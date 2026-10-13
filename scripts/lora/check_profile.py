"""Check a character's art profile against characters/profile.schema.json.

No dependencies: a small walk of the schema's required keys, types, enums,
patterns and item shapes, plus two checks the schema cannot express:

- a TODO left from new_profile.py (the lock has not filled it in);
- no action shot in `body_shots` (ruling #186: a dataset of calm, front-facing
  standing poses is what went wrong on Sara and Duke).

Usage: check_profile.py <id> [<id> ...]      exit 1 on any error; warnings print.
"""
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHARACTERS = os.path.join(HERE, "characters")
ACTION_WORDS = (
    "action", "mid-motion", "mid-stride", "lunging", "sprint", "running", "jump",
    "leap", "kick", "punch", "striking", "strike", "swing", "dash", "crouch",
    "turning", "charging", "slash", "throw",
)

TYPES = {
    "string": str,
    "integer": int,
    "boolean": bool,
    "array": list,
    "object": dict,
    "null": type(None),
}


def type_ok(value, schema_type):
    kinds = schema_type if isinstance(schema_type, list) else [schema_type]
    for kind in kinds:
        py = TYPES[kind]
        if kind == "integer" and isinstance(value, bool):
            continue
        if isinstance(value, py):
            return True
    return False


def check(value, schema, path, errors):
    if "type" in schema and not type_ok(value, schema["type"]):
        errors.append(f"{path}: expected {schema['type']}, got {type(value).__name__}")
        return
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} is not one of {schema['enum']}")
    if "pattern" in schema and isinstance(value, str) and not re.search(schema["pattern"], value):
        errors.append(f"{path}: {value!r} does not match /{schema['pattern']}/")
    if isinstance(value, int) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} is below {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} is above {schema['maximum']}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: {len(value)} items, at least {schema['minItems']} needed")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: {len(value)} items, at most {schema['maxItems']} allowed")
        items = schema.get("items")
        if isinstance(items, list):
            for index, (item, item_schema) in enumerate(zip(value, items)):
                check(item, item_schema, f"{path}[{index}]", errors)
        elif isinstance(items, dict):
            for index, item in enumerate(value):
                check(item, items, f"{path}[{index}]", errors)
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required key {key!r}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if key in properties:
                check(item, properties[key], f"{path}.{key}", errors)
            elif isinstance(schema.get("additionalProperties"), dict):
                check(item, schema["additionalProperties"], f"{path}.{key}", errors)


def check_profile(char_id, schema):
    path = os.path.join(CHARACTERS, f"{char_id}.json")
    with open(path, encoding="utf-8") as f:
        profile = json.load(f)
    errors, warnings = [], []
    check(profile, schema, char_id, errors)

    known = set(schema["properties"])
    for key in profile:
        if key not in known and not re.search(r"_note$|_lock$|_v\d+$|_\d{4}_\d{2}_\d{2}$", key):
            warnings.append(f"{char_id}.{key}: not in the schema (a free note ends in _note or _lock; a versioned record ends in _v2 or a date)")

    text = json.dumps(profile)
    if "TODO" in text:
        errors.append(f"{char_id}: a TODO from new_profile.py is still in the file; fill it from the design lock")

    body = profile.get("body_shots") or []
    action = [row for row in body if any(word in row[1].lower() for word in ACTION_WORDS)]
    needed = math.ceil(len(body) / 3) if body else 0
    if body and len(action) < needed:
        warnings.append(
            f"{char_id}.body_shots: {len(action)} action shots of {len(body)}; ruling #186 wants about a third ({needed}). "
            "A calm, front-facing standing set is the Sara and Duke failure."
        )
    return errors, warnings


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    with open(os.path.join(CHARACTERS, "profile.schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    failed = False
    for char_id in sys.argv[1:]:
        errors, warnings = check_profile(char_id, schema)
        for line in warnings:
            print("warning:", line)
        for line in errors:
            print("error:", line)
        if errors:
            failed = True
        else:
            print(f"{char_id}: ok" + (f" ({len(warnings)} warnings)" if warnings else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
