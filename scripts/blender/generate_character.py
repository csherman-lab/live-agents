"""Generate character.glb — cute vinyl workers (REF body hybrid + atlas faces)."""
from __future__ import annotations

import math
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import bmesh
import bpy
from mathutils import Euler, Vector

from common import (
    MODELS_DIR,
    add_cube,
    add_cylinder,
    add_subsurf,
    assign_material,
    ensure_dir,
    make_material,
    reset_scene,
    shade_smooth,
)

ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
REF_CHARACTER = '/tmp/ref-character.glb'
TEXTURES_DIR = os.path.join(MODELS_DIR, 'textures')
REQUIRED_ACTIONS = [
    'Idle', 'Walk', 'Talk', 'Listen', 'Sit', 'Sit_Idle', 'Sit_Work',
    'LookAround', 'Happy', 'Sad', 'Pick', 'Wave',
]


def ensure_reference_character() -> None:
    if os.path.exists(REF_CHARACTER) and os.path.getsize(REF_CHARACTER) > 1000:
        return
    os.makedirs(os.path.dirname(REF_CHARACTER), exist_ok=True)
    with open(REF_CHARACTER, 'wb') as out:
        subprocess.run(
            ['git', 'show', 'HEAD:public/models/character.glb'],
            cwd=ROOT,
            stdout=out,
            check=True,
        )


def load_face_textures():
    ensure_dir(TEXTURES_DIR)
    eyes_img = bpy.data.images.load(os.path.join(TEXTURES_DIR, 'eyes-atlas-color.png'))
    eyes_img.name = 'eyes-atlas-color'
    mouth_img = bpy.data.images.load(os.path.join(TEXTURES_DIR, 'mouth-atlas-color.png'))
    mouth_img.name = 'mouth-atlas-color'
    return eyes_img, mouth_img


