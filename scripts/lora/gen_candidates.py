"""Step 1: queue dataset candidates for one character.

Body shots at 832x1216 with the full identity; close-ups at 1024x1024 with
`identity_upper`, because naming lower-body garments in a head shot made the
model cram in a whole body, often two (Lyra, 2026-09-27).
Usage: gen_candidates.py <id>
"""
import sys
from common import NEG_BASE, base_graph, profile, queue

BODY = [
    ("cowboy_stand", "cowboy shot, standing, arms at sides, calm expression, looking at viewer"),
    ("full_stand", "full body, standing, relaxed pose, looking at viewer"),
    ("over_shoulder", "upper body, from behind, looking back over shoulder"),
    ("upper_crossed", "upper body, arms crossed, confident smirk, looking at viewer"),
    ("upper_hip", "upper body, hand on hip, determined expression, looking at viewer"),
]
FACE = [
    ("face_front", "facing viewer, looking at viewer, neutral expression, closed mouth"),
    ("face_smile", "facing viewer, looking at viewer, gentle smile"),
    ("face_34l", "three-quarter view, head turned left, looking at viewer, serious expression"),
    ("face_34r", "three-quarter view, head turned right, looking to the side, determined expression"),
    ("face_profile", "profile, side view, looking to the side, calm expression"),
    ("face_up", "looking up, slightly from below, confident expression"),
    ("face_down", "looking down, from above, pensive expression"),
    ("face_shout", "facing viewer, shouting, open mouth, angry, intense eyes"),
]
STYLE = "cel shading, thick clean lineart, anime screencap, even lighting, white background, simple background"

p = profile(sys.argv[1])
neg = f"{NEG_BASE}, {p['negative_extra']}, busy background, gradient background, colored background, aura"
out = f"lora_{p['id']}/cand_"
for i, (slug, clause) in enumerate(BODY):
    pos = f"{p['identity']}, {clause}, {STYLE}"
    print(slug, queue(base_graph(pos, neg, 832, 1216, 910000 + i, out + slug, face_ref=p["face_ref"])))
face_neg = f"{neg}, (multiple views:1.3), lower body, legs, skirt"
for i, (slug, clause) in enumerate(FACE):
    pos = f"{p['identity_upper']}, {clause}, portrait, head and shoulders, face focus, {STYLE}"
    print(slug, queue(base_graph(pos, face_neg, 1024, 1024, 920000 + i, out + slug, face_ref=p["face_ref"])))
