# Story Rewards & Team Agency — Design

> Date: 2026-08-09 · Status: approved (Approach A) · Owner of all numbers: **Tanveer**

## Problem

Story mode is a closed loop. A chapter is intro scenes → one canon-locked battle → outro scenes → the next chapter unlocks. It pays nothing, costs nothing, and never touches the roster the player has actually built.

Every economy system shipped since story went live — leveling, ascension, stamina, inventory, gacha — exists on the other side of a wall from it. A player who pulls a character on `/gacha` has nowhere in the narrative to use them, and a player who clears all six chapters ends with exactly the resources they started with. The daily loop dead-ends at the one mode that has the most content.

This batch connects the two: story battles pay out, and story battles can be fought with your own team where canon allows.

Out of scope, deliberately: the Dokkan-style node-path stage map, multi-wave stages with persistent HP, per-chapter mission objectives, difficulty tiers, and Story Parts 3–6. Each is its own batch.

## Decisions (Tanveer, 2026-08-09)

| # | Decision |
|---|---|
| 1 | **Per-chapter team lock mode.** Each chapter declares `canon`, `anchored`, or `free`. Parts 1–2 stay `canon` as authored. |
| 2 | **First-clear bundle + repeat drops.** No mission-objective layer this batch. |
| 3 | **Payout mix:** repeat drops are `coin` + `training_manual` tiers. `gems` appear only in the one-time first-clear bundle. Ascension materials (`sea_monster_eye`, `corroded_seaweed`) stay world-boss exclusive. |
| 4 | **Stamina gates replays only.** The first attempt at an uncleared chapter is always free, however many times it is retried. Replaying a cleared chapter costs stamina. |
| 5 | **Repeat drops roll a random range per entry** (min/max), not fixed amounts and not a weighted table. |

## Architecture

Approach A: extend the existing story view machine, and give story its own pure reward module mirroring `lib/game/worldBossRewards.ts`. World boss and story keep separate reward paths — the duplication is a ~30-line roll helper and a results card, and two data points aren't enough to derive the right shared abstraction. Revisit when a third mode needs one.

### Data model — `types/story.ts`

```ts
export type StoryTeamMode = "canon" | "anchored" | "free";

/** Inclusive roll bounds for one repeat-drop entry. */
export interface StoryDropRange {
  min: number;
  max: number;
}

/** Fixed amounts, granted once, the first time a chapter is cleared. */
export interface StoryFirstClearBundle {
  gems?: number;
  coin?: number;
  permanentTicket?: number;
  /** Material id → fixed quantity. */
  materials?: Record<string, number>;
}

/** Rolled on every clear. Ranges, per decision 5. */
export interface StoryRepeatDrops {
  coin?: StoryDropRange;
  /** Material id → roll bounds. */
  materials?: Record<string, StoryDropRange>;
}

export interface StoryChapterRewards {
  firstClear: StoryFirstClearBundle;
  repeat: StoryRepeatDrops;
  /** Stamina charged to replay this chapter once cleared. Uncleared attempts are free. */
  replayStamina: number;
}
```

`StoryChapter` gains two fields:

```ts
teamMode: StoryTeamMode;   // required — authoring a chapter is a deliberate choice
rewards: StoryChapterRewards;
```

Both are **required**, not optional. A chapter that pays nothing and silently defaults to `canon` is a chapter someone forgot to finish; the schema should say so at load, the same way a malformed kit does.

### Team modes

| Mode | Player team at battle start |
|---|---|
| `canon` | Exactly `battle.playerTeam`. No picker. The brief still shows the team and the payout. |
| `anchored` | `battle.playerTeam` entries are fixed anchors, shown locked. The player fills the remaining slots (up to 4 total) from owned characters. |
| `free` | The player picks 1–4 owned characters. `battle.playerTeam` is offered as a one-tap prefill. |

**Canon units bypass ownership.** An anchor is playable whether or not it is in `playerStore.roster` — Part 1 is Duke's story, and it must stay playable by an account that hasn't pulled Duke. Only the *player-chosen* slots are restricted to owned characters.