def _set_face_uv(
    obj: bpy.types.Object,
    col: int,
    row: int,
    cols: int = 2,
    rows: int = 4,
    zoom: float = 1.0,
    zoom_v: float | None = None,
) -> None:
    """Map shell → one atlas cell via object-wide XZ bounds.

    Per-face min/max (old) re-tiled the full expression onto every triangle of the
    dense curved grid → iso read as QR/static noise. Global bounds keep one face.
    """
    u0, u1 = col / cols, (col + 1) / cols
    v1 = 1.0 - row / rows
    v0 = 1.0 - (row + 1) / rows
    zv = zoom if zoom_v is None else zoom_v
    if zoom > 1.0 or zv > 1.0:
        mid_u = (u0 + u1) * 0.5
        mid_v = (v0 + v1) * 0.5
        half_u = (u1 - u0) * 0.5 / max(zoom, 1.0)
        half_v = (v1 - v0) * 0.5 / max(zv, 1.0)
        u0, u1 = mid_u - half_u, mid_u + half_u
        v0, v1 = mid_v - half_v, mid_v + half_v
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv_layer = bm.loops.layers.uv.verify()
    # Object-wide bounds — one continuous atlas projection across the shell.
    xs = [v.co.x for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    min_x, max_x = min(xs), max(xs)
    min_z, max_z = min(zs), max(zs)
    dx = max(max_x - min_x, 1e-6)
    dz = max(max_z - min_z, 1e-6)
    for face in bm.faces:
        for loop in face.loops:
            u = (loop.vert.co.x - min_x) / dx
            v = (loop.vert.co.z - min_z) / dz
            loop[uv_layer].uv.x = u0 + u * (u1 - u0)
            loop[uv_layer].uv.y = v0 + v * (v1 - v0)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _apply_modifiers(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def _pin_mesh_to_bone(obj: bpy.types.Object, arm_obj: bpy.types.Object, bone_name: str) -> None:
    if arm_obj.data.bones.get(bone_name) is None:
        return
    for vg in list(obj.vertex_groups):
        obj.vertex_groups.remove(vg)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')


def _vg_weight(obj: bpy.types.Object, vert_index: int, group_index: int) -> float:
    for g in obj.data.vertices[vert_index].groups:
        if g.group == group_index:
            return g.weight
    return 0.0


def _refine_body_weights(body: bpy.types.Object) -> None:
    """Limit limb spill into torso/head so Walk doesn't melt the core or yank accessories."""
    groups = {vg.name: vg for vg in body.vertex_groups}
    needed = ('root', 'hips', 'spine', 'head', 'arm.L', 'arm.R', 'lower.arm.L', 'lower.arm.R', 'leg.L', 'leg.R')
    if any(n not in groups for n in needed):
        print(f'Weight refine skip; groups={sorted(groups)}')
        return

    zs = [v.co.z for v in body.data.vertices]
    z_min, z_max = min(zs), max(zs)
    z_span = max(z_max - z_min, 1e-6)
    # Chibi: head is ~half height, so pin shell starts lower than adult proportions.
    head_z = z_min + z_span * 0.48
    torso_lo = z_min + z_span * 0.18
    torso_hi = z_min + z_span * 0.55

    limb_names = ('arm.L', 'arm.R', 'lower.arm.L', 'lower.arm.R', 'leg.L', 'leg.R')
    for vi, v in enumerate(body.data.vertices):
        x, z = v.co.x, v.co.z
        # Head shell → pin to head (keeps face/accessories glued)
        if z >= head_z and abs(x) < 0.34:
            for name in limb_names + ('root', 'hips', 'spine'):
                groups[name].add([vi], 0.0, 'REPLACE')
            groups['head'].add([vi], 1.0, 'REPLACE')
            continue
        # Torso core → hips/spine only (no leg/arm melt)
        if torso_lo <= z <= torso_hi and abs(x) < 0.10:
            for name in limb_names:
                groups[name].add([vi], 0.0, 'REPLACE')
            groups['head'].add([vi], 0.0, 'REPLACE')
            spine_w = 0.55 if z > (torso_lo + torso_hi) * 0.55 else 0.25
            hips_w = 1.0 - spine_w
            groups['spine'].add([vi], spine_w, 'REPLACE')
            groups['hips'].add([vi], hips_w, 'REPLACE')
            groups['root'].add([vi], 0.0, 'REPLACE')
            continue
        # Soft clamp: kill opposite-side limb weights far from midline bleed
        if x > 0.07:
            for name in ('arm.R', 'lower.arm.R', 'leg.R'):
                if _vg_weight(body, vi, groups[name].index) > 0.0:
                    groups[name].add([vi], 0.0, 'REPLACE')
        elif x < -0.07:
            for name in ('arm.L', 'lower.arm.L', 'leg.L'):
                if _vg_weight(body, vi, groups[name].index) > 0.0:
                    groups[name].add([vi], 0.0, 'REPLACE')


def _textured_mat(name, img, roughness=0.42):
    mat = make_material(name, (1, 1, 1, 1), roughness=roughness)
    mat.blend_method = 'BLEND'
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Closest'
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if bsdf.inputs.get('Alpha'):
        mat.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    if bsdf.inputs.get('Emission Color'):
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        # Mild lift for atlas contrast in Blender preview; runtime uses selective bright-ink emissive
        bsdf.inputs['Emission Strength'].default_value = 0.22
    return mat


def _body_aabb(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    mn = Vector((min(xs), min(ys), min(zs)))
    mx = Vector((max(xs), max(ys), max(zs)))
    return mn, mx


def _head_ratio(body: bpy.types.Object) -> float:
    """Fraction of body height occupied by the head bulb (neck pinch → crown)."""
    pts = [v.co for v in body.data.vertices]
    zs = [p.z for p in pts]
    z_min, z_max = min(zs), max(zs)
    span = max(z_max - z_min, 1e-6)
    # Slice widths along Z; head starts where width flares past a narrow neck.
    slices = 24
    widths = []
    for i in range(slices):
        lo = z_min + span * (i / slices)
        hi = z_min + span * ((i + 1) / slices)
        band = [p.x for p in pts if lo <= p.z < hi]
        if not band:
            widths.append(0.0)
            continue
        widths.append(max(band) - min(band))
    # Search upper half for min width (neck), then flare above = head start.
    search = list(range(int(slices * 0.35), int(slices * 0.75)))
    neck_i = min(search, key=lambda i: widths[i] if widths[i] > 1e-4 else 1e9)
    head_start_i = neck_i
    neck_w = max(widths[neck_i], 1e-6)
    for i in range(neck_i, slices):
        if widths[i] >= neck_w * 1.18:
            head_start_i = i
            break
    head_lo = z_min + span * (head_start_i / slices)
    return max(0.0, min(1.0, (z_max - head_lo) / span))


def adapt_ref_body(src_body: bpy.types.Object, body_mat) -> bpy.types.Object:
    """Hybrid body: keep reference limb layout, soften for cute vinyl — no metaball bean.

    Procedural metaballs kept melting into pills. The HEAD reference silhouette already
    has readable underarm/crotch valleys; we clone it, mild-smooth for toy finish, nudge
    toward art-direction AABB, then attach our atlas faces + accessories.
    """
    # Bake world transform so unparenting doesn't drift the mesh off the rig.
    mw = src_body.matrix_world.copy()
    body = src_body.copy()
    body.data = src_body.data.copy()
    bpy.context.collection.objects.link(body)
    body.name = 'body_hybrid'
    body.data.name = 'body_hybrid'
    body.parent = None
    body.matrix_world = mw

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Drop ref skin / armature mods — we re-weight after vinyl soften.
    for mod in list(body.modifiers):
        body.modifiers.remove(mod)
    for vg in list(body.vertex_groups):
        body.vertex_groups.remove(vg)

    # Remove the imported original so only the hybrid remains.
    bpy.data.objects.remove(src_body, do_unlink=True)
    body.name = 'body'
    body.data.name = 'body'

    # Ground + center (ref sits slightly above z=0).
    zs = [v.co.z for v in body.data.vertices]
    min_z = min(zs)
    mid_x = sum(v.co.x for v in body.data.vertices) / len(body.data.vertices)
    mid_y = sum(v.co.y for v in body.data.vertices) / len(body.data.vertices)
    for v in body.data.vertices:
        v.co.x -= mid_x
        v.co.y -= mid_y
        v.co.z -= min_z - 0.01
    body.data.update()

    # Mild vinyl soften ONLY — Remesh/over-smooth re-fuses stubby limbs into a bean.
    # Keep this light: ref topology already has underarm/crotch valleys we must not erase.
    smooth = body.modifiers.new('Smooth', 'SMOOTH')
    smooth.factor = 0.05
    smooth.iterations = 1
    _apply_modifiers(body)

    # Art-direction AABB ≈ (0.81 × 0.78 × 1.23). Uniform-ish scale preserves limb gaps.
    mn, mx = _body_aabb(body)
    size = mx - mn
    target = Vector((0.81, 0.78, 1.23))
    sx = max(0.85, min(1.25, target.x / max(size.x, 1e-6)))
    sy = max(0.85, min(1.25, target.y / max(size.y, 1e-6)))
    sz = max(0.90, min(1.15, target.z / max(size.z, 1e-6)))
    for v in body.data.vertices:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    min_z = min(v.co.z for v in body.data.vertices)
    for v in body.data.vertices:
        v.co.z -= min_z - 0.01
    body.data.update()

    # Iso fix: ref head ≈ arm width, so head dominates the silhouette and reads as a pill.
    # Slim the crown and push stubby arms past it — keep ref valleys, don't metaball.
    _slim_head_bulb(body, max_head_width=0.60)
    _soft_limb_hints_ref(body)
    _a_pose_arms_ref(body)
    _face_mask_indent(body)

    # Contract floor: arm band clearly past head (≥ 0.80; aim ~0.88 for iso).
    _ensure_arm_xspan(body, target=0.88, z_lo=0.20, z_hi=0.54)

    # Re-ground after sculpt
    min_z = min(v.co.z for v in body.data.vertices)
    for v in body.data.vertices:
        v.co.z -= min_z - 0.01
    body.data.update()

    shade_smooth(body)
    assign_material(body, body_mat)

    mn, mx = _body_aabb(body)
    size = mx - mn
    hr = _head_ratio(body)
    band_xs = [v.co.x for v in body.data.vertices if 0.22 <= v.co.z <= 0.50]
    xspan = (max(band_xs) - min(band_xs)) if band_xs else 0.0
    head_xs = [v.co.x for v in body.data.vertices if v.co.z >= max(v.co.z for v in body.data.vertices) * 0.48]
    head_w = (max(head_xs) - min(head_xs)) if head_xs else 0.0
    print(
        f'Hybrid ref body verts={len(body.data.vertices)} AABB=({size.x:.3f},{size.y:.3f},{size.z:.3f}) '
        f'head_ratio≈{hr:.2f} arm_xspan≈{xspan:.3f} head_w≈{head_w:.3f}'
    )
    return body


def _soft_limb_hints_ref(body: bpy.types.Object) -> None:
    """Deepen underarm/crotch valleys on the reference silhouette — keep person, don't melt."""
    for v in body.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        ax = abs(x)
        # Underarm notch — carve between torso and arm buds so iso sees a gap
        if 0.30 <= z <= 0.58 and 0.030 <= ax <= 0.185:
            t = 1.0 - abs(ax - 0.100) / 0.075
            t = max(0.0, min(1.0, t))
            v.co.x *= 1.0 - 0.32 * t
            v.co.y *= 1.0 - 0.08 * t
        # Crotch valley — separate stubby legs
        if 0.02 <= z <= 0.24 and ax <= 0.105:
            t = 1.0 - ax / 0.105
            v.co.x *= 1.0 - 0.30 * t
            v.co.z += 0.010 * t
        # Soft neck pinch — two volumes (head vs torso)
        if 0.52 <= z <= 0.62 and ax <= 0.16:
            t = 1.0 - ax / 0.16
            v.co.x *= 1.0 - 0.07 * t
            v.co.y *= 1.0 - 0.05 * t
        # Outer arm reach — tip stubs past the (slimmed) head
        if 0.24 <= z <= 0.54 and ax >= 0.16:
            t = min(1.0, (ax - 0.16) / 0.18)
            v.co.x *= 1.0 + 0.14 * t
        # Outer leg reach — keep feet/shins from reading as one stump
        if 0.01 <= z <= 0.24 and ax >= 0.08:
            t = min(1.0, (ax - 0.08) / 0.10)
            v.co.x *= 1.0 + 0.10 * t
    body.data.update()


def _a_pose_arms_ref(body: bpy.types.Object) -> None:
    """Stronger mild A-pose so top-down iso sees stubby arms past the head."""
    for v in body.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        ax = abs(x)
        if 0.20 <= z <= 0.56 and ax >= 0.12:
            t = min(1.0, (ax - 0.12) / 0.24)
            # Forward-out for isometric silhouette (camera looks from +Y toward −Y)
            v.co.y -= 0.068 * t
            v.co.x *= 1.0 + 0.09 * t
            v.co.z -= 0.014 * t
        # Hand tips a bit more forward / out
        if 0.18 <= z <= 0.36 and ax >= 0.28:
            t = min(1.0, (ax - 0.28) / 0.16)
            v.co.y -= 0.036 * t
            v.co.x *= 1.0 + 0.04 * t
    body.data.update()


def _ensure_arm_xspan(
    body: bpy.types.Object,
    target: float = 0.88,
    z_lo: float = 0.16,
    z_hi: float = 0.48,
) -> None:
    """Push stubby ARMS until arm-band xspan clears target — never inflate the head."""

    def _arm_verts():
        # Arms live below the head bulb, outboard and/or A-posed forward (−Y).
        out = []
        for v in body.data.vertices:
            if not (z_lo <= v.co.z <= z_hi):
                continue
            ax = abs(v.co.x)
            # Exclude head-ish upper midline; require outboard or forward stub
            if v.co.z > 0.50 and ax < 0.22:
                continue
            if ax >= 0.10 or v.co.y < -0.015:
                out.append(v)
        return out

    for _ in range(8):
        arms = _arm_verts()
        if not arms:
            return
        xs = [v.co.x for v in arms]
        xspan = max(xs) - min(xs)
        if xspan >= target:
            break
        need = target / max(xspan, 1e-6)
        for v in arms:
            ax = abs(v.co.x)
            if ax > 0.12:
                v.co.x *= need
                v.co.y -= 0.008 * min(1.0, (ax - 0.12) / 0.24)
            elif ax > 0.05:
                t = (ax - 0.05) / 0.07
                sign = 1.0 if v.co.x >= 0.0 else -1.0
                v.co.x += sign * 0.080 * t * need
                v.co.y -= 0.024 * t
            elif v.co.y < -0.02:
                # Forward stubs near midline — shove sideways into arm silhouette
                sign = 1.0 if v.co.x >= 0.0 else -1.0
                if abs(v.co.x) < 1e-4:
                    continue
                v.co.x += sign * 0.040 * need
        body.data.update()

    arms = _arm_verts()
    if not arms:
        return
    xs = [v.co.x for v in arms]
    xspan = max(xs) - min(xs)
    if xspan < target:
        pad = 0.5 * (target - xspan) + 0.012
        for v in arms:
            if v.co.x > 0.08:
                v.co.x += pad
            elif v.co.x < -0.08:
                v.co.x -= pad
        body.data.update()


def _slim_head_bulb(body: bpy.types.Object, max_head_width: float = 0.58) -> None:
    """Keep the head bulb narrower than outstretched arms (anti-bean)."""
    zs = [v.co.z for v in body.data.vertices]
    z_max = max(zs)
    head_lo = z_max * 0.48
    head = [v for v in body.data.vertices if v.co.z >= head_lo]
    if not head:
        return
    xs = [v.co.x for v in head]
    hw = max(xs) - min(xs)
    if hw <= max_head_width:
        return
    scale = max_head_width / max(hw, 1e-6)
    for v in head:
        v.co.x *= scale
        # Soften Y slightly so the head stays round, not a flat coin
        v.co.y *= 0.5 + 0.5 * scale
    body.data.update()


def _soft_limb_hints(body: bpy.types.Object) -> None:
    """Carve underarm / crotch valleys so stubby limbs read at isometric distance."""
    for v in body.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        ax = abs(x)
        # Deeper underarm notch between torso and arm buds
        if 0.28 <= z <= 0.54 and 0.030 <= ax <= 0.185:
            t = 1.0 - abs(ax - 0.100) / 0.075
            t = max(0.0, min(1.0, t))
            v.co.x *= 1.0 - 0.30 * t
            v.co.y *= 1.0 - 0.08 * t
        # Crotch valley between leg buds
        if 0.03 <= z <= 0.22 and ax <= 0.105:
            t = 1.0 - ax / 0.105
            v.co.x *= 1.0 - 0.28 * t
            v.co.z += 0.012 * t
        # Outer arm silhouette push — stubby paws stick out past torso
        if 0.26 <= z <= 0.52 and ax >= 0.16:
            t = min(1.0, (ax - 0.16) / 0.18)
            v.co.x *= 1.0 + 0.11 * t
        if 0.01 <= z <= 0.22 and ax >= 0.08:
            t = min(1.0, (ax - 0.08) / 0.10)
            v.co.x *= 1.0 + 0.07 * t
        # Soft neck pinch — keep head/torso as two volumes (mild — don't erase head)
        if 0.54 <= z <= 0.62 and ax <= 0.14:
            t = 1.0 - ax / 0.14
            v.co.x *= 1.0 - 0.06 * t
            v.co.y *= 1.0 - 0.04 * t
    body.data.update()


def _a_pose_arms(body: bpy.types.Object) -> None:
    """Mild A-pose: pull outer arm verts forward (−Y) and slightly down so iso sees stubs."""
    for v in body.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        ax = abs(x)
        if 0.20 <= z <= 0.54 and ax >= 0.12:
            t = min(1.0, (ax - 0.12) / 0.24)
            # Forward-out for isometric silhouette (camera looks from +Y toward −Y)
            v.co.y -= 0.070 * t
            v.co.x *= 1.0 + 0.08 * t
            v.co.z -= 0.016 * t
        # Hand tips a bit more forward
        if 0.18 <= z <= 0.34 and ax >= 0.30:
            t = min(1.0, (ax - 0.30) / 0.16)
            v.co.y -= 0.038 * t
    body.data.update()


def _face_mask_indent(body: bpy.types.Object) -> None:
    """Flatten any ref face cavity so atlas paints on vinyl — recesses read as dark screens."""
    pts = [v.co.copy() for v in body.data.vertices]
    # Estimate front shell of the head (excluding deep face dish).
    head = [p for p in pts if p.z > 0.55]
    if not head:
        return
    # Use cheek/side front as target; ignore mid-face band which may be recessed.
    cheeks = [p for p in head if abs(p.x) > 0.12 and abs(p.x) < 0.28 and 0.65 < p.z < 1.0]
    if not cheeks:
        cheeks = [p for p in head if abs(p.x) > 0.10]
    target_front = min(p.y for p in cheeks) if cheeks else min(p.y for p in head)

    for v in body.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        if z < 0.58 or z > 1.05 or abs(x) > 0.24:
            continue
        if y > -0.02:
            continue
        # Elliptical mid-face band
        nx = x / 0.20
        nz = (z - 0.80) / 0.26
        r2 = nx * nx + nz * nz
        if r2 > 1.0:
            continue
        t = max(0.0, 1.0 - r2)
        # Pull recessed verts out toward cheek front (fill the dark dish)
        if y > target_front:  # more positive Y = more recessed (toward back)
            v.co.y = y + (target_front - y) * (0.85 * t)
    body.data.update()


def _make_baseball_cap(acc_mat, top_z: float = 1.14) -> bpy.types.Object:
    """Tall soft beanie — reads at iso dist~13 (Wave 10 silhouette)."""
    bpy.ops.mesh.primitive_uv_sphere_add(
        location=Vector((0.0, 0.004, top_z - 0.008)),
        radius=0.178,
        segments=28,
        ring_count=16,
    )
    dome = bpy.context.active_object
    dome.name = 'cap_dome'
    bpy.ops.object.mode_set(mode='OBJECT')
    # Flatten underside so it hugs the crown like a beanie
    for v in dome.data.vertices:
        if v.co.z < -0.040:
            v.co.z = -0.040 + (v.co.z + 0.040) * 0.10
            v.co.x *= 0.90
            v.co.y *= 0.90
        # Soft rounded peak (taller beanie puff for iso silhouette)
        if v.co.z > 0.028:
            v.co.x *= 0.86
            v.co.y *= 0.86
            v.co.z *= 1.22
    # Tall soft dome — unmistakable crown bump vs bare head / headphones
    dome.scale = (1.14, 1.10, 1.12)
    bpy.ops.object.transform_apply(scale=True)
    assign_material(dome, acc_mat)
    add_subsurf(dome, 1)
    _apply_modifiers(dome)
    shade_smooth(dome)

    # Rolled cuff only (no forward platter brim) — thicker for iso read
    rim = add_cylinder(
        'cap_rim',
        Vector((0.0, 0.002, top_z - 0.078)),
        radius=0.172,
        depth=0.044,
        material=acc_mat,
        vertices=28,
    )
    rim.scale = (1.06, 1.04, 0.62)
    bpy.ops.object.transform_apply(scale=True)
    for v in rim.data.vertices:
        ax = math.sqrt(v.co.x * v.co.x + v.co.y * v.co.y)
        if ax > 0.12 and v.co.z < 0.0:
            v.co.z -= 0.010
            # Soft outward roll
            v.co.x *= 1.06
            v.co.y *= 1.06
    bevel = rim.modifiers.new('Bevel', 'BEVEL')
    bevel.width = 0.014
    bevel.segments = 2
    add_subsurf(rim, 1)
    _apply_modifiers(rim)
    shade_smooth(rim)

    bpy.ops.object.select_all(action='DESELECT')
    dome.select_set(True)
    rim.select_set(True)
    bpy.context.view_layer.objects.active = dome
    bpy.ops.object.join()
    cap = bpy.context.active_object
    cap.name = 'cap'
    cap.data.name = 'cap'
    return cap


def _make_headphones(acc_mat, top_z: float = 1.14) -> bpy.types.Object:
    """Chunky cute cups — ear paddles read at iso vs beanie (Wave 10)."""
    ear_z = top_z - 0.26
    radius = 0.238
    y = -0.01
    parts: list[bpy.types.Object] = []

    steps = 10
    for i in range(steps + 1):
        theta = math.pi * i / steps
        x = radius * math.cos(theta)
        z = ear_z + radius * math.sin(theta) * 0.82
        bpy.ops.mesh.primitive_uv_sphere_add(
            location=Vector((x, y, z)),
            radius=0.024,
            segments=10,
            ring_count=6,
        )
        bead = bpy.context.active_object
        bead.name = f'hp_band_{i}'
        assign_material(bead, acc_mat)
        shade_smooth(bead)
        parts.append(bead)

    for sx in (1, -1):
        bpy.ops.mesh.primitive_uv_sphere_add(
            location=Vector((radius * sx, y, ear_z)),
            radius=0.098,
            segments=18,
            ring_count=12,
        )
        cup = bpy.context.active_object
        cup.name = f'cup_{sx}'
        # Thicker X (stick out past cheeks) + taller Z for unmistakable ear cups
        cup.scale = (0.58, 1.22, 1.28)
        bpy.ops.object.transform_apply(scale=True)
        assign_material(cup, acc_mat)
        shade_smooth(cup)
        parts.append(cup)

    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    headphones = bpy.context.active_object
    headphones.name = 'headphones'
    headphones.data.name = 'headphones'
    return headphones


def _make_face_shell(
    name: str,
    center: Vector,
    half_x: float,
    half_z: float,
    head_center: Vector,
    head_radius: float,
    mat: bpy.types.Material,
    proud: float = 0.0025,
) -> bpy.types.Object:
    """Curved face patch that follows the head sphere — not a flat googly card."""
    # Dense grid in XZ, bend onto sphere. Oversized chibi shells need a curve radius
    # that covers the patch diagonal so corners don't collapse to a flat plane.
    segs_x, segs_z = 14, 10
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=segs_x,
        y_subdivisions=segs_z,
        size=1.0,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    # Grid lies in XY; rotate to XZ facing −Y
    obj.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
    bpy.ops.object.transform_apply(rotation=True)

    patch_diag = math.sqrt(half_x * half_x + half_z * half_z)
    curve_r = max(head_radius, patch_diag + 0.04)

    for v in obj.data.vertices:
        lx = (v.co.x) * (half_x * 2.0)  # grid is size 1 → [-0.5,0.5]
        lz = (v.co.z) * (half_z * 2.0)
        # Sphere surface in front (−Y): y = cy - sqrt(r^2 - (x-cx)^2 - (z-cz)^2)
        dx = lx
        dz = lz
        r2 = curve_r * curve_r
        inside = r2 - dx * dx - dz * dz
        if inside < 1e-6:
            inside = 1e-6
        # Hair outside so atlas wins depth vs vinyl; keep flush Δ ≤ 0.01 after project
        y = -math.sqrt(inside) + proud
        v.co = Vector((dx, y, dz))
    obj.location = Vector((head_center.x, head_center.y, center.z))
    bpy.ops.object.transform_apply(location=True)
    # Nudge so patch sits at intended Z band center
    dz = center.z - sum(v.co.z for v in obj.data.vertices) / max(len(obj.data.vertices), 1)
    for v in obj.data.vertices:
        v.co.z += dz
    obj.data.update()
    # Normals must face camera (−Y); curved grid can cull as back-faces.
    import bmesh as _bm
    bm = _bm.new()
    bm.from_mesh(obj.data)
    _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    # If average normal points +Y (into head), flip all
    nsum = __import__('mathutils').Vector((0, 0, 0))
    for f in bm.faces:
        nsum += f.normal
    if nsum.y > 0:
        _bm.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    assign_material(obj, mat)
    shade_smooth(obj)
    return obj


def _shrinkwrap_face_to_body(face: bpy.types.Object, body: bpy.types.Object) -> None:
    """Light project onto head; keep a hair of offset so the atlas stays visible."""
    wrap = face.modifiers.new('FaceWrap', 'SHRINKWRAP')
    wrap.target = body
    wrap.wrap_method = 'PROJECT'
    wrap.use_project_y = True
    wrap.use_negative_direction = True
    wrap.use_positive_direction = False
    wrap.offset = 0.0012
    wrap.cull_face = 'OFF'
    _apply_modifiers(face)


def create_icon_meshes(
    arm_obj: bpy.types.Object,
    eyes_img,
    mouth_img,
    ref_body: bpy.types.Object,
) -> list[bpy.types.Object]:
    # Soft matte vinyl
    body_mat = make_material('body', (0.97, 0.97, 0.98, 1.0), roughness=0.53)
    eye_mat = _textured_mat('eyes', eyes_img, roughness=0.40)
    mouth_mat = _textured_mat('mouth', mouth_img, roughness=0.40)
    acc_mat = make_material('accessory', (0.12, 0.13, 0.16, 1.0), roughness=0.48, metallic=0.18)
    cap_mat = make_material('cap_mat', (0.97, 0.97, 0.98, 1.0), roughness=0.55)

    body = adapt_ref_body(ref_body, body_mat)

    # Face cards: thin, mid-face, front face nearly at head_front (embedded).
    zs = [v.co.z for v in body.data.vertices]
    z_max = max(zs)
    head_verts = [v.co for v in body.data.vertices if v.co.z > z_max * 0.45]
    head_front = min(v.y for v in head_verts)
    head_top = max(v.z for v in head_verts)
    head_bottom = min(v.z for v in head_verts)
    head_h = max(head_top - head_bottom, 1e-6)
    face_mid_z = head_bottom + head_h * 0.46
    # Iso camera looks down (~59°): put face on upper-front so it isn't foreshortened onto the chin.
    eyes_z = face_mid_z + head_h * 0.10
    mouth_z = face_mid_z - head_h * 0.02

    # Approximate head sphere for curved face patches
    head_xs = [v.x for v in head_verts]
    head_ys = [v.y for v in head_verts]
    head_zs = [v.z for v in head_verts]
    head_center = Vector(
        (
            (min(head_xs) + max(head_xs)) * 0.5,
            (min(head_ys) + max(head_ys)) * 0.5,
            (min(head_zs) + max(head_zs)) * 0.5,
        )
    )
    head_radius = max(
        (max(head_xs) - min(head_xs)) * 0.5,
        (max(head_ys) - min(head_ys)) * 0.5,
        (max(head_zs) - min(head_zs)) * 0.5,
    )

    # Ink-only atlases (transparent — no white face plate / bandit mask).
    # Bigger near-square shells so eyes+brows+mouth read cute at iso.
    head_width = max(1e-6, max(head_xs) - min(head_xs))
    eyes_w = min(max(head_width * 0.72, 0.46), 0.52)
    mouth_w = min(max(head_width * 0.55, 0.34), 0.40)
    eyes_half_x = eyes_w * 0.5
    eyes_half_z = eyes_half_x * 0.82
    mouth_half_x = mouth_w * 0.5
    mouth_half_z = mouth_half_x * 0.65
    print(
        f'Face ink target head_w={head_width:.3f} eyes_w={eyes_w:.3f} '
        f'mouth_w={mouth_w:.3f} head_r={head_radius:.3f}'
    )

    eyes = _make_face_shell(
        'eyes',
        Vector((0.0, head_front, eyes_z)),
        half_x=eyes_half_x,
        half_z=eyes_half_z,
        head_center=head_center,
        head_radius=head_radius,
        mat=eye_mat,
        proud=0.0035,
    )
    mouth = _make_face_shell(
        'mouth',
        Vector((0.0, head_front, mouth_z)),
        half_x=mouth_half_x,
        half_z=mouth_half_z,
        head_center=head_center,
        head_radius=head_radius * 0.98,
        mat=mouth_mat,
        proud=0.0035,
    )
    # UV from the designed shell XZ *before* shrinkwrap — project compresses height and
    # turns round pupils into horizontal dashes if UVs are recomputed after.
    _set_face_uv(eyes, col=0, row=0, zoom=0.90)
    _set_face_uv(mouth, col=1, row=0, zoom=0.90)

    _shrinkwrap_face_to_body(eyes, body)
    _shrinkwrap_face_to_body(mouth, body)

    def _flush_face(face: bpy.types.Object, target_front: float, proud: float = 0.0055) -> None:
        """Pull the whole patch so its front sits on the head surface."""
        pts = [face.matrix_world @ v.co for v in face.data.vertices]
        cur_front = min(p.y for p in pts)
        dy = target_front - cur_front + proud  # proud of vinyl; keep flush Δ ≤ 0.01
        for v in face.data.vertices:
            v.co.y += dy
        face.data.update()

    _flush_face(eyes, head_front)
    _flush_face(mouth, head_front)

    eyes_pts = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
    eyes_front = min(p.y for p in eyes_pts)
    print(
        f'Face place curved eyes_z={eyes_z:.3f} mouth_z={mouth_z:.3f} '
        f'head_front={head_front:.4f} eyes_front={eyes_front:.4f} '
        f'delta={eyes_front - head_front:.4f} head_r={head_radius:.3f}'
    )

    top_z = head_top
    cap = _make_baseball_cap(cap_mat, top_z)
    headphones = _make_headphones(acc_mat, top_z)

    # Body gets automatic weights across the full skeleton.
    body_mod = body.modifiers.new('Armature', 'ARMATURE')
    body_mod.object = arm_obj
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # Clean skin weights so Walk stays local (no torso melt / accessory yank).
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    # Higher clean limit strips soft limb spill; 2 influences keep vinyl soft folds.
    bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.14, keep_single=False)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=2)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    _refine_body_weights(body)
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.10, keep_single=False)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=2)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Eyes/mouth/accessories: keep world transform, skin 100% to head.
    # REST while parenting so matrix_world → bone-local uses bind pose.
    # Must restore POSE before glTF export — force-sampling in REST bakes
    # every action down to 2 rest-pose keys (Walk leg travel → 0).
    arm_obj.data.pose_position = 'REST'
    for obj in (eyes, mouth, cap, headphones):
        mw = obj.matrix_world.copy()
        obj.parent = arm_obj
        obj.matrix_world = mw
        _pin_mesh_to_bone(obj, arm_obj, 'head')
        # Remove any prior armature mods
        for mod in list(obj.modifiers):
            if mod.type == 'ARMATURE':
                obj.modifiers.remove(mod)
        mod = obj.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm_obj
        mod.use_bone_envelopes = False
        mod.use_vertex_groups = True
        print(f'{obj.name} groups={[g.name for g in obj.vertex_groups]} loc={tuple(round(x,3) for x in obj.location)}')
    arm_obj.data.pose_position = 'POSE'

    return [body, eyes, mouth, cap, headphones]


