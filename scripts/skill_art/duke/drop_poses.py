"""A real drop kick: airborne and nearly horizontal, torso reclined, BOTH feet driven together at the target (image right),
arms out behind for balance. Three cameras. Adult build, no wrist above the shoulders."""
import json
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

REPO = r"E:\Projects\toll-the-game"
POSES = os.path.join(REPO, "scripts", "pose", "poses")
OUT = r"E:\Installed\ComfyUI_windows_portable\ComfyUI\output\duke_pose"
SCR = OUT  # the preview sheet lands beside the depth maps

base = {
    "_note": "Slide, real drop kick: body nearly horizontal in the air, torso reclined, both legs together driven at the target (image right), arms back for balance.",
    "height": 1.1, "thickness": 1.35,
    "pelvis": [0, 0, 1.0], "spine": [-1, 0.05, 0.4], "neck": [-0.4, 0, 1], "hip_axis": [0, 1, 0], "shoulder_axis": [0.1, 1, 0],
    "face": [1, -0.5, 0.1],
    "upper_arm_l": [-0.7, 0.6, -0.25], "forearm_l": [-0.9, 0.5, 0.1],
    "upper_arm_r": [-0.6, -0.7, -0.25], "forearm_r": [-0.8, -0.6, 0.15],
    "thigh_r": [1, 0.1, 0.2], "shin_r": [1, 0.03, 0.12], "foot_r": [0.15, -0.2, 1],
    "thigh_l": [1, -0.1, 0.2], "shin_l": [1, -0.03, 0.12], "foot_l": [0.15, 0.2, 1],
}


def cam(loc, look, lens, roll=0):
    c = {"location": loc, "look_at": look, "lens_mm": lens}
    if roll:
        c["roll_deg"] = roll
    return c


# duke_drop_a|b|c (side views, 2026-10-07) were drawn by an earlier version of this file; their JSONs stand in scripts/pose/poses.
# His pick 2026-10-08: soles toward the lens. The camera sits past his feet (+x), looking back along his body, wide lens,
# so both soles are huge in front and his face rides behind them, eyes on the viewer (the target). Tilted roll.
named = {
    "duke_drop_e": dict(base, camera=cam([1.65, -0.12, 1.42], [-0.15, 0.0, 1.1], 22, -24)),
    "duke_drop_f": dict(base, camera=cam([1.6, -0.05, 1.05], [-0.15, 0.0, 1.15], 22, 20)),
    "duke_drop_g": dict(base, camera=cam([1.55, -0.45, 1.5], [-0.15, 0.0, 1.05], 22, -35)),
}
for n, p in named.items():
    json.dump(p, open(os.path.join(POSES, n + ".json"), "w"), indent=2)
    r = subprocess.run([r"D:\Blender\blender.exe", "-b", "--factory-startup", "--python",
                        os.path.join(REPO, "scripts", "pose", "mannequin.py"), "--",
                        os.path.join(POSES, n + ".json"), OUT], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    print(n, [l for l in r.stdout.splitlines() if l.startswith("ok")] or r.stderr[-200:])
subprocess.run(["python", os.path.join(REPO, "scripts", "pose", "draw_pose.py"), OUT] + list(named), stdin=subprocess.DEVNULL)
font = ImageFont.truetype("arialbd.ttf", 22)
tw, th = 300, 438
sheet = Image.new("RGB", (tw * 3, th), "white")
d = ImageDraw.Draw(sheet)
for i, n in enumerate(named):
    sheet.paste(Image.open(os.path.join(OUT, n + "_depth.png")).convert("RGB").resize((tw, th)), (i * tw, 0))
    d.text((i * tw + 6, 4), n.replace("duke_", ""), fill="yellow", font=font)
sheet.save(os.path.join(SCR, "duke_drop2_preview.jpg"), quality=88)