Sub flags (`isSub`) on anchors are preserved. Player-chosen picks are field units; the existing 3v3/4v4 rule (`lib/game/sub.ts`) handles the 4th-unit-is-a-sub case as it does everywhere else.

### Reward module — `lib/game/storyRewards.ts` (new, pure)

```ts
export interface StoryPayout {
  gems: number;
  coin: number;
  permanentTicket: number;
  materials: Record<string, number>;
}

export interface StoryClearResult {
  /** Null on a replay. */
  firstClear: StoryPayout | null;
  drops: StoryPayout;
  total: StoryPayout;
}

export function rollStoryRewards(
  rewards: StoryChapterRewards,
  isFirstClear: boolean,
  rng: () => number = Math.random,
): StoryClearResult;

/** Stamina this attempt costs. Uncleared chapters are free (decision 4). */
export function storyAttemptCost(rewards: StoryChapterRewards, cleared: boolean): number;
```

`rng` is injectable exactly as `rollWorldBossRewards` does it, so tests force both bounds of every range deterministically. Roll order is documented in the module so a test knows which `rng()` call maps to which entry.

**A first clear grants the bundle *and* a drop roll.** Assumption, flagged for Tanveer: the alternative (first clear pays the bundle only) is a one-line change in `rollStoryRewards`.

### Flow

```
parts → chapters → brief → intro → battle → outro → rewards → chapters
                     └──────── skip scenes (cleared only) ────┘
```

Two new states join the `View` union in `app/story/page.tsx`:

- **`brief`** — sits between tapping a chapter and the intro. Shows the chapter title, the enemy line-up, the team (picker if `anchored`/`free`), the first-clear bundle or repeat-drop ranges, the stamina cost, and START. Stamina is spent here, on entry, via the existing `spendStaminaAction`; insufficient stamina disables START with a notice rather than failing after the scenes.
- **`rewards`** — after the outro. Shows FIRST CLEAR BONUS (once) and DROPS, then returns to the chapter list.

**Skip scenes.** A cleared chapter's brief offers SKIP STORY, going straight to the battle and, on victory, straight to the rewards screen. Sitting through eight VN panels per farm run would make the loop unusable. Uncleared chapters always play their scenes.

**Grant timing.** Rewards are rolled and granted in the transition callback that enters the `rewards` view — the same place world boss does it (`onContinue` → roll → grant → `setView`) — never in an effect. This is what makes double-granting under React's double-invoked effects impossible by construction. `markChapterComplete` fires in the same callback, so "was this a first clear" is read *before* it flips.

**Defeat** pays nothing and clears nothing. Retry re-enters the battle and re-charges stamina only if the chapter was already cleared (decision 4 — an uncleared chapter is free however many attempts it takes).

### Component split

`app/story/page.tsx` is 313 lines and this batch roughly doubles it. Extracting first, into `components/game/story/`:

| File | Responsibility |
|---|---|
| `StoryPartSelect.tsx` | Part banners, lock state, cleared counts |
| `StoryChapterList.tsx` | Chapter rows, unlock/cleared badges, payout hint |
| `ChapterBrief.tsx` | Team resolution + picker, payout preview, stamina gate, START / SKIP STORY |
| `StoryTeamPicker.tsx` | Owned-character multi-select with locked anchor slots |
| `StoryRewardsScreen.tsx` | First-clear bundle + drops readout |

`app/story/page.tsx` keeps the view machine and the battle shell only. `StorySceneReader.tsx` is unchanged.

`RosterOverlay` inside `TeamSelect.tsx` is not reused: it is module-private, and its interaction (pick-order badges for both teams in a sandbox) differs from the story picker's (fill the slots canon left open, from owned units only). Per the standing note in `STATUS.md`, the genuinely shared unit is the character *tile*, not the grid — sharing the grid here would need a prop per difference.

### Validation — `lib/game/storySchema.ts`

The part schema gains `teamMode` (enum) and `rewards`, and fails at load with the part id, chapter id, and field path, matching the existing policy. Three rules beyond shape:

1. `min <= max` on every `StoryDropRange`.
2. `replayStamina >= 0`, and `<= STAMINA_CAP` — a cost the bar can never reach is an unplayable chapter.
3. Material ids in `firstClear.materials` / `repeat.materials` must be known ids. A typo'd material currently becomes a silent inventory key nothing can spend.

