"""Step 1: queue dataset candidates for one character.

Body shots at 832x1216 with the full identity; close-ups at 1024x1024 with
`identity_upper`, because naming lower-body garments in a head shot made the
model cram in a whole body, often two (Lyra, 2026-09-27).
A profile may carry its own `body_shots` / `face_shots` ([slug, clause] pairs)
when he specifies the set, as he did for Sara's expressions (2026-10-02);
otherwise the lists below are used. A profile may also override `style` and
`out_dir`.
A body shot may carry a third element:
  "noref" - render without the face reference.
  "back"  - a back view: no face reference, plus the drawn back skeleton
            (common.draw_back_skeleton). Prompting alone turns her round.
Usage: gen_candidates.py <id> [slug ...]
"""
import sys
from common import BACK_POSE, NEG_BASE, base_graph, draw_back_skeleton, profile, queue

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
BODY = p.get("body_shots", BODY)
FACE = p.get("face_shots", FACE)
STYLE = p.get("style", STYLE)
neg = f"{NEG_BASE}, {p['negative_extra']}, busy background, gradient background, colored background, aura"
out = p.get("out_dir", f"lora_{p['id']}") + "/cand_"
seed0 = p.get("seed_offset", 0)  # bump to re-roll a slot with fresh seeds
batch = p.get("batch", 4)
hands = p.get("hand_fix", False)  # the 512px hand pass (common.base_graph)
only = set(sys.argv[2:])  # optional slugs, to re-queue part of a set


def hood_neg(clause):
    """A profile's `hood_down_negative`, added only to shots that ask for hood down."""
    return f", {p['hood_down_negative']}" if "hood down" in clause and p.get("hood_down_negative") else ""


def submit(slug, pos, shot_neg, w, h, seed, **kw):
    """Queue `batch` images of one slot. The hand detector refuses image batches
    (Impact Pack), so with the hand pass on each image is its own job, seed + 1000*k."""
    if not hands:
        print(slug, queue(base_graph(pos, shot_neg, w, h, seed, out + slug, batch=batch, **kw)))
        return
    for k in range(batch):
        print(slug, k, queue(base_graph(pos, shot_neg, w, h, seed + 1000 * k, out + slug, batch=1, hand_fix=True, **kw)))

for i, (slug, clause, *flags) in enumerate(BODY):
    if only and slug not in only:
        continue
    pos = f"{p['identity']}, {clause}, {STYLE}"
    back = "back" in flags
    if back:
        draw_back_skeleton()
    ref = None if back or "noref" in flags else p["face_ref"]
    # A back view with no face ref drifts to dark grounds (Sara v5: 3 of 4).
    back_neg = ", face, looking at viewer, looking back, (dark background:1.3), grey background"
    shot_neg = neg + (back_neg if back else "") + hood_neg(clause)
    submit(slug, pos, shot_neg, 832, 1216, 910000 + seed0 + i, face_ref=ref, pose=BACK_POSE if back else None)
face_neg = f"{neg}, (multiple views:1.3), lower body, legs, skirt"
for i, (slug, clause) in enumerate(FACE):
    if only and slug not in only:
        continue
    pos = f"{p['identity_upper']}, {clause}, portrait, head and shoulders, face focus, {STYLE}"
    submit(slug, pos, face_neg + hood_neg(clause), 1024, 1024, 920000 + seed0 + i, face_ref=p["face_ref"])
