"""Scenic backdrops for blue Duke (no character): the ultimate's snowy mountains (ruling #184) and the card's riverside
(his pick 2026-10-08). 832x1216, 6 seeds each, no LoRA. Output ComfyUI output/duke_backdrop/<kind>/."""
import sys

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import base_graph, queue  # noqa: E402

STYLE = "anime background art, scenery, no humans, cel shading, clean lineart, vibrant colors, highly detailed, depth of field"
NEG = ("(1boy:1.4), (1girl:1.4), person, people, character, text, watermark, logo, signature, worst quality, low quality, "
       "blurry, realistic, photo, 3d")
KINDS = {
    "ult_snow": ("snowy mountain range, jagged snow-capped peaks, cold blue dusk sky, mist in the valleys, light snowfall, "
                 "frozen lake below, dramatic clouds, vertical composition, " + STYLE),
    "card_river": ("riverside at evening, wide calm river, stone embankment, reeds, city bridge in the distance, "
                   "warm sunset sky reflected in the water, gentle ripples, vertical composition, " + STYLE),
}
for kind, pos in KINDS.items():
    for k in range(6):
        g = base_graph(pos, NEG, 832, 1216, 883000 + k + (0 if kind.startswith("ult") else 100),
                       f"duke_backdrop/{kind}/{kind}_{k + 1}", batch=1)
        queue(g)
print("12 queued")
