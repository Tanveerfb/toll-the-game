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
  /** Stamina charged to replay this chapter once cleared. Attempts at an
   *  uncleared chapter are always free, however many times they are retried,
   *  so the narrative can never be stamina-locked — only farming is gated. */
  replayStamina: number;
}

export interface StoryChapter {
  id: string;
  title: string;
  intro: StoryScene[];
  battle: StoryBattle;
  outro: StoryScene[];
  /** Required: a chapter that silently defaults is a chapter someone forgot
   *  to finish, and the schema should say so at load. */
  teamMode: StoryTeamMode;
  /** Encounter-level modifiers for this fight. Absent or empty = a standard
   *  fight, which is the default (Tanveer, 2026-08-10). */
  stageEffects?: StageEffect[];
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
