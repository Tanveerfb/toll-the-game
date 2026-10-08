"""Stage the cleaned Duke dataset (grey lock in front of the ear painted out, his pick A, 2026-10-08) as datasets/duke_v2,
captions copied unchanged from duke_v1, and draw the full numbered approval sheet."""
import glob
import os
import shutil

from PIL import Image, ImageDraw, ImageFont

V1 = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v1"
V2 = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v2"
CL = r"E:\Installed\ComfyUI_windows_portable\ComfyUI\output\lora_duke_v2_lock"
SCR = os.path.dirname(os.path.abspath(__file__))
PICK = {"duke_01": 12, "duke_02": 13, "duke_04": 12, "duke_06": 14, "duke_08": 13, "duke_10": 16, "duke_12": 11,
        "duke_13": 14, "duke_14": 12, "duke_15": 11, "duke_16": 11, "duke_17": 11, "duke_18": 12, "duke_19": 11,
        "duke_20": 14, "duke_21": 11}
DROP = {"duke_07"}  # every repaint left a blob where the lock was
os.makedirs(V2, exist_ok=True)
rows = []
for f in sorted(glob.glob(os.path.join(V1, "*.png"))):
    n = os.path.basename(f)[:-4]
    if n in DROP:
        continue
    src = glob.glob(os.path.join(CL, f"{n}_s{PICK[n]}_*.png"))[0] if n in PICK else f
    shutil.copyfile(src, os.path.join(V2, n + ".png"))
    shutil.copyfile(os.path.join(V1, n + ".txt"), os.path.join(V2, n + ".txt"))
    rows.append((n, src, n in PICK, open(os.path.join(V1, n + ".txt"), encoding="utf-8").read().strip()))
font = ImageFont.truetype("arialbd.ttf", 26)
small = ImageFont.truetype("arial.ttf", 15)
tw, th, cols = 360, 470, 5
sheet = Image.new("RGB", (cols * tw, ((len(rows) + cols - 1) // cols) * th), "white")
d = ImageDraw.Draw(sheet)
for i, (n, src, changed, cap) in enumerate(rows):
    x, y = (i % cols) * tw, (i // cols) * th
    im = Image.open(src).convert("RGB")
    im.thumbnail((tw - 6, th - 60))
    sheet.paste(im, (x + 3, y + 3))
    d.rectangle([x, y, x + 120, y + 34], fill="black")
    d.text((x + 6, y + 3), n.replace("duke_", "D") + (" *" if changed else ""), fill="yellow", font=font)
    words, line, ly = cap.split(), "", y + th - 55
    for w in words:
        if d.textlength(line + w, font=small) > tw - 10:
            d.text((x + 4, ly), line, fill="black", font=small)
            line, ly = "", ly + 17
        line += w + " "
    d.text((x + 4, ly), line, fill="black", font=small)
sheet.save(os.path.join(SCR, "duke_v2_sheet.jpg"), quality=85)
print(len(rows), "staged")
