
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  atan,
  attribute, cos, float, Fn, If, instanceIndex, mat3,
  mat4, mix, positionLocal, sin, storage, texture, uint, uniform, uv, vec2, vec3,
  vec4
} from 'three/tsl';
import * as THREE from 'three/webgpu';
import { getAllAgents, getAllCharacters } from '../../data/agents';
import { getActiveAgentSet } from '../../integration/store/teamStore';
import { AgentBehavior, AnimationName, ExpressionKey } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { ExpressionBuffer } from '../behavior/ExpressionBuffer';
import {
  AGENT_MOVE_GOTO_MULT,
  AGENT_MOVE_SPEED,
  AGENT_WAYPOINT_RADIUS,
  ATLAS_COLS,
  ATLAS_ROWS,
  DRACO_LIB_PATH,
} from '../constants';
import { PoiManager } from '../world/PoiManager';

export class CharacterManager {
  private instanceCount = getAllAgents(getActiveAgentSet()).length + 1;
  private poiManager: PoiManager | null = null;

  // Compute Buffers (GPU)
  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private accessoryAttribute: THREE.InstancedBufferAttribute | null = null;
  private scaleAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  // Agent state buffer (CPU+GPU): waypoint + behavior state per instance
  private agentStateBuffer: AgentStateBuffer | null = null;

  // Expression buffer (CPU+GPU): eye and mouth UV offsets per instance
  private expressionBuffer: ExpressionBuffer | null = null;

  // CPU-side mirror of GPU positions (updated via GPU readback each frame)
  private debugPosArray: Float32Array | null = null;

  // Track global time for animation resets (also drives the paused-safe shader uTime uniform)
  private currentTime = 0;
  private uTime = uniform(0);

  // Logic Nodes
  private computeNode: any;

