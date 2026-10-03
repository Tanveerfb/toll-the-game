"""Turn mannequin.py's <name>_joints.json into an OpenPose image, and copy it plus the depth map
into ComfyUI input/ as pose3d_<name>_pose.png / pose3d_<name>_depth.png.
Usage: python scripts/pose/draw_pose.py <out_dir> <name> [<name> ...]"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lora"))
from common import COMFY, draw_skeleton  # noqa: E402

out_dir = sys.argv[1]
for name in sys.argv[2:]:
    j = json.load(open(os.path.join(out_dir, f"{name}_joints.json")))
    pts = {int(k): tuple(v) for k, v in j["joints"].items()}
    img = draw_skeleton(pts, f"pose3d_{name}_pose.png", tuple(j["size"]))
    img.save(os.path.join(out_dir, f"{name}_pose.png"))
    shutil.copy(os.path.join(out_dir, f"{name}_depth.png"), os.path.join(COMFY, "input", f"pose3d_{name}_depth.png"))
    print(name, len(pts), "joints")
