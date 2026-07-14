"""Generate office.glb — white open workspace matching reference layout & aesthetic.

Mesh strategy: build detailed local parts, then join into few solid pieces
(desk / pc / flexo / chair / plant / …) so export mesh count stays near the
reference order of magnitude while keeping a denser silhouette than empty.
"""
from __future__ import annotations

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import bpy
from mathutils import Euler, Vector

from common import (
    MODELS_DIR,
    add_cube,
    add_cylinder,
    add_poi,
    add_subsurf,
    assign_material,
    export_glb,
    make_material,
    reset_scene,
    shade_smooth,
)
from navmesh import build_navmesh
from reference_data import REFERENCE_POIS


def _apply(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    return obj


def _bevel(obj: bpy.types.Object, width: float = 0.015, segments: int = 3) -> None:
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)


def _smooth_cube(name, loc, scale, mat, *, rot=None, bevel=0.02, bevel_seg=3, subsurf=1):
    obj = add_cube(name, loc, scale, mat, rotation=rot)
    if bevel > 0:
        _bevel(obj, bevel, bevel_seg)
    if subsurf:
        add_subsurf(obj, subsurf)
    shade_smooth(obj)
    return _apply(obj)


def _smooth_cyl(name, loc, radius, depth, mat, *, rot=None, verts=24, subsurf=1):
    obj = add_cylinder(name, loc, radius, depth, mat, rotation=rot, vertices=verts)
    if subsurf:
        add_subsurf(obj, subsurf)
    shade_smooth(obj)
    return _apply(obj)


def _smooth_sphere(name, loc, radius, mat, *, segments=24, rings=16, subsurf=0):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=segments,
        ring_count=rings,
        location=loc,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    assign_material(obj, mat)
    if subsurf:
        add_subsurf(obj, subsurf)
    shade_smooth(obj)
    return _apply(obj)


def _origin_geometry(obj: bpy.types.Object) -> bpy.types.Object:
    """Put object origin at bbox center so export node translation matches world center."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    obj.select_set(False)
    return obj


def _join(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    """Join mesh objects into one named mesh (multi-material slots preserved)."""
    objects = [o for o in objects if o is not None]
    if not objects:
        raise ValueError(f'nothing to join for {name}')
    if len(objects) == 1:
        objects[0].name = name
        objects[0].data.name = name
        return _origin_geometry(objects[0])

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    joined.data.name = name
    joined.select_set(False)
    return _origin_geometry(joined)


def _emit(obj: bpy.types.Object, color, strength: float) -> None:
    """Set emission on this object's material slot only — never mutate a shared mat in place."""
    if not obj.data.materials:
        return
    shared = obj.data.materials[0]
    # Duplicate so flexo glow / screen tint cannot pollute every white mesh
    mat = shared.copy()
    mat.name = f'{shared.name}-emit'
    obj.data.materials[0] = mat
    if not mat.use_nodes:
        return
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if not bsdf:
        return
    if bsdf.inputs.get('Emission Color'):
        bsdf.inputs['Emission Color'].default_value = (*color[:3], 1)
    if bsdf.inputs.get('Emission Strength'):
        bsdf.inputs['Emission Strength'].default_value = strength


def _rot_offset(offset: Vector, rot_z: float) -> Vector:
    c, s = math.cos(rot_z), math.sin(rot_z)
    return Vector((offset.x * c - offset.y * s, offset.x * s + offset.y * c, offset.z))


