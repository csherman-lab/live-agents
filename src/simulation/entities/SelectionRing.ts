import * as THREE from 'three/webgpu';
import {
  SELECTION_RING_BASE_OPACITY,
  SELECTION_RING_INNER,
  SELECTION_RING_OPACITY_AMPLITUDE,
  SELECTION_RING_OUTER,
  SELECTION_RING_POP_DURATION,
  SELECTION_RING_POP_OPACITY_BOOST,
  SELECTION_RING_POP_SCALE_BOOST,
  SELECTION_RING_PULSE_SPEED,
  SELECTION_RING_SCALE_AMPLITUDE,
  SELECTION_RING_Y,
} from '../constants';

/**
 * Flat ground ring under the selected NPC — readable at iso without
 * touching instance buffers or face materials. Breathes gently (opacity +
 * scale) so a held selection still reads as "alive" while stationary, and
 * kicks with a brief one-shot pop the instant a *new* agent is selected so
 * the swap reads as deliberate rather than a silent teleport.
 */
export class SelectionRing {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicNodeMaterial;
  /** Pulse phase clock; only advances while a selection is visible. */
  private elapsed = 0;
  /** Counts down from SELECTION_RING_POP_DURATION on a fresh selection; 0 = settled into ambient pulse. */
  private popRemaining = 0;
  /** Selection identity (agent index) as of the last update — lets us detect "newly selected" vs "held". */
  private lastKey: number | null = null;

  constructor(private readonly scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(
      SELECTION_RING_INNER,
      SELECTION_RING_OUTER,
      48,
    );
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshBasicNodeMaterial({
      color: 0x4285f4,
      transparent: true,
      opacity: SELECTION_RING_BASE_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    // Drawn after body/accessories (0/1) but before face decals (10); combined
    // with the Y lift this keeps the ring legible near desk legs/chairs.
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  /**
   * Follow selected agent feet; hide when nothing is selected.
   * @param position World-space feet position of the selected agent, or null to hide.
   * @param colorHex Agent-family tint; caller should cache this rather than rebuild the agent list per frame.
   * @param dt Seconds since last update — drives the soft breathing pulse.
   * @param selectionKey Stable identity (agent index) of the current selection — a change from the previous
   *   call triggers the one-shot select pop. Omit to hold the current pop/pulse state without re-triggering.
   */
  update(position: THREE.Vector3 | null, colorHex?: string, dt = 0, selectionKey: number | null = null): void {
    if (!position) {
      this.mesh.visible = false;
      this.lastKey = null;
      return;
    }

    if (selectionKey !== null && selectionKey !== this.lastKey) {
      this.popRemaining = SELECTION_RING_POP_DURATION;
    }
    this.lastKey = selectionKey;

    this.elapsed += dt;
    this.popRemaining = Math.max(0, this.popRemaining - dt);

    this.mesh.visible = true;
    this.mesh.position.set(position.x, SELECTION_RING_Y, position.z);
    if (colorHex) this.material.color.set(colorHex);

    const pulse = Math.sin(this.elapsed * SELECTION_RING_PULSE_SPEED);
    // Ease the pop boost out quadratically so it reads as a quick kick, not a linear fade.
    const popT = this.popRemaining / SELECTION_RING_POP_DURATION;
    const popEase = popT * popT;

    this.material.opacity = Math.min(
      1,
      SELECTION_RING_BASE_OPACITY + pulse * SELECTION_RING_OPACITY_AMPLITUDE + popEase * SELECTION_RING_POP_OPACITY_BOOST,
    );
    const scale = 1 + pulse * SELECTION_RING_SCALE_AMPLITUDE + popEase * SELECTION_RING_POP_SCALE_BOOST;
    this.mesh.scale.set(scale, 1, scale);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Dim, static ground ring — no pulse, no pop. Reused for two cheap affordances:
 *  - hovering an unselected NPC (neutral tint, distinct from the colored selection ring)
 *  - a subtle marker under the player while the camera follows self
 * Kept as a plain "position in/out" mesh so driving it per frame is nearly free.
 */
export class HoverRing {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicNodeMaterial;

  constructor(private readonly scene: THREE.Scene, colorHex: THREE.ColorRepresentation, opacity: number) {
    const geometry = new THREE.RingGeometry(
      SELECTION_RING_INNER,
      SELECTION_RING_OUTER,
      48,
    );
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshBasicNodeMaterial({
      color: colorHex,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  update(position: THREE.Vector3 | null): void {
    if (!position) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.set(position.x, SELECTION_RING_Y, position.z);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
