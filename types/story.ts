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

export interface StoryChapter {
  id: string;
  title: string;
  intro: StoryScene[];
  battle: StoryBattle;
  outro: StoryScene[];
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
