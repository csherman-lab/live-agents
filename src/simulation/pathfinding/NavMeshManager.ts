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

    const groupID = this.pf.getGroup(NAVMESH_ZONE, from as any);

    if (groupID === null) return [];

    const path = this.pf.findPath(from as any, to as any, NAVMESH_ZONE, groupID) as THREE.Vector3[];

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
   * Returns true when the point was adjusted.
   */
  public projectOntoNavMesh(point: THREE.Vector3): boolean {
    if (!this.ready || this.isPointOnNavMesh(point)) return false;
    const groupID = this.pf.getGroup(NAVMESH_ZONE, point as any);
    if (groupID === null) return false;
    const node = this.pf.getClosestNode(point as any, NAVMESH_ZONE, groupID, false);
    if (!node) return false;
    this.pf.clampStep(point as any, point as any, node, NAVMESH_ZONE, groupID, this._clampOut as any);
    point.set(this._clampOut.x, point.y, this._clampOut.z);
    return true;
  }
}
