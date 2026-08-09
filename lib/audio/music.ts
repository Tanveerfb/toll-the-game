import { MUSIC_TRACKS, type MusicRole } from "@/lib/audio/tracks";

/** Crossfade length. Long enough to feel deliberate, short enough that a fast
 *  navigation doesn't leave two tracks audible for an awkward beat. */
export const CROSSFADE_MS = 700;

export interface MusicSettings {
  volume: number;
  muted: boolean;
}

/**
 * Minimal slice of HTMLAudioElement the controller actually touches. Declaring
 * it explicitly is what lets tests hand in a stub without a DOM.
 */
export interface AudioElementLike {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
}

export interface MusicControllerOptions {
  createAudio: () => AudioElementLike;
  /** Injected so tests can step time instead of waiting for rAF frames. */
  now?: () => number;
  schedule?: (step: () => void) => void;
}

interface Deck {
  audio: AudioElementLike;
  role: MusicRole | null;
  /** Fade target, 0–1, before settings volume is applied. */
  level: number;
}

/**
 * Two-deck crossfading music player.
 *
 * Two `HTMLAudioElement`s rather than a Web Audio graph: no AudioContext
 * lifecycle to babysit, and gapless looping stays the browser's problem.
 *
 * Three states are load-bearing and all of them are normal, not errors:
 *  - no user gesture yet (browsers refuse to start audio),
 *  - the track file doesn't exist (Tanveer supplies the OST later),
 *  - the same role is requested again (navigating within story must not
 *    restart the theme).
 */
export class MusicController {
  private decks: [Deck, Deck];
  private active = 0;
  private settings: MusicSettings = { volume: 0.6, muted: false };
  private pendingRole: MusicRole | null = null;
  private unlocked = false;
  /** Sources already known to be unplayable, so one missing file can't log on
   *  every screen change for the rest of the session. */
  private deadSources = new Set<string>();
  private fadeHandle: number | null = null;

  private readonly createAudio: () => AudioElementLike;
  private readonly now: () => number;
  private readonly schedule: (step: () => void) => void;

  constructor(options: MusicControllerOptions) {
    this.createAudio = options.createAudio;
    this.now = options.now ?? (() => Date.now());
    this.schedule =
      options.schedule ??
      ((step) => {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);
      });

    this.decks = [
      { audio: this.createAudio(), role: null, level: 0 },
      { audio: this.createAudio(), role: null, level: 0 },
    ];
  }

  get currentRole(): MusicRole | null {
    return this.decks[this.active].role;
  }

  /** True once a user gesture has let playback start. */
  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** A source that failed to play is remembered, so callers (and tests) can
   *  assert we don't retry it forever. */
  isDeadSource(src: string): boolean {
    return this.deadSources.has(src);
  }

  setSettings(settings: MusicSettings): void {
    this.settings = settings;
    this.applyVolumes();
  }

  /**
   * Requests a role. Same role → no-op, so walking part select → chapter list
   * → brief doesn't restart the story theme. `null` fades everything out.
   */
  play(role: MusicRole | null): void {
    if (role === null) {
      this.pendingRole = null;
      this.fadeTo(null);
      return;
    }
    if (this.currentRole === role) return;

    const track = MUSIC_TRACKS[role];
    if (this.deadSources.has(track.src)) {
      // Known-missing file: treat as "this role is silent" and still record it
      // as current, so we don't re-attempt on every render.
      this.decks[this.active].role = role;
      return;
    }

    if (!this.unlocked) {
      this.pendingRole = role;
      return;
    }
    this.start(role);
  }

  /**
   * Called on the first user gesture. Browsers block `play()` until then, so
   * whatever the current screen asked for starts here instead.
   */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.pendingRole) {
      const role = this.pendingRole;
      this.pendingRole = null;
      this.start(role);
    }
  }

  stop(): void {
    this.pendingRole = null;
    this.decks.forEach((deck) => {
      deck.audio.pause();
      deck.role = null;
      deck.level = 0;
    });
    this.applyVolumes();
  }

  private start(role: MusicRole): void {
    const track = MUSIC_TRACKS[role];
    const next = this.active === 0 ? 1 : 0;
    const deck = this.decks[next];

    deck.audio.src = track.src;
    deck.audio.loop = track.loop;
    deck.audio.currentTime = 0;
    deck.role = role;
    deck.level = 0;
    this.setDeckVolume(deck);

    void deck.audio.play().then(
      () => {
        this.active = next;
        this.fadeTo(role);
      },
      () => {
        // Either no gesture yet or the file isn't there. A rejection with the
        // page already unlocked means the source is genuinely unusable.
        deck.role = null;
        if (this.unlocked) this.deadSources.add(track.src);
        else this.pendingRole = role;
      },
    );
  }

  /** Ramps the deck holding `role` up and every other deck down. */
  private fadeTo(role: MusicRole | null): void {
    const startedAt = this.now();
    const from = this.decks.map((deck) => deck.level) as [number, number];

    const step = () => {
      const elapsed = this.now() - startedAt;
      const t = Math.min(1, elapsed / CROSSFADE_MS);
      this.decks.forEach((deck, index) => {
        const target = deck.role !== null && deck.role === role ? 1 : 0;
        deck.level = from[index] + (target - from[index]) * t;
        this.setDeckVolume(deck);
      });

      if (t < 1) {
        this.fadeHandle = 1;
        this.schedule(step);
        return;
      }

      this.fadeHandle = null;
      // Park anything fully faded out so it isn't decoding in the background.
      this.decks.forEach((deck) => {
        if (deck.level === 0 && deck.role !== role) {
          deck.audio.pause();
          deck.role = null;
        }
      });
    };

    step();
  }

  private applyVolumes(): void {
    this.decks.forEach((deck) => this.setDeckVolume(deck));
  }

  private setDeckVolume(deck: Deck): void {
    const trackGain = deck.role ? MUSIC_TRACKS[deck.role].gain : 1;
    // Muting forces 0 without pausing, so unmuting resumes in place rather
    // than restarting the track from the top.
    const volume = this.settings.muted
      ? 0
      : this.settings.volume * trackGain * deck.level;
    deck.audio.volume = Math.max(0, Math.min(1, volume));
  }
}

let controller: MusicController | null = null;

/** Browser-only singleton. Returns null during SSR so importing this module
 *  from a server component can't construct an Audio element. */
export function getMusicController(): MusicController | null {
  if (typeof window === "undefined") return null;
  if (!controller) {
    controller = new MusicController({
      createAudio: () => {
        const audio = new Audio();
        audio.preload = "auto";
        return audio;
      },
    });
    const unlock = () => {
      controller?.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }
  return controller;
}

/** Test seam — drops the singleton so a suite can build its own. */
export function resetMusicControllerForTests(): void {
  controller = null;
}
