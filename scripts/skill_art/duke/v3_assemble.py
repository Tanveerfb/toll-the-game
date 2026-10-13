import os

from PIL import Image

A = r"E:\Installed\ComfyUI_windows_portable\ComfyUI\output\duke_v3_action"
SRC = [
    ("A01_guard", "A01_guard_00001_.png"),
    ("A02_lowstance", "A02_lowstance_00001_.png"),
    ("A03_crouchlunge", "A03_crouchlunge_00001_.png"),
    ("A04_fist_lunge", r"qclean\A04_fist_lunge_00001_.png"),
    ("A05_stride", "A05_stride_00001_.png"),
    ("A06_wide_crouch", "A06_wide_crouch_00001_.png"),
    ("A07_guard_stance", r"qclean\A07_nologo_00001_.png"),
    ("A08_leap", "A08_leap_00001_.png"),
    ("A09_lunge_fist", "A09_lunge_fist_00001_.png"),
    ("A10_high_kick", "A10_high_kick_00001_.png"),
    ("A11_slide_kick", "A11_slide_kick_00001_.png"),
    ("A12_slide_kick_b", r"qclean\A12_slide_kick_b_00001_.png"),
    ("A13_crouch_fist", r"qclean\A13_crouch_fist_00001_.png"),
]
out = os.path.join(A, "final")
os.makedirs(out, exist_ok=True)
heads = Image.new("RGB", (13 * 240, 300), (255, 255, 255))
for i, (key, rel) in enumerate(SRC):
    im = Image.open(os.path.join(A, rel)).convert("RGB")
    if im.size != (832, 1216):
        im = im.resize((832, 1216), Image.LANCZOS)
    im.save(os.path.join(out, f"{key}.png"))
    # head check strip: the darkest-top region is not reliable, so take the top half and let the eye find the head
    heads.paste(im.resize((240, 351)).crop((0, 0, 240, 300)), (i * 240, 0))
heads.save(r"C:\Users\Tanve\AppData\Local\Temp\claude\E--Projects-toll-the-game\0c1db477-bd2b-4e69-952b-1e94938ee752\scratchpad\heads.png")
print("ok", len(SRC))
