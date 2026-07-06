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

## Current Set (v1 — 2026-07-07)

| Character | Seed | Notes |
|---|---|---|
| duke | 777001 | magenta changpao, blue water fx; hair/robe bleed solved per rule above |
| lyra | 777002 | recurve bow, red ice crystals, white skirt |
| master_tao | 777003 | white gi, fire fists; wraps rendered white not black (acceptable) |
| mustafa | 777004 | design NOT locked in lore — invented: olive kurta, stone gauntlets |
| siddiq | 777005 | design NOT locked — invented: red tunic w/ gold leaf, vine arms |
| batra | 777006 | saffron turban, blue+gold armor, lion flame |
| gabrist | 777007 | indigo coat, giant calligraphy brush, ink ribbons |
| sara | 777008 | twin braids, cat-ear band, red overall dress, spectral cats |
| yalina | 777009 | design NOT locked — invented: green bob, bandaged fists |

Full prompts recoverable from ComfyUI history / git log of this file's introduction commit.

## Adding a New Character

**Workflow (agreed 2026-07-07):** Tanveer supplies the locked design — or at least a blueprint/idea — for any character without one. Generate from that. The three AI-invented designs below (Mustafa, Siddiq, Yalina) are placeholders to be regenerated once he provides theirs.

1. Write the positive prompt from the template using the character's locked design (or Tanveer's blueprint; only invent as a stopgap and note it here).
2. Generate, inspect at full size, fix color bleed per the rule, re-roll seed if pose is weak.
3. Copy to `public/characters/<id>.png`, add id to `lib/game/characterArt.ts`, add a row to the table above.

## Consistency Rules

- Never change the checkpoint or the style block without regenerating the whole set.
- Keep 1024×1024 — UI crops with `object-cover object-top`.
- Backgrounds stay dark + element-tinted so cards read on the dark UI.
