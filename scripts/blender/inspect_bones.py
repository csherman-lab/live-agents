import bpy
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CHAR = os.path.join(ROOT, 'public', 'models', 'character.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CHAR)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for b in arm.data.bones:
    print(b.name)
