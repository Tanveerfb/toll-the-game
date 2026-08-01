# Gacha System — Design Spec

> Status: Approved by Tanveer 2026-08-01. Supersedes the pity/rarity sections of
> `docs/design/GACHA_DESIGN.md` (see "Supersedes" section at the bottom).

## Overview

Summon system with two banners — a rotating **Limited** banner and an evergreen
**Permanent** banner — a milestone-bar pity mechanic (replacing the old hard/soft
pity numbers), dupes feeding an Ultimate Level system, and a new debut banner
covering 12 of the 18 currently-playable characters.

## Terminology change: rarity is gone

`GACHA_DESIGN.md` originally split characters into **Premium** and **Standard**
rarity tiers (a power/prestige distinction, not a pull-rate distinction). That
concept is **dropped entirely** — characters are no longer tagged Premium or
Standard anywhere. This is a labeling change only: no character stats or kits
are being rebalanced. Whatever power variance already exists between characters
stays exactly as-is; the game just stops naming it as a formal tier.

Because "Standard" was about to collide with a *banner* naming idea, the two
banner types are called:

- **Limited banner** — rotates, has a featured roster and an end date (this
  replaces what the old doc informally called "the banner").
- **Permanent banner** — always available, evergreen pool, no end date.

## Currencies

| Currency | Existing? | Purpose |
|---|---|---|
| `gems` | Yes (`store/playerStore.ts`) | Limited banner pulls |
| `coin` | Yes | Ascension/leveling (existing use) + now also a possible miss-pull reward |
| `permanentTicket` | **New** | Permanent banner pulls only |

Pull cost (both currencies use the same discount shape):

| Banner | Single | 11-pull |
|---|---|---|
| Limited | 3 gems | 30 gems |
| Permanent | 1 ticket | 10 tickets |

## Debut Limited banner

**Featured (12, 5% total pull rate, split evenly — ~0.417% each):** Duke, Lyra,
Batra, Gabrist, Sara, Yalina, Mustafa, Siddiq, Master Tao, Seras, Chiara, Isolde.

This 5%-flat-regardless-of-count rate is a **one-off for this debut banner only**.
Future smaller banners (2-3 featured units) go back to `GACHA_DESIGN.md`'s
existing rule: 2 units → 5% total, 3+ units → 7% total, split evenly.

The 6 collab characters (Meliodas/Ban/Diane, Gon/Killua/Leorio) are **deliberately
excluded** — reserved for their own dedicated collab banners later, per the
original collab-banner design (bundle by IP, one banner, constant shared rate).

Duke and Lyra **keep their existing free-grant paths** (Duke = starter,
Lyra = Chapter 2 reward) *in addition to* being pullable here. Pulling either
one is just a dupe → Ultimate Level, same as any other dupe. No special-casing
needed in the free-grant code: `addCharacterToRoster` already no-ops if the
character is already owned (`store/playerStore.ts:98-100`), and it never touches
`ultLevel`, so the two paths can't clobber each other regardless of order.

## The other 95% (miss-pull outcomes)

A non-featured pull on the Limited banner never gives a character — same rule
as before. It gives one item from three equally-weighted categories (~31.67%
each), each split evenly among its own items:

**Currency bundles (coin):** 1,000 / 2,000 / 5,000 / 10,000 — even split
(~7.9% each of the total 95%).

**Level-up matz:** the existing Training Manual tiers (`training_manual`,
`training_manual_advanced`, `training_manual_premium`, already in the inventory
schema from the World Boss system) — even split.

**Local specialty matz:** 4 shared materials, grouped by each character's
existing `color` tag on their character JSON (already used for the type-advantage
system, no new schema needed). Every group happens to have exactly 3 of the 12
debut characters, so "pick uniformly among the 12 characters, give their group's
material" is equivalent to a flat 25% per material:

| Material | Color group | Characters |
|---|---|---|
| Riverstone Fragment | blue | Duke, Batra, Gabrist |
| Scorched Ember | red | Lyra, Sara, Siddiq |
| Bramble Thorn | green | Yalina, Mustafa, Master Tao |
| Prism Dust | light/dark | Seras, Isolde, Chiara |

These are deliberately **shared across characters**, not one unique material per
character — this is the resolution to `GACHA_DESIGN.md`'s open item #5
("local specialty items for the remaining characters").

## Milestone bar (replaces hard-pity-80/soft-pity-70)

The old "hard pity at 80, soft pity from 70" mechanic from `GACHA_DESIGN.md` is
**removed**. Pull rate is flat for the life of the banner — no soft-pity ramp.
In its place, a milestone bar tracks currency *spent* (not pull count), 1:1:

**Limited banner:**
- Bar increases by however many gems are spent (a single pull = +3, an
  11-pull = +30).
- Resets to 0 whenever the active banner changes (**does not carry over**
  between banners, unlike the old pity counter).
- **300** → a random pull from **every currently-released playable character**
  (not just this banner's featured list — the full roster, 18 as of this
  banner). If the result is already owned, it's a dupe → Ultimate Level.
- **600** → guaranteed pull, **player picks** any one of this banner's featured
  units. Same dupe→Ultimate Level rule if already owned.
- After 600 is claimed, the bar resets to 0 and climbs again — **it loops**,
  so a player who spends enough keeps re-earning both milestones.

**Permanent banner:**
- Bar increases by tickets spent, same 1:1 shape.
- Only one milestone, at **600** → guaranteed player-picked pull from the
  Permanent pool.
- Loops the same way (must loop — this banner never ends, so a one-time pity
  would mean zero backstop after the first claim, forever).

## Permanent banner pool

Membership is **manual, per-character** — a `permanentPool: true` flag added to
a character's JSON file (`data/characters/<id>.json`), flipped by hand whenever
Tanveer decides a character should join the evergreen pool. Not automatic on a
Limited run ending.

Pull rate is **equal odds across the whole pool** — consistent with dropping
rarity as a rate factor everywhere, not just on Limited.

## Ultimate Level (dupes)