  // Assets & Objects
  private instancedMeshes: THREE.Mesh[] = [];
  private meshData: { name: string; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[] = [];
  private eyesAtlasMap: THREE.Texture | null = null;
  private mouthAtlasMap: THREE.Texture | null = null;

  // Animation Data
  private animationsMeta: { [key: string]: { offset: number; numFrames: number; duration: number; index: number } } = {};
  private bakedAnimationsBuffer: THREE.StorageBufferAttribute | null = null;
  private metaBuffer: THREE.StorageBufferAttribute | null = null;
  private numBones = 0;
  private headBoneIndex = -1;

  // Uniforms
  private uSpeed = uniform(AGENT_MOVE_SPEED);

  public isLoaded = false;

  constructor(private scene: THREE.Scene) { }

  public setPoiManager(poiManager: PoiManager) {
    this.poiManager = poiManager;
  }

  public async load() {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_LIB_PATH);
    loader.setDRACOLoader(dracoLoader);
    try {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/character.glb?v=187`);
      // Face atlases: white eye whites + black pupils + thick smile. Cache-bust beats GLB embeds.
      const texLoader = new THREE.TextureLoader();
      const loadFaceAtlas = async (file: string) => {
        const map = await texLoader.loadAsync(
          `${import.meta.env.BASE_URL}models/textures/${file}?v=187`,
        );
        map.colorSpace = THREE.SRGBColorSpace;
        map.flipY = false; // match glTF UV space
        map.generateMipmaps = false;
        map.minFilter = THREE.LinearFilter;
        map.magFilter = THREE.LinearFilter;
        map.needsUpdate = true;
        return map;
      };
      this.eyesAtlasMap = await loadFaceAtlas('eyes-atlas-color.png');
      this.mouthAtlasMap = await loadFaceAtlas('mouth-atlas-color.png');
      const model = gltf.scene;

      const skinnedMeshes: THREE.SkinnedMesh[] = [];
      const allMeshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if ((child as any).isMesh) {
          allMeshes.push(child as THREE.Mesh);
          if ((child as any).isSkinnedMesh) {
            skinnedMeshes.push(child as THREE.SkinnedMesh);
          }
        }
      });

      if (allMeshes.length === 0) {
        console.warn("CharacterManager: No meshes found.");
        return;
      }

      this.meshData = allMeshes.map(m => ({
        name: m.name,
        geometry: m.geometry,
        material: m.material as THREE.MeshStandardMaterial
      }));

      // Wave 17: keep Blender-baked object-wide face UVs (home cell col0/row3).
      // Do NOT runtime-reproject with XZ — after glTF, height is +Y; XZ only spanned
      // shell depth and collapsed atlas V so mouths read as hairlines at iso.

      const firstSkinnedMesh =
        skinnedMeshes.find(m => m.name.toLowerCase().includes('body')) || skinnedMeshes[0];
      if (firstSkinnedMesh) {
        this.numBones = firstSkinnedMesh.skeleton.bones.length;
        const headBone = firstSkinnedMesh.skeleton.bones.find(b => b.name.toLowerCase() === 'head');
        this.headBoneIndex = headBone ? firstSkinnedMesh.skeleton.bones.indexOf(headBone) : -1;
      }

      const animations = gltf.animations;
      const animNames = Object.values(AnimationName);
      const bakedDataList: Float32Array[] = [];
      const metaArray = new Float32Array(animNames.length * 4);
      let currentOffset = 0;

      animNames.forEach((name, i) => {
        let clip = animations.find(a => a.name === name);
        // Fallback for essential animations
        if (!clip) {
          if (name === AnimationName.IDLE) clip = animations[0];
          else clip = animations.find(a => a.name === AnimationName.IDLE) || animations[0];
        }

        const baked = this.bakeAnimation(firstSkinnedMesh, clip!, model);
        bakedDataList.push(baked.data);

        this.animationsMeta[name] = {
          offset: currentOffset,
          numFrames: baked.numFrames,
          duration: baked.duration,
          index: i
        };

        metaArray[i * 4 + 0] = currentOffset;
        metaArray[i * 4 + 1] = baked.numFrames;
        metaArray[i * 4 + 2] = baked.duration;
        metaArray[i * 4 + 3] = 0;

        currentOffset += baked.numFrames * this.numBones;
      });

      const totalSize = bakedDataList.reduce((acc, data) => acc + data.length, 0);
      const combinedData = new Float32Array(totalSize);
      let seek = 0;
      for (const data of bakedDataList) {
        combinedData.set(data, seek);
        seek += data.length;
      }

      this.bakedAnimationsBuffer = new THREE.StorageBufferAttribute(combinedData, 16);
      this.metaBuffer = new THREE.StorageBufferAttribute(metaArray, 4);

      this.initInstances();
      this.isLoaded = true;
    } catch (err) {
      console.error("Failed to load character:", err);
    }
  }

  public setInstanceCount(count: number) {
    if (this.instanceCount === count) return;
    this.instanceCount = count;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  /**
   * Planar-project face shell → one atlas cell using object-wide face-plane bounds.
   * Fixes per-triangle UV tiling that made faces read as static/QR at iso.
   *
   * Wave 17: after glTF, face height lives on +Y (Blender +Z). Projecting XZ mapped
   * only shell depth → atlas V collapsed to a hairline. Use XY (width × height).
   */
  private reprojectFaceAtlasUVs(
    geometry: THREE.BufferGeometry,
    col: number,
    row: number,
    zoom = 1.0,
  ) {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    if (!pos || !uv) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const dx = Math.max(maxX - minX, 1e-6);
    const dy = Math.max(maxY - minY, 1e-6);

    let u0 = col / ATLAS_COLS;
    let u1 = (col + 1) / ATLAS_COLS;
    let v1 = 1.0 - row / ATLAS_ROWS;
    let v0 = 1.0 - (row + 1) / ATLAS_ROWS;
    if (zoom > 1.0) {
      const midU = (u0 + u1) * 0.5;
      const midV = (v0 + v1) * 0.5;
      const halfU = ((u1 - u0) * 0.5) / zoom;
      const halfV = ((v1 - v0) * 0.5) / zoom;
      u0 = midU - halfU;
      u1 = midU + halfU;
      v0 = midV - halfV;
      v1 = midV + halfV;
    }

    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - minX) / dx;
      // Face height +Y → atlas V (match Blender Z-up bake intent after glTF axis convert).
      const v = (pos.getY(i) - minY) / dy;
      uv.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0));
    }
    uv.needsUpdate = true;
  }

  /**
   * Reads back the GPU position buffer to CPU.
   * Must be called after renderer.compute() each frame.
   * Returns the updated positions (1-frame GPU lag).
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    if (!this.posAttribute) return null;
    try {
      const buffer = await renderer.getArrayBufferAsync(this.posAttribute);
      this.debugPosArray = new Float32Array(buffer);
      // Keep the CPU-side attribute array in sync so setPosition doesn't upload stale data
      (this.posAttribute.array as Float32Array).set(this.debugPosArray);
    } catch {
      // WebGPU readback not available – fall back to stale data
    }
    return this.debugPosArray;
  }

  public update(delta: number, renderer: any) {
    this.currentTime += delta;
    this.uTime.value = this.currentTime;

    if (this.expressionBuffer) {
      this.expressionBuffer.update(delta);
    }
    if (this.computeNode) {
      renderer.compute(this.computeNode);
    }
  }

  private cleanupInstances() {
    for (const mesh of this.instancedMeshes) {
      this.scene.remove(mesh);
    }
    this.instancedMeshes = [];
    this.computeNode = null;
    this.expressionBuffer = null;
  }

  private initInstances() {
    if (this.meshData.length === 0) return;

    const posArray = new Float32Array(this.instanceCount * 4);
    const velArray = new Float32Array(this.instanceCount * 4);
    const colorArray = new Float32Array(this.instanceCount * 3);
    const accessoryArray = new Float32Array(this.instanceCount);
    const scaleArray = new Float32Array(this.instanceCount);

    const tempColor = new THREE.Color();
    const spawnRadius = 8; // Default spawn area

    const spawnPois = this.poiManager?.getFreePoisByPrefix('spawn') || [];
    let spawnIndex = 0;

    const agentsBuffer = []; // Temporary to store POIs for orientation

    const system = getActiveAgentSet();
    const allCharacters = getAllCharacters(system);

    // Accessory rules (art-direction.md + readable silhouette):
    // 0=None (user), 2=Cap (lead — always visible), specialists alternate 1=Headphones / 2=Cap
    let specialistSlot = 0;

    for (let i = 0; i < this.instanceCount; i++) {
      const agentNode = allCharacters.find(a => a.index === i) || system.leadAgent;
      const colorOverride = agentNode.color;
      tempColor.set(colorOverride);

      if (i === system.user.index) {
        // Player spawns at (0,0,0)
        posArray[i * 4 + 0] = 0;
        posArray[i * 4 + 2] = 0;
        agentsBuffer[i] = null;
      } else {
        const poi = spawnPois[spawnIndex % spawnPois.length];
        if (poi) {
          this.poiManager?.occupy(poi.id, i);
          posArray[i * 4 + 0] = poi.position.x;
          posArray[i * 4 + 2] = poi.position.z;
          spawnIndex++;
          agentsBuffer[i] = poi;
        } else {
          posArray[i * 4 + 0] = (Math.random() - 0.5) * spawnRadius * 2;
          posArray[i * 4 + 2] = (Math.random() - 0.5) * spawnRadius * 2;
          agentsBuffer[i] = null;
        }
        posArray[i * 4 + 3] = 1;
        velArray[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
        velArray[i * 4 + 2] = (Math.random() - 0.5) * 0.1;
      }

      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;

      if (i === system.user.index) {
        accessoryArray[i] = 0;
      } else if (i === system.leadAgent.index) {
        accessoryArray[i] = 2; // Cap — team lead signature (art-direction)
      } else {
        // Specialists: headphones, cap, headphones, …
        accessoryArray[i] = (specialistSlot % 2 === 0) ? 1 : 2;
        specialistSlot++;
      }

      // Cute short/tall variety: deterministic uniform scale in [0.90, 1.12] from agent index
      scaleArray[i] = 0.90 + (((i * 37 + 11) % 100) / 99) * 0.22;
    }


    this.debugPosArray = new Float32Array(posArray);

    this.posAttribute = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.accessoryAttribute = new THREE.InstancedBufferAttribute(accessoryArray, 1);
    this.scaleAttribute = new THREE.InstancedBufferAttribute(scaleArray, 1);

    this.positionStorage = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage = storage(this.velAttribute, 'vec4', this.instanceCount);

    // Physics & state buffer — all start at mode 0 (IDLE)
    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    for (let i = 0; i < this.instanceCount; i++) {
      this.setPhysicsMode(i, AgentBehavior.IDLE);

      // Initial animation: start with a random negative time so they are out of sync
      const meta = this.animationsMeta[AnimationName.IDLE];
      if (meta) {
        this.agentStateBuffer.setAnimation(i, meta.index, true, -Math.random() * 10);
      }

      // APPLY POI ORIENTATION
      const poi = agentsBuffer[i];
      if (poi && (poi.id.includes('spawn') || poi.id.includes('sit'))) {
        this.setOrientation(i, poi.quaternion);
      }
    }

    this.expressionBuffer = new ExpressionBuffer(this.instanceCount);

    // Role-flavored idle faces: lead slightly happier, user neutral, specialists vary
    for (let i = 0; i < this.instanceCount; i++) {
      if (i === system.user.index) {
        this.expressionBuffer.setExpression(i, 'neutral');
      } else if (i === system.leadAgent.index) {
        this.expressionBuffer.setExpression(i, 'happy');
      }
      // Specialists keep ExpressionBuffer's per-index idle personality seed
    }

    this.initComputeNode();
    this.createInstancedMesh();
  }

  private initComputeNode() {
    const agentStorage = this.agentStateBuffer!.storageNode;

    this.computeNode = Fn(() => {
      const index = instanceIndex;

      const posElement = this.positionStorage.element(index);
      const velElement = this.velocityStorage.element(index);
      const agentData = agentStorage.element(index.mul(2));   // Buffer 0: (wpX, anim, wpZ, state)
      const agentState = agentData.w;                         // float: 0=IDLE 1=GOTO 2=SEATED

      const pos = posElement.xyz.toVar();

      // ── Physical Logic ──────────────────────────────────────

      // GOTO = 1  |  IDLE = 0  |  SEATED = 2 (treated as IDLE on GPU)
      const isGoto = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));

      If(isGoto, () => {
        const waypointXZ = vec3(agentData.x, float(0), agentData.z);
        const toTarget = waypointXZ.sub(pos);
        const dist = toTarget.length();
        If(dist.greaterThan(float(AGENT_WAYPOINT_RADIUS)), () => {
          const gotoVel = toTarget.normalize().mul(this.uSpeed.mul(float(AGENT_MOVE_GOTO_MULT)));
          velElement.assign(vec4(gotoVel, 0.0));
          posElement.assign(vec4(pos.add(gotoVel), 1.0));
        }).Else(() => {
          // Snap X,Z to exact waypoint — CPU will transition to IDLE this frame
          posElement.assign(vec4(agentData.x, pos.y, agentData.z, 1.0));
        });

      }).Else(() => {
        // ── IDLE / SEATED (0 or 2) ───────────────────────────────
        // Zero velocity so the vertex shader uses facingOverride (setFacing/setOrientation)
        // instead of the stale walk velocity for rotation.
        // SEATED (2) is handled identically on the GPU — the semantic difference is CPU-only.
        velElement.assign(vec4(float(0), float(0), float(0), float(0)));
        posElement.assign(vec4(pos, 1.0));
      });

    })().compute(this.instanceCount);
  }

  private createInstancedMesh() {
    // Reorder meshData: Body FIRST, then features (eyes/mouth)
    // This ensures body writes to depth buffer before features are drawn over it.
    const sortedMeshData = [...this.meshData].sort((a, b) => {
      const aIsBody = a.name.toLowerCase().includes('body');
      const bIsBody = b.name.toLowerCase().includes('body');
      if (aIsBody && !bIsBody) return -1;
      if (!aIsBody && bIsBody) return 1;
      return 0;
    });

    for (const { name, geometry, material: baseMaterial } of sortedMeshData) {
      const instancedGeometry = new THREE.InstancedBufferGeometry();
      instancedGeometry.copy(geometry as any);
      instancedGeometry.instanceCount = this.instanceCount;

      const isEyes = name.toLowerCase().includes('eyes');
      const isMouth = name.toLowerCase().includes('mouth');
      const isFace = isEyes || isMouth;
      const isHeadphones = name.toLowerCase().includes('headphones');
      const isCap = name.toLowerCase().includes('cap');
      const isAccessory = isHeadphones || isCap;
      const isBody = name.toLowerCase().includes('body');

      // Faces must not carry instanceColor — Three auto-tints and turns sclera team-colored.
      if (!isFace) {
        instancedGeometry.setAttribute('instanceColor', this.colorAttribute);
      }
      if (this.accessoryAttribute) instancedGeometry.setAttribute('accessoryType', this.accessoryAttribute);
      if (this.scaleAttribute) instancedGeometry.setAttribute('instanceScale', this.scaleAttribute);

      // Faces: MeshStandard but lighting-proof — black albedo + full atlas emissive
      // (MeshBasic + alpha was still reading as dark plates under ACES at iso).
      const material = new THREE.MeshStandardNodeMaterial();

      const instanceColor = isFace ? vec3(1, 1, 1) : attribute('instanceColor', 'vec3');
      let map = (baseMaterial as any).map as THREE.Texture | null;
      // Prefer runtime atlases when loaded; otherwise GLB-embedded maps (correct flipY).
      if (isEyes && this.eyesAtlasMap) map = this.eyesAtlasMap;
      if (isMouth && this.mouthAtlasMap) map = this.mouthAtlasMap;
      // Atlas maps must stay in sRGB; no mipmaps (mips → gray “dark screens” at iso).
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.generateMipmaps = false;
        // Linear (no mips): smooth ovals at iso; Nearest looked like pixel noise on the face card
        map.minFilter = THREE.LinearFilter;
        map.magFilter = THREE.LinearFilter;
        map.needsUpdate = true;
      }

      const expressionData = this.expressionBuffer!.storageNode.element(instanceIndex);
      const animParams = this.agentStateBuffer!.storageNode.element(instanceIndex.mul(2).add(1));
      const instanceAlpha = animParams.z;
      const accessoryType = attribute('accessoryType', 'float');

      if (isEyes) {
        // Eyes UVs baked to open-dots (0,0). Relative xy offsets for blink/happy/etc.
        material.uvNode = uv().add(vec2(expressionData.x, expressionData.y));
      } else if (isMouth) {
        // Mouth UVs baked to closed-smile cell. Relative zw offsets select speaking cells.
        material.uvNode = uv().add(vec2(expressionData.z, expressionData.w));
      }

      material.transparent = true;

      if (isHeadphones) {
        material.opacityNode = accessoryType.equal(float(1)).select(instanceAlpha, float(0));
      } else if (isCap) {
        material.opacityNode = accessoryType.equal(float(2)).select(instanceAlpha, float(0));
      }

      if (isBody || isAccessory) {
        // Soft matte vinyl / clay-toy read for cute workers
        material.roughness = 0.68;
        material.metalness = 0.02;
        material.depthWrite = true;
        material.depthTest = true;

        const baseAlpha = isAccessory ? material.opacityNode : (map ? texture(map).a.mul(instanceAlpha) : instanceAlpha);

        if (isHeadphones) {
          // Near-black plastic cups — high contrast vs body hue (Wave 10 iso silhouette)
          const hpColor = map ? texture(map).rgb.mul(vec3(0.08, 0.08, 0.09)) : vec3(0.07, 0.07, 0.08);
          material.colorNode = vec4(hpColor, baseAlpha);
        } else if (isCap) {
          // Soft team-tinted beanie (not cream-white — that read as a white “face plate”)
          const softTint = mix(vec3(0.92, 0.9, 0.88), instanceColor, float(0.55));
          const capRgb = map ? texture(map).rgb.mul(softTint) : softTint;
          material.colorNode = vec4(capRgb, baseAlpha);
        } else if (map) {
          const texColor = texture(map);
          material.colorNode = vec4(texColor.rgb.mul(instanceColor), baseAlpha);
        } else {
          material.colorNode = vec4(instanceColor, baseAlpha);
        }
      } else if (isFace) {
        // Painted-on-vinyl ink: transparent atlas bg, only dark features draw.
        // depthTest OFF — curved face shells otherwise Z-fight the head and hide one eye
        // (reads as a permanent wink at iso). Ink-only alpha keeps them from looking like cards.
        material.roughness = 0.75;
        material.metalness = 0;
        material.depthWrite = false;
        material.depthTest = false;
        material.side = THREE.DoubleSide;
        material.alphaTest = 0.08;

        if (map) {
          map.minFilter = THREE.LinearFilter;
          map.magFilter = THREE.LinearFilter;
          map.needsUpdate = true;

          const texColor = texture(map);
          const faceAlpha = texColor.a.mul(instanceAlpha);
          // Atlas RGB: white sclera + black pupils/smile (transparent bg — no full face plate).
          material.colorNode = vec4(texColor.rgb, faceAlpha);
          material.opacityNode = faceAlpha;
          // Keep whites bright under ACES; ink stays dark.
          material.emissiveNode = texColor.rgb.mul(float(0.65));
        } else {
          material.opacityNode = float(0);
        }
      } else {
        // Unknown non-body mesh: keep visible but don't steal face treatment
        material.roughness = 0.6;
        material.metalness = 0.04;
        material.depthWrite = false;
        material.depthTest = true;
        if (map) {
          const texColor = texture(map);
          material.colorNode = vec4(texColor.rgb, texColor.a.mul(instanceAlpha));
          material.opacityNode = texColor.a.mul(instanceAlpha);
        } else {
          material.opacityNode = float(0);
        }
      }

      // Eyes/mouth/cap/headphones must follow the baked skeleton's head bone.
      // GLB skin indices can disagree with the body skeleton used for bakeAnimation,
      // which made face cards float beside heads (and accessories drift).
      if ((isFace || isHeadphones || isCap) && this.headBoneIndex !== -1) {
        const skinIndices = new Float32Array(geometry.attributes.position.count * 4).fill(this.headBoneIndex);
        const skinWeights = new Float32Array(geometry.attributes.position.count * 4).fill(0);
        for (let i = 0; i < geometry.attributes.position.count; i++) skinWeights[i * 4] = 1.0;
        instancedGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
        instancedGeometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));
      }

      const isVisible = isHeadphones ? accessoryType.equal(float(1)) : (isCap ? accessoryType.equal(float(2)) : float(1));
      const vertexNode = this.createVertexNode(isVisible.and(instanceAlpha.greaterThan(0)));
      material.positionNode = vertexNode;
      (material as any).castShadowPositionNode = vertexNode;

      const instancedMesh = new THREE.Mesh(instancedGeometry, material);
      instancedMesh.frustumCulled = false;
      // Face cards must not darken under self-shadow; body/accessories still cast+receive
      instancedMesh.castShadow = !isFace;
      instancedMesh.receiveShadow = !isFace;
      // Body 0 → accessories 1 → eyes/mouth 10 (decals draw last over vinyl)
      if (isFace) {
        instancedMesh.renderOrder = 10;
      } else {
        instancedMesh.renderOrder = isBody ? 0 : 1;
      }
      this.scene.add(instancedMesh);
      this.instancedMeshes.push(instancedMesh);
    }
  }

  private createVertexNode(isVisibleNode: any) {
    return Fn(() => {
      const instancePos = this.positionStorage.element(instanceIndex).xyz;
      const rawVel = this.velocityStorage.element(instanceIndex).xyz;
      const agentData = this.agentStateBuffer!.storageNode.element(instanceIndex.mul(2));
      const animParams = this.agentStateBuffer!.storageNode.element(instanceIndex.mul(2).add(1));

      // 1. Determine local rotation (facing)
      const isMoving = rawVel.length().greaterThan(float(0.01));
      const facingOverride = vec3(agentData.x, float(0), agentData.z);
      const hasFacingOverride = facingOverride.length().greaterThan(float(0));

      const facing = vec3(0, 0, 1).toVar(); // Default: Forward

      If(isMoving, () => {
        facing.assign(rawVel);
      }).ElseIf(hasFacingOverride, () => {
        facing.assign(facingOverride);
      });

      const angle = atan(facing.z, facing.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedAnimationsBuffer && this.metaBuffer) {
        const animBuffer = storage(this.bakedAnimationsBuffer, 'mat4', this.bakedAnimationsBuffer.count);
        const metaStorage = storage(this.metaBuffer, 'vec4', this.metaBuffer.count);

        const animIndex = agentData.y.toUint();

        const meta = metaStorage.element(animIndex);
        const animOffset = uint(meta.x);
        const numFrames = uint(meta.y);
        const duration = float(meta.z);

        const startTime = animParams.x;
        const loopMode = animParams.y;

        const animTime = this.uTime.sub(startTime).max(0);
        const t = loopMode.greaterThan(0.5) ? animTime.div(duration).fract() : animTime.div(duration).clamp(0, 1);

        // Fractional frame index → lerp bone matrices between adjacent baked frames
        const frameFloat = t.mul(numFrames.toFloat());
        const lastFrame = numFrames.sub(uint(1));
        const frame0 = frameFloat.floor().toUint().min(lastFrame);
        const frame1Candidate = frame0.add(uint(1));
        // Looping clips wrap N→0; one-shots hold the final pose
        const frame1 = loopMode.greaterThan(0.5).select(
          frame1Candidate.mod(numFrames),
          frame1Candidate.min(lastFrame)
        );
        const frameFrac = frameFloat.fract();

        const skinIndex = attribute('skinIndex');
        const skinWeight = attribute('skinWeight');
        const skinMat = mat4(0).toVar();

        const addInfluence = (boneIdxNode: any, weightNode: any) => {
          If(weightNode.greaterThan(0), () => {
            const boneIdx = boneIdxNode.toUint();
            const stride = uint(this.numBones);
            const m0 = animBuffer.element(animOffset.add(frame0.mul(stride)).add(boneIdx));
            const m1 = animBuffer.element(animOffset.add(frame1.mul(stride)).add(boneIdx));
            // Element-wise mat4 lerp (WGSL mix() is float/vec only)
            const boneMat = m0.mul(float(1).sub(frameFrac)).add(m1.mul(frameFrac));
            skinMat.addAssign(boneMat.mul(weightNode));
          });
        };

        addInfluence(skinIndex.x, skinWeight.x);
        addInfluence(skinIndex.y, skinWeight.y);
        addInfluence(skinIndex.z, skinWeight.z);
        addInfluence(skinIndex.w, skinWeight.w);

        finalPosition.assign(skinMat.mul(vec4(positionLocal, 1.0)).xyz);
      }

      const vertexScale = isVisibleNode.select(float(1), float(0));
      const instanceScale = attribute('instanceScale', 'float');
      return rotationMat.mul(finalPosition.mul(vertexScale.mul(instanceScale))).add(instancePos);
    })();
  }

  private bakeAnimation(mesh: THREE.SkinnedMesh, clip: THREE.AnimationClip, root: THREE.Object3D) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const skeleton = mesh.skeleton;
    const duration = clip.duration;
    const numFrames = Math.ceil(duration * 60);
    const numBones = skeleton.bones.length;
    const data = new Float32Array(numFrames * numBones * 16);
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime((f / numFrames) * duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < numBones; b++) {
        const i = (f * numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[i + k] = skeleton.boneMatrices[b * 16 + k];
      }
    }
    return {
      data,
      numFrames,
      duration,
    };
  }

  public getCount() { return this.instanceCount; }

  /** Exposes the agent state buffer so BehaviorManager can read/write states. */
  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.agentStateBuffer;
  }

  /** Returns the current CPU-tracked positions buffer (vec4 stride). Updated each simulateOnCPU call. */
  public getCPUPositions(): Float32Array | null {
    return this.debugPosArray;
  }

  /** Returns the world position of a single character from the CPU buffer. */
  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.debugPosArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.debugPosArray[i], this.debugPosArray[i + 1], this.debugPosArray[i + 2]);
  }

  public setPhysicsMode(index: number, mode: AgentBehavior) {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return;
    this.agentStateBuffer.setState(index, mode);
  }

  /** Teleport an agent to an exact world position by writing directly to the CPU→GPU buffer. */
  public setPosition(index: number, position: THREE.Vector3): void {
    if (!this.posAttribute || index < 0 || index >= this.instanceCount) return;
    const arr = this.posAttribute.array as Float32Array;
    arr[index * 4 + 0] = position.x;
    arr[index * 4 + 1] = position.y;
    arr[index * 4 + 2] = position.z;
    this.posAttribute.needsUpdate = true;
    // Also update the CPU mirror so getCPUPosition() is immediately accurate
    if (this.debugPosArray) {
      this.debugPosArray[index * 4 + 0] = position.x;
      this.debugPosArray[index * 4 + 1] = position.y;
      this.debugPosArray[index * 4 + 2] = position.z;
    }
  }

  /** Teleport an agent and zero their current velocity to avoid sliding. */
  public setPositionAndZeroVelocity(index: number, position: THREE.Vector3): void {
    this.setPosition(index, position);
    if (this.velAttribute && index >= 0 && index < this.instanceCount) {
      const arr = this.velAttribute.array as Float32Array;
      arr[index * 4 + 0] = 0;
      arr[index * 4 + 1] = 0;
      arr[index * 4 + 2] = 0;
      arr[index * 4 + 3] = 0;
      this.velAttribute.needsUpdate = true;
    }
  }

  /** Force a specific facing direction when IDLE. */
  public setFacing(index: number, x: number, z: number) {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return;
    this.agentStateBuffer.setFacing(index, x, z);
  }

  /** Force a specific orientation based on a quaternion. */
  public setOrientation(index: number, quaternion: THREE.Quaternion) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    this.setFacing(index, forward.x, forward.z);
  }

  public getAgentState(index: number): AgentBehavior {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return AgentBehavior.IDLE;
    return this.agentStateBuffer.getState(index) as AgentBehavior;
  }

  public setAnimation(index: number, name: AnimationName, loop: boolean = true) {
    if (this.agentStateBuffer && index >= 0 && index < this.instanceCount) {
      const meta = this.animationsMeta[name];
      if (meta) {
        this.agentStateBuffer.setAnimation(index, meta.index, loop, this.currentTime);
      }
    }
  }

  public getAnimationIndex(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getAnimation(index);
  }

  public getAnimationMeta(name: AnimationName) {
    return this.animationsMeta[name];
  }

  /** Returns the baked clip duration in seconds. Returns 1.0 if the animation is not found. */
  public getAnimationDuration(name: AnimationName): number {
    return this.animationsMeta[name]?.duration ?? 1.0;
  }

  public setExpression(index: number, name: ExpressionKey) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setExpression(index, name);
    }
  }

  public setSpeaking(index: number, isSpeaking: boolean) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setSpeaking(index, isSpeaking);
    }
    // Note: External logic should handle TALK/IDLE animations
  }

  public setColors() {
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
