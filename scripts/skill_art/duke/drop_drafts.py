"""Slide drop kick drafts, soles toward the lens (his pick 2026-10-08, ruling #184): mannequin duke_drop_e / duke_drop_f,
12 each, same recipe as kit_drafts.py (LoRA 0.65, short prompt, union depth 0.55 + openpose 0.6, end 0.7).
Outputs ComfyUI output/duke_kit/slide_drop/drafts/."""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.argv = [sys.argv[0]]
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("kd", os.path.join(os.path.dirname(os.path.abspath(__file__)), "kit_drafts.py"))
src = open(spec.origin, encoding="utf-8").read().split("# (slot, clause, pose name, count)")[0]
ns = {"__file__": spec.origin}
exec(compile(src, spec.origin, "exec"), ns)

COMFY = r"E:\Installed\ComfyUI_windows_portable\ComfyUI"
POSE_OUT = os.path.join(COMFY, "output", "duke_pose")
DROP = ("full body, (drop kick:1.35), airborne, body horizontal, (both feet together:1.2), (soles of the boots toward the viewer:1.3), "
        "both legs thrust straight at the viewer, (extreme foreshortening:1.2), boots huge in the foreground, torso and face behind the boots, "
        "arms back for balance, gritted teeth, intense eyes on the viewer")
for pose in ("duke_drop_e", "duke_drop_f"):
    for kind in ("depth", "pose"):
        shutil.copyfile(os.path.join(POSE_OUT, f"{pose}_{kind}.png"), os.path.join(COMFY, "input", f"pose3d_{pose}_{kind}.png"))
    for k in range(12):
        seed = 882000 + (0 if pose.endswith("e") else 100) + k
        g = ns["base_graph"](f"{ns['BODY']}, {DROP}, {ns['ACTION']}, {ns['STYLE']}", ns["NEG"], 832, 1216, seed,
                             f"duke_kit/slide_drop/drafts/{pose}_{seed}", batch=1, lora="duke_toll.safetensors",
                             lora_strength=0.65, hand_fix=False)
        pos, ng = ns["union"](g, ["2", 0], ["3", 0], f"pose3d_{pose}_depth.png", "depth", 0.55, ("40", "41", "42", "43"))
        pos, ng = ns["union"](g, pos, ng, f"pose3d_{pose}_pose.png", "openpose", 0.6, ("44", "45", "46", "47"))
        g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = pos, ng
        ns["queue"](g)
print("24 queued")
