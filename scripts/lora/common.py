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


BACK_POSE = "back_view_skeleton.png"


LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11),
         (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0),
          (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
          (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]
_MIRROR = {2: 5, 3: 6, 4: 7, 8: 11, 9: 12, 10: 13, 14: 15, 16: 17}
_MIRROR.update({v: k for k, v in list(_MIRROR.items())})


def mirror_pose(pts, width):
    """Flip a pose left-right: x mirrored, and left/right joints swapped so the
    colours stay attached to the subject's own limbs."""
    return {_MIRROR.get(k, k): (width - x, y) for k, (x, y) in pts.items()}


def draw_skeleton(pts, name, size=(832, 1216)):
    """Draw an OpenPose COCO-18 skeleton (joint id -> (x, y); an omitted joint
    drops its limbs) to ComfyUI input/<name>. A pose the prompt alone cannot
    hold must be drawn: Sara's first kit round left every pose to the prompt
    and he rejected most of 120 drafts as awkward (2026-10-03)."""
    import math
    from PIL import Image, ImageDraw
    img = Image.new("RGB", size, (0, 0, 0))
    for i, (a, b) in enumerate(LIMBS):
        if a not in pts or b not in pts:
            continue
        (x1, y1), (x2, y2) = pts[a], pts[b]
        length = max(1, int(math.hypot(x2 - x1, y2 - y1)))
        limb = Image.new("RGBA", (length, 16), (0, 0, 0, 0))
        ImageDraw.Draw(limb).ellipse([0, 0, length - 1, 15], fill=COLORS[i] + (153,))
        limb = limb.rotate(-math.degrees(math.atan2(y2 - y1, x2 - x1)), expand=True, resample=Image.BICUBIC)
        img.paste(limb, (int((x1 + x2 - limb.width) / 2), int((y1 + y2 - limb.height) / 2)), limb)
    d = ImageDraw.Draw(img)
    for k, (x, y) in pts.items():
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=COLORS[k])
    img.save(os.path.join(COMFY, "input", name))
    return img


def draw_back_skeleton():
    """OpenPose COCO-18 back view: the A-pose seen from behind, written to ComfyUI input/.

    Prompt weights alone turn a character to the camera every time (Sara,
    2026-10-02). From behind there is no nose and no eyes, and the subject's
    right shoulder is on the image's right."""
    pts = {1: (416, 375), 2: (494, 390), 5: (338, 390), 3: (528, 530), 6: (304, 530),
           4: (554, 668), 7: (278, 668), 8: (468, 690), 11: (364, 690), 9: (472, 832),
           12: (360, 832), 10: (474, 980), 13: (358, 980), 16: (442, 298), 17: (390, 298)}
    # Scaled 1.12 with the ankles held at y=1010: at the A-pose's own size the
    # figure rendered small and soft (Sara v4). Ankles past ~1040 crop the shoes
    # (Lyra, 2026-09-20), so the anchor is the feet, not the centre.
    pts = {k: (round(416 + (x - 416) * 1.12), round(1010 - (980 - y) * 1.12)) for k, (x, y) in pts.items()}
    draw_skeleton(pts, BACK_POSE)


HAND_POS = "detailed human hand, five fingers, slender fingers, natural hand"
HAND_NEG = "(paw:1.3), (cat paw:1.3), animal hand, claws, mitten hands, fused fingers, extra fingers, missing fingers"


def base_graph(pos, neg, w, h, seed, prefix, batch=4, face_ref=None, lora=None, lora_strength=0.9, pose=None,
               hand_fix=False):
    """Animagine txt2img with either an IP-Adapter face ref or a LoRA, an
    optional OpenPose skeleton (an input/ filename) at strength 0.6, and an
    optional hand pass (`hand_fix`): each detected hand re-rendered at 512px
    by the checkpoint (docs/CHARACTER_ART.md, Environment; history in the archive's "The hand pass",
    2026-09-21). Added for
    Sara v2, whose v1 set drew cat-paw hands (his note, 2026-10-03)."""
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
    if pose:
        g["20"] = {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "controlnet-openpose-sdxl.safetensors"}}
        g["21"] = {"class_type": "LoadImage", "inputs": {"image": pose}}
        g["22"] = {"class_type": "ControlNetApplyAdvanced", "inputs": {
            "positive": ["2", 0], "negative": ["3", 0], "control_net": ["20", 0], "image": ["21", 0],
            "strength": 0.6, "start_percent": 0.0, "end_percent": 0.75}}
        g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = ["22", 0], ["22", 1]
    g["6"] = {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}}
    out = ["6", 0]
    if hand_fix:
        g["30"] = {"class_type": "UltralyticsDetectorProvider", "inputs": {"model_name": "bbox/hand_yolov8s.pt"}}
        g["31"] = {"class_type": "BboxDetectorSEGS", "inputs": {
            "bbox_detector": ["30", 0], "image": out, "threshold": 0.35, "dilation": 16, "crop_factor": 3.0,
            "drop_size": 8, "labels": "all"}}
        g["32"] = {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": HAND_POS}}
        g["33"] = {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": f"{HAND_NEG}, {neg}"}}
        g["34"] = {"class_type": "DetailerForEach", "inputs": {
            "image": out, "segs": ["31", 0], "model": ["1", 0], "clip": ["1", 1], "vae": ["1", 2],
            "guide_size": 512, "guide_size_for": True, "max_size": 1024, "seed": seed, "steps": 24, "cfg": 6.0,
            "sampler_name": "euler_ancestral", "scheduler": "normal", "positive": ["32", 0], "negative": ["33", 0],
            "denoise": 0.55, "feather": 8, "noise_mask": True, "force_inpaint": True, "wildcard": "", "cycle": 1,
            "noise_mask_feather": 20}}
        out = ["34", 0]
    g["7"] = {"class_type": "SaveImage", "inputs": {"images": out, "filename_prefix": prefix}}
    return g
