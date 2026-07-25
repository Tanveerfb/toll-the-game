# Skill Art Generation Plan (ComfyUI)

**Status:** Planned 2026-07-24. NOT started — this is the plan only, no generation run yet.

## Why

The battle-UI overhaul made skill cards **art-forward** (7DSGC-style: type icon + rank stars + full-bleed art, no name/element clutter). Right now every card of a character shows the same portrait, so a character's own skills are visually indistinguishable. This plan generates a **unique art per skill/ultimate** so each card reads on its own.

## Decisions (locked with Tanveer 2026-07-24)

- **Granularity:** one art **per skill (+ ultimate)**, shared across ranks R1/R2/R3. (7DS reuses the same card art on rank-up.)
- **Composition:** **dynamic action pose** — the character mid-attack in a skill-specific pose with element VFX, full-bleed (true 7DSGC look). Not portrait+overlay.
- **Scope:** **playable roster + boss Molvarr.** Skip: generic enemies/mobs (their cards are face-down/hidden in play), `lyra_npc` (reuses playable Lyra's art), `chiara`/`isolde` (kits not finalized — add when they land).
- **Count:** 16 playables × 3 = 48, + 8 unique Molvarr skills = **56 arts**.

## Pipeline (extends `docs/ART_PIPELINE.md`)

Same setup as portraits: ComfyUI + `animagineXL40_v4Opt.safetensors`, 28 steps, CFG 7, `euler_ancestral`/`normal`. **Reuse each character's locked design sheet (`docs/design/characters/*.md`), seed, and color-bleed/trigger-word guards** — those hold the character on-model.

**Positive prompt = character-lock block (unchanged from portrait) + per-skill action block:**

```
masterpiece, best quality, absurdres, 1boy|1girl, solo,
(HAIR:1.3), (EYES:1.2),                         <- character lock (from design sheet)
wearing (COSTUME:1.3), COSTUME DETAILS,
(SIGNATURE PROP:1.25),
(SKILL POSE:1.2), (SKILL VFX in ELEMENT-COLOR:1.25), motion blur, action lines,   <- per-skill
cel shading, thick clean lineart, vibrant colors, anime screencap, dramatic lighting,
dynamic angle, full body or cowboy shot,
dark ELEMENT-COLOR gradient background, ELEMENT particles
```

Negative prompt: same as portraits (+ per-character bleed guards).

**Per-skill authoring:** each skill needs a short **pose + VFX fragment** written to match its kit (e.g. Gon "Jajanken: Rock" → `winding up a massive punch, fist glowing, green nen aura burst`; Killua "Lightning Palm" → `open-palm thrust, crackling electricity, blue-white lightning arcs`). Element color follows the character's element. This authoring is the bulk of the execution work.

**LOCKED recipe (proven on Gon, 2026-07-25) — the simple formula:**
> **dynamic character pose + spiral/radial background speed-lines (element-colored) + a HINT of the character's power.** That's it. No big VFX blasts.

- **NO balls/orbs of energy, no dominant energy blast, no ki-sphere.** The power shows as a *subtle hint* — a wisp/streak/shard of the character's element around the pose (Lyra → red ice shards, Duke → water swirl, Batra → flame licks, Gon → green nen streaks), plus the element-colored spiral/radial lines in the background. The character + pose is the subject; the power is flavor, not the focus.
- Exactly ONE clean, sharp character in a single frozen dynamic pose. **NO motion blur, ghost/afterimage limbs, duplicated/smeared hands, or lingering body trails** — dynamism is from the pose, not blur.
- **Drop from positives:** `motion lines`, `motion blur`, `action lines`, `afterimage`, `speed blur`, and any `energy ball/orb/sphere` wording.
- **Standard negative for every skill:** `lowres, bad anatomy, bad hands, extra fingers, worst quality, low quality, jpeg artifacts, signature, watermark, text, blurry, realistic, photorealistic, 3d, busy background, multiple characters, motion blur, afterimage, ghost hands, ghost limbs, duplicate limbs, extra arms, extra hands, double exposure, blurry limbs, transparent body, smeared hands, energy ball, energy orb, glowing sphere, ki ball, energy bomb` (+ per-character color-bleed guards).
- **Framing/settings (locked):** portrait **832×1216**, cowboy shot, character centered with face in the upper third; animagineXL40_v4Opt, 28 steps, CFG 7, euler_ancestral/normal; `(<element> gradient background:1.3)`.

**Per-character element + power hint** (element color = background/spiral tint from the JSON; power theme = from each design sheet `docs/design/characters/*.md` + kit — NOT always the same as the element color, e.g. Batra):

| char | element (bg tint) | power hint |
|---|---|---|
| ban | green | green soul wisps |
| batra | blue | golden-lion flame licks |
| diane | blue | rock/earth shards (NO fist gauntlet — bare-handed / giant's stance) |
| duke | blue | water swirl / vortex |
| gabrist | blue | ink brush strokes |
| killua | blue | crackling blue-white lightning |
| leorio | red | red energy-fist glow |
| lyra | red | crimson red-ice shards |
| master_tao | green | fire/flame licks |
| meliodas | red | dark demonic aura wisps |
| mustafa | green | earth/stone shards |
| sara | red | spectral beast-paw glyphs |
| seras | light | lightning arcs (polearm) |
| siddiq | red | nature vines / bloom petals |
| yalina | green | green energy-fist glow |
| molvarr (boss) | dark | corrosive abyssal water / sea-rot |

Read each character's design sheet before authoring — costume/hair/prop tokens + color-bleed guards carry over from the portrait recipe in `docs/ART_PIPELINE.md`.

### Consistency strategy (the hard part with action poses)

txt2img pose variation drifts the character. Mitigations, in order:
1. **Same seed + high-weight design-sheet tokens** per character (first attempt; cheapest).
2. If drift is too high, **img2img / ControlNet from the locked portrait** as an identity/pose anchor — regenerate around the existing on-model portrait rather than pure txt2img.
3. Canon-tag characters (Meliodas/Ban/Diane/Gon/Killua/Leorio use danbooru tags) stay on-model most easily — **do one of these first** to prove the recipe before the AI-invented designs.

### Composition for the new card shape

Cards are now **narrow/tall** (flex-fit, ~44–80px wide). Art should be a **vertical crop centered on the character mid-action**, readable when small. Generate 1024×1024 (or 768×1024 portrait), card `object-cover object-top` crops it. Keep the focal action in the upper-center so the crop doesn't lose it.

## Code wiring (do alongside generation)

- **Naming/slug:** `skillArtSlug(skillName)` → kebab-case, strip punctuation. `"Jajanken: Rock"` → `jajanken-rock`, `"Fist of Flowing Ruin : Slide"` → `fist-of-flowing-ruin-slide`.
- **Files:** playables `public/characters/skills/<charId>__<slug>.png`; boss `public/npc/skills/molvarr__<slug>.png`.
- **Lookup:** add `getSkillArt(charId, skill)` to `lib/game/characterArt.ts` — returns the skill-art path if registered (a `SKILLS_WITH_ART` set, same pattern as `CHARACTERS_WITH_ART`), else `null`.
- **Fallback:** the card already defaults to the portrait — so `getSkillArt(...) ?? getCharacterArt(charId)`. Ungenerated skills gracefully show the portrait; no broken images. This lets us ship art incrementally.
- **Consumers to switch to `getSkillArt`:** `components/game/Deck.tsx` (hand card art), and the skill thumbnails on the archive character page / detail overlays if we want them there too.
- **(Recommended) stable key:** skill slugs derive from `skillName`, so renaming a skill orphans its art. Optionally add an explicit `artKey` field per skill in the JSON to decouple — decide when wiring.
- Bump `ART_VERSION` when replacing any file in place (cache-bust), same as portraits.

## Generation checklist (56 arts)

Order: prove the recipe on **Gon** (canon tag, easy consistency) → review with Tanveer → lock recipe → batch the rest → Molvarr last.

**Playables (48):**
- [ ] **ban** — Drain · Snatch · Fox Hunt (ult)
- [ ] **batra** — Lion's Charge · Roar of Spite · Khalsa Flame (ult)
- [ ] **diane** — Ground Gladius · Rush Rock · Mother Earth Catastrophe (ult)
- [ ] **duke** — Fist of Flowing Ruin : Slide · : Weaken · : Water (ult)
- [ ] **gabrist** — Ink Slash · Erase · Masterpiece Unveiled (ult)
- [ ] **gon** — Jajanken: Rock · Jajanken: Round 2 · Jajanken Combo (ult)  ← recipe proof
- [ ] **killua** — Lightning Palm · Thunderbolt · Speed of Lightning (ult)
- [ ] **leorio** — Member of the Zodiac · Switchblade Attack · Remote Punch (ult)
- [ ] **lyra** — Red Ice: Volcanic Frost · Red Ice: Magma Shaft · Red Ice: Absolute Zero Ignition (ult)
- [ ] **master_tao** — Flaming Palm · Inferno Consumption · Wrath of the Fire Sage (ult)
- [ ] **meliodas** — Triple Strike · Full Counter · Evil Spirit (ult)
- [ ] **mustafa** — Earth Stance: Fortress · Earth Shatter · Tea Time Tremor (ult)
- [ ] **sara** — Animal Strike · Stampede Concentrate · Beast Master's Fury (ult)
- [ ] **seras** — Static Lance · Chain Tempest · Heavenfall Bolt (ult)
- [ ] **siddiq** — Nature's Strike · Cleansing Bloom · Wrath of the Wild (ult)
- [ ] **yalina** — Attention Drawer · Unexpected Strike · Devastating Blow (ult)

**Boss Molvarr (8 unique, across 2 phases):**
- [ ] Corrosive Surge · Crushing Maw · Sunken Verdict · Devour the Tide · Abyssal Pierce · Devouring Bite · Iron Carapace · Tidal Cataclysm

## Proof batch — Gon (ready-to-run)

Generate these 3 first, review with Tanveer for consistency + card-crop legibility, THEN lock the recipe and batch the rest. Gon = canon danbooru tag (`gon freecss`), green element, seed 777023 (portrait seed — reuse or vary per skill). 1024×1024, 28 steps, CFG 7, euler_ancestral/normal.

Shared character-lock block (prepend to every Gon skill):
```
masterpiece, best quality, absurdres, 1boy, solo,
gon freecss, (spiky black-green hair:1.2), (brown eyes:1.1), determined expression,
green fishing jacket, green shorts,
```
Shared tail (append to every Gon skill):
```
cel shading, thick clean lineart, vibrant colors, anime screencap, dramatic lighting,
dynamic angle, dark green gradient background, green energy particles
```
Negative (standard, no bleed guard needed for Gon):
```
lowres, bad anatomy, bad hands, extra fingers, worst quality, low quality, jpeg artifacts,
signature, watermark, text, blurry, realistic, photorealistic, 3d, busy background, multiple characters
```

Per-skill action fragment (insert between lock block and tail):
- [ ] `gon__jajanken-rock` (Jajanken: Rock) — `winding up a massive reinforced punch, huge clenched fist thrust forward, explosive green nen aura bursting around the fist, motion lines`
- [ ] `gon__jajanken-round-2` (Jajanken: Round 2) — `charging an even bigger two-fisted strike, intense swirling green nen aura, ground cracking beneath a powerful braced stance`
- [ ] `gon__jajanken-combo` (Jajanken Combo, ULT) — `unleashing an all-out finishing punch, giant glowing fist, massive green nen shockwave explosion, full-body dynamic action pose`

Save to `public/characters/skills/gon__<slug>.png`, add each `gon__<slug>` key to `SKILLS_WITH_ART` in `lib/game/characterArt.ts`, bump `ART_VERSION`. Then the cards pick them up automatically.

## Batch status (2026-07-25)

**First full batch DONE, wired, NOT committed.** 53 arts generated (45 playable + 8 Molvarr) via pure txt2img (locked recipe above), + Gon's 3 = 56 total. `lib/game/characterArt.ts`: all keys in `SKILLS_WITH_ART`, `ART_VERSION` bumped 12→13. `npm run check` green (307/307 tests). Files under `public/characters/skills/` + `public/npc/skills/`. **Uncommitted by design** — one clean commit after the re-spin.

Next step is the **IP-Adapter re-spin** of the flagged queue below, then Tanveer reviews, then commit.

## IP-Adapter design-lock method (LOCKED 2026-07-25, proven on Ban)

The re-spin uses **IP-Adapter (design-ref lock)**, NOT pure txt2img. The character's locked portrait becomes a visual reference that holds identity/costume/colors while the text prompt drives only the action pose. This directly fixes the 4 recurring txt2img failures: costume-color bleed (Ban→teal), face de-aging (Ban→teen), gender-drift (Siddiq→female), and off-model AI-invented chars (Seras).

**Tooling confirmed present on the local Comfy (E:\Installed\ComfyUI_windows_portable):**
- Custom nodes: `ComfyUI_IPAdapter_plus` (enabled).
- IP-Adapter models: `ip-adapter-plus_sdxl_vit-h.safetensors` + `ip-adapter_sdxl_vit-h.safetensors` (SDXL → matches Animagine XL).
- clip_vision: `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`.
- ControlNet folder is EMPTY (no OpenPose yet) — pose comes from the text prompt, not ControlNet. If a specific pose won't hold, download an SDXL OpenPose ControlNet and pair it.

**Proven recipe (Ban Drain test, on-model, red costume held):**
1. `upload_image` the character portrait → `public/characters/<id>.png` (boss: `public/npc/<id>.png`). Use filename `ref_<id>_portrait.png`.
2. `generate_with_ip_adapter`:
   - `reference_image` = the uploaded ref
   - `preset` = `PLUS (high strength)`, `weight` = **0.6–0.65**, `weight_type` = `standard`
   - `checkpoint` = `animagineXL40_v4Opt.safetensors`, `width` 832, `height` 1216, `cfg` 7
   - **`steps` 36, `sampler` `dpmpp_2m`, `scheduler` `karras`** ← updated 2026-07-25; the old euler_ancestral/28 caused the grain (see the SAMPLER FIX section below)
   - `seed` — pass an explicit one so a good result is reproducible (777023 is a known-good starting point); vary per skill so poses differ
   - `prompt` = character-lock tokens + per-skill action pose (from the audit notes below)
   - `negative_prompt` = standard anti-ghost/anti-drift set + per-character guards
3. `list_output_images` → newest `ComfyUI_ipadapter_*.png` → copy to `public/{characters|npc}/skills/<id>__<slug>.png` (overwrite the flagged file).
4. After the queue: `ART_VERSION` is already 13 — bump to **14** on the re-spin (files replaced in place). `npm run check`. Do NOT commit until Tanveer signs off.

**Tuning note:** the Ban proof came out slightly neon/oversaturated with a yellow-pink bg instead of green. weight too high = copies the portrait's pose; too low = drifts off-model. **0.6 is the balance.**

### ⚠️ SAMPLER FIX — the single most important finding (2026-07-25). SUPERSEDES the locked sampler.

**`euler_ancestral` @ 28 steps is the cause of the grainy/wavy/oversaturated "artifacty" look.** Switch to **`dpmpp_2m` + `karras` @ 36 steps** for every re-spin.

How it was isolated (each step ruled one thing out):
1. Suspected IP-Adapter compounding across queued jobs → `clear_vram` before a re-render: **no change**. Wrong.
2. Suspected bad random seeds → re-ran a known-clean prompt with fixed seed 777023: came back **clean**. But re-running a known-*bad* prompt on that same good seed was **still bad**. So seed is not the cause either.
3. Compared clean vs bad content: clean images were flat shapes (suit, short spiky hair, simple particles); bad images were all **high-frequency detail** — curly hair, gold filigree trim, bead necklaces, erupting vines/flames. `euler_ancestral` is a stochastic (ancestral) sampler that injects fresh noise every step, and at 28 steps it cannot resolve that detail density, so it lands as grain and colour mush.
4. Same prompt + same seed, only `dpmpp_2m`/`karras`/36 steps: **clean lineart, no grain, bg colour held, curly hair resolved.** Confirmed.

**This very likely also explains defects in the original 56-art txt2img batch**, which used euler_ancestral/28 throughout. Characters with dense detail (Siddiq, Batra, Seras, Molvarr) suffered worst — exactly the ones Tanveer flagged.

Rule: high-detail characters **require** dpmpp_2m/karras/36. Do not go back to euler_ancestral for these.

### Palette-bleed tuning — measured on Leorio (2026-07-25). READ BEFORE TWEAKING.

IP-Adapter carries the reference portrait's **whole color palette**, not just identity. Leorio's portrait is yellow-nen-on-cyan, so at weight 0.6 the arts came out cyan/yellow and the `(dark red gradient background:1.3)` was overridden. Two attempts, one clear verdict:

| set | weight | bg token weight | negatives | result |
|---|---|---|---|---|
| A | 0.6 | 1.3 | standard + ~12 anti-vector/anti-mask | ✅ identity + costume + face perfect, clean lineart. ❌ palette stayed cyan/yellow |
| B | 0.5 | **1.6** | standard + **~24** (added blue/cyan/teal/yellow bg, melted shapes, extreme foreshortening…) | ❌ **badly degraded** — smeared jagged artifacts, dissolving bodies, washed-out orange mush. Unusable |
| C | 0.6 | 1.35 | standard + A's set + only 2–4 palette guards | (see below) |

**DECISION (2026-07-25): stop fighting the palette — keep the reference portrait's palette.** A 4th attempt with `weight_type: "prompt is more important"` *also* stayed cyan/yellow, so the reference palette is not promptable at usable weights. Rationale for accepting it: Tanveer's own standard for rejecting the Seras arts was that they were "inconsistent with her official artwork" — so matching the portrait beats matching the element swatch. A character's card `color` drives UI chrome, not the art. **Practical rule: write the prompt's bg/VFX color to match the character's PORTRAIT, not the element table above.** (Leorio → deep blue bg + yellow nen, not red.) The per-character element table stays valid for the 34 unflagged txt2img arts already shipped.

**Rule learned: do NOT stack fixes.** Pushing the bg token past ~1.4 *and* piling on 20+ negatives overloads the conditioning at CFG 7 and wrecks image quality — it fails far worse than the palette problem it was trying to fix. Nudge ONE knob at a time: bg token ceiling **1.35–1.4**, and cap added palette negatives at ~4 short tags (`cyan background`, `yellow glow`). Lowering IP-Adapter weight is NOT the lever for palette — it costs identity without buying color.

**The overload budget applies to WEIGHTED POSITIVE TOKENS too — measured on Siddiq 2026-07-25.** His prompt kept the negatives inside budget but stacked **9 weighted tokens** (`1boy:1.4`, `dark-skinned muscular:1.35`, `masculine face:1.3`, `hair:1.35`, `eyes:1.2`, `tunic:1.3`, pose`:1.35`, vines`:1.25`, bg`:1.3`). Result: 1 of 3 dissolved into yellow mush, and all 3 lost his **dark skin** (washed to pale) while the red-orange bg was flooded green. Leorio's clean Set A had ~7. **Cap emphasis at 4–5 tokens above 1.2 per prompt; leave everything else unweighted.** Emphasis is a budget, not a volume knob — weighting everything weights nothing, and the tokens that lose the fight are the quiet ones (skin tone, background color).

**Colour-flood corollary:** if a character's costume, hair accent AND element are all the same hue (Siddiq: green tunic + green hair highlights + green vines), that hue floods the frame and overrides the background. Keep the element VFX unweighted for those characters and weight the *background* instead.

**Hard limit, measured: the negative list has a budget of ~45 tags.** Set A's list (45 tags) renders clean. Growing it to ~55 (adding hair + pose guards) reproduced the exact same smearing/dissolving-body failure as bg-weight 1.6 — twice. **Freeze the standard negative block; only ever swap the per-skill action fragment in the positive.** If a new guard is genuinely needed, remove one first.

### Hand/face detailer pass — WORKING, validated 2026-07-25

Mushy fists were the top remaining defect once identity was solved (and this queue is mostly punch skills). Fixed with a second inpaint pass. **Installed for this:** `ComfyUI-Impact-Subpack` (provides `UltralyticsDetectorProvider`; Impact-Pack alone does NOT have it) + detectors `models/ultralytics/bbox/hand_yolov8s.pt` and `face_yolov8m.pt` (from [Bingsu/adetailer](https://huggingface.co/Bingsu/adetailer)).

Usage: `upload_image` the finished art → `enqueue_workflow` with this graph (swap `image` filename; use `bbox/face_yolov8m.pt` for a face pass):

```json
{"1":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"animagineXL40_v4Opt.safetensors"}},
 "2":{"class_type":"LoadImage","inputs":{"image":"<uploaded>.png"}},
 "3":{"class_type":"UltralyticsDetectorProvider","inputs":{"model_name":"bbox/hand_yolov8s.pt"}},
 "4":{"class_type":"BboxDetectorSEGS","inputs":{"bbox_detector":["3",0],"image":["2",0],"threshold":0.4,"dilation":12,"crop_factor":3,"drop_size":10,"labels":"all"}},
 "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["1",1],"text":"masterpiece, best quality, a single clean anime hand, tightly clenched fist, correct five fingers, cel shading, thick clean lineart"}},
 "6":{"class_type":"CLIPTextEncode","inputs":{"clip":["1",1],"text":"bad hands, bad anatomy, extra fingers, fused fingers, missing fingers, mutated hands, deformed, blurry, smeared, lowres, worst quality"}},
 "7":{"class_type":"DetailerForEach","inputs":{"image":["2",0],"segs":["4",0],"model":["1",0],"clip":["1",1],"vae":["1",2],"guide_size":512,"guide_size_for":true,"max_size":1024,"seed":123456,"steps":24,"cfg":7,"sampler_name":"euler_ancestral","scheduler":"normal","positive":["5",0],"negative":["6",0],"denoise":0.45,"feather":6,"noise_mask":true,"force_inpaint":true,"wildcard":"","cycle":1}},
 "8":{"class_type":"SaveImage","inputs":{"images":["7",0],"filename_prefix":"handfix"}}}
```

`denoise` 0.45 is the sweet spot — enough to rebuild the hand, low enough to keep the pose. It fixes *hands*, not composition: an oversized/badly-framed fist stays oversized, so fix framing in the base render first.

**Hard limitation (measured on `ban__drain`, threshold lowered to 0.35, still no effect): the detailer only repairs hands YOLO can DETECT.** A hand that has degenerated into an unrecognizable blob produces no bbox, so `DetailerForEach` has nothing to inpaint and the output is byte-identical to the input. It worked on `leorio__remote-punch` because that fist was still hand-shaped, just sloppy. **Triage rule: hand-shaped-but-ugly → detailer pass. Blob → re-render the base image; the detailer cannot save it.** Blobs usually come from the prompt fighting the reference (e.g. asking for an empty gripping hand while Ban's portrait holds nunchaku there → merged into a hook shape); fix by naming the hand's state explicitly and negating the stray prop.

**Gotcha:** the MCP's `get_node_info` served a **stale /object_info cache** and reported `UltralyticsDetectorProvider` missing for several minutes after it was actually loaded. Verify with `curl -s http://127.0.0.1:8188/object_info/<NodeName>` before concluding a node failed to install.

**Word trap — never write "crown".** `(small topknot at the crown:1.2)` made Animagine paint a literal **gold royal crown** on Leorio's head, in 2 of 2 renders. Use `(small tied tuft of hair at the back of the head:1.15)`. Add `crown, tiara` to negatives for any character with a topknot/tied hair (Leorio, Batra's patka). Watch for the same literalism with other anatomy-vs-object words.

### Tooling upgrades added 2026-07-25 (research-backed)

Our characters are **anime illustrations**, so the InsightFace face-lock family (InstantID / PuLID / IP-Adapter FaceID) is the WRONG tool — those need real faces (PuLID errors "no faces detected" on anime). **IP-Adapter Plus (image-embedding, what we use) is the correct anime identity-lock.** Don't waste time on FaceID/InstantID/PuLID.

State as of 2026-07-25 (verified, post-restart):
1. **comfyui_controlnet_aux v1.1.5 — INSTALLED + IMPORTED.** ✅ The OpenPose/DWPose **preprocessor**: extracts a pose skeleton from a reference action image to feed a ControlNet.
2. **xinsir OpenPose ControlNet SDXL — NOT DOWNLOADED.** ❌ The earlier download never landed (`models/controlnet/` is empty; health_check reports `controlnet: EMPTY`, and download ids don't survive an MCP session). **Deliberately not re-fetched:** OpenPose needs a *pose skeleton reference image* per art and we only have portraits — 2.5GB is dead weight until we source pose refs. IP-Adapter alone fixes the real failure modes (identity, costume, color-bleed); static-pose failures are prompt problems. Re-download (`download_model` → `controlnet` subfolder) only if pose keeps failing after the IP-Adapter re-spin.
3. **FaceDetailer** — already had it (`ComfyUI-Impact-Pack`, no download). Add to the workflow to auto-inpaint/sharpen the face after generation for cleaner on-model features.

**`restart_comfyui` is broken on this install** — it stops the server then fails to relaunch (`spawn ComfyUI\main.py ENOENT`, wrong cwd). Relaunch manually:
```powershell
Start-Process -FilePath "E:\Installed\ComfyUI_windows_portable\python_embeded\python.exe" `
  -ArgumentList "-s","ComfyUI\main.py","--windows-standalone-build" `
  -WorkingDirectory "E:\Installed\ComfyUI_windows_portable" -WindowStyle Minimized
```

**Optional escalation (only if IP-Adapter+OpenPose still drifts on the AI-invented chars):** train a tiny per-character **LoRA** (Comfy MCP has `train_*` tools) on Seras/Siddiq's art for a near-100% lock. Overkill for the whole roster; reserve for repeat offenders.

**Skipped (deliberately):** Flux-based consistency (ACE++, InstantCharacter, PuLID-Flux) — Flux is less anime-native than Animagine XL and switching base model would restyle the roster off the existing 56 arts. Stay on Animagine XL SDXL.

## Post-completion audit catch (2026-07-25)

After declaring all 22 done, Tanveer asked "are you sure ban's fox-hunt is good?" — it wasn't. Re-look found `ban__fox-hunt` had the exact costume-bleed bug already fixed for `drain`/`snatch` (green/teal costume instead of locked red), plus an invented giant green ball-mace weapon (not nunchaku, not even a real Ban weapon), no visible red scar, and a young-looking face. This file had been carried over from a prior (compacted) session's "accepted" verdict without a fresh look this session — trusting stale acceptance instead of re-verifying was the mistake. Fixed by re-applying the same locked-costume prompt used for `drain`/`snatch` (red sleeveless shirt, mature adult, red scar) and dropping the weapon for a bare-hand snatching-grab pose.

That prompted a full re-audit of every art carried over from the prior session (Leorio ×3, Ban drain/snatch, Yalina ×2, Batra, Mustafa) instead of trusting the doc's prior "done" state. Two more imperfections surfaced and were fixed: `batra__roar-of-spite`'s beard was longer/more pointed than the locked "neat, rounded, medium-length" spec (re-spun, fixed), and `ban__snatch`'s hair had stray magenta/purple streaks bleeding into what should be plain white/blue (re-spun, fixed). The rest (Leorio ×3, Ban Drain, Yalina ×2, Mustafa) held up under re-inspection.

**Lesson: "written to disk" and "matches the plan doc's checklist" are not the same as "actually good" — re-look at the pixels every time, especially anything inherited from before the current review pass, don't just trust a prior verdict (even your own).**

## Re-spin PROGRESS (2026-07-25) — COMPLETE, all 22/22 (+ 2 post-audit fixes)

All 22 flagged arts done and written (uncommitted): `leorio__member-of-the-zodiac`, `leorio__switchblade-attack`, `leorio__remote-punch`, `ban__drain`, `ban__snatch`, `ban__fox-hunt`, `yalina__unexpected-strike`, `yalina__devastating-blow`, `batra__roar-of-spite`, `mustafa__earth-shatter`, `siddiq__cleansing-bloom`, `siddiq__wrath-of-the-wild`, `siddiq__nature-s-strike`, `diane__ground-gladius`, `diane__rush-rock`, `diane__mother-earth-catastrophe`, `seras__static-lance`, `seras__chain-tempest`, `seras__heavenfall-bolt`, `molvarr__corrosive-surge`, `molvarr__crushing-maw`, `molvarr__sunken-verdict`, `molvarr__abyssal-pierce`.

`ART_VERSION` bumped 13→14 in `lib/game/characterArt.ts`. `npm run check` green (307 tests). Not committed — pending Tanveer's review per standing git-confirmation rule.

**siddiq__nature-s-strike gender miss:** first render was female (wrong — Siddiq is male). Re-spun with `1boy, male` lock + `1girl, female, woman, breasts` negatives; fixed clean on first retry.

**diane (all 3): gauntlet + upskirt framing persisted through a full render pass and required a second fix round.** Even after the "no gauntlet" note above, the actual renders still had silver riveted metal gauntlets on one or both arms plus low-angle crotch-focus framing. Root cause: prompt said "no gauntlet" only in spirit, not as an explicit weighted negative, and didn't lock the *replacement* (bare fist + fabric wrist wrap) hard enough to out-compete IP-Adapter's pull toward "big fist = armored fist" associations. Fix that worked: `(bare oversized muscular right fist and forearm:1.4)` + `(orange fingerless wrist wrap:1.2)` positive, `(metal gauntlet:1.5), (steel armor:1.5), armored glove, riveted metal` negative, plus explicit `eye-level camera angle` positive + `low angle, worm's eye view, from below, upskirt, panty shot, crotch focus` negative to kill the framing issue. Purple eyes (not blue) also corrected per portrait.

**seras: portrait/design-sheet conflict resolved by scrapping the old design, not reconciling it.** Tanveer: "open to new seras design" — dropped the fight to match the plate-armor portrait. New locked look (used for all 3 skill arts + should inform a future portrait regen): white hair, pink eyes, elf ears, **dark navy kimono-style battle dress, high collar, flared cape, black gloves, blue-white lightning** (never pink/magenta/gold). IP-Adapter weight 0.35 (low, so the text prompt drives costume/color while the reference only anchors face/hair/ears).

**seras__heavenfall-bolt: 7 render attempts, root cause was NOT the pose or the seed.** Chronology: v1 pose (two-handed overhead raise) failed twice with heavy diagonal-stripe/moire corruption. Suspected pose complexity (per the "upright single-arm gestures land" rule below) → switched to a single-arm thrust pose reusing the exact sentence structure that had already worked for `static-lance`/`chain-tempest`, same proven seed 777023 — **still failed**, three more times, including after a full manual ComfyUI restart (ruling out server/VRAM state) and a fresh unused seed (ruling out a poisoned seed). Actual cause: the pose+VFX text was bundled into **one over-weighted run-on clause** — `(gripping...thrusting...blade wreathed in crackling blue-white lightning:1.45)` — combining two distinct concepts (grip/thrust action + lightning VFX) under a single high emphasis weight, unlike every working Seras render which always kept the pose clause and the VFX/color clause as two separate weighted parentheticals. Splitting them — `(thrusting a long silver polearm straight forward with immense force:1.4), (crackling blue-white lightning:1.3)` — fixed it on the very next attempt. **Lesson: a single weighted clause should carry one concept, not a chained pose+VFX run-on, even if the overall prompt is well under the ~4-5 weighted-token budget.**

**Hit rate ≈ 1 in 3 renders.** Dominant failure modes, in order: (1) mangled hands, (2) wide/low dynamic poses collapsing anatomy, (3) costume colour bled by the element VFX (Batra orange→gold, needed `(bright orange kurta:1.4)` + `yellow clothes, gold clothes` negatives).

**Pose rule learned: upright single-arm gestures land; low lunges and wide swipes fail.** Every keeper is an upright pose with one clear arm action. Cards render ~44–80px wide, so fine dynamism is invisible anyway — clear silhouette and colour are what read. Prefer reliability.

**Composition guard:** one Mustafa render came out fully inverted (head-down, holding an invented staff). Add `upside down, inverted, rotated, lying down, falling` to negatives when a pose implies downward motion ("slam downward into the ground") — the model can satisfy it by rotating the character instead.

### ⚠️ Seras: her PORTRAIT contradicts her design sheet — needs Tanveer's decision

`public/characters/seras.png` shows **silver plate armour** (pauldrons, gauntlets, breastplate segments), magenta trim, and **pink lightning** — precisely what Tanveer rejected in her skill arts. `docs/design/characters/seras.md` instead specifies a dark kimono-armor formal silhouette (high collar, flared cape, no plate) and her element is light/lightning.

So the skill arts didn't invent the armour — they inherited it from the portrait, and IP-Adapter locking to that reference reproduces the rejected look by design. Interim workaround: **Seras only — IP-Adapter `weight` 0.45** (vs 0.6 elsewhere) so face/hair/elf-ears carry but the text prompt drives costume, plus heavy negatives `(plate armour:1.4), pauldrons, breastplate, gauntlets, (pink lightning:1.4), magenta`. Proper fix is regenerating her portrait to match the sheet — Tanveer's call, and consistent with [[tanveer-art-design-feedback]] already listing Seras as "iterate later".

## Re-iteration queue (audit flags 2026-07-25)

Arts Tanveer flagged from the first full batch — re-spin these after the batch finishes. More get added as he audits. **Per-image diagnosis below** (Opus read every flagged file against its portrait 2026-07-25).

**leorio (ALL 3: member-of-the-zodiac, switchblade-attack, remote-punch) — COMPLETE MISS (highest priority).** Sonnet flagged all three too: they rendered as a stylized dark silhouette / vector-poster look, faceless, inconsistent with every other char's cel-shaded style. member-of-the-zodiac is a faceless black-suited figure with a red-eyed slasher mask — reads as a horror villain, not Leorio. Leorio = tall mature man, **navy blue business suit + white dress shirt + blue necktie**, spiky short black hair with a tiny topknot/ponytail, **small round BLACK sunglasses** (not clear glasses — verified against `public/characters/leorio.png` 2026-07-25), confident grin; card color is red so the bg/VFX tint is red energy-fist glow (his Remote Punch nen) — note his *portrait* uses yellow nen on a blue bg, but card-element consistency wins. IP-Adapter-lock to his portrait + strong Leorio tokens + a real cel-shaded face. No mask, no faceless silhouette, no vector-poster style.

**ban__drain · ban__snatch · ban__fox-hunt — costume color bled + face de-aged.** All three turned his outfit **teal/green** and made his face look like a teenager. Ban (ref portrait) = mature muscular adult, **red sleeveless top + dark pants**, white/blue spiky hair, red eyes, red facial scar, nunchaku (Courechouse). Fix: lock `(red sleeveless shirt:1.3)`, `muscular adult man`, `mature face`; add `teal, green shirt, green clothes, child, teen, young boy` to NEGATIVES. Green stays ONLY as aura wisps + bg tint, never on the costume.

**batra__roar-of-spite — wrong turban+beard, and static.** Two fixes:
  - **Headwear/beard drifted.** Skill gave a huge bulbous genie-turban and a long pointed wizard beard. Portrait (ref) = a **small, snug orange patka/dumalla fitted close to the head** with a round gold emblem front-center, and a **full but neat, rounded, medium-length black beard** (not floor-length, not pointed). Match the portrait exactly. Add `huge turban, oversized turban, long beard, pointed beard` to NEGATIVES.
  - **Static.** It's a calm side stance. "Roar of Spite" needs an aggressive **open-mouth roar/shout, dynamic lunge**, golden-lion flames flaring with the roar.
  - Keep (correct): orange kurta, purple sash, gold bracelet, golden-lion flames, blue bg.

**diane (all 3) — remove the gauntlet + de-sexualize.** Every one shows a giant metal fist/gauntlet weapon (user: NO gauntlet) and the framing is cheesecake (leotard, crotch/thigh/butt focus). Diane = orange outfit, brown twin-tails, blue eyes; power = **bare-handed giant's strength + earth/rock shards** (she smashes/hurls rock, no weapon). Fix: `NO gauntlet, no metal glove, bare hands`; reframe as a powerful action pose (punching ground, hurling boulders), not a pin-up. `ground-gladius` = summon earth/stone spikes-blade; `rush-rock` = charging rock rush; `mother-earth-catastrophe` (ULT) = massive earth-shatter finisher.

**mustafa__earth-shatter — verify vs portrait.** Pose is fine (downward punch, rocks flying) but likeness drifted — reads as a generic barbarian. On re-spin, pull Mustafa's portrait tokens (green element, earth) and match his actual face/build; confirm against `public/characters/mustafa.png`.

**siddiq (all 3) — reads female / androgynous.** `nature-s-strike` is clearly a girl (slim, feminine face, **red hair-streak** — wrong); `cleansing-bloom` androgynous & static; `wrath-of-the-wild` slim/soft. Siddiq (ref portrait) = dark-skinned **muscular young man**, black curly hair with **green** streaks, green eyes, green gold-trim sleeveless tunic, red-gem necklace, gold wristbands. Fix: `(1boy:1.35), muscular man, masculine face/jaw, flat chest, green hair streak`; NEGATIVES `1girl, feminine, red hair, slim, petite`. Keep dynamic nature/vine action.

**yalina__unexpected-strike — static stand for an attack skill.** Needs a dynamic mid-strike lunge with her **green energy-fist glow** (see her portrait). Not a stand.

**yalina__devastating-blow (ULT) — cutesy idle (hand-to-earring, smiling, looking away).** Must read as an all-out finishing punch; big dynamic action, high impact, green energy-fist blast.

**seras (all 3) — plate armour + pink lightning.** Currently silver pauldrons/breastplate knight armour with magenta-pink trim & pink lightning. Corrections:
  - **NO plate armour.** Dark, structured *kimono-formal* battle silhouette — high collar, sharp tailored lines, flared cape/skirt-piece. NOT a knight/armour look.
  - **Lightning is blue-white, not pink.** Element is light/lightning; drop the magenta palette to blue-white/silver.
  - **Antagonist — never smiling.** Cold, composed, narcissistic authority (expression is already coldish — keep it, never let it smile).
  - **Anchor to her locked portrait via img2img/ControlNet** (consistency strategy step 2) — she's AI-invented, txt2img drifts.
  - Keep: white-silver asymmetrical hair, elf-point ears, light-reddish eyes (can crackle), lightning-channeling polearm.

**molvarr (boss) — 4 of 8 flagged by Sonnet.** Re-spin `corrosive-surge`, `crushing-maw`, `sunken-verdict`, `abyssal-pierce` — they came out as abstract extreme-close-up textures/claws that don't read as the creature at card size. The other 4 (`devour-the-tide`, `devouring-bite`, `iron-carapace`, `tidal-cataclysm`) are fine — leave them. Fix: pull back the framing so the corroded rock behemoth clearly reads; IP-Adapter-lock to `public/npc/molvarr.png`.

## Out of scope (this pass)

- Per-rank art (R1/R2/R3 variants) — one art per skill only.
- Generic enemy/mob skills (frost, gale, iron, prism, raider, road_bandit, wild_beast) — cards hidden in play.
- `lyra_npc` — reuses playable Lyra's skill art via id fallback.
- `chiara`, `isolde` — kits not finalized; generate once locked.

## Verification (per art)

- On-model vs the character's design sheet (hair/eyes/costume/prop correct, no color bleed).
- Reads clearly at card size (narrow crop, focal action upper-center).
- Element/VFX color matches the skill's element and type.
- Fallback path confirmed: an un-generated skill still shows the portrait, no broken image.
