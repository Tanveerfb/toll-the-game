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
  "pose:<name>" - an action shot held by the Blender mannequin
            (scripts/pose/poses/<name>.json, rendered to ComfyUI input/ first):
            union ControlNet depth 0.55 + openpose 0.6, end 0.7, the kit-draft
            strengths. Ruling #186: an action clause alone often comes back standing.
Usage: gen_candidates.py <id> [slug ...]
"""
import sys
from common import (BACK_POSE, NEG_BASE, apply_pose, base_graph, draw_back_skeleton, missing_inputs, pose_files,
                    profile, queue)

MANNEQUIN = (0.55, 0.6, 0.7)  # depth, openpose, end_percent: as scripts/skill_art/kit_drafts.py

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


def submit(slug, pos, shot_neg, w, h, seed, hand_pass=None, mannequin=None, **kw):
    """Queue `batch` images of one slot. The hand detector refuses image batches
    (Impact Pack), so with the hand pass on each image is its own job, seed + 1000*k.
    Close-ups skip the hand pass unless the profile sets `face_hand_fix`: Duke's
    head shots came back with burnt neon skin and hard edges with it on (2026-10-07).
    `mannequin` is a pose name wired in by common.apply_pose."""
    hand_pass = hands if hand_pass is None else hand_pass

    def build(**extra):
        g = base_graph(pos, shot_neg, w, h, **extra, **kw)
        if mannequin:
            apply_pose(g, mannequin, *MANNEQUIN)
        return g

    if not hand_pass:
        print(slug, queue(build(seed=seed, prefix=out + slug, batch=batch)))
        return
    for k in range(batch):
        print(slug, k, queue(build(seed=seed + 1000 * k, prefix=out + slug, batch=1, hand_fix=True,
                                   hand_extra=p.get("hand_extra", ""))))


def pose_flag(flags):
    names = [f.split(":", 1)[1] for f in flags if f.startswith("pose:")]
    return names[0] if names else None


wanted = [pose_flag(f) for s, _, *f in BODY if pose_flag(f) and (not only or s in only)]
missing = missing_inputs([n for name in wanted for n in pose_files(name)])
if missing:
    sys.exit("missing in ComfyUI input/: " + ", ".join(missing) + " (render the poses first: scripts/pose/README.md)")

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
    submit(slug, pos, shot_neg, 832, 1216, 910000 + seed0 + i, face_ref=ref, pose=BACK_POSE if back else None,
           mannequin=pose_flag(flags))
face_neg = f"{neg}, (multiple views:1.3), lower body, legs, skirt"
for i, (slug, clause) in enumerate(FACE):
    if only and slug not in only:
        continue
    pos = f"{p['identity_upper']}, {clause}, portrait, head and shoulders, face focus, {STYLE}"
    submit(slug, pos, face_neg + hood_neg(clause), 1024, 1024, 920000 + seed0 + i, hand_pass=hands and p.get("face_hand_fix", False), face_ref=p["face_ref"])
