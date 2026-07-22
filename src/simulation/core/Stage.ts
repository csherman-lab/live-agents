import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three/webgpu';
import {
  CAMERA_CHEST_Y,
  CAMERA_DIST_DAMP,
  CAMERA_FOLLOW_DAMP,
  CAMERA_LIMIT_DAMP,
  CAMERA_MAX_DELTA,
  CHAT_CAMERA_DIST,
  CHAT_CAMERA_MAX_DIST,
  CHAT_CAMERA_MIN_DIST,
  SCENE_BACKGROUND_COLOR,
} from '../constants';

export class Stage {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  private followTarget: THREE.Vector3 | null = null;
  /** Soft iso look-at: slight bias off origin so desks + lounge read like office-preview.jpg */
  private readonly defaultTarget = new THREE.Vector3(0.2, 0.55, 0.15);

  private isChatting = false;
  private playerMoving = false;
  private chatPlayer: THREE.Vector3 | null = null;
  private chatNpc: THREE.Vector3 | null = null;

  private readonly _lookAt = new THREE.Vector3();
  private readonly _offset = new THREE.Vector3();
  private readonly _spherical = new THREE.Spherical();

  // Free-roam orbit limits — closer framing so limbs/faces read; zoom-in to inspect agents.
  private static readonly ROAM_MIN_DIST = 8;
  private static readonly ROAM_MAX_DIST = 16;
  private static readonly ROAM_MIN_POLAR = Math.PI / 3.6; // ~50°
  private static readonly ROAM_MAX_POLAR = Math.PI / 2.5; // ~72°