### Store

`playerStore` gains `grantStoryRewards(payout: StoryPayout)`, mirroring `grantWorldBossRewards` — split currencies from materials, delegate to the existing `grantCurrency` / `grantMaterials`. No new persisted state, so **no migration and no version bump**: first-clear status is already derivable from `storyStore.completed`, which is the same record that drives chapter unlocks.

`storyStore` is unchanged.

## Numbers (placeholders — Tanveer tunes)

Derived from shipped anchors, not invented from nothing: world boss pays 2000–10000 coin, 3–6 manuals, 20–50 gems and 1–3 tickets for 40 stamina;

> **This anchor is out of date as of 2026-08-13 (rulings #80/#81).** The world
> boss no longer pays gems or Permanent Tickets on a repeat clear at all —
> both moved to a one-off first-clear bundle, and difficulty became authored
> tiers rather than a multiplier. The line above described the boss when this
> spec was written and is kept as the derivation's provenance; **do not read
> it as current rates.** `lib/game/worldBossRewards.ts` is the source of truth.
> The story numbers derived from it were never re-derived — they remain
> Tanveer's to tune, as this section already says.

Original anchors, for the record: a summon costs 3 gems single / 30 multi; manuals grant 100/400/1000 XP; the stamina bar caps at 120 and refills at +1/5min.

**Per-stamina intent:** story should beat the world boss on *levelling fuel* and lose badly on *gacha currency and ascension materials*, so each mode keeps a distinct reason to exist.

| | Part 1 chapter | Part 2 chapter |
|---|---|---|
| First clear | 50 gems, 1500 coin, 2 `training_manual` | 75 gems, 2500 coin, 3 `training_manual` |
| Repeat drops | 300–800 coin, 0–2 `training_manual` | 500–1200 coin, 1–2 `training_manual` |
| Replay stamina | 5 | 6 |

At 5 stamina a Part 1 replay yields 60–160 coin and ~0.2 manuals per stamina point, against the boss's 50–250 coin and ~0.1 manuals — story wins on manuals, loses on coin ceiling, and pays no gems or ascension materials at all. A full 120 bar buys 24 Part 1 replays.

Across the six shipped chapters the first-clear gems total 350 — about 11 multi-summons, on top of the 1000-gem starter grant.

Every one of these lives in `data/story/*.json`. Changing them is a one-line edit with no code change.

## Testing

`tests/storyRewards.test.ts` (new), following `tests/worldBossRewards.test.ts`'s forced-`rng` style:

- every range entry hits its exact min at `rng = 0` and its exact max at `rng → 1`
- first clear returns a non-null bundle; a replay returns null and drops only
- `total` equals `firstClear + drops` across currencies and materials
- absent optional entries contribute nothing rather than `NaN` or `undefined` keys
- `storyAttemptCost` returns 0 for an uncleared chapter and `replayStamina` for a cleared one

`tests/storySchema.test.ts` (extend): missing `teamMode`, missing `rewards`, inverted range, negative and over-cap `replayStamina`, unknown material id — each fails naming the part, chapter, and field.

`tests/storyTeam.test.ts` (new), covering the pure team-resolution helper: `canon` ignores player picks; `anchored` keeps anchors and appends picks up to 4; `free` uses picks and falls back to the canon team when the player picks nothing; anchors resolve even when unowned; `isSub` survives.

Team resolution is a pure function in `lib/game/storyTeam.ts`, not logic inside the picker component — same house rule that keeps the engine testable.

## Risks

- **Stamina lockout of narrative.** Mitigated by decision 4: uncleared chapters never cost stamina, so the story is never unreachable. Only farming is gated.
- **Anchors and ownership.** If anchor-bypasses-ownership were missed, a fresh account could be locked out of its own story. Covered by an explicit test.
- **Reward double-grant.** Structurally prevented by granting in the transition callback rather than an effect; a re-render cannot re-enter it.
- **`data/story/*.json` becomes required-field-heavy.** Both new fields are mandatory, so a half-authored chapter fails loudly at load instead of silently paying zero.
