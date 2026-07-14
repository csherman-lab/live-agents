import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three/webgpu';
import { getAgentSet } from '../../data/agents';
import { useTeamStore } from '../../integration/store/teamStore';
import { DRACO_LIB_PATH } from '../constants';
import { NavMeshManager } from '../pathfinding/NavMeshManager';
import { PoiManager } from './PoiManager';

export class WorldManager {
  private office: THREE.Group | null = null;

  constructor(
    private scene: THREE.Scene,
    private navMesh: NavMeshManager,
    private poiManager: PoiManager
  ) {}

  public async load(): Promise<void> {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_LIB_PATH);
    loader.setDRACOLoader(dracoLoader);
    const officeGltf = await loader.loadAsync(
      `${import.meta.env.BASE_URL}models/office.glb?v=160`
    );
    this.office = officeGltf.scene;
    this.scene.add(this.office);

    // Get current AgentSet color
    const { selectedAgentSetId, customSystems } = useTeamStore.getState();
    const activeSet = getAgentSet(selectedAgentSetId, customSystems);
    const themeColor = new THREE.Color(activeSet.color);

    // Extract NavMesh and setup
    this.office.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();

        if (name.includes('navmesh')) {
          this.navMesh.loadFromGeometry(mesh.geometry);
          mesh.visible = false;
        } else {
          // Floor + large props receive; skip cast on tiny clutter (~0.05m) to cut shadow casters
          mesh.receiveShadow = true;
          mesh.castShadow = this.shouldCastShadow(mesh);

          // WebGPU MeshStandardNodeMaterial — one NodeMaterial per GLB slot
          // so joined meshes (PC white/screen/metal, plant pot/plant/leaf) keep contrast
          if (mesh.material) {
            const oldMats = this.getMaterialSlots(mesh);
            const newMats = oldMats.map((oldMat) =>
              this.createOfficeMaterial(name, oldMat, themeColor)
            );
            mesh.material = newMats.length === 1 ? newMats[0] : newMats;
          }
        }
      }
    });

    // Extract Points of Interest
    this.poiManager.loadFromGlb(this.office);
  }

  public updateThemeColor(color: string): void {
    if (!this.office) return;

    const themeColor = new THREE.Color(color);

    this.office.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();
        if (!mesh.material) return;

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const tinted =
            name.startsWith('colored') || (mat as any).userData?.themeTint === true;
          if (tinted && (mat as any).color) {
            (mat as any).color.copy(themeColor);
          }
        }
      }
    });
  }

  /** Tiny clutter casts negligible shadow — skip to cut shadow-map draw calls. */
  private shouldCastShadow(mesh: THREE.Mesh): boolean {
    const geometry = mesh.geometry;
    if (!geometry.boundingSphere) {
      geometry.computeBoundingSphere();
    }
    const radius = geometry.boundingSphere?.radius ?? 1;
    const scale = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
    return radius * scale >= 0.05;
  }

  /** Normalize mesh.material to a slot list (multi-material joins → array). */
  private getMaterialSlots(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      return mat as THREE.MeshStandardMaterial[];
    }
    // Geometry groups without an array still share one material
    return mat ? [mat as THREE.MeshStandardMaterial] : [];
  }

  /**
   * Material rules by slot material name (preferred), then mesh name:
   * - screen → near-black + low emissive (survives ACES high-key)
   * - leaf / plant → saturated foliage greens
   * - pot / paper / metal → GLB colors (metal keeps metalness)
   * - floor / grid → neutral mid-grey (Wave 18 edge pop vs white furniture)
   * - accent / colored-* → team theme color
   * - everything else (white furniture) → soft white, mid roughness (not chalk)
   */
  private createOfficeMaterial(
    meshName: string,
    oldMat: THREE.MeshStandardMaterial,
    themeColor: THREE.Color
  ): THREE.MeshStandardNodeMaterial {
    const slot = (oldMat.name ?? '').toLowerCase();
    const mesh = meshName.toLowerCase();
    // Prefer slot name for joined multi-material meshes; fall back to mesh name
    const hint = slot || mesh;

    const isColored =
      mesh.startsWith('colored') ||
      hint.includes('accent') ||
      hint.includes('colored');
    const isFloor = hint.includes('floor');
    const isGrid = hint.includes('grid');
    const isScreen = hint.includes('screen');
    const isLeaf = hint.includes('leaf');
    const isPlant =
      hint.includes('plant') ||
      hint.includes('soil') ||
      hint.includes('stem');
    const isPot = hint.includes('pot');
    const isMetal = hint.includes('metal');
    const isPaper = hint.includes('paper');
    const isFoliage = isLeaf || isPlant;
    const isLampGlow = hint.includes('emit') && !isScreen;

    if (isColored) {
      const mat = new THREE.MeshStandardNodeMaterial({
        color: themeColor,
        map: oldMat.map,
        roughness: 0.48,
        metalness: 0.04,
      });
      mat.userData.themeTint = true;
      return mat;
    }

    if (isFloor) {
      // Wave 18: neutral mid-grey (not blue/green carpet) so white desk edges pop at iso
      return new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(0.52, 0.52, 0.525),
        map: oldMat.map,
        roughness: 0.98,
        metalness: 0,
      });
    }

    if (isGrid) {
      return new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(0.32, 0.32, 0.325),
        map: oldMat.map,
        roughness: 0.98,
        metalness: 0,
      });
    }

    if (isScreen) {
      const mat = new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(0.03, 0.035, 0.045),
        map: oldMat.map,
        roughness: 0.28,
        metalness: 0.1,
      });
      mat.emissive = new THREE.Color(0.04, 0.1, 0.18);
      mat.emissiveIntensity = 0.18;
      return mat;
    }

    if (isLeaf) {
      return new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(0.14, 0.58, 0.24),
        map: oldMat.map,
        roughness: 0.58,
        metalness: 0.02,
      });
    }

    if (isPlant) {
      return new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(0.1, 0.42, 0.2),
        map: oldMat.map,
        roughness: 0.8,
        metalness: 0.02,
      });
    }

    if (isPot || isPaper) {
      return new THREE.MeshStandardNodeMaterial({
        color: oldMat.color,
        map: oldMat.map,
        roughness: oldMat.roughness ?? 0.7,
        metalness: 0.02,
      });
    }

    if (isMetal) {
      return new THREE.MeshStandardNodeMaterial({
        color: oldMat.color,
        map: oldMat.map,
        roughness: oldMat.roughness ?? 0.3,
        metalness: oldMat.metalness ?? 0.7,
      });
    }

    if (isLampGlow) {
      const mat = new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(0.96, 0.96, 0.97),
        map: oldMat.map,
        roughness: 0.5,
        metalness: 0.02,
      });
      if (oldMat.emissive) {
        mat.emissive.copy(oldMat.emissive);
        mat.emissiveIntensity = Math.min(oldMat.emissiveIntensity ?? 1.2, 1.6);
      }
      return mat;
    }

    // White furniture — bright vs mid-grey floor; mid roughness avoids chalk blowout
    return new THREE.MeshStandardNodeMaterial({
      color: new THREE.Color(0.96, 0.96, 0.97),
      map: oldMat.map,
      roughness: 0.62,
      metalness: 0.02,
    });
  }

  public getOffice(): THREE.Group | null {
    return this.office;
  }
}
