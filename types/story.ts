import type { StageEffect } from "./stageEffects";

/**
 * Story mode v2 — **Chapter → Stage** (Tanveer, 2026-08-18).
 *
 * A **Chapter** is one webtoon chapter, 1:1 with a beat sheet in
 * `E:\Toll - Web toon\Chapter N.md`. A **Stage** is one playable unit inside it,
 * numbered `1-1`, `1-2`, … and addressed directly from the stage list — there is
 * no board and no movement, so the stage a player wants to farm is one tap away.
 *
 * A battle stage runs **1–3 waves**: consecutive fights where **HP carries over
 * and the fallen stay down** (his ruling #103, which was decided before v1 and
 * never got built because one fight per board meant nothing survived). That
 * attrition is the mode's decision layer, and it is why heals, DR, cleanses and
 * the sub slot matter here where they didn't before.
 *
 * Replaces the Part → Chapter shape entirely. The old one made the unit a player
 * calls a chapter a *beat*, so nothing on screen matched the source.
 */

/**
 * Whether a piece of content comes from the webtoon or was drafted for the game.
 *
 * Tagged in the data rather than tracked in a document, so what is invented is
 * always auditable, a canon retcon can strip it mechanically, and a reviewer can
 * see at a glance which lines Tanveer approved as filler. Every stage and every
 * scene carries it.
 */
export type StoryOrigin = "canon" | "filler";

export interface StoryScene {
  /** Display name shown on the plate; omit for narration */
  speaker?: string;
  /** Character id for the portrait art; omit for narration/off-screen */
  portraitId?: string;
  /** Portrait side; default left */
  side?: "left" | "right";
  text: string;
  /**
   * Background plate this scene plays over — a slug from Category A of
   * `docs/ART_REQUESTS.md` (`village_ruins`, `open_road`, …).
   *
   * Authored now even though the plates don't exist yet: an absent or unqueued
   * slug resolves to the locale-tinted fallback, so the art drops in later with
   * no edit to a single scene. v1 had no background field at all, which is why
   * twelve chapters played over the same void.
   */
  backgroundId?: string;
  origin: StoryOrigin;
}

export interface StoryTeamPick {
  id: string;
  isSub?: boolean;
  /**
   * Progression this unit fights at, mirroring `TeamPick` in BattleProvider.
   * Authored on an enemy to raise a wave's difficulty; filled in at resolve time
   * for a story lead the player doesn't own (see `DEFAULT_TRIAL_LEVEL`).
   * Absent means level 1 — the bare catalog statline.
   */
  level?: number;
  ascension?: number;
  ultLevel?: number;
}

/**
 * One fight inside a stage.
 *
 * Waves are ordered and always fought front to back. The player's side is *not*
 * authored per wave — it is whatever survived the previous one.
 */
export interface StoryWave {
  enemies: StoryTeamPick[];
  /** Per-wave encounter modifiers. A later wave may be harsher than an earlier
   *  one without touching a kit (ruling #69). */
  stageEffects?: StageEffect[];
  /**
   * End this wave as a victory once the enemy side falls to this percentage of
   * its pooled HP, instead of requiring every enemy dead — for fights the story
   * says you don't win (Chiara conceding, Molvarr being crossed rather than
   * killed). Absent = fight to the end.
   */
  victoryAtEnemyHpPercent?: number;
}

/**
 * How much freedom the player has over the team for a stage:
 *  - `canon`    — exactly the authored team, no picker.
 *  - `anchored` — authored units are fixed anchors; the player fills the rest.
 *  - `free`     — the player brings 1–4 owned characters; the canon team is
 *                 offered as a one-tap prefill.
 *
 * Anchors are always playable regardless of ownership — a fresh account must
 * never be locked out of its own story by not having pulled the protagonist.
 */
export type StoryTeamMode = "canon" | "anchored" | "free";

/**
 * What a stage *is*.
 *
 * `challenge` (replay-only, harder lineup, no scenes) is deliberately **not**
 * here. Tanveer, 2026-08-18: *"don't build yet"* — and a variant nothing
 * authors is dead code the schema would have to keep honest (ruling #83). It
 * arrives as one more member when a chapter actually needs it.
 */
export type StoryStageKind = "story" | "battle" | "boss";

/** Inclusive roll bounds for one farmable entry. */
export interface StoryDropRange {
  min: number;
  max: number;
}

/**
 * Paid once, the first time a stage is cleared. **Fixed amounts, never rolled**
 * (ruling #80). Gems and account XP live here and nowhere else, which is what
 * keeps story from becoming a gem faucet (rulings #47, #86).
 */
