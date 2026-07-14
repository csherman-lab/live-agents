"""Shared helpers for Live Agents procedural asset generation."""
from __future__ import annotations

import os

import bpy
from mathutils import Euler, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODELS_DIR = os.path.join(ROOT, 'public', 'models')
TEXTURES_DIR = os.path.join(MODELS_DIR, 'textures')


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.55,
    metallic: float = 0.0,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if emission:
            bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
            bsdf.inputs['Emission Strength'].default_value = emission_strength
    return mat


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def shade_smooth(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)


def add_subsurf(obj: bpy.types.Object, level: int = 1) -> None:
    mod = obj.modifiers.new('Subsurf', 'SUBSURF')
    mod.levels = level
    mod.render_levels = level


def add_cube(
    name: str,
    location: Vector,
    scale: Vector,
    material: bpy.types.Material,
    *,
    rotation: Euler | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, scale=scale, rotation=rotation or (0.0, 0.0, 0.0))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    assign_material(obj, material)
    return obj


def add_cylinder(
    name: str,
    location: Vector,
    radius: float,
    depth: float,
    material: bpy.types.Material,
    *,
    rotation: Euler | None = None,
    vertices: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=depth,
        vertices=vertices,
        location=location,
        rotation=rotation or (0.0, 0.0, 0.0),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    assign_material(obj, material)
    return obj


def add_poi(name: str, location: Vector, rotation_z: float = 0.0) -> bpy.types.Object:
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    empty.empty_display_size = 0.15
    empty.location = location
    empty.rotation_euler = Euler((0.0, 0.0, rotation_z))
    return empty


def export_glb(filepath: str) -> None:
    ensure_dir(os.path.dirname(filepath))
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
