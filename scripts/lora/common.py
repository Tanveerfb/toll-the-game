"""Shared helpers for the character LoRA recipe (see README.md)."""
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
COMFY = r"E:\Installed\ComfyUI_windows_portable\ComfyUI"
TRAINING = r"C:\Users\Tanve\.comfyui-mcp\training"
CHECKPOINT = "animagineXL40_v4Opt.safetensors"
NEG_BASE = (
    "(multiple girls:1.3), (multiple boys:1.3), (two heads:1.2), extra limbs, extra arms, nsfw, cleavage, "
    "weapon, bad anatomy, bad hands, extra fingers, worst quality, low quality, blurry, realistic, 3d"
)


def profile(char_id):
    """Load characters/<id>.json."""
    with open(os.path.join(HERE, "characters", f"{char_id}.json"), encoding="utf-8") as f:
        return json.load(f)


def queue(graph):
    """POST an API-format graph to ComfyUI; return the prompt id."""
    body = json.dumps({"prompt": graph}).encode()
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=body,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]


def base_graph(pos, neg, w, h, seed, prefix, batch=4, face_ref=None, lora=None, lora_strength=0.9):
    """Animagine txt2img with either an IP-Adapter face ref or a LoRA."""
    g = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}}}
    model, clip = ["1", 0], ["1", 1]
    if face_ref:
        g["10"] = {"class_type": "LoadImage", "inputs": {"image": face_ref}}
        g["11"] = {"class_type": "IPAdapterUnifiedLoader", "inputs": {"model": model, "preset": "PLUS FACE (portraits)"}}
        g["12"] = {"class_type": "IPAdapter", "inputs": {"model": ["11", 0], "ipadapter": ["11", 1], "image": ["10", 0],
                                                        "weight": 0.6, "start_at": 0.0, "end_at": 0.75,
                                                        "weight_type": "standard"}}
        model = ["12", 0]
    if lora:
        g["8"] = {"class_type": "LoraLoader", "inputs": {"model": model, "clip": clip, "lora_name": lora,
                                                         "strength_model": lora_strength,
                                                         "strength_clip": lora_strength}}
        model, clip = ["8", 0], ["8", 1]
    g["2"] = {"class_type": "CLIPTextEncode", "inputs": {"clip": clip, "text": pos}}
    g["3"] = {"class_type": "CLIPTextEncode", "inputs": {"clip": clip, "text": neg}}
    g["4"] = {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": batch}}
    g["5"] = {"class_type": "KSampler", "inputs": {"model": model, "positive": ["2", 0], "negative": ["3", 0],
                                                  "latent_image": ["4", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                  "sampler_name": "euler_ancestral", "scheduler": "normal",
                                                  "denoise": 1.0}}
    g["6"] = {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}}
    g["7"] = {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}}
    return g