export interface StoryFixedBundle {
  gems?: number;
  coin?: number;
  permanentTicket?: number;
  /** Material id → fixed quantity */
  materials?: Record<string, number>;
  accountXp?: number;
}

/**
 * Rolled on every clear, first one included. Deliberately thin — coin and basic
 * training manuals only. No gems, no ascension materials (world-boss exclusive,
 * ruling #47), no Permanent Tickets.
 */
export interface StoryFarmDrops {
  coin?: StoryDropRange;
  /** Material id → roll bounds */
  materials?: Record<string, StoryDropRange>;
}

export interface StoryStageRewards {
  firstClear: StoryFixedBundle;
  /** Absent on a `story` stage — a scene has nothing to grind. */
  farm?: StoryFarmDrops;
}

/**
 * A mission goal, evaluated against a `StageRunSummary` once the last wave is
 * won (`lib/game/stageMissions.ts`).
 *
 * Tanveer picks which stage carries which, chapter by chapter; the vocabulary is
 * fixed here so the evaluator and the schema can't drift from each other.
 */
export type StoryMissionGoal =
  /** Clear with every unit that started still standing. */
  | { type: "noLosses" }
  /** Clear the stage inside N player turns, counted across every wave. */
  | { type: "withinTurns"; turns: number }
  /** Field a specific character (bench counts — a passive works from it). */
  | { type: "fieldCharacter"; characterId: string }
  /** Field at least N units carrying a tag, e.g. `[Collab]`. */
  | { type: "fieldTag"; tag: string; count: number }
  /** Fire at least N player ultimates across the run. */
  | { type: "useUltimates"; count: number }
  /**
   * Play at least N player cards of a given rank across the run.
   *
   * Ultimates never count — they carry no rank at all (engine rule), so a
   * rank goal is always about the three-card ladder and never about the ult.
   */
  | { type: "useSkillRank"; rank: 1 | 2 | 3; count: number }
  /** Clear on an attempt that wasn't a retry of a lost run. */
  | { type: "firstAttempt" }
  /** Reach and clear the final wave. Trivial on a 1-wave stage, real on 3. */
  | { type: "allWaves" };

/**
 * One optional objective. **Never lost by clearing without it** — an unmet
 * mission stays claimable forever, so no stage becomes content a player can no
 * longer complete.
 */
export interface StoryMission {
  id: string;
  /** Player-facing line, e.g. "Reach wave 3 with 4 units alive". */
  label: string;
  goal: StoryMissionGoal;
  /** Fixed, paid once. Gems are the currency here. */
  reward: StoryFixedBundle;
}

export interface StoryStage {
  id: string;
  /** 1-based position inside the chapter — the `N` in `1-N`. */
  number: number;
  name: string;
  kind: StoryStageKind;
  /** Plays before the first wave. */
  intro: StoryScene[];
  /** Plays after the last wave is won. */
  outro: StoryScene[];
  /**
   * Ordered fights, 1–3. Empty on a `story` stage and required on the others,
   * which the schema enforces rather than trusting an author to remember.
   */
  waves: StoryWave[];
  /**
   * The authored player lineup — the canon team for this stage.
   *
   * Lives on the stage rather than per wave because the player's side is not
   * re-authored between waves: it is whatever survived the last one. Read as
   * fixed anchors under `canon`/`anchored`, and as a one-tap prefill under
   * `free`. Empty on a `story` stage, which has no team to field.
   */
  team: StoryTeamPick[];
  teamMode: StoryTeamMode;
  /** Up to 3, and optional — a stage may carry none. */
  missions: StoryMission[];
  rewards: StoryStageRewards;
  /** Charged on **every** attempt, first try included (ruling #100). */
  stamina: number;
  /** Level a story lead is lent at when the player doesn't own them. Defaults to
   *  `DEFAULT_TRIAL_LEVEL`. */
  trialLevel?: number;
  /**
   * Ascension a lent lead fights at. Defaults to 0.
   *
   * `maxLevelForAscension` caps ascension 0 at level 1, so `trialLevel: 20`
   * alone describes a unit nobody could own — 1.322x against a real Lv20's
   * 1.489x. Author this whenever a stage means "hand them a proper Lv N unit"
   * (ruling #93).
   */
  trialAscension?: number;
  origin: StoryOrigin;
}

export interface StoryChapter {
  id: string;
  /** Matches the webtoon chapter number. */
  number: number;
  title: string;
  /** Short flavor line under the title on the chapter card */
  tagline: string;
  /** Character id whose art fronts the chapter card */
  coverCharacterId: string;
  /**
   * Default background slug for scenes in this chapter that don't name one, and
   * the tint the fallback gradient is built from.
   */
  localeId?: string;
  stages: StoryStage[];
}