Already scaffolded as an open item in `GACHA_DESIGN.md` ("dupes → Ultimate
Level system... max 6... higher ult multiplier, additional effects unlock at
Lv4/6"). This spec adds the concrete field: `characters[id].ultLevel`, starts
at 1, dupes (from any source — normal pull, 300 milestone, 600 milestone)
increment it, capped at 6. Multiplier/effect tuning per level is unchanged —
still an open numbers question for Tanveer, not blocking this build (same as
it was already open before this spec).

## Faucet

No real gem/ticket faucet currently exists (`grep` shows only a dev-grant
button and the 1000-gem starter balance). This build adds a small amount of
both to the existing World Boss clear-reward roll (`lib/game/worldBossRewards.ts`
— the only reward pipeline that currently exists in the game), the same way
`coin`/materials are already rolled there. Exact amounts are tunable later,
same as `COIN_MIN`/`COIN_MAX` already are — not a blocking number for this spec.

## UI

**Layout: Option A (spacious, scrolling page)** — confirmed via visual
companion mockup, consistent with `/news`'s page shape rather than the
single-viewport battle HUD convention (that convention is specific to the
battle screen, not every screen in the app).

Screen shape, top to bottom:
- Limited / Permanent tabs
- Wide banner splash art
- Banner name + time-remaining (Limited only; Permanent has no end date)
- Owned currency (top-right aligned)
- Milestone bar with 300/600 tick marks (Permanent shows only a 600 tick)
- Draw ×1 / Draw ×11 buttons
- "Rates" link opening a modal

**Rates modal:** per-character flat-% list; featured units get a "Rate Up"
badge (mechanically identical to non-featured on Limited today, since Limited's
"featured" list already covers the whole banner — this mainly matters
cosmetically now, and will matter functionally once smaller banners return to
the 5%/7% split rule where non-featured units exist alongside featured ones).

**Pull reveal:** reuses the existing ult-cutin cinematics tech (per
`GACHA_DESIGN.md`'s own "Reuse notes" section) rather than building new reveal
animation from scratch.

**Collection browsing:** the existing Archive already serves as the gacha pool
browser (per `GACHA_DESIGN.md`'s reuse note) — needs an owned/unowned state and
an Ultimate Level badge added to its tiles/detail view.

## Art

One new wide banner-splash image per banner (ComfyUI, reusing each character's
already-locked design/seed for consistency, new banner-specific background and
character composition), stored at `public/banners/<banner-id>.png`. The debut
banner needs one splash covering all 12 characters.

## Data model changes

`store/playerStore.ts`:
- `currencies: { gems, coin, permanentTicket }` — adds `permanentTicket`.
- `pity` is restructured. Currently `{ standard: number; limited: number }`
  (unused scaffolding). Becomes:
  ```ts
  pity: {
    limited: { bannerId: string | null; bar: number };
    permanent: { bar: number };
  }
  ```
  `bannerId` is how the "reset on banner change" rule is detected — if the
  active banner's id doesn't match the stored `bannerId`, reset `bar` to 0 and
  update `bannerId` before applying any spend.
- `characters[id]` (the `CharacterProgress` interface) gains `ultLevel: number`
  (default 1, max 6).
- This is a breaking shape change to persisted state → the existing
  `migratePlayerState`/`version` mechanism (`store/playerStore.ts:74-88`, currently
  at version 2) needs a version 3 migration: add `permanentTicket: 0`, convert
  old `pity: {standard, limited}` numbers into the new shape (discarding the old
  values is fine — the new bar always starts at 0 anyway, and the old numbers
  were dead scaffolding that no code ever read), and default `ultLevel: 1` on
  every existing entry in `characters`.

`data/characters/<id>.json`: new optional field `permanentPool: boolean`
(absent/false = not in the evergreen pool).

`data/banners/*.json` (new directory): one file per banner —
```json
{
  "id": "debut-2026-08",
  "type": "limited",
  "featured": ["duke", "lyra", "batra", "gabrist", "sara", "yalina", "mustafa", "siddiq", "master_tao", "seras", "chiara", "isolde"],
  "rate": 0.05,
  "endsAt": "2026-09-05"
}
```
The Permanent banner needs no per-instance file — its pool is computed by
scanning `data/characters/*.json` for `permanentPool: true`.

## Architecture

Pure-function core in `lib/gacha/` (mirrors the existing pattern in
`lib/game/worldBossRewards.ts`, `lib/game/ascension.ts`, `lib/game/tick.ts` —
every non-trivial game rule in this codebase lives as a tested pure function,
with thin Zustand store actions and thin UI on top):

- `lib/gacha/pull.ts` — `rollPull(banner, rng)`: hit/miss roll, hit picks
  uniformly among `featured`, miss picks uniformly among the 3 miss-categories
  then uniformly within that category.
- `lib/gacha/milestone.ts` — `applyMilestoneSpend(pityBar, amountSpent)`:
  advances the bar, returns which milestone(s) were crossed (a big single
  purchase could cross both 300 and 600 in one step — this needs handling,
  not just a single threshold check).
- `lib/gacha/dupes.ts` — `resolvePullResult(characterId, state)`: owned →
  ultLevel+1 (capped 6); not owned → add to roster. Single function, reused by
  normal pulls and both milestone rewards.

This was chosen over two alternatives considered and rejected:
- **Logic inline in the store** — rejected, breaks from the established
  pure-function/thin-store split used everywhere else in this codebase.
- **Server-authoritative pulls** (API route resolves the RNG server-side) —
  rejected for now. Nothing else in this app is server-authoritative (damage
  calc, world-boss rewards, ascension are all client-computed then written to
  Firestore) — introducing server authority just for gacha would be a real
  architecture pivot. Worth revisiting once real-money purchases exist
  (`GACHA_DESIGN.md` roadmap item 6, monetization — not in scope here), since
  that's the point where a player reading client JS to see exact odds actually
  matters financially.

## Testing

Every `lib/gacha/` function gets unit tests with an injectable `rng` (same
pattern as `rollWorldBossRewards`), covering: rate math sums to 1.0 across all
categories, milestone crossing at exact boundaries and in a single large jump,
dupe vs new-character resolution, bar reset on banner-id change, Permanent's
single-milestone behavior vs Limited's two-milestone behavior.

## Out of scope

- Wiring the 4 new local specialty materials into actual ascension cost
  formulas (`lib/game/ascension.ts` currently costs `sea_monster_eye` +
  `corroded_seaweed` + `coin` only, no specialty-mat slot yet). This spec
  introduces the materials as gacha drops; spending them on ascension is a
  follow-up to `lib/game/ascension.ts`, not part of this build.
- Ultimate Level's actual multiplier/effect tuning per level (1-6) — the field
  and increment mechanic are built here, the numbers are still Tanveer's open
  call, same as before this spec.
- Real-money purchase of gems/tickets — `GACHA_DESIGN.md` roadmap item 6
  (monetization), sequenced after gacha per the roadmap's own ordering.

## Supersedes (changes to `docs/design/GACHA_DESIGN.md`)

- **Rarities** section — remove. No more Premium/Standard.
- **Pity** paragraph (hard 80 / soft 70) — replaced by the milestone-bar
  mechanic above.
- **Planned banners** table — the Batra/Gabrist, Sara/Yalina, Mustafa/Siddiq
  rows are superseded by the single 12-character debut banner for now; keep
  the table as a reference for future *reruns* of those pairs individually
  (which would use the normal 5%/7% rate rule, not the debut's 5%-flat
  one-off).
- **OPEN item #5** ("local specialty items for the remaining characters") —
  resolved by the 4 shared color-grouped materials above.
- Everything else in `GACHA_DESIGN.md` (ascension model, currency existence,
  11-for-10 pull discount shape, non-featured-pull-gives-no-characters rule)
  is unchanged and this spec builds on top of it.