def _add_work_desk(idx: int, loc: Vector, rot_z: float, white, metal, screen, accent, paper) -> None:
    """Desk + clutter, PC, and flexo as three meshes (ref naming)."""
    def at(offset: Vector) -> Vector:
        return loc + _rot_offset(offset, rot_z)

    rot = Euler((0, 0, rot_z))
    _ = accent
    desk_z = 0.528
    parts: list[bpy.types.Object] = []

    parts.append(
        _smooth_cube(
            f'_desk-top.{idx}',
            at(Vector((0, 0, 0.468))),
            Vector((0.675, 0.365, 0.055)),
            white,
            rot=rot,
            bevel=0.022,
            bevel_seg=4,
            subsurf=1,
        )
    )
    parts.append(
        _smooth_cube(
            f'_desk-apron.{idx}',
            at(Vector((0, 0, 0.405))),
            Vector((0.645, 0.335, 0.024)),
            white,
            rot=rot,
            bevel=0.008,
            subsurf=0,
        )
    )
    for dx in (-0.58, 0.58):
        parts.append(
            _smooth_cube(
                f'_desk-leg.{idx}',
                at(Vector((dx, 0, 0.200))),
                Vector((0.058, 0.350, 0.200)),
                white,
                rot=rot,
                bevel=0.014,
                bevel_seg=3,
                subsurf=1,
            )
        )
    parts.append(
        _smooth_cube(
            f'_desk-brace.{idx}',
            at(Vector((0, 0, 0.065))),
            Vector((0.54, 0.034, 0.028)),
            white,
            rot=rot,
            bevel=0.006,
            subsurf=0,
        )
    )
    # Desk clutter stays on the desk mesh for density without extra export meshes
    parts.append(
        _smooth_cube(
            f'_keyboard.{idx}',
            at(Vector((0, 0.14, desk_z))),
            Vector((0.21, 0.075, 0.014)),
            white,
            rot=rot,
            bevel=0.008,
            subsurf=0,
        )
    )
    parts.append(
        _smooth_cube(
            f'_mouse.{idx}',
            at(Vector((0.30, 0.12, desk_z + 0.008))),
            Vector((0.032, 0.052, 0.018)),
            white,
            rot=rot,
            bevel=0.014,
            bevel_seg=4,
            subsurf=1,
        )
    )
    parts.append(
        _smooth_cube(
            f'_notepad.{idx}',
            at(Vector((-0.30, 0.10, desk_z))),
            Vector((0.065, 0.085, 0.010)),
            paper,
            rot=Euler((0, 0, rot_z + 0.18)),
            bevel=0.004,
            subsurf=0,
        )
    )
    for i, (ox, oz, h) in enumerate(((-0.42, desk_z + 0.006, 0.014), (-0.42, desk_z + 0.028, 0.012))):
        parts.append(
            _smooth_cube(
                f'_desk-book.{idx}.{i}',
                at(Vector((ox, -0.08, oz))),
                Vector((0.07, 0.09, h)),
                white if i == 0 else metal,
                rot=Euler((0, 0, rot_z - 0.12 + i * 0.05)),
                bevel=0.004,
                subsurf=0,
            )
        )
    parts.append(
        _smooth_cyl(
            f'_mug.{idx}',
            at(Vector((0.40, -0.02, desk_z + 0.038))),
            0.030,
            0.070,
            white,
            rot=rot,
            verts=20,
            subsurf=1,
        )
    )
    parts.append(
        _smooth_cube(
            f'_mug-handle.{idx}',
            at(Vector((0.438, -0.02, desk_z + 0.038))),
            Vector((0.014, 0.010, 0.024)),
            white,
            rot=rot,
            bevel=0.006,
            subsurf=0,
        )
    )
    _join(f'static-work-desk.{idx:03d}', parts)

    # Chunky all-in-one toward ref ~0.62 × 0.66 × 0.45 (was flat iMac slab)
    pc_parts: list[bpy.types.Object] = []
    pc_parts.append(
        _smooth_cube(
            f'_pc-body.{idx}',
            at(Vector((0, 0.00, 0.750))),
            Vector((0.310, 0.160, 0.180)),
            white,
            rot=rot,
            bevel=0.028,
            bevel_seg=5,
            subsurf=2,
        )
    )
    pc_parts.append(
        _smooth_cube(
            f'_pc-chin.{idx}',
            at(Vector((0, 0.00, 0.590))),
            Vector((0.290, 0.145, 0.036)),
            white,
            rot=rot,
            bevel=0.016,
            bevel_seg=4,
            subsurf=2,
        )
    )
    scr = _smooth_cube(
        f'_pc-screen.{idx}',
        at(Vector((0, -0.155, 0.765))),
        Vector((0.270, 0.014, 0.150)),
        screen,
        rot=rot,
        bevel=0.004,
        bevel_seg=2,
        subsurf=0,
    )
    _emit(scr, (0.08, 0.18, 0.32), 0.14)
    pc_parts.append(scr)
    pc_parts.append(
        _smooth_cyl(
            f'_pc-stand.{idx}',
            at(Vector((0, 0.10, 0.555))),
            0.038,
            0.10,
            metal,
            rot=rot,
            verts=24,
            subsurf=1,
        )
    )
    pc_parts.append(
        _smooth_cube(
            f'_pc-base.{idx}',
            at(Vector((0, 0.18, desk_z))),
            Vector((0.140, 0.280, 0.014)),
            white,
            rot=rot,
            bevel=0.012,
            bevel_seg=4,
            subsurf=1,
        )
    )
    _join(f'static-pc.{idx:03d}', pc_parts)

    # Flexo lamp — one mesh
    flexo: list[bpy.types.Object] = []
    flexo.append(
        _smooth_cyl(
            f'_flexo-base.{idx}',
            at(Vector((0.44, 0.20, desk_z + 0.018))),
            0.058,
            0.038,
            metal,
            rot=rot,
            verts=28,
            subsurf=1,
        )
    )
    flexo.append(
        _smooth_cyl(
            f'_flexo-joint.{idx}',
            at(Vector((0.44, 0.14, 0.64))),
            0.030,
            0.042,
            metal,
            rot=rot,
            verts=20,
            subsurf=1,
        )
    )
    flexo.append(
        _smooth_cube(
            f'_flexo-arm.{idx}',
            at(Vector((0.44, 0.07, 0.74))),
            Vector((0.022, 0.022, 0.14)),
            metal,
            rot=Euler((0.48, 0, rot_z)),
            bevel=0.008,
            bevel_seg=3,
            subsurf=1,
        )
    )
    flexo.append(
        _smooth_cyl(
            f'_flexo-joint2.{idx}',
            at(Vector((0.44, 0.0, 0.82))),
            0.028,
            0.036,
            metal,
            rot=rot,
            verts=18,
            subsurf=1,
        )
    )
    flexo.append(
        _smooth_cube(
            f'_flexo-arm2.{idx}',
            at(Vector((0.44, -0.07, 0.84))),
            Vector((0.020, 0.020, 0.10)),
            metal,
            rot=Euler((-0.6, 0, rot_z)),
            bevel=0.007,
            bevel_seg=3,
            subsurf=1,
        )
    )
    head = _smooth_cube(
        f'_flexo-head.{idx}',
        at(Vector((0.44, -0.12, 0.86))),
        Vector((0.10, 0.070, 0.048)),
        white,
        rot=Euler((0.75, 0, rot_z)),
        bevel=0.022,
        bevel_seg=4,
        subsurf=2,
    )
    _emit(head, (1.0, 0.94, 0.80), 1.8)
    flexo.append(head)
    bulb = _smooth_sphere(
        f'_flexo-bulb.{idx}',
        at(Vector((0.44, -0.13, 0.845))),
        0.028,
        white,
        segments=16,
        rings=10,
        subsurf=0,
    )
    _emit(bulb, (1.0, 0.96, 0.88), 2.6)
    flexo.append(bulb)
    # Ref names flexos static-flexo / .001… — keep zero-padded index for uniqueness
    _join(f'static-flexo.{idx:03d}', flexo)


