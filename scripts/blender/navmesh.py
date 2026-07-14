"""Nav mesh helpers — walkable floor with furniture cutouts."""
from __future__ import annotations

import bpy
import bmesh
from mathutils import Vector

# Extra clearance around furniture so agents don't clip desk edges.
NAV_PADDING = 0.24

# Obstacle footprints (x, y, half_width, half_depth) in world space.
# half_width = X extent, half_depth = Y extent (before NAV_PADDING).
NAV_OBSTACLES: list[tuple[float, float, float, float]] = [
    # Work desks — footprint ~1.35 × 0.73 (+ legs / chair approach buffer)
    (1.40, 3.16, 0.82, 0.55),
    (3.17, 3.16, 0.82, 0.55),
    (1.61, 1.05, 0.82, 0.55),
    # Desk 4 is rotated -90° so long axis is along world Y
    (2.58, 1.45, 0.55, 0.82),
    # Office chairs at work POIs (5-star base + casters — Round 2 slightly larger)
    (1.58, 3.69, 0.52, 0.52),
    (3.35, 3.69, 0.52, 0.52),
    (1.09, 1.24, 0.52, 0.52),
    (3.11, 1.27, 0.52, 0.52),
    (-4.14, -4.47, 0.52, 0.52),
    # Lounge / cafe / counter / board / cabinet
    (-4.04, -1.13, 1.05, 0.40),
    (-2.96, 3.46, 0.68, 0.68),
    (-3.50, -3.94, 1.15, 0.55),
    (3.00, -2.47, 1.05, 0.40),
    # Cabinet: local 2.27×0.52 with 90° yaw → world ~0.52×2.27
    (-4.79, 3.64, 0.35, 1.25),
    (-3.16, 4.44, 0.50, 0.50),
    (-3.72, 2.87, 0.50, 0.50),
    # Plants — pot + leafy canopy radius (Round 2: larger volumetric foliage)
    (-2.13, -3.92, 0.45, 0.45),
    (-4.55, 2.09, 0.42, 0.42),
    (4.2, 3.6, 0.40, 0.40),
    (0.9, -3.8, 0.38, 0.38),
    (-1.2, 4.2, 0.40, 0.40),
    # Low dividers — cover Blender cube ±scale plus body radius so walk edges
    # don't visually sit inside thin partitions (W15 holes short/narrow).
    (0.2, 0.0, 0.48, 2.15),
    (-0.8, -3.0, 1.70, 0.48),
]


def _point_in_obstacle(x: float, y: float) -> bool:
    for ox, oy, hw, hd in NAV_OBSTACLES:
        if abs(x - ox) <= hw + NAV_PADDING and abs(y - oy) <= hd + NAV_PADDING:
            return True
    return False


def build_navmesh(size: float = 4.85, subdivisions: int = 64) -> bpy.types.Object:
    """Create a subdivided floor mesh with desk/furniture holes for pathfinding."""
    bpy.ops.mesh.primitive_plane_add(size=size * 2, location=(0, 0, 0.005))
    plane = bpy.context.active_object
    plane.name = 'navMesh'
    plane.data.name = 'navMesh'

    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.subdivide(number_cuts=subdivisions)
    bm = bmesh.from_edit_mesh(plane.data)

    faces_to_delete = []
    for face in bm.faces:
        cx = sum(v.co.x for v in face.verts) / len(face.verts)
        cy = sum(v.co.y for v in face.verts) / len(face.verts)
        if _point_in_obstacle(cx, cy):
            faces_to_delete.append(face)

    bmesh.ops.delete(bm, geom=faces_to_delete, context='FACES')
    bmesh.update_edit_mesh(plane.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    return plane
