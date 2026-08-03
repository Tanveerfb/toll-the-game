# Gacha / Summon Design

> Status: BUILT 2026-08-02 (code complete, awaiting Tanveer's commit/deploy). Drafted 2026-07-18,
> resolved into an implementation spec 2026-08-01 (`docs/superpowers/specs/2026-08-01-gacha-design.md`).
> Part of the monetization core (see PRODUCT_AUDIT.md).

## Banners
Two banner categories, not one:
- **Limited banner** — rotates, has a featured roster and an end date. Currently: the **debut banner**
  (in-game display name **"V1. Beta Roster Banner"**, renamed 2026-08-02 — "debut banner" below is the
  conceptual/doc term, not the player-facing string), a one-off covering 12 non-collab characters (Duke,
  Lyra, Batra, Gabrist, Sara, Yalina, Mustafa,
  Siddiq, Master Tao, Seras, Chiara, Isolde) at a flat **5% total** rate, split evenly (~0.417% each).
  This 12-unit/5%-flat shape is a **one-off for the debut banner only** — future smaller Limited
  banners (2-3 featured units) revert to the rate rule below.
- **Permanent banner** — always available, evergreen pool. Membership is **manual, per-character** (a
  `permanentPool: true` flag on the character's data file, flipped by hand whenever Tanveer decides —
  never automatic). Starts **empty** until characters are flagged. Equal odds across the whole pool,
  no rarity/rate weighting.

**Duke and Lyra** keep their existing free-grant paths (Duke = starter, Lyra = Chapter 2 reward) *in
addition to* being pullable on the debut banner — pulling either is just a dupe.

The 6 collab characters (Meliodas/Ban/Diane, Gon/Killua/Leorio) are **deliberately excluded** from the
debut banner, reserved for their own future collab banners.

## Rarity is gone
The old **Premium/Standard** rarity split (a power/prestige tier, never a rate difference) has been
**dropped entirely** — characters are no longer tagged Premium or Standard anywhere. This is a
labeling change only: no character stats or kits were rebalanced. Whatever power variance already
existed between characters stays exactly as it was.

### Planned banners (for future Limited reruns — the debut banner absorbed the original small-pairing plan)
| Banner | Featured |
|---|---|
| Batra / Gabrist | Batra, Gabrist |
| Sara / Yalina | Sara, Yalina |
| Mustafa / Siddiq | Mustafa, Siddiq |
| 7DS collab | Meliodas, Ban, Diane |
| HxH collab | Gon, Killua, Leorio |

These pairs already appeared together on the debut banner once; future *reruns* of them as their own
dedicated 2-3-unit Limited banners use the rate rule below, not the debut's 5%-flat one-off.

## Rates
- **Limited banner rate rule** (for any banner other than the debut one-off): **2 featured units -> 5%
  total** (2.5% each), **3+ featured units -> 7% total** (split evenly). Generous vs Hoyo (Genshin
  5-star = 0.6%), closer to 7DSGC.
- **Permanent banner:** equal odds across the whole flagged pool, no featured/off-featured distinction.
- Rate is **flat for the life of a banner** — no soft-pity rate ramp on either banner. The milestone
  bar below is the sole pity mechanism.

## Pity: milestone bar (replaces the old hard/soft pity numbers)
The originally-drafted "hard pity at 80, soft pity from 70" is **gone**, replaced by a milestone bar
that tracks currency *spent* (not pull count), 1:1:

- **Limited:** bar increases by gems spent (single pull = +3, 11-pull = +30). Resets to 0 whenever the
  active banner changes — **does not** carry over between banners.
  - **300** → unlocks a **Claim** button (not automatic). Clicking grants a random pull from **every
    currently-released playable character**, not just the current banner's featured list.
  - **600** → unlocks a **Claim** button that opens a picker: player picks any one of the current
    banner's featured units.
  - **300 and 600 claim independently** — reaching 600 before claiming 300 doesn't forfeit or gate
    anything. The bar only resets on the **600 claim** (not the moment it's reached), and resetting
    forfeits an unclaimed 300 for that lap. It **loops** — claiming 600 restarts the bar at 0.
- **Permanent:** bar increases by tickets spent (single pull = +1, 11-pull = +10). Only one milestone,
  at **600** → guaranteed player-picked pull from the Permanent pool. Loops the same way.

## Economy & pull system
- **Three currencies:** `gems` (Limited banner pulls), `coin` (in-world money, ascension/leveling — also
  a possible miss-pull reward), `permanentTicket` (Permanent banner pulls only).
- **Pull cost:** Limited = 3 gems single / 30 gems for an 11-pull. Permanent = 1 ticket single / 10
  tickets for an 11-pull (same 7DSGC-style discount shape on both banners).
- **Faucet:** small gems + tickets rolled into the existing World Boss clear-reward roll (the only
  reward pipeline that existed when this was built) — amounts are tunable later, same as the
  materials/coin ranges already are.

## Non-featured pull outcomes (Limited banner only — Permanent never misses)
A non-featured Limited pull never gives a character. It gives one item from 3 equally-weighted
categories (~31.67% each), each split evenly within itself:
- **Currency bundles (coin):** 1,000 / 2,000 / 5,000 / 10,000.
- **Level-up matz:** the existing Training Manual tiers (`training_manual`/`_advanced`/`_premium`).
- **Local specialty matz:** 4 shared materials, grouped by each character's existing `color` tag
  (already used for type-advantage, no new schema needed):

  | Material | Color group | Characters |
  |---|---|---|
  | Riverstone Fragment | blue | Duke, Batra, Gabrist |
  | Scorched Ember | red | Lyra, Sara, Siddiq |
  | Bramble Thorn | green | Yalina, Mustafa, Master Tao |
  | Prism Dust | light/dark | Seras, Isolde, Chiara |

  These are deliberately **shared across characters**, not unique-per-character. Resolves the old
  "local specialty items for the remaining characters" open item below — no per-character brainstorm
  needed after all, the color-group split covers everyone on the debut banner evenly (3 each).

## Dupes -> Ultimate Level (built)
- Each dupe raises the character's **Ultimate Level**, **max 6**. All characters start at **1/6**.
- Reused for every reward source that can land on an owned character: normal pulls, the 300 milestone,
  and the 600 milestone.
- **Multiplier/effect tuning per level (1-6) is still Tanveer's open call** — the field and increment
  mechanic are built, the numbers aren't set yet. Not blocking.
- Distinct from skill card rank (r1->r3), which drives *skill* multipliers and is a battle-internal
  merge mechanic (`store/gameStore.ts`), not meta-progression.

## Ascension cost model (unchanged, not part of this build)
- `[boss signature drop] + [local specialty] + [currency]` per band. Mirrors Genshin.
- **Not yet wired to the 4 new specialty materials above** — `lib/game/ascension.ts` still only costs
  `sea_monster_eye` + `corroded_seaweed` + `coin`. Spending the new materials on ascension is a
  follow-up, not part of this build.

## OPEN (tuning, non-blocking)

1. **Per-level leveling fuel** — within a band, does Lv->Lv cost currency only, or currency + a common
   mat? (ascension band gates are fully specced in `WORLD_BOSS_AND_ASCENSION_PLAN.md`.)
2. **Ascension per-band stat-bump distribution** — the +stat granted at each of the 6 ascension unlocks.
3. **Ult per-level multiplier step** — how much the ult multiplier rises per level 1->6, and what (if
   any) special effects unlock at Lv4/Lv6.
4. **Wiring the 4 specialty materials into actual ascension costs.**
5. **Which characters, if any, get flagged into the Permanent pool** — currently empty by design.

## RESOLVED
Two banner categories (Limited rotating + Permanent evergreen); rarity/Premium-Standard dropped
entirely (labeling only, no rebalance); milestone-bar pity (300/600, independent claims, reset-only-
on-claim, loops) replaces hard/soft pity; debut banner = 12 non-collab characters at a one-off 5% flat
rate; collab characters held back for their own banners; non-featured Limited pull = currency/mats/
specialty-mats only (3-way even split); 4 shared specialty materials grouped by color tag; dupes ->
Ultimate Level 1/6->6/6 (stat/multiplier bump mechanic built, numbers still open); 3 currencies (gems/
coin/permanentTicket); pull = single or 11-for-10(ish) multi on both banners; faucet = small gems/
tickets on World Boss clears; free chars Duke (start) + Lyra (Ch2) unchanged and stack with gacha as
dupes.

## Reuse notes (from PRODUCT_AUDIT) — all landed as planned
- Archive/codex -> gacha pool browser (owned/unowned + Ultimate Level badge). **Built.**
- Ult cut-in / cinematics tech -> summon reveal animations (GSAP timeline, not the framer-motion
  cut-in directly, but the same visual language). **Built.**
- Art pipeline -> banner splash art. **Built 2026-08-02** — `public/banners/debut-2026-08.png`, a
  composite of 6 existing character portraits (Duke, Seras, Lyra, Sara, Chiara, Gabrist) over a
  generated amber/zinc burst background, not a fresh single-scene AI render (this pipeline generates
  one character per image; a 12-up group render isn't how it works). See `docs/ART_PIPELINE.md`'s
  banner-compositing section for the method. Permanent banner still shows the placeholder SVG
  (empty pool, nothing to feature yet).
- `users/{uid}` doc -> roster ownership + wallet + pity counters. **Built** (plus a cloud-save
  migration fix discovered along the way — see the news post / session notes for detail).
