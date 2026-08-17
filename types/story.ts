import type { StageEffect } from "./stageEffects";
/**
 * Dokkan-style story structure: Parts contain Chapters. Each chapter is
 * intro scenes → one canon-team battle → outro scenes. Parts map 1:1 to the
 * source beat-sheet markdown files (Arc One, Chapters 1–6).
 */

export interface StoryScene {
  /** Display name shown on the plate; omit for narration */
  speaker?: string;
  /** Character id for the portrait art; omit for narration/off-screen */
  portraitId?: string;
  /** Portrait side; default left */
  side?: "left" | "right";
  text: string;
}

export interface StoryTeamPick {
  id: string;
  isSub?: boolean;
  /**
   * Progression this unit fights at, mirroring `TeamPick` in BattleProvider.
   * Authored on an enemy to raise a fight's difficulty; filled in at resolve
   * time for a story lead the player doesn't own (see `DEFAULT_TRIAL_LEVEL`).
   * Absent means level 1 — the bare catalog statline.
   */
  level?: number;
  ascension?: number;
  ultLevel?: number;
}

export interface StoryBattle {
  playerTeam: StoryTeamPick[];
  enemyTeam: StoryTeamPick[];
}

/**
 * How much freedom the player has over the team for a chapter's battle:
 *  - `canon`    — exactly `battle.playerTeam`, no picker (Part 1 is Duke alone
 *                 and must stay that way).
 *  - `anchored` — `battle.playerTeam` are fixed anchors; the player fills the
 *                 remaining slots (up to 4 total) from characters they own.
 *  - `free`     — the player brings 1–4 owned characters; the canon team is
 *                 offered as a one-tap prefill.
 * Anchors are always playable regardless of ownership — a fresh account must
 * never be locked out of its own story by not having pulled the protagonist.
 */
export type StoryTeamMode = "canon" | "anchored" | "free";

/** Inclusive roll bounds for one repeat-drop entry. */
export interface StoryDropRange {
  min: number;
  max: number;
}

/** Fixed amounts, granted once, the first time a chapter is cleared. Gems are
 *  first-clear-only by design — story is not a gem faucet (Tanveer, 2026-08-09). */
export interface StoryFirstClearBundle {
  gems?: number;
  coin?: number;
  permanentTicket?: number;
  /** Material id → fixed quantity */
  materials?: Record<string, number>;
  /** Account XP. First clears are the only source for now (Tanveer,
   *  2026-08-11), so this rises as the story goes on rather than staying flat,
   *  and it's multiplied by the difficulty's reward multiplier like everything
   *  else in the bundle. */
  accountXp?: number;
}

/** Rolled on every clear. Ranges rather than fixed amounts or a weighted
 *  table, per Tanveer's ruling 2026-08-09. */
export interface StoryRepeatDrops {
  coin?: StoryDropRange;
  /** Material id → roll bounds */
  materials?: Record<string, StoryDropRange>;
}

export interface StoryChapterRewards {
  firstClear: StoryFirstClearBundle;
  repeat: StoryRepeatDrops;
  /**
   * Stamina charged for one attempt at this chapter.
   *
   * Charged on **every** attempt since 2026-08-17, first clear and retries
   * alike (Tanveer). It used to be free until a chapter was cleared, on the
   * grounds that the narrative should never be stamina-locked; that rule is
   * retired and story progress is now gated like everything else. The name is
   * kept because it is in authored JSON for all 37 chapters.
   */
  replayStamina: number;
}

export interface StoryChapter {
  id: string;
  title: string;
  intro: StoryScene[];
  /**
   * Omitted for a scene-only chapter — a debrief, a reveal, a comedown.
   * Those still pay first-clear rewards; they just have nothing to fight
   * (Tanveer, 2026-08-11). The flow skips the versus splash and the battle
   * and runs intro → outro → complete → rewards.
   */
  battle?: StoryBattle;
  outro: StoryScene[];
  /** Required: a chapter that silently defaults is a chapter someone forgot
   *  to finish, and the schema should say so at load. */
  teamMode: StoryTeamMode;
  /**
   * The board this chapter is walked on. Omitted means `generateLinearRoute`
   * builds one from `intro` and `battle`, which is how all 37 authored chapters
   * keep working untouched — a generated route is start → intro → the fight, and
   * the fight is terminal.
   *
   * Typed loosely here on purpose: `lib/game/route.ts` owns `StoryRoute`, and
   * importing it into the shared contract would point the type layer at a
   * gameplay module. The schema validates the real shape at load.
   */
  route?: import("@/lib/game/route").StoryRoute;
  /** Encounter-level modifiers for this fight. Absent or empty = a standard
   *  fight, which is the default (Tanveer, 2026-08-10). */
  stageEffects?: StageEffect[];
  /** Level a story lead is lent at when the player doesn't own them. Rises as
   *  the story goes on — "level 10 for now, ofc it would go higher as we go
   *  deep into story" (Tanveer, 2026-08-11). Defaults to
   *  `DEFAULT_TRIAL_LEVEL`. */
  trialLevel?: number;
  /**
   * Ascension a lent story lead fights at. Defaults to 0.
   *
   * Needed because a level alone under-describes a character: `maxLevelForAscension`
   * means a real Lv20 unit must be ascension 1 and a real Lv40 unit ascension 3,
   * so a loaner at `trialLevel: 20` with no ascension is **1.322x** where the
   * player's own Lv20 is **1.489x** — 13% weaker than the thing it is imitating.
   * Author this whenever the chapter means "hand them a proper Lv N character".
   */
  trialAscension?: number;
  /**
   * End the battle as a victory once the enemy side falls to this percentage
   * of its pooled HP, instead of requiring every enemy dead.
   *
   * For fights the story says you don't win — Chiara conceding, Duke and Batra
   * breaking off, Molvarr being crossed rather than killed. The chapter's
   * outro panels carry what actually happened; the battle just stops at the
   * right moment (Tanveer, 2026-08-11). Absent = fight to the end, which is
   * every chapter authored before this.
   */
  victoryAtEnemyHpPercent?: number;
  rewards: StoryChapterRewards;
}

export interface StoryPart {
  id: string;
  order: number;
  title: string;
  /** Short flavor line under the title on the part banner */
  tagline: string;
  /** Character id whose art fronts the part banner */
  coverCharacterId: string;
  chapters: StoryChapter[];
}
