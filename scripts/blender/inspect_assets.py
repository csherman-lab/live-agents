"""Inspect existing GLB assets — run: blender -b --python scripts/blender/inspect_assets.py"""
import bpy
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OFFICE = os.path.join(ROOT, 'public', 'models', 'office.glb')
CHAR = os.path.join(ROOT, 'public', 'models', 'character.glb')

for path, label in [(OFFICE, 'OFFICE'), (CHAR, 'CHARACTER')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    print(f'\n=== {label} ===')
    for obj in bpy.data.objects:
        print(f'  {obj.type:8} {obj.name}')
