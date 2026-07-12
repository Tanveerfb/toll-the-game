# Character Art Pipeline

All character art is **AI-generated locally** (ComfyUI, RTX 5060 Ti). Style target: **Dokkan Battle card art × 7DSGC character renders** — bold cel shading, thick clean lineart, vibrant saturated colors, dynamic pose, element-tinted gradient background.

## Setup

- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` (`run_nvidia_gpu.bat`, API on `127.0.0.1:8188`)
- Checkpoint: **`animagineXL40_v4Opt.safetensors`** (Animagine XL 4.0)
- Settings: 1024×1024, 28 steps, CFG 7, `euler_ancestral` / `normal`
- Output → copy to `public/characters/<id>.png`; register the id in `lib/game/characterArt.ts`
- ~12s per image

## Prompt Template

**Positive** (order matters — hair/eyes BEFORE costume, both weighted, to fight color bleed):

```
masterpiece, best quality, absurdres, 1boy|1girl, solo,
(HAIR:1.3), (EYES:1.2), EXPRESSION,
wearing (COSTUME:1.3), COSTUME DETAILS,
(SIGNATURE PROP/EFFECT:1.25),
POSE, dynamic pose,
cel shading, thick clean lineart, vibrant colors, anime screencap,
dramatic lighting, cowboy shot,
dark ELEMENT-COLOR gradient background, ELEMENT particles
```

**Negative**:

```
lowres, bad anatomy, bad hands, extra fingers, worst quality, low quality,
jpeg artifacts, signature, watermark, text, blurry, realistic,
photorealistic, 3d, busy background, multiple characters
[+ per-character color-bleed guards, e.g. (pink hair:1.4) for Duke]
```

**Color-bleed rule:** when a costume color leaks into hair or effects, add the wrong combination to the negative prompt with weight ≥1.3 and raise the correct token's weight. (Duke's magenta robe turned his hair pink until `(dark blue spiky hair:1.3)` + negative `(pink hair:1.4)`.)

**Trigger-word rule:** some ordinary words summon literal objects regardless of context — and putting them in the NEGATIVE prompt can leak the concept in too. Keep these words out of both prompts entirely and paraphrase:

| Word | Summons | Paraphrase |
|---|---|---|
| crown ("at the crown") | literal gold crown | "top of head" |
| cuffs ("collar and cuffs") | handcuffs + wrist chains | "sleeve borders" |
| chain ("hair chain") | wrist/neck chains | drop it |

## Current Set (v4 — 2026-07-11)

Locked design sheets live in `docs/design/characters/*.md` — they are the source of truth for appearance and override old lore descriptions. Reference photos in `docs/design/characters/refs/`.

| Character | Seed | Design source | Notes |
|---|---|---|---|
| duke | 777012 | design sheet (duke.md) | v3: bulkier MC redesign — DBZ-spiky quiff + taper fade, navy gi with magenta trim/sash over combat bodysuit, water vortex fists |
| lyra | 888051 | design sheet + Tanveer's concept art (refs/lyra-concept-*) | v2: dark blue high ponytail + red tie, crimson frilled top, bronze sash/bracers, white pleated skirt, red fingerless gloves, ribboned bow |
| master_tao | 888002 | design sheet | serious mode: max-power bulk, tank shirt, tidy beard, fire fists |
| sara | 888003 | design sheet | platinum pigtails + black ribbons, cat-ear hoodie, spectral paws |
| yalina | 888043 | design sheet + ref photo | v2 redesign: dark-brown curly hair, deep pink shalwar kameez + gold embroidery, green energy fist. Literal side braid won't render at this style weight — loose side curls accepted. "cuffs"/"chain" are trigger words (see rule above) |
| seras | 888035 | design sheet | villain true form: pointed ears, light-red eyes, kimono-armor, lightning polearm. Horn-like hair tufts didn't render; acceptable v1, revisit later |
| mustafa | 777004 | AI-invented | design approved by Tanveer 2026-07-11 |
| siddiq | 777131 | AI-invented v2 (2026-07-11 redesign per Tanveer) | emerald kurta + gold trim, curly dark hair, nature orb + vines, red bg. Still awaiting his locked sheet |
| batra | 777132 | Tanveer's direction (2026-07-11): keep turban/facial hair/kesari, drop heavy armour | kesari kurta, navy sash, steel kara, golden lion energy fists |
| gabrist | 777019 | hair/face locked (ref photo) + AI ink-artist theme | jet-black shoulder-length waves, full beard, calligraphy brush + ink strokes |
| meliodas | 777020 | canon (7DS collab) | danbooru character tag `meliodas \(nanatsu no taizai\)` — model knows the design natively |
| ban | 777021 | canon (7DS collab) | pale spiky hair, cheek scar, nunchaku, green soul wisps |
| diane | 777022 | canon (7DS collab) | twin pigtails, orange leotard, giant gauntlet, rock shards |
| gon | 777023 | canon (HxH collab) | danbooru tag `gon freecss` — first roll accepted |
| killua | 777024 | canon (HxH collab) | danbooru tag `killua zoldyck` — first roll accepted |
| leorio | 777125 | canon (HxH collab) | suit + teashades + energy fist. Bg came out blue instead of red; forcing red bg regressed the character (gaunt villain face), so blue bg accepted — the card frame supplies the red |

### Story-only NPC/enemy art (v6 — 2026-07-12)

Generic enemy kits — no character sheets, AI-invented per element. Shown only in the hidden `/archive/npc` page and in story battles.

| Character | Seed | Design source | Notes |
|---|---|---|---|
| raider | 777201 | AI-invented (red) | shaved head, red scarf, scavenged leather/pauldron, flaming torch, charging pose, dark-red bg + fire embers |
| road_bandit | 777202 | AI-invented (dark) | hooded desert ambusher, face in shadow, reverse-grip curved dagger, crouched ambush, dark violet/indigo swirl bg |
| wild_beast | 777203 | AI-invented (green) | feral quadruped monster, green-black fur, glowing yellow eyes, bared fangs + curved claws, emerald bg |

Full prompts recoverable from ComfyUI history / git log.

### NPC boss copies of playable characters (2026-07-12)

When an official character appears as a story-battle enemy, it gets a dedicated `storyOnly` NPC kit with tweakable stats (raised HP for a multi-turn boss fight, `tier: "elite"` for 3 actions/turn). The NPC copy **reuses the playable character's art** — no regeneration: copy `public/characters/<base>.png` → `<base>_npc.png` and register `<base>_npc` in `characterArt.ts`.

| Character | Art source | Notes |
|---|---|---|
| lyra_npc | copy of `lyra.png` | Part 2 boss. 3300 HP / 250 ATK (Tanveer's tune), elite tier |

## Adding a New Character

**Workflow (agreed 2026-07-07):** Tanveer supplies the locked design — or at least a blueprint/idea — for any character without one. Generate from that. The three AI-invented designs below (Mustafa, Siddiq, Yalina) are placeholders to be regenerated once he provides theirs.

1. Write the positive prompt from the template using the character's locked design (or Tanveer's blueprint; only invent as a stopgap and note it here).
2. Generate, inspect at full size, fix color bleed per the rule, re-roll seed if pose is weak.
3. Copy to `public/characters/<id>.png`, add id to `lib/game/characterArt.ts`, add a row to the table above.

## Consistency Rules

- Never change the checkpoint or the style block without regenerating the whole set.
- Keep 1024×1024 — UI crops with `object-cover object-top`.
- Backgrounds stay dark + element-tinted so cards read on the dark UI.