def _add_office_chair(idx: int, loc: Vector, rot_z: float, white, metal) -> None:
    """Seat + back + base as one mesh (no per-caster export meshes)."""
    rot = Euler((0, 0, rot_z))

    def at(offset: Vector) -> Vector:
        return loc + _rot_offset(offset, rot_z)

    parts: list[bpy.types.Object] = []
    parts.append(
        _smooth_cube(
            f'_chair-seat.{idx}',
            at(Vector((0, 0, 0.38))),
            Vector((0.245, 0.245, 0.058)),
            white,
            rot=rot,
            bevel=0.048,
            bevel_seg=5,
            subsurf=2,
        )
    )
    parts.append(
        _smooth_cube(
            f'_chair-back.{idx}',
            at(Vector((0, 0.150, 0.60))),
            Vector((0.225, 0.048, 0.28)),
            white,
            rot=Euler((-0.18, 0, rot_z)),
            bevel=0.038,
            bevel_seg=5,
            subsurf=2,
        )
    )
    parts.append(
        _smooth_cube(
            f'_chair-lumbar.{idx}',
            at(Vector((0, 0.125, 0.48))),
            Vector((0.17, 0.035, 0.065)),
            white,
            rot=Euler((-0.1, 0, rot_z)),
            bevel=0.022,
            subsurf=1,
        )
    )
    for dx in (-0.24, 0.24):
        # Arm + post as one solid block each (fewer parts before join)
        parts.append(
            _smooth_cube(
                f'_chair-arm.{idx}',
                at(Vector((dx, 0.02, 0.48))),
                Vector((0.034, 0.13, 0.055)),
                white,
                rot=rot,
                bevel=0.014,
                subsurf=1,
            )
        )
    parts.append(
        _smooth_cyl(
            f'_chair-pole.{idx}',
            at(Vector((0, 0, 0.20))),
            0.030,
            0.30,
            metal,
            rot=rot,
            verts=20,
            subsurf=0,
        )
    )
    parts.append(
        _smooth_cyl(
            f'_chair-hub.{idx}',
            at(Vector((0, 0, 0.045))),
            0.065,
            0.032,
            metal,
            rot=rot,
            verts=20,
            subsurf=0,
        )
    )
    # 5-star base: spokes with thickened tips (casters baked into spoke ends)
    for i in range(5):
        a = rot_z + i * (2 * math.pi / 5)
        parts.append(
            _smooth_cube(
                f'_chair-spoke.{idx}.{i}',
                loc + Vector((math.cos(a) * 0.16, math.sin(a) * 0.16, 0.04)),
                Vector((0.15, 0.030, 0.024)),
                metal,
                rot=Euler((0, 0, a)),
                bevel=0.008,
                subsurf=0,
            )
        )
        parts.append(
            _smooth_cyl(
                f'_chair-tip.{idx}.{i}',
                loc + Vector((math.cos(a) * 0.26, math.sin(a) * 0.26, 0.028)),
                0.028,
                0.036,
                metal,
                rot=Euler((math.pi / 2, 0, a)),
                verts=12,
                subsurf=0,
            )
        )
    _join(f'static-work-chair.{idx:03d}', parts)