  constructor(rendererElement: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    // Wave 15 stranger framing: slight pullback so south-edge agents + bubbles stay in view
    // (was 7.3/7.2/8.7 → dist ≈ 13.0; now ≈ 14.6).
    this.camera.position.set(8.2, 8.0, 9.7);

    this.controls = new OrbitControls(this.camera, rendererElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.8;
    this.controls.enableRotate = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.minPolarAngle = Stage.ROAM_MIN_POLAR;
    this.controls.maxPolarAngle = Stage.ROAM_MAX_POLAR;
    this.controls.minDistance = Stage.ROAM_MIN_DIST;
    this.controls.maxDistance = Stage.ROAM_MAX_DIST;
    this.controls.target.copy(this.defaultTarget);

    this.controls.addEventListener('start', () => {
      rendererElement.style.cursor = 'grabbing';
    });
    this.controls.addEventListener('end', () => {
      rendererElement.style.cursor = 'auto';
    });

    this.setupLights();
    // Environment is initialized with a default, but updated via updateDimensions immediately in SceneManager

    if (typeof window !== 'undefined') {
      (window as unknown as { __laStage?: Stage }).__laStage = this;
    }
  }

  private setupLights() {
    // Soft high-key office: low ambient so directional shadows define desks/feet;
    // hemisphere + warm key keep fill without chalk blowout.
    // Intensities (×π): ambient 0.15 | hemi 0.32 | dir 0.92  (Wave 18: furniture edge pop)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15 * Math.PI);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8e8e6, 0.32 * Math.PI);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaf5, 0.92 * Math.PI);
    dirLight.position.set(6, 20, 8);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.left = -10;
    // 2048 keeps soft contact shadows under desks/feet at ~¼ the shadow-pass cost of 4096
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.0001;
    // Wave 19: trimmed normal bias closes the light gap under desk legs/feet
    dirLight.shadow.normalBias = 0.005;
    // Wave 19: tighter still than Wave 18 so feet/desks read grounded, but soft (not hard-edged)
    dirLight.shadow.radius = 1.3;
    dirLight.shadow.autoUpdate = true;
    this.scene.add(dirLight);
  }

  public onResize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Call every frame with the character's world position to follow, or null to return to origin. */
  public setFollowTarget(pos: THREE.Vector3 | null) {
    this.followTarget = pos ? pos.clone() : null;
  }

  /**
   * Feed player + NPC world positions while chatting so the camera can compose
   * a two-person shot (midpoint look-at). Clear both when not chatting.
   */
  public setChatSubjects(player: THREE.Vector3 | null, npc: THREE.Vector3 | null): void {
    this.chatPlayer = player ? player.clone() : null;
    this.chatNpc = npc ? npc.clone() : null;
  }

  /**
   * Exponential-decay damping factor for use with `lerp(target, factor)`,
   * scaled by elapsed time so easing speed is frame-rate independent
   * (same feel at 30fps and 144fps). `rate` is roughly "how many times per
   * second the gap closes"; higher = snappier catch-up.
   */
  private static dampFactor(rate: number, dt: number): number {
    return 1 - Math.exp(-rate * dt);
  }

  /** @param delta Seconds since last frame (clamped internally against stalls/tab-switches). */
  public update(delta = 1 / 60) {
    const dt = Math.min(Math.max(delta, 0), CAMERA_MAX_DELTA);
    if (this.isChatting) {
      this.updateChatFraming(dt);
    } else {
      const lerpTarget = this.followTarget
        ? this._lookAt.set(this.followTarget.x, CAMERA_CHEST_Y, this.followTarget.z)
        : this.defaultTarget;
      this.controls.target.lerp(lerpTarget, Stage.dampFactor(CAMERA_FOLLOW_DAMP, dt));
    }
    this.controls.update();
  }

  private updateChatFraming(dt: number): void {
    // Prefer player+NPC midpoint; fall back to selected NPC chest, then follow.
    if (this.chatPlayer && this.chatNpc) {
      this._lookAt.set(
        (this.chatPlayer.x + this.chatNpc.x) * 0.5,
        CAMERA_CHEST_Y,
        (this.chatPlayer.z + this.chatNpc.z) * 0.5,
      );
    } else if (this.chatNpc) {
      this._lookAt.set(this.chatNpc.x, CAMERA_CHEST_Y, this.chatNpc.z);
    } else if (this.followTarget) {
      this._lookAt.set(this.followTarget.x, CAMERA_CHEST_Y, this.followTarget.z);
    } else {
      this._lookAt.copy(this.defaultTarget);
    }

    this.controls.target.lerp(this._lookAt, Stage.dampFactor(CAMERA_FOLLOW_DAMP, dt));
    this.easeCameraDistance(CHAT_CAMERA_DIST, dt);
  }

  /** Ease orbit radius toward ideal while keeping azimuth + iso-friendly polar. */
  private easeCameraDistance(ideal: number, dt: number): void {
    this._offset.copy(this.camera.position).sub(this.controls.target);
    const dist = this._offset.length();
    if (dist < 1e-4) return;

    this._spherical.setFromVector3(this._offset);
    this._spherical.radius = THREE.MathUtils.lerp(
      dist,
      ideal,
      Stage.dampFactor(CAMERA_DIST_DAMP, dt),
    );
    this._spherical.phi = THREE.MathUtils.clamp(
      this._spherical.phi,
      Stage.ROAM_MIN_POLAR,
      Stage.ROAM_MAX_POLAR,
    );
    this._offset.setFromSpherical(this._spherical);
    this.camera.position.copy(this.controls.target).add(this._offset);
  }

  /**
   * Drive camera behavior based on chat state.
   * Call every frame from the animation loop.
   *
   * @param isChatting  True while a conversation is active.
   * @param playerMoving True while player is walking toward the NPC (GOTO state).
   * @param delta Seconds since last frame — drives frame-rate-independent limit easing.
   */
  public setChatMode(isChatting: boolean, playerMoving: boolean, delta = 1 / 60): void {
    if (!this.controls) return;

    this.isChatting = isChatting;
    this.playerMoving = playerMoving;
    const dt = Math.min(Math.max(delta, 0), CAMERA_MAX_DELTA);
    const limitFactor = Stage.dampFactor(CAMERA_LIMIT_DAMP, dt);

    if (isChatting) {
      if (playerMoving) {
        // Lock orbit while walking in; framing still eases via updateChatFraming.
        this.controls.enabled = false;
      } else {
        this.controls.enabled = true;
      }
      this.controls.minDistance = THREE.MathUtils.lerp(
        this.controls.minDistance,
        CHAT_CAMERA_MIN_DIST,
        limitFactor,
      );
      this.controls.maxDistance = THREE.MathUtils.lerp(
        this.controls.maxDistance,
        CHAT_CAMERA_MAX_DIST,
        limitFactor,
      );
      this.controls.minPolarAngle = THREE.MathUtils.lerp(
        this.controls.minPolarAngle,
        Stage.ROAM_MIN_POLAR,
        limitFactor,
      );
      this.controls.maxPolarAngle = THREE.MathUtils.lerp(
        this.controls.maxPolarAngle,
        Stage.ROAM_MAX_POLAR,
        limitFactor,
      );
    } else {
      // Free roam — restore office overview zoom envelope.
      this.controls.enabled = true;
      this.controls.minDistance = THREE.MathUtils.lerp(
        this.controls.minDistance,
        Stage.ROAM_MIN_DIST,
        limitFactor,
      );
      this.controls.maxDistance = THREE.MathUtils.lerp(
        this.controls.maxDistance,
        Stage.ROAM_MAX_DIST,
        limitFactor,
      );
      this.controls.minPolarAngle = THREE.MathUtils.lerp(
        this.controls.minPolarAngle,
        Stage.ROAM_MIN_POLAR,
        limitFactor,
      );
      this.controls.maxPolarAngle = THREE.MathUtils.lerp(
        this.controls.maxPolarAngle,
        Stage.ROAM_MAX_POLAR,
        limitFactor,
      );
    }
  }

  /** Debug snapshot for Wave 13 QA. */
  public getCameraDebug() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    return {
      isChatting: this.isChatting,
      playerMoving: this.playerMoving,
      distance: dist,
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z,
      },
      hasChatSubjects: !!(this.chatPlayer && this.chatNpc),
    };
  }
}
