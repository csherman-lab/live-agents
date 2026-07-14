import bpy
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OFFICE = os.path.join(ROOT, 'public', 'models', 'office.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=OFFICE)
for obj in bpy.data.objects:
    if obj.name.startswith('poi-'):
        p = obj.matrix_world.translation
        r = obj.matrix_world.to_euler()
        print(f'{obj.name}: pos=({p.x:.3f}, {p.y:.3f}, {p.z:.3f}) rot=({r.x:.3f}, {r.y:.3f}, {r.z:.3f})')