def _add_sofa(loc: Vector, white, metal) -> None:
    """Low lounge sofa toward ref ~1.85 × 0.47 × 0.50."""
    parts: list[bpy.types.Object] = [
        _smooth_cube(
            '_sofa-seat',
            loc + Vector((0, 0, 0.14)),
            Vector((0.90, 0.22, 0.12)),
            white,
            bevel=0.045,
            bevel_seg=5,
            subsurf=2,
        ),
        _smooth_cube(
            '_sofa-back',
            loc + Vector((0, 0.14, 0.30)),
            Vector((0.90, 0.055, 0.18)),
            white,
            bevel=0.035,
            bevel_seg=4,
            subsurf=2,
        ),
        _smooth_cube(
            '_sofa-arm-l',
            loc + Vector((-0.84, 0, 0.24)),
            Vector((0.065, 0.20, 0.14)),
            white,
            bevel=0.035,
            subsurf=2,
        ),
        _smooth_cube(
            '_sofa-arm-r',
            loc + Vector((0.84, 0, 0.24)),
            Vector((0.065, 0.20, 0.14)),
            white,
            bevel=0.035,
            subsurf=2,
        ),
    ]
    for dx in (-0.40, 0.40):
        parts.append(
            _smooth_cube(
                '_sofa-cushion',
                loc + Vector((dx, -0.01, 0.26)),
                Vector((0.36, 0.18, 0.045)),
                white,
                bevel=0.035,
                bevel_seg=4,
                subsurf=2,
            )
        )
    for dx, dy in ((-0.70, -0.14), (0.70, -0.14), (-0.70, 0.14), (0.70, 0.14)):
        parts.append(
            _smooth_cyl(
                '_sofa-foot',
                loc + Vector((dx, dy, 0.03)),
                0.018,
                0.05,
                metal,
                verts=12,
                subsurf=0,
            )
        )
    _join('static-sofa', parts)


def _add_cafe_table(loc: Vector, white, metal) -> None:
    parts = [
        _smooth_cyl('_cafe-top', loc + Vector((0, 0, 0.42)), 0.44, 0.038, white, verts=56, subsurf=1),
        _smooth_cyl('_cafe-pole', loc + Vector((0, 0, 0.21)), 0.048, 0.40, metal, verts=20, subsurf=0),
        _smooth_cyl('_cafe-base', loc + Vector((0, 0, 0.025)), 0.24, 0.032, metal, verts=36, subsurf=0),
        _smooth_cyl('_cafe-coaster', loc + Vector((0.12, 0.08, 0.445)), 0.05, 0.008, white, verts=20, subsurf=0),
    ]
    _join('static-cafe-table', parts)


