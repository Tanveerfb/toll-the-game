import { describe, expect, it } from "vitest";
import {
  activeSideAt,
  autoAdvanceDelayMs,
  AUTO_ADVANCE_FLOOR_MS,
  isNarration,
  isRevealComplete,
  MAX_REVEAL_MS,
  portraitSlotsAt,
  revealDurationMs,
  splitWords,
  staggerDurationMs,
  tapIntent,
  WORD_FADE_MS,
  WORD_STAGGER_MS,
  wordDelayMs,
} from "@/lib/game/storyScene";
import type { StoryScene } from "@/types/story";

const TEXT = "Six words of narration right here.";
const LONG = "word ".repeat(80).trim();

describe("word splitting", () => {
  it("keeps trailing whitespace so re-joining reproduces the source", () => {
    expect(splitWords("a b  c").join("")).toBe("a b  c");
  });

  it("splits into one entry per word", () => {
    expect(splitWords(TEXT)).toHaveLength(6);
  });

  it("handles an empty line", () => {
    expect(splitWords("")).toEqual([]);
  });
});

describe("word reveal pacing", () => {
  it("staggers each word by the per-word step on a short line", () => {
    // 6 words → 5 gaps
    expect(staggerDurationMs(TEXT)).toBe(5 * WORD_STAGGER_MS);
  });

  it("caps the stagger so a long paragraph is no slower than a short one", () => {
    // The whole point of the cap: reading shouldn't be rate-limited by length.
    expect(staggerDurationMs(LONG)).toBe(MAX_REVEAL_MS);
    expect(revealDurationMs(LONG)).toBe(MAX_REVEAL_MS + WORD_FADE_MS);
  });

  it("never takes longer than the cap plus one word's fade", () => {
    expect(revealDurationMs(LONG)).toBeLessThanOrEqual(MAX_REVEAL_MS + WORD_FADE_MS);
  });

  it("starts the first word immediately and the last at the end of the stagger", () => {
    expect(wordDelayMs(0, TEXT)).toBe(0);
    expect(wordDelayMs(5, TEXT)).toBeCloseTo(staggerDurationMs(TEXT), 5);
  });

  it("spreads delays monotonically across the line", () => {
    const delays = splitWords(LONG).map((_, i) => wordDelayMs(i, LONG));
    const ascending = delays.every((d, i) => i === 0 || d >= delays[i - 1]);
    expect(ascending).toBe(true);
  });

  it("clamps an out-of-range index to the last word", () => {
    expect(wordDelayMs(999, TEXT)).toBeCloseTo(staggerDurationMs(TEXT), 5);
  });

  it("has no stagger for a single word", () => {
    expect(staggerDurationMs("alone")).toBe(0);
    expect(wordDelayMs(0, "alone")).toBe(0);
  });

  it("treats an empty line as instantly complete", () => {
    expect(revealDurationMs("")).toBe(0);
    expect(isRevealComplete("", 0)).toBe(true);
  });

  it("completes instantly when asked — reduced motion or tap-to-complete", () => {
    expect(isRevealComplete(TEXT, 0, true)).toBe(true);
  });

  it("reports completion only once the last word has finished fading", () => {
    expect(isRevealComplete(TEXT, revealDurationMs(TEXT) - 1)).toBe(false);
    expect(isRevealComplete(TEXT, revealDurationMs(TEXT))).toBe(true);
  });
});

describe("tap contract", () => {
  it("first tap completes a line still revealing", () => {
    expect(tapIntent(TEXT, 10)).toBe("complete");
  });

  it("tap on a finished line advances", () => {
    expect(tapIntent(TEXT, revealDurationMs(TEXT))).toBe("advance");
  });

  it("advances on the first tap under reduced motion", () => {
    expect(tapIntent(TEXT, 0, true)).toBe("advance");
  });
});

describe("auto-advance dwell", () => {
  it("is at least the floor even for a one-character line", () => {
    expect(autoAdvanceDelayMs("a")).toBeGreaterThanOrEqual(AUTO_ADVANCE_FLOOR_MS);
  });

  it("grows with the amount to read", () => {
    expect(autoAdvanceDelayMs("a".repeat(200))).toBeGreaterThan(
      autoAdvanceDelayMs("a".repeat(20)),
    );
  });
});

describe("narration vs dialogue", () => {
  it("treats a speakerless scene as narration", () => {
    expect(isNarration({ text: "The village is quiet." })).toBe(true);
  });

  it("treats a scene with a speaker as dialogue", () => {
    expect(isNarration({ speaker: "Duke", text: "I'm going." })).toBe(false);
  });

  it("treats an explicit Narrator speaker as narration, not a cast member", () => {
    // Part 1 authors most of its prose this way.
    expect(isNarration({ speaker: "Narrator", text: "Six hundred years ago…" })).toBe(
      true,
    );
    expect(isNarration({ speaker: "narrator", text: "lowercase too" })).toBe(true);
    expect(isNarration({ speaker: " Narrator ", text: "padded" })).toBe(true);
  });
});

describe("portrait slot memory", () => {
  const scenes: StoryScene[] = [
    { text: "Narration, nobody on screen." },
    { speaker: "Duke", portraitId: "duke", text: "Left speaker." },
    { speaker: "Lyra", portraitId: "lyra", side: "right", text: "Right speaker." },
    { speaker: "Duke", portraitId: "duke", text: "Back to the left." },
  ];

  it("shows nobody before any portrait appears", () => {
    expect(portraitSlotsAt(scenes, 0)).toEqual({ left: null, right: null });
  });

  it("fills a side when that side's speaker arrives", () => {
    expect(portraitSlotsAt(scenes, 1)).toEqual({ left: "duke", right: null });
  });

  it("keeps the previous speaker on the opposite side — that's what makes it read as a conversation", () => {
    expect(portraitSlotsAt(scenes, 2)).toEqual({ left: "duke", right: "lyra" });
    expect(portraitSlotsAt(scenes, 3)).toEqual({ left: "duke", right: "lyra" });
  });

  it("defaults a portrait with no side to the left", () => {
    expect(portraitSlotsAt([{ portraitId: "duke", text: "x" }], 0)).toEqual({
      left: "duke",
      right: null,
    });
  });

  it("names the side that is currently speaking", () => {
    expect(activeSideAt(scenes, 1)).toBe("left");
    expect(activeSideAt(scenes, 2)).toBe("right");
    expect(activeSideAt(scenes, 3)).toBe("left");
  });

  it("has no active side on a portraitless narration line", () => {
    expect(activeSideAt(scenes, 0)).toBeNull();
  });
});
