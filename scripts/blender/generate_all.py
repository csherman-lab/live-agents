"""Generate all Live Agents 3D assets. Run: blender -b --python scripts/blender/generate_all.py"""
import importlib
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import generate_character
import generate_office

importlib.reload(generate_office)
importlib.reload(generate_character)

generate_character.ensure_reference_character()
generate_office.build_office()
generate_character.build_character()
print('All Live Agents assets generated.')