def _add_counter(loc: Vector, white, metal, screen) -> None:
    parts: list[bpy.types.Object] = [
        _smooth_cube(
            '_counter-body',
            loc + Vector((0, 0, 0.40)),
            Vector((1.05, 0.34, 0.40)),
            white,
            bevel=0.032,
            bevel_seg=4,
            subsurf=1,
        ),
        _smooth_cube(
            '_counter-top',
            loc + Vector((0, 0, 0.825)),
            Vector((1.10, 0.38, 0.028)),
            white,
            bevel=0.014,
            subsurf=0,
        ),
        _smooth_cube(
            '_counter-kick',
            loc + Vector((0, 0.28, 0.04)),
            Vector((1.0, 0.04, 0.04)),
            metal,
            bevel=0.005,
            subsurf=0,
        ),
        _smooth_cyl('_cup', loc + Vector((0.40, 0.05, 0.88)), 0.032, 0.075, white, verts=18, subsurf=1),
        _smooth_cube(
            '_counter-pad',
            loc + Vector((0.15, 0.05, 0.855)),
            Vector((0.08, 0.10, 0.005)),
            white,
            bevel=0.003,
            subsurf=0,
        ),
    ]
    _join('static-counter', parts)

    # Laptop stays its own mesh (matches ref)
    lap_parts = [
        _smooth_cube(
            '_laptop-base',
            loc + Vector((-0.25, 0.0, 0.86)),
            Vector((0.20, 0.14, 0.01)),
            metal,
            bevel=0.005,
            subsurf=0,
        ),
    ]
    lap_scr = _smooth_cube(
        '_laptop-screen',
        loc + Vector((-0.25, -0.12, 0.99)),
        Vector((0.19, 0.01, 0.13)),
        screen,
        rot=Euler((0.18, 0, 0)),
        bevel=0.002,
        subsurf=0,
    )
    _emit(lap_scr, (0.1, 0.22, 0.4), 0.14)
    lap_parts.append(lap_scr)
    _join('static-laptop', lap_parts)


def _add_board(loc: Vector, white, screen, metal) -> None:
    """Standing board toward ref ~1.99 × 0.37 × 1.30."""
    parts: list[bpy.types.Object] = [
        _smooth_cube(
            '_board-frame',
            loc + Vector((0, 0, 0.82)),
            Vector((0.99, 0.070, 0.48)),
            white,
            bevel=0.028,
            bevel_seg=4,
            subsurf=1,
        ),
    ]
    scr = _smooth_cube(
        '_board-screen',
        loc + Vector((0, -0.055, 0.82)),
        Vector((0.90, 0.010, 0.42)),
        screen,
        bevel=0.002,
        subsurf=0,
    )
    # Dedicated dark board glass — don't mutate shared screen mat
    if scr.data.materials:
        board_scr = scr.data.materials[0].copy()
        board_scr.name = 'screen-board'
        scr.data.materials[0] = board_scr
        if board_scr.use_nodes:
            bsdf = board_scr.node_tree.nodes.get('Principled BSDF')
            if bsdf:
                bsdf.inputs['Base Color'].default_value = (0.02, 0.025, 0.035, 1)
    _emit(scr, (0.08, 0.18, 0.36), 0.10)
    parts.append(scr)
    for dx in (-0.78, 0.78):
        parts.append(
            _smooth_cube(
                '_board-leg',
                loc + Vector((dx, 0.05, 0.34)),
                Vector((0.032, 0.040, 0.34)),
                white,
                bevel=0.008,
                subsurf=0,
            )
        )
    parts.append(
        _smooth_cube(
            '_board-base',
            loc + Vector((0, 0.08, 0.03)),
            Vector((0.90, 0.18, 0.025)),
            white,
            bevel=0.01,
            subsurf=0,
        )
    )
    parts.append(
        _smooth_cube(
            '_board-brace',
            loc + Vector((0, 0.05, 0.16)),
            Vector((0.72, 0.022, 0.015)),
            metal,
            bevel=0.004,
            subsurf=0,
        )
    )
    _join('static-board', parts)


