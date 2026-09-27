"""Lyra kit art with the approved LoRA recipe (lyra_toll.safetensors, step
1500, strength 0.9, no IP-Adapter). Usage: lyra_kit_gen.py <piece> [<piece>...]"""
import json
import sys
import urllib.request

IDENTITY = (
    "lyratoll, masterpiece, best quality, absurdres, 1girl, solo, mature adult woman, late 20s, slender athletic build, "
    "(dark blue hair, very long high ponytail:1.3), (violet red eyes:1.2), "
    "(crimson red sleeveless top with a (crimson red frilled collar:1.2) and frilled shoulders:1.1), bare arms, "
    "gold bracers, dark red fingerless gloves, (short white pleated skirt:1.4), (crimson ankle boots:1.2)"
)
STYLE = "cel shading, thick clean lineart, vibrant colors, anime screencap, dramatic lighting"
NEG = (
    "(multiple girls:1.3), (two heads:1.2), extra limbs, extra arms, extra hands, nsfw, cleavage, child, loli, teenager, "
    "(long skirt:1.2), (red skirt:1.3), (blue skirt:1.2), white shirt, (white collar:1.2), thigh-high boots, thighhighs, "
    "weapon, bow, arrow, sword, energy ball, energy orb, glowing sphere, motion blur, afterimage, ghost limbs, "
    "bad anatomy, bad hands, extra fingers, worst quality, low quality, blurry, realistic, 3d, text, signature, watermark"
)
PIECES = {
    # Card art: same format as the other 17 portraits (1024 square, dark
    # element-tinted ground, UI crops object-top). No weapon (#151).
    "card": [
        ("card_a", "cowboy shot, confident expression, looking at viewer, one hand on hip, other hand raised with fingers open, "
                   "(crimson red ice shards floating around her:1.2), (dark red gradient background:1.3), red particles", 1024, 1024),
        ("card_b", "upper body, three-quarter view, determined expression, looking at viewer, clenched fist at chest, "
                   "long ponytail flowing, (crimson red ice crystals:1.2), (dark crimson gradient background:1.3), "
                   "radial speed lines", 1024, 1024),
    ],
    # Passive "Supercooling": DEF up when she acts first. Defensive, cold.
    "passive": [
        ("passive_a", "cowboy shot, defensive stance, forearms raised crossed in front, guarding, calm focused expression, "
                      "(translucent crimson red ice forming a crystalline shell around her:1.2), frost mist, cold breath, "
                      "(dark red gradient background:1.3), spiral lines", 832, 1216),
        ("passive_b", "cowboy shot, bracing stance, one arm raised to guard, looking at viewer, serious expression, "
                      "(jagged crimson red ice crystals growing over her forearms and shoulders like armor:1.2), frost, "
                      "(dark red gradient background:1.3), radial lines", 832, 1216),
    ],
    # v2: v1's ice mostly never appeared and the ground drifted blue.
    "passive2": [
        ("passive2_a", "cowboy shot, defensive stance, forearms raised crossed in front of her face, guarding, focused expression, "
                       "(her forearms encased in jagged crimson red ice:1.35), (large crimson red ice crystal formation rising behind her:1.3), "
                       "cold mist, frost particles, (dark crimson gradient background:1.4), spiral lines", 832, 1216),
        ("passive2_b", "cowboy shot, bracing stance, knees bent, one forearm raised to block, looking at viewer, serious expression, "
                       "(crimson red ice crystals erupting from the ground around her like a shield wall:1.35), frost, cold breath, "
                       "(dark crimson gradient background:1.4), radial lines", 832, 1216),
    ],
}
NEG += ", (blue ice:1.3), (blue background:1.3), (light blue:1.2), ice sword"


def graph(prefix, scene, w, h, seed):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{IDENTITY}, {scene}, {STYLE}"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": NEG}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 4}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                  "latent_image": ["4", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                  "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}},
    }


for piece in sys.argv[1:]:
    for i, (slug, scene, w, h) in enumerate(PIECES[piece]):
        for rep in range(2):
            body = json.dumps({"prompt": graph(f"lyra_kit/{slug}", scene, w, h, 5100 + i * 10 + rep)}).encode()
            req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=body, headers={"Content-Type": "application/json"})
            print(slug, rep, json.loads(urllib.request.urlopen(req).read())["prompt_id"])
