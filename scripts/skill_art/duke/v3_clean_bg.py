"""Cut each picked identity render out with BiRefNet and put it on plain white (the dataset ground).
Keeps Duke's pixels exactly; only the ink swirls and ground swatches go."""
import json
import os
import shutil
import sys
import time
import urllib.request

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import COMFY, queue  # noqa: E402

PICKS = [
    ("A01_guard", "d_buu_guard_base_940010_d82_960001"),
    ("A02_lowstance", "d_buu_lowstance_base_940000_d82_960002"),
    ("A03_crouchlunge", "d_gogeta_crouchlunge_base_940022_d82_960001"),
    ("A04_fist_lunge", "d_gogeta_lunge_base_940030_d82_960002"),
    ("A05_stride", "d_gogeta_stride_base_940042_d82_960002"),
    ("A06_wide_crouch", "d_goku_crouch_base_940111_d82_960001"),
    ("A07_guard_stance", "d_goku_guard_base_940123_d82_960001"),
    ("A08_leap", "d_goku_leap_base_940130_d82_960002"),
    ("A09_lunge_fist", "d_hit_lungefist_base_940101_d82_960001"),
    ("A10_high_kick", "s_highkick_base_940140_d82_960001"),
    ("A11_slide_kick", "s_slidekick_base_940150_d82_960002"),
    ("A12_slide_kick_b", "s_slidekick_base_940152_d82_960001"),
    ("A13_crouch_fist", "d_hit_crouchfist_base_940082_d82_960001"),
]
I = os.path.join(COMFY, "output", "duke_identity")
ids = []
for key, stem in PICKS:
    src = f"clean_{key}.png"
    shutil.copyfile(os.path.join(I, stem + "_00001_.png"), os.path.join(COMFY, "input", src))
    g = {
        "1": {"class_type": "LoadImage", "inputs": {"image": src}},
        "2": {"class_type": "BiRefNetRMBG", "inputs": {"image": ["1", 0], "model": "BiRefNet-general", "sensitivity": 1.0,
                                                       "mask_blur": 0, "mask_offset": 0, "invert_output": False,
                                                       "refine_foreground": False, "background": "Color",
                                                       "background_color": "#FFFFFF"}},
        "3": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": f"duke_v3_action/{key}"}},
    }
    ids.append(queue(g))
for pid in ids:
    while True:
        h = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
        if pid in h:
            print(h[pid]["status"]["status_str"], [m[1].get("exception_message", "")[:200] for m in h[pid]["status"]["messages"] if m[0] == "execution_error"])
            break
        time.sleep(2)