def _add_cabinet(loc: Vector, white, metal, paper) -> None:
    """Low bookshelf: local dims ~2.27×0.52×0.8 with 90° yaw (matches ref footprint)."""
    rot_z = math.pi / 2
    rot = Euler((0, 0, rot_z))

    def at(offset: Vector) -> Vector:
        return loc + _rot_offset(offset, rot_z)

    parts: list[bpy.types.Object] = [
        _smooth_cube(
            '_cabinet-body',
            at(Vector((0, 0, 0.40))),
            Vector((1.13, 0.26, 0.40)),
            white,
            rot=rot,
            bevel=0.022,
            bevel_seg=4,
            subsurf=1,
        ),
    ]
    for i, z in enumerate((0.14, 0.36, 0.58)):
        parts.append(
            _smooth_cube(
                f'_cabinet-shelf.{i}',
                at(Vector((0, 0, z))),
                Vector((1.10, 0.245, 0.014)),
                white,
                rot=rot,
                bevel=0.004,
                subsurf=0,
            )
        )
    # Books along local X (world Y after 90° yaw)
    book_specs = [
        (-0.85, 0.48, 0.17, 0.09, white),
        (-0.55, 0.50, 0.21, 0.07, metal),
        (-0.25, 0.47, 0.15, 0.08, paper),
        (0.05, 0.49, 0.19, 0.075, white),
        (0.35, 0.51, 0.23, 0.065, metal),
        (0.65, 0.46, 0.14, 0.085, paper),
        (0.90, 0.48, 0.16, 0.08, white),
        (-0.70, 0.26, 0.16, 0.08, metal),
        (-0.20, 0.28, 0.20, 0.07, white),
        (0.40, 0.25, 0.13, 0.09, paper),
    ]
    for i, (x, z, h, w, mat) in enumerate(book_specs):
        parts.append(
            _smooth_cube(
                f'_cabinet-book.{i}',
                at(Vector((x, 0.04, z))),
                Vector((w, 0.14, h * 0.5)),
                mat,
                rot=rot,
                bevel=0.008,
                bevel_seg=2,
                subsurf=0,
            )
        )
    _join('static-cabinet', parts)


def _add_lounge_chair(name: str, loc: Vector, rot_z: float, white, metal) -> None:
    rot = Euler((0, 0, rot_z))

    def at(offset: Vector) -> Vector:
        return loc + _rot_offset(offset, rot_z)

    parts: list[bpy.types.Object] = [
        _smooth_cube(
            f'_lounge-seat.{name}',
            at(Vector((0, 0, 0.32))),
            Vector((0.255, 0.255, 0.048)),
            white,
            rot=rot,
            bevel=0.042,
            bevel_seg=5,
            subsurf=2,
        ),
        _smooth_cube(
            f'_lounge-back.{name}',
            at(Vector((0, 0.125, 0.52))),
            Vector((0.24, 0.038, 0.24)),
            white,
            rot=Euler((-0.22, 0, rot_z)),
            bevel=0.032,
            bevel_seg=4,
            subsurf=2,
        ),
    ]
    # Two slats only (was 3) — still reads as lounge chair
    for i, dz in enumerate((0.44, 0.56)):
        parts.append(
            _smooth_cube(
                f'_lounge-slat.{name}.{i}',
                at(Vector((0, 0.145, dz))),
                Vector((0.20, 0.012, 0.018)),
                white,
                rot=Euler((-0.22, 0, rot_z)),
                bevel=0.006,
                subsurf=0,
            )
        )
    for dx, dy in ((-0.13, -0.13), (0.13, -0.13), (-0.13, 0.13), (0.13, 0.13)):
        parts.append(
            _smooth_cyl(
                f'_lounge-leg.{name}',
                at(Vector((dx, dy, 0.15))),
                0.016,
                0.28,
                metal,
                rot=rot,
                verts=14,
                subsurf=0,
            )
        )
    _join(name, parts)


