"""Put Duke onto a good-pose draft: img2img with his LoRA at 0.9, the draft's own DWPose skeleton on the union
ControlNet (0.6, end 0.8), denoise 0.72 and 0.82, two seeds. The official-render method (2026-10-08) with the
skeleton read from the draft instead of a mannequin. Light negatives only (weighted colour words burn neon).

usage: identity_pass.py <draft.png under output/> [...]"""
import json
import os
import shutil
import sys

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import CHECKPOINT, COMFY, NEG_BASE, profile, queue, union  # noqa: E402

kp = profile("duke")["kit_prompt"]
BODY = kp["official"]["body"]
STYLE = "dynamic pose, action shot, cel shading, thick clean lineart, vibrant colors, anime screencap, simple background, white background"
NEG = (f"{NEG_BASE}, long hair, spiky hair, hair strand in front of ear, sideburns, shorts, capri pants, sleeveless, "
       "long sleeves, white shirt, grey shirt, jacket, cape, skirt, hakama, aura, text, logo, standing, posing, mannequin")
runs = []
for draft in sys.argv[1:]:
    tag = os.path.basename(draft).rsplit("_0000", 1)[0]
    src = f"ident_{tag}.png"
    shutil.copyfile(os.path.join(COMFY, "output", draft), os.path.join(COMFY, "input", src))
    for den in ((0.72, 0.82) if os.environ.get("BOTH_DENOISE") else (0.82,)):
        for seed in (960001, 960002):
            g = {
                "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
                "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "duke_toll.safetensors",
                                                             "strength_model": 0.9, "strength_clip": 0.9}},
                "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{BODY}, {STYLE}"}},
                "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": NEG}},
                "10": {"class_type": "LoadImage", "inputs": {"image": src}},
                "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
                "12": {"class_type": "DWPreprocessor", "inputs": {"image": ["10", 0], "detect_hand": "enable", "detect_body": "enable",
                                                                  "detect_face": "enable", "resolution": 1024,
                                                                  "bbox_detector": "yolox_l.torchscript.pt",
                                                                  "pose_estimator": "dw-ll_ucoco_384_bs5.torchscript.pt",
                                                                  "scale_stick_for_xinsr_cn": "disable"}},
                "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                          "latent_image": ["11", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                          "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": den}},
                "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
                "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0],
                                                           "filename_prefix": f"duke_identity/{tag}_d{int(den * 100)}_{seed}"}},
            }
            # union() wants an input filename; wire the preprocessor output in directly instead
            g["40"] = {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "controlnet-union-sdxl-promax.safetensors"}}
            g["41"] = {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["40", 0], "type": "openpose"}}
            g["43"] = {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["2", 0], "negative": ["3", 0],
                                                                          "control_net": ["41", 0], "image": ["12", 0],
                                                                          "strength": 0.6, "start_percent": 0.0, "end_percent": 0.8}}
            g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = ["43", 0], ["43", 1]
            runs.append({"draft": draft, "den": den, "seed": seed, "id": queue(g)})
print(len(runs), "queued")
