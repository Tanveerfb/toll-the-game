"""Official renders with the cleaned LoRA (duke_toll v2): img2img from his picked draft + mannequin depth/openpose
ControlNets + LoRA 0.9. Two denoise levels (0.72 keeps more of the draft; 0.82 lets the LoRA redraw the hair, which leaked
off-model from the drafts at 0.72 on 2026-10-08), 4 seeds each. Picks: Surge S2, Slide K4/K10 (drop kick, soles to lens),
Ultimate U19. Usage: official_render.py <lora file in models/loras>. Output ComfyUI output/duke_official3/<slot>/."""
import os
import shutil
import sys

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import CHECKPOINT, COMFY, NEG_BASE, queue  # noqa: E402

LORA = sys.argv[1]
O = os.path.join(COMFY, "output")
HAIR = ("(short black hair swept back:1.25), ash grey highlights in the top layer, short curled tufts at the nape, "
        "ears visible, no strand in front of the ears")
BODY = (f"duketoll, 1boy, solo, human, (adult man, 26 years old:1.1), (broad shoulders:1.1), {HAIR}, dark brown eyes, "
        "plain black short sleeve crew neck t-shirt, (dark charcoal loose trousers:1.2), "
        "black ankle boots, blue wristbands, bare hands")
STYLE = "cel shading, thick clean lineart, vibrant colors, anime screencap, simple background"
NEG = (f"{NEG_BASE}, child, teenager, (robe:1.3), (blue hair:1.4), (white shirt:1.6), (grey shirt:1.5), beard, glasses, "
       "(text:1.5), (letters:1.4), (logo:1.4), necklace, slim, skinny, boyish, (long hair:1.5), (spiky hair:1.4), "
       "(hair standing up:1.3), (sideburns:1.3), (hair strand in front of ear:1.3), flowing hair, white hair, sleeveless, "
       "(blue trousers:1.4), (green trousers:1.4), (jeans:1.4), (shorts:1.4), (bare legs:1.4), (light grey trousers:1.3), "
       "(white collar:1.3), (motion blur:1.3), (black smear:1.4), aura, fire, lightning, arms raised, (bad anatomy:1.2), "
       "mannequin, grey figure, multiple boys, scenery")
SURGE = ("upper body, (gathering strength:1.2), (both fists clenched at chest height:1.3), elbows out, head thrown back, "
         "screaming, open mouth, intense eyes, from below")
DROP = ("full body, (drop kick:1.3), airborne, (both feet together:1.2), (soles of the boots toward the viewer:1.3), "
        "extreme foreshortening, boots huge in the foreground, torso and face behind the boots, arms back for balance, "
        "gritted teeth, intense eyes on the viewer")
ULT = ("full body, (wide low stance:1.3), hunched forward, head low, looking up at the viewer, (open palm toward the viewer:1.3), "
       "other hand drawn back, fierce glare, martial arts stance, from the front")
JOBS = [  # slot, key, pose, clause, draft
    ("surge", "S2", "duke_surge3_a", SURGE, "duke_kit/surge/drafts/duke_surge3_a_880001_00001_.png"),
    ("slide", "K4", "duke_drop_e", DROP, "duke_kit/slide_drop/drafts/duke_drop_e_882003_00001_.png"),
    ("slide", "K10", "duke_drop_e", DROP, "duke_kit/slide_drop/drafts/duke_drop_e_882009_00001_.png"),
    ("ult", "U19", "duke_ult3_c", ULT, "duke_kit/ult/drafts/duke_ult3_c_881002_00001_.png"),
]
n = 0
for slot, key, pose, clause, draft in JOBS:
    src = f"duke_off3_{key}_src.png"
    shutil.copyfile(os.path.join(O, draft), os.path.join(COMFY, "input", src))
    for den in (0.72, 0.82):
        for k in range(4):
            seed = 893000 + k
            g = {
                "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
                "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": LORA,
                                                             "strength_model": 0.9, "strength_clip": 0.9}},
                "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{BODY}, {clause}, {STYLE}"}},
                "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": NEG}},
                "10": {"class_type": "LoadImage", "inputs": {"image": src}},
                "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
                "20": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "controlnet-union-sdxl-promax.safetensors"}},
                "21": {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["20", 0], "type": "depth"}},
                "22": {"class_type": "LoadImage", "inputs": {"image": f"pose3d_{pose}_depth.png"}},
                "23": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["2", 0], "negative": ["3", 0],
                                                                          "control_net": ["21", 0], "image": ["22", 0],
                                                                          "strength": 0.6, "start_percent": 0.0, "end_percent": 0.85}},
                "24": {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["20", 0], "type": "openpose"}},
                "25": {"class_type": "LoadImage", "inputs": {"image": f"pose3d_{pose}_pose.png"}},
                "26": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["23", 0], "negative": ["23", 1],
                                                                          "control_net": ["24", 0], "image": ["25", 0],
                                                                          "strength": 0.65, "start_percent": 0.0, "end_percent": 0.85}},
                "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["26", 0], "negative": ["26", 1],
                                                          "latent_image": ["11", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                          "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": den}},
                "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
                "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0],
                                                           "filename_prefix": f"duke_official3/{slot}/{key}_d{int(den * 100)}_{seed}"}},
            }
            queue(g)
            n += 1
print(n, "queued with", LORA)