def _add_plant(name: str, loc: Vector, pot_m, plant_m, leaf_m, *, scale: float = 1.0) -> None:
    """Volumetric plant as a single mesh — bushy canopy that reads green at iso."""
    s = scale
    parts: list[bpy.types.Object] = [
        _smooth_cyl(f'_pot.{name}', loc + Vector((0, 0, 0.13 * s)), 0.14 * s, 0.22 * s, pot_m, verts=32, subsurf=1),
        _smooth_cyl(f'_rim.{name}', loc + Vector((0, 0, 0.24 * s)), 0.155 * s, 0.032 * s, pot_m, verts=32, subsurf=0),
        _smooth_cyl(f'_soil.{name}', loc + Vector((0, 0, 0.23 * s)), 0.120 * s, 0.030 * s, plant_m, verts=18, subsurf=0),
        _smooth_cyl(f'_stem.{name}', loc + Vector((0, 0, 0.42 * s)), 0.022 * s, 0.36 * s, plant_m, verts=12, subsurf=0),
    ]

    # 5 thick leaf clusters + 4 canopy spheres — denser green mass vs preview
    leaf_cubes = [
        (0.00, 0.00, 0.62, 0.19, 0.17, 0.095),
        (-0.16, 0.10, 0.54, 0.17, 0.14, 0.085),
        (0.17, -0.09, 0.56, 0.18, 0.14, 0.085),
        (0.02, 0.07, 0.78, 0.15, 0.14, 0.080),
        (-0.08, -0.12, 0.68, 0.14, 0.13, 0.075),
    ]
    for i, (dx, dy, dz, sx, sy, sz) in enumerate(leaf_cubes):
        parts.append(
            _smooth_cube(
                f'_leaf.{name}.{i}',
                loc + Vector((dx * s, dy * s, dz * s)),
                Vector((sx * s, sy * s, sz * s)),
                leaf_m,
                rot=Euler((0.3 * ((i % 3) - 1), 0.35 * ((i % 2) * 2 - 1), i * 0.7)),
                bevel=0.052 * s,
                bevel_seg=4,
                subsurf=1,
            )
        )

    leaf_spheres = [
        (-0.08, 0.06, 0.74, 0.110),
        (0.12, -0.06, 0.72, 0.105),
        (0.00, 0.10, 0.86, 0.095),
        (-0.10, -0.08, 0.80, 0.090),
    ]
    for i, (dx, dy, dz, r) in enumerate(leaf_spheres):
        parts.append(
            _smooth_sphere(
                f'_leaf-ball.{name}.{i}',
                loc + Vector((dx * s, dy * s, dz * s)),
                r * s,
                leaf_m,
                segments=18,
                rings=12,
                subsurf=0,
            )
        )
    _join(name, parts)


def _add_floor_grid(line_mat) -> None:
    """Subtle grid as a single joined mesh (avoids ~14 export meshes)."""
    spacing = 1.25
    half = 4.8
    n = int(half * 2 / spacing)
    parts: list[bpy.types.Object] = []
    for i in range(-n, n + 1):
        x = i * spacing
        if abs(x) > half - 0.05:
            continue
        # Slightly thicker lines so the grid survives soft high-key + ACES
        parts.append(
            add_cube(
                f'_grid-x.{i}',
                Vector((x, 0, 0.0035)),
                Vector((0.012, half, 0.0018)),
                line_mat,
            )
        )
        parts.append(
            add_cube(
                f'_grid-y.{i}',
                Vector((0, x, 0.0035)),
                Vector((half, 0.012, 0.0018)),
                line_mat,
            )
        )
    if parts:
        _join('static-floor-grid', parts)


def _add_border_frame(mat, half: float = 5.0, thickness: float = 0.042, height: float = 0.006) -> None:
    """Single thin accent ring (four sides joined — matches ref one colored-border)."""
    inner = half - thickness
    sides = [
        add_cube(
            '_border-n',
            Vector((0, half - thickness * 0.5, height * 0.5)),
            Vector((half, thickness * 0.5, height * 0.5)),
            mat,
        ),
        add_cube(
            '_border-s',
            Vector((0, -(half - thickness * 0.5), height * 0.5)),
            Vector((half, thickness * 0.5, height * 0.5)),
            mat,
        ),
        add_cube(
            '_border-e',
            Vector((half - thickness * 0.5, 0, height * 0.5)),
            Vector((thickness * 0.5, inner, height * 0.5)),
            mat,
        ),
        add_cube(
            '_border-w',
            Vector((-(half - thickness * 0.5), 0, height * 0.5)),
            Vector((thickness * 0.5, inner, height * 0.5)),
            mat,
        ),
    ]
    _join('colored-border', sides)


