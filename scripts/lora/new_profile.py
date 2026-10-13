"""Start a character's art profile from the schema, not from another character's file.

Writes scripts/lora/characters/<id>.json with every key a session needs at
step 0 and 1, placeholders where the lock has to fill them in, and a body-shot
list that already carries the action shots ruling #186 requires. Duke's and
Sara's profiles stopped being the base on 2026-10-13 (his rule: a schema
"that Claude or myself can use when drafting a new character ... so it
doesn't have to be using duke kit as base").

Usage: new_profile.py <id> --trigger <word> [--subject 1girl|1boy] [--force]

Then: fill `identity`, `identity_upper`, `negative_extra` and `face_ref` from
the design lock, adjust the shot clauses to the character, and run
`python scripts/lora/check_profile.py <id>` before `gen_candidates.py`.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHARACTERS = os.path.join(HERE, "characters")

# Calm slots are a few, not the set (ruling #186). The action slots are posed by
# their clause only; gen_candidates.py has no mannequin input yet, so write the
# motion into the words (mid-motion, the near limb big, the face in view) and
# re-roll a slot that comes back standing.
BODY_SHOTS = [
    ["front_calm", "full body, standing, front view, arms at sides, hands visible, calm expression, looking at viewer"],
    ["three_quarter_l", "full body, standing, three-quarter view, body turned left, arms at sides, hands visible, slight smile, looking at viewer"],
    ["three_quarter_r", "cowboy shot, standing, three-quarter view, body turned right, hand on hip, confident expression, looking at viewer"],
    ["profile_walk", "full body, side view, walking, mid-stride, arms swinging, looking ahead"],
    ["back_view", "full body, from behind, looking back over shoulder, hair and back of the outfit visible", "back"],
    ["action_lunge", "full body, lunging forward, mid-motion, low stance, near arm reaching toward viewer, foreshortening, hair flowing, clothes fluttering, intense expression, looking at viewer"],
    ["action_sprint", "full body, sprinting toward viewer, mid-stride, leaning in, speed lines, hair flowing, determined expression, looking at viewer"],
    ["action_strike", "full body, striking with the near arm, mid-motion, body twisted, dynamic angle, motion lines, fierce expression, looking at viewer"],
    ["action_turn", "full body, turning sharply, mid-motion, hair whipping, clothes fluttering, three-quarter view, alert expression, looking at viewer"],
    ["action_crouch", "full body, crouching low, one hand on the ground, ready to spring, low angle, looking up at viewer"],
    ["upper_crossed", "upper body, arms crossed, confident smirk, looking at viewer"],
]

FACE_SHOTS = [
    ["face_front", "facing viewer, looking at viewer, neutral expression, closed mouth"],
    ["face_smile", "facing viewer, looking at viewer, gentle smile"],
    ["face_34l", "three-quarter view, head turned left, looking at viewer, serious expression"],
    ["face_34r", "three-quarter view, head turned right, looking to the side, determined expression"],
    ["face_profile", "profile, side view, looking to the side, calm expression"],
    ["face_up", "looking up, slightly from below, confident expression"],
    ["face_down", "looking down, from above, pensive expression"],
    ["face_shout", "facing viewer, shouting, open mouth, angry, intense eyes"],
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id")
    ap.add_argument("--trigger", required=True, help="the LoRA trigger word, <id>toll by convention")
    ap.add_argument("--subject", default="1girl", choices=["1girl", "1boy"])
    ap.add_argument("--force", action="store_true", help="overwrite an existing profile")
    args = ap.parse_args()

    path = os.path.join(CHARACTERS, f"{args.id}.json")
    if os.path.exists(path) and not args.force:
        sys.exit(f"{path} exists; pass --force to overwrite it, or edit it in place")

    quality = "masterpiece, best quality, absurdres"
    profile = {
        "id": args.id,
        "trigger": args.trigger,
        "face_ref": f"{args.id}_head_ref.png",
        "identity": f"{quality}, {args.subject}, solo, TODO age and build, TODO hair, TODO eyes, TODO every garment with its colour, weighted on the defining words",
        "identity_upper": f"{quality}, {args.subject}, solo, TODO the same without the lower-body garments",
        "negative_extra": "child, loli, teenager, TODO the looks this character must not drift to",
        "style": "cel shading, thick clean lineart, anime screencap, even lighting, white background, simple background",
        "out_dir": f"lora_{args.id}",
        "dataset_name": f"{args.id}_v1",
        "batch": 4,
        "seed_offset": 0,
        "hand_fix": False,
        "body_shots": BODY_SHOTS,
        "face_shots": FACE_SHOTS,
        "design_note": "TODO at the design lock: every garment and colour, hood state, age, build, what is banned",
        "lock": None,
        "approved": {},
        "lora_use": None,
        "art_direction": None,
        "kit_prompt": None,
        "status": f"Created by new_profile.py; step 0 (design lock) not started. Fill the TODO fields from toll-kits/designs/characters/{args.id}.md, then check_profile.py.",
    }
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {path}")
    print("next: fill the TODO fields from the design lock, then python scripts/lora/check_profile.py", args.id)


if __name__ == "__main__":
    main()
