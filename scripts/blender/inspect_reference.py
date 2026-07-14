import bpy
import os

for label, path in [('OFFICE', '/tmp/ref-office.glb'), ('CHAR', '/tmp/ref-character.glb')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    print(f'\n=== {label} ===')
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type in {'MESH', 'EMPTY', 'ARMATURE'}:
            loc = obj.matrix_world.translation
            print(f'  {obj.type:8} {obj.name:30} loc=({loc.x:.2f},{loc.y:.2f},{loc.z:.2f})')
    if label == 'CHAR':
        arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
        if arm:
            for b in arm.data.bones:
                print(f'    bone {b.name} head={b.head_local} tail={b.tail_local}')
