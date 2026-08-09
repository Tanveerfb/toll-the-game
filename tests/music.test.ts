import { beforeEach, describe, expect, it } from "vitest";
import {
  CROSSFADE_MS,
  MusicController,
  type AudioElementLike,
} from "@/lib/audio/music";
import { MUSIC_TRACKS } from "@/lib/audio/tracks";

class FakeAudio implements AudioElementLike {
  src = "";
  loop = false;
  volume = 1;
  currentTime = 0;
  paused = true;
  playCalls = 0;
  /** Sources this element should refuse — stands in for a missing file. */
  static failing = new Set<string>();
  /** Every src `play()` was called on, in order. Recorded here rather than
   *  read off the elements afterwards because decks are reused: a later role
   *  overwrites `src`, hiding the earlier attempt. */
  static attempts: string[] = [];

  play(): Promise<void> {
    this.playCalls += 1;
    FakeAudio.attempts.push(this.src);
    if (FakeAudio.failing.has(this.src)) return Promise.reject(new Error("no file"));
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

/** Drives the controller's fade with controllable time instead of rAF. */
function makeController() {
  const created: FakeAudio[] = [];
  let now = 0;
  const queue: Array<() => void> = [];

  const controller = new MusicController({
    createAudio: () => {
      const audio = new FakeAudio();
      created.push(audio);
      return audio;
    },
    now: () => now,
    schedule: (step) => queue.push(step),
  });

  /** Runs the pending fade steps forward to `ms`. */
  const advance = (ms: number) => {
    now += ms;
    while (queue.length > 0) {
      const step = queue.shift();
      step?.();
      // One pass per advance, or a completed fade would spin forever.
      if (queue.length > 0 && now >= CROSSFADE_MS) continue;
      break;
    }
  };

  return { controller, created, advance, flush: () => Promise.resolve() };
}

beforeEach(() => {
  FakeAudio.failing.clear();
  FakeAudio.attempts = [];
});

describe("role switching", () => {
  it("starts a role once unlocked", async () => {
    const { controller, created } = makeController();
    controller.unlock();
    controller.play("story");
    await Promise.resolve();
    expect(controller.currentRole).toBe("story");
    expect(created.some((a) => a.src === MUSIC_TRACKS.story.src)).toBe(true);
  });

  it("is a no-op when the same role is requested again", async () => {
    const { controller, created } = makeController();
    controller.unlock();
    controller.play("story");
    await Promise.resolve();
    const callsAfterFirst = created.reduce((sum, a) => sum + a.playCalls, 0);

    controller.play("story");
    await Promise.resolve();
    // Walking parts → chapters → brief must not restart the theme.
    expect(created.reduce((sum, a) => sum + a.playCalls, 0)).toBe(callsAfterFirst);
  });

  it("switches decks for a different role", async () => {
    const { controller } = makeController();
    controller.unlock();
    controller.play("story");
    await Promise.resolve();
    controller.play("battle");
    await Promise.resolve();
    expect(controller.currentRole).toBe("battle");
  });
});

describe("autoplay gate", () => {
  it("does not start before a user gesture", async () => {
    const { controller, created } = makeController();
    controller.play("story");
    await Promise.resolve();
    expect(controller.isUnlocked).toBe(false);
    expect(created.every((a) => a.playCalls === 0)).toBe(true);
  });

  it("plays whatever was pending on the first gesture", async () => {
    const { controller, created } = makeController();
    controller.play("story");
    controller.unlock();
    await Promise.resolve();
    expect(controller.isUnlocked).toBe(true);
    expect(created.some((a) => a.src === MUSIC_TRACKS.story.src)).toBe(true);
  });
});

describe("missing files", () => {
  it("resolves silently and is only attempted once", async () => {
    FakeAudio.failing.add(MUSIC_TRACKS.battle.src);
    const { controller } = makeController();
    controller.unlock();

    controller.play("battle");
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.isDeadSource(MUSIC_TRACKS.battle.src)).toBe(true);

    controller.play("story");
    await Promise.resolve();
    controller.play("battle");
    await Promise.resolve();

    // A missing file must not be retried on every screen change for the rest
    // of the session.
    const battleAttempts = FakeAudio.attempts.filter(
      (src) => src === MUSIC_TRACKS.battle.src,
    ).length;
    expect(battleAttempts).toBe(1);
  });

  it("still plays other roles after one turns out to be missing", async () => {
    FakeAudio.failing.add(MUSIC_TRACKS.battle.src);
    const { controller } = makeController();
    controller.unlock();

    controller.play("battle");
    await Promise.resolve();
    await Promise.resolve();
    controller.play("story");
    await Promise.resolve();

    expect(controller.currentRole).toBe("story");
    expect(FakeAudio.attempts).toContain(MUSIC_TRACKS.story.src);
  });
});

describe("volume", () => {
  it("is the settings volume scaled by the track's own gain", async () => {
    const { controller, created, advance } = makeController();
    controller.unlock();
    controller.setSettings({ volume: 0.5, muted: false });
    controller.play("battle");
    await Promise.resolve();
    advance(CROSSFADE_MS);

    const deck = created.find((a) => a.src === MUSIC_TRACKS.battle.src);
    expect(deck?.volume).toBeCloseTo(0.5 * MUSIC_TRACKS.battle.gain, 5);
  });

  it("mute forces zero without pausing, so unmuting resumes in place", async () => {
    const { controller, created, advance } = makeController();
    controller.unlock();
    controller.setSettings({ volume: 0.8, muted: false });
    controller.play("battle");
    await Promise.resolve();
    advance(CROSSFADE_MS);

    const deck = created.find((a) => a.src === MUSIC_TRACKS.battle.src) as FakeAudio;
    controller.setSettings({ volume: 0.8, muted: true });
    expect(deck.volume).toBe(0);
    expect(deck.paused).toBe(false);

    controller.setSettings({ volume: 0.8, muted: false });
    expect(deck.volume).toBeCloseTo(0.8 * MUSIC_TRACKS.battle.gain, 5);
  });

  it("clamps a settings volume outside 0–1", async () => {
    const { controller, created, advance } = makeController();
    controller.unlock();
    controller.setSettings({ volume: 5, muted: false });
    controller.play("battle");
    await Promise.resolve();
    advance(CROSSFADE_MS);
    const deck = created.find((a) => a.src === MUSIC_TRACKS.battle.src);
    expect(deck?.volume).toBeLessThanOrEqual(1);
  });
});

describe("stop", () => {
  it("pauses every deck and clears the current role", async () => {
    const { controller, created } = makeController();
    controller.unlock();
    controller.play("story");
    await Promise.resolve();
    controller.stop();
    expect(controller.currentRole).toBeNull();
    expect(created.every((a) => a.paused)).toBe(true);
  });
});

describe("manifest", () => {
  it("gives the victory sting no loop — it should land once and get out", () => {
    expect(MUSIC_TRACKS.victory.loop).toBe(false);
  });

  it("keeps every other role looping", () => {
    const looping = (["menu", "story", "storyScene", "battle"] as const).every(
      (role) => MUSIC_TRACKS[role].loop,
    );
    expect(looping).toBe(true);
  });

  it("keeps every gain within 0–1", () => {
    expect(
      Object.values(MUSIC_TRACKS).every((t) => t.gain > 0 && t.gain <= 1),
    ).toBe(true);
  });
});