def build_office() -> None:
    reset_scene()

    # Wave 18: neutral mid-grey floor vs soft white furniture (WorldManager mirrors)
    floor_mat = make_material('floor', (0.52, 0.52, 0.525, 1.0), roughness=0.98)
    white_mat = make_material('white', (0.96, 0.96, 0.97, 1.0), roughness=0.62)
    metal_mat = make_material('metal', (0.68, 0.70, 0.74, 1.0), roughness=0.32, metallic=0.70)
    # Near-black screens — low emissive so ACES doesn't wash them to grey
    screen_mat = make_material(
        'screen',
        (0.025, 0.030, 0.040, 1.0),
        roughness=0.22,
        emission=(0.05, 0.12, 0.22),
        emission_strength=0.12,
    )
    accent_mat = make_material('accent', (0.28, 0.50, 0.98, 1.0), roughness=0.42)
    grid_mat = make_material('grid', (0.32, 0.32, 0.325, 1.0), roughness=0.98)
    # Saturated foliage — ACES + high-key fill otherwise pastel-washes greens
    plant_mat = make_material('plant', (0.12, 0.46, 0.22, 1.0), roughness=0.80)
    leaf_mat = make_material('leaf', (0.16, 0.62, 0.26, 1.0), roughness=0.58)
    pot_mat = make_material('pot', (0.90, 0.90, 0.92, 1.0), roughness=0.50)
    paper_mat = make_material('paper', (0.95, 0.94, 0.91, 1.0), roughness=0.85)

    _smooth_cube(
        'static-floor',
        Vector((0.0, 0.0, -0.08)),
        Vector((5.1, 5.1, 0.08)),
        floor_mat,
        bevel=0.04,
        subsurf=0,
    )

    nav = build_navmesh(size=4.85, subdivisions=64)
    assign_material(nav, floor_mat)

    _add_floor_grid(grid_mat)
    _add_border_frame(accent_mat, half=5.0, thickness=0.042)

    desk_specs = [
        (1, Vector((1.40, 3.16, 0.0)), 0.0),
        (2, Vector((3.17, 3.16, 0.0)), 0.0),
        (3, Vector((1.61, 1.05, 0.0)), 0.0),
        (4, Vector((2.58, 1.45, 0.0)), -1.571),
    ]
    for idx, loc, rot in desk_specs:
        _add_work_desk(idx, loc, rot, white_mat, metal_mat, screen_mat, accent_mat, paper_mat)

    chair_specs = [
        (0, Vector((-4.14, -4.47, 0.0)), 3.141),
        (1, Vector((1.58, 3.69, 0.0)), 0.0),
        (2, Vector((3.35, 3.69, 0.0)), 0.0),
        (3, Vector((1.09, 1.24, 0.0)), 1.571),
        (4, Vector((3.11, 1.27, 0.0)), -1.571),
    ]
    for idx, loc, rot in chair_specs:
        _add_office_chair(idx, loc, rot, white_mat, metal_mat)

    _add_sofa(Vector((-4.04, -1.13, 0.0)), white_mat, metal_mat)
    _add_cafe_table(Vector((-2.96, 3.46, 0.0)), white_mat, metal_mat)
    _add_counter(Vector((-3.50, -3.94, 0.0)), white_mat, metal_mat, screen_mat)
    _add_board(Vector((3.00, -2.47, 0.0)), white_mat, screen_mat, metal_mat)
    _add_cabinet(Vector((-4.79, 3.64, 0.0)), white_mat, metal_mat, paper_mat)

    _add_lounge_chair('static-chair', Vector((-3.16, 4.44, 0.0)), 0.0, white_mat, metal_mat)
    _add_lounge_chair('static-chair.001', Vector((-3.72, 2.87, 0.0)), 1.571, white_mat, metal_mat)

    _add_plant('static-plant.001', Vector((-2.13, -3.92, 0.0)), pot_mat, plant_mat, leaf_mat, scale=1.18)
    _add_plant('static-plant.002', Vector((-4.55, 2.09, 0.0)), pot_mat, plant_mat, leaf_mat, scale=1.08)
    _add_plant('static-plant.003', Vector((4.2, 3.6, 0.0)), pot_mat, plant_mat, leaf_mat, scale=1.00)
    _add_plant('static-plant.004', Vector((0.9, -3.8, 0.0)), pot_mat, plant_mat, leaf_mat, scale=0.92)
    _add_plant('static-plant.005', Vector((-1.2, 4.2, 0.0)), pot_mat, plant_mat, leaf_mat, scale=0.98)

    _smooth_cube(
        'static-divider-a',
        Vector((0.2, 0.0, 0.32)),
        Vector((0.04, 2.0, 0.32)),
        white_mat,
        bevel=0.015,
        subsurf=0,
    )
    _smooth_cube(
        'static-divider-b',
        Vector((-0.8, -3.0, 0.26)),
        Vector((1.5, 0.04, 0.26)),
        white_mat,
        bevel=0.015,
        subsurf=0,
    )

    for name, (x, y, z), rot_z in REFERENCE_POIS:
        add_poi(name, Vector((x, y, z)), rot_z)

    export_glb(f'{MODELS_DIR}/office.glb')
    print('Exported office.glb')


if __name__ == '__main__':
    build_office()