def build_character() -> None:
    ensure_reference_character()
    reset_scene()
    eyes_img, mouth_img = load_face_textures()

    bpy.ops.import_scene.gltf(filepath=REF_CHARACTER)
    arm_obj = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    ref_body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'body')

    # Drop bone custom shapes first — otherwise Icosphere refuses removal / reappears.
    for bone in arm_obj.pose.bones:
        bone.custom_shape = None
        bone.custom_shape_transform = None

    # Keep REF body for hybrid silhouette; drop ref faces/accessories/orphans.
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.name != 'body':
            bpy.data.objects.remove(obj, do_unlink=True)

    for action in list(bpy.data.actions):
        if action.name not in REQUIRED_ACTIONS:
            bpy.data.actions.remove(action)

    create_icon_meshes(arm_obj, eyes_img, mouth_img, ref_body)

    allowed = {'body', 'eyes', 'mouth', 'cap', 'headphones'}

    # Force-remove every non-contract mesh (incl. armature children / bone shapes).
    # use_selection still walks armature children; orphans must be gone first.
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.name not in allowed:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Purge leftover mesh datablocks (Icosphere, metaball debris, stale name holders)
    for mesh in list(bpy.data.meshes):
        if mesh.name not in allowed and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
        elif mesh.name in allowed and mesh.users == 0:
            # Free stale name so live mesh can be renamed without .001 suffix
            bpy.data.meshes.remove(mesh)

    # Final sweep — catch renames like Icosphere.001
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.name.split('.')[0] not in allowed and obj.name not in allowed:
            bpy.data.objects.remove(obj, do_unlink=True)

    for name in allowed:
        obj = bpy.data.objects.get(name)
        if obj:
            obj.name = name
            obj.data.name = name

    bpy.ops.object.select_all(action='DESELECT')
    arm_obj.select_set(True)
    for name in allowed:
        obj = bpy.data.objects.get(name)
        if obj:
            obj.select_set(True)

    # Preserve imported reference actions (layered Action slots in Blender 5).
    # export_apply=True / pose_position=REST + force sampling both collapse
    # Walk to rest stubs (ours leg travel 0 vs ref ~0.15).
    arm_obj.data.pose_position = 'POSE'
    if arm_obj.animation_data is None:
        arm_obj.animation_data_create()
    ad = arm_obj.animation_data
    for track in list(ad.nla_tracks):
        ad.nla_tracks.remove(track)
    for action in bpy.data.actions:
        if action.name not in REQUIRED_ACTIONS:
            continue
        action.use_fake_user = True
        track = ad.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, int(action.frame_range[0]), action)
    idle = bpy.data.actions.get('Idle')
    ad.action = idle
    if idle is not None and idle.slots:
        ad.action_slot = idle.slots[0]

    ensure_dir(MODELS_DIR)
    bpy.ops.export_scene.gltf(
        filepath=f'{MODELS_DIR}/character.glb',
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_nla_strips=True,
        export_force_sampling=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    print('Exported character.glb')
    _print_verify_metrics(arm_obj)


def _walk_leg_travel(arm_obj: bpy.types.Object) -> tuple[float, float]:
    """Peak |ΔY| of leg.L / leg.R bone heads across Walk (must stay > 0.05)."""
    walk = bpy.data.actions.get('Walk')
    if walk is None or arm_obj.animation_data is None:
        return 0.0, 0.0
    ad = arm_obj.animation_data
    prev_action = ad.action
    prev_slot = getattr(ad, 'action_slot', None)
    ad.action = walk
    if walk.slots:
        ad.action_slot = walk.slots[0]
    scene = bpy.context.scene
    f0, f1 = int(walk.frame_range[0]), int(walk.frame_range[1])
    travels = {'leg.L': [], 'leg.R': []}
    for frame in range(f0, f1 + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for name in travels:
            pb = arm_obj.pose.bones.get(name)
            if pb is None:
                continue
            travels[name].append((arm_obj.matrix_world @ pb.head).y)
    ad.action = prev_action
    if prev_slot is not None:
        ad.action_slot = prev_slot
    out = []
    for name in ('leg.L', 'leg.R'):
        ys = travels[name]
        out.append((max(ys) - min(ys)) if ys else 0.0)
    return out[0], out[1]


def _print_verify_metrics(arm_obj: bpy.types.Object) -> None:
    body = bpy.data.objects.get('body')
    eyes = bpy.data.objects.get('eyes')
    mouth = bpy.data.objects.get('mouth')
    if body:
        pts = [body.matrix_world @ v.co for v in body.data.vertices]
        xs = [p.x for p in pts]
        ys = [p.y for p in pts]
        zs = [p.z for p in pts]
        size = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
        hr = _head_ratio(body)
        print(
            f'Body verts={len(body.data.vertices)} AABB=({size[0]:.3f},{size[1]:.3f},{size[2]:.3f}) '
            f'head_ratio≈{hr:.2f}'
        )
        band = [p for p in pts if 0.22 <= p.z <= 0.50]
        if band:
            bxs = [p.x for p in band]
            print(f'Arm band xspan={max(bxs) - min(bxs):.3f}')
        torso = [p for p in pts if 0.25 <= p.z <= 0.45]
        head = [p for p in pts if p.z > max(zs) * 0.48]
        if torso and head:
            torso_w = max(p.x for p in torso) - min(p.x for p in torso)
            head_w = max(p.x for p in head) - min(p.x for p in head)
            print(f'Head vs torso width={head_w:.3f} / {torso_w:.3f}')
        # Face-band front (mid-head) — matches flush contract better than crown tip
        face_band = [p for p in pts if 0.70 <= p.z <= 0.95 and abs(p.x) < 0.22]
        head_front = min(p.y for p in face_band) if face_band else (
            min(p.y for p in head) if head else 0.0
        )
        if eyes:
            eyes_pts = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
            eyes_front = min(p.y for p in eyes_pts)
            eyes_w = max(p.x for p in eyes_pts) - min(p.x for p in eyes_pts)
            eyes_h = max(p.z for p in eyes_pts) - min(p.z for p in eyes_pts)
            eyes_cz = sum(p.z for p in eyes_pts) / len(eyes_pts)
            print(
                f'Eyes size=({eyes_w:.3f}×{eyes_h:.3f}) front_y={eyes_front:.3f} '
                f'center_z={eyes_cz:.3f} head_front_y={head_front:.3f} '
                f'delta={eyes_front - head_front:.3f}'
            )
        if mouth:
            mouth_pts = [mouth.matrix_world @ v.co for v in mouth.data.vertices]
            mouth_w = max(p.x for p in mouth_pts) - min(p.x for p in mouth_pts)
            mouth_h = max(p.z for p in mouth_pts) - min(p.z for p in mouth_pts)
            mouth_cz = sum(p.z for p in mouth_pts) / len(mouth_pts)
            print(f'Mouth size=({mouth_w:.3f}×{mouth_h:.3f}) center_z={mouth_cz:.3f}')
    for name in ('cap', 'headphones'):
        obj = bpy.data.objects.get(name)
        if obj:
            pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
            sx = max(p.x for p in pts) - min(p.x for p in pts)
            sy = max(p.y for p in pts) - min(p.y for p in pts)
            sz = max(p.z for p in pts) - min(p.z for p in pts)
            print(f'{name} verts={len(obj.data.vertices)} size=({sx:.3f},{sy:.3f},{sz:.3f})')
    tl, tr = _walk_leg_travel(arm_obj)
    print(f'Walk leg travel L={tl:.4f} R={tr:.4f} (need >0.05)')
    print(f'Actions={sorted(a.name for a in bpy.data.actions)}')
    print(f'Head bone present={arm_obj.data.bones.get("head") is not None}')
    print(f'pose_position={arm_obj.data.pose_position}')


if __name__ == '__main__':
    build_character()
