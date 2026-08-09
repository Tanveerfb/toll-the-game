import { describe, expect, it } from "vitest";
import {
  activeSideAt,
  autoAdvanceDelayMs,
  AUTO_ADVANCE_FLOOR_MS,
  isNarration,
  isRevealComplete,
  portraitSlotsAt,
  revealDurationMs,
  revealedLength,
  tapIntent,
  TYPEWRITER_MS_PER_CHAR,
} from "@/lib/game/storyScene";
import type { StoryScene } from "@/types/story";

const TEXT = "Six words of narration right here.";

describe("typewriter reveal", () => {
  it("shows nothing at t=0", () => {
    expect(revealedLength(TEXT, 0)).toBe(0);
  });

  it("reveals one character per tick", () => {
    expect(revealedLength(TEXT, TYPEWRITER_MS_PER_CHAR * 5)).toBe(5);
  });

  it("never runs past the end of the string", () => {
    expect(revealedLength(TEXT, 10_000_000)).toBe(TEXT.length);
  });

  it("completes instantly when asked — reduced motion or tap-to-complete", () => {
    expect(revealedLength(TEXT, 0, true)).toBe(TEXT.length);
    expect(isRevealComplete(TEXT, 0, true)).toBe(true);
  });

  it("reports completion only once the whole line is out", () => {
    expect(isRevealComplete(TEXT, TYPEWRITER_MS_PER_CHAR * (TEXT.length - 1))).toBe(
      false,
    );
    expect(isRevealComplete(TEXT, revealDurationMs(TEXT))).toBe(true);
  });

  it("treats an empty line as already complete", () => {
    expect(isRevealComplete("", 0)).toBe(true);
  });
});

describe("tap contract", () => {
  it("first tap completes a line still revealing", () => {
    expect(tapIntent(TEXT, TYPEWRITER_MS_PER_CHAR * 2)).toBe("complete");
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
