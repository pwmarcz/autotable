import bpy
import sys


def print_usage():
    print("usage: export.py target_file")


argv = sys.argv[1:]

if '--' not in argv:
    print_usage()
    exit(1)

argv = argv[argv.index("--") + 1:]

if len(argv) != 1:
    print_usage()
    exit(1)

target_file = argv[0]
bpy.ops.export_scene.gltf(filepath=target_file, export_apply=True, export_colors=False)
