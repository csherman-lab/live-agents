import { Pathfinding } from 'three-pathfinding';
import * as THREE from 'three/webgpu';
import { NAVMESH_ZONE } from '../constants';

/**
 * Manages the navigation mesh used for path queries.
 *
 * Initially built procedurally from a flat plane (same dimensions as the
 * visible ground). In the future, call loadFromGeometry() with a navmesh
 * extracted from a GLB to replace it.
 */
export class NavMeshManager {
  private pf = new Pathfinding();
  private ready = false;
  private readonly _clampOut = new THREE.Vector3();

  // ── Setup ────────────────────────────────────────────────────

  /**
   * Load a navmesh from any BufferGeometry (e.g. extracted from a GLB).
   * Replaces any previously loaded zone.
   */
  public loadFromGeometry(geometry: THREE.BufferGeometry): void {
    const zone = Pathfinding.createZone(geometry as any);
    this.pf.setZoneData(NAVMESH_ZONE, zone);
    this.ready = true;
  }

  // ── Queries ──────────────────────────────────────────────────

  /**
   * Find a path from `from` to `to`.
   * Returns an array of waypoints (excluding the start position).
   * Falls back to [to] if the navmesh is not ready or no path is found.
   */
  public findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    if (!this.ready) return [];

    // Snap slightly-off-mesh starts onto walkable polys so findPath doesn't fail
    // (common after separation / partition push / float error).
    const start = from.clone();
    this.projectOntoNavMesh(start);
    const end = to.clone();
    // Keep off-mesh sit targets as-is; only snap when the goal is meant to be walkable.
    if (this.isPointOnNavMesh(to) || this.pf.getGroup(NAVMESH_ZONE, to as any) !== null) {
      this.projectOntoNavMesh(end);
    }

    const groupID = this.pf.getGroup(NAVMESH_ZONE, start as any);
    if (groupID === null) return [];

    const path = this.pf.findPath(start as any, end as any, NAVMESH_ZONE, groupID) as THREE.Vector3[];

    if (!path || path.length === 0) {
      return [];
    }
    return path;
  }

  public isReady(): boolean {
    return this.ready;
  }

  /** Checks if a point lies on a walkable nav polygon (not just near a group). */
  public isPointOnNavMesh(point: THREE.Vector3): boolean {
    if (!this.ready) return false;
    // getGroup(zone, point) alone returns the nearest group by centroid even for
    // points inside desk holes — use getClosestNode(..., checkPolygon=true).
    const groupID = this.pf.getGroup(NAVMESH_ZONE, point as any);
    if (groupID === null) return false;
    const node = this.pf.getClosestNode(point as any, NAVMESH_ZONE, groupID, true);
    return node !== null;
  }

  /**
   * Clamp a proposed step so it cannot leave the walkable mesh
   * (stops cutting through desks / furniture holes).
   * Mutates `proposed` in place when clamping; returns whether a clamp ran.
   */
  public clampMove(from: THREE.Vector3, proposed: THREE.Vector3): boolean {
    if (!this.ready) return false;

    const groupID = this.pf.getGroup(NAVMESH_ZONE, from as any);
    if (groupID === null) return false;

    // Still on mesh and target also on mesh — no clamp needed.
    if (this.isPointOnNavMesh(proposed)) return false;

    const node =
      this.pf.getClosestNode(from as any, NAVMESH_ZONE, groupID, true) ??
      this.pf.getClosestNode(from as any, NAVMESH_ZONE, groupID, false);
    if (!node) return false;

    this.pf.clampStep(from as any, proposed as any, node, NAVMESH_ZONE, groupID, this._clampOut as any);
    proposed.set(this._clampOut.x, from.y, this._clampOut.z);
    return true;
  }

  /**
   * If `point` is off-mesh, snap it to the closest point on the navmesh.
   * Returns true when the point was adjusted (or already on mesh → false).
   * Furniture holes often make getGroup null — ring-sample until a foothold exists.
   */
  public projectOntoNavMesh(point: THREE.Vector3): boolean {
    if (!this.ready || this.isPointOnNavMesh(point)) return false;

    const trySnap = (sample: THREE.Vector3): boolean => {
      const groupID = this.pf.getGroup(NAVMESH_ZONE, sample as any);
      if (groupID === null) return false;
      const node = this.pf.getClosestNode(sample as any, NAVMESH_ZONE, groupID, false);
      if (!node) return false;
      this.pf.clampStep(sample as any, sample as any, node, NAVMESH_ZONE, groupID, this._clampOut as any);
      point.set(this._clampOut.x, point.y, this._clampOut.z);
      return true;
    };

    if (trySnap(point)) return true;

    const radii = [0.4, 0.8, 1.2, 1.8, 2.5];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const r of radii) {
      for (const [dx, dz] of dirs) {
        const sample = point.clone();
        sample.x += dx * r;
        sample.z += dz * r;
        if (trySnap(sample)) return true;
      }
    }
    return false;
  }

  /**
   * Walkable approach point for an off-mesh seat/desk. Prefers the seat itself when on-mesh.
   */
  public findWalkableApproach(seat: THREE.Vector3): THREE.Vector3 | null {
    if (!this.ready) return null;
    if (this.isPointOnNavMesh(seat)) return seat.clone();

    const candidate = seat.clone();
    if (this.projectOntoNavMesh(candidate) && this.isPointOnNavMesh(candidate)) {
      return candidate;
    }

    const radii = [0.45, 0.75, 1.1, 1.6];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [-0.7, -0.7],
    ];
    for (const r of radii) {
      for (const [dx, dz] of dirs) {
        const sample = seat.clone();
        sample.x += dx * r;
        sample.z += dz * r;
        if (this.isPointOnNavMesh(sample)) return sample;
        if (this.projectOntoNavMesh(sample) && this.isPointOnNavMesh(sample)) return sample;
      }
    }
    return null;
  }
}
