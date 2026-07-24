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
