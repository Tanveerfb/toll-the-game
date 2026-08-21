import { Howl } from "howler";

import { SFX, SFX_CUES, type SfxCue } from "@/lib/audio/cues";

/**
 * The sound-effect bus.
 *
 * Howler rather than the bare `HTMLAudioElement` the music deck uses, and the
 * difference is the job: music plays one long file at a time and wants nothing
 * more than play/pause/fade, which is why `music.ts` is hand-rolled. Effects
 * are short, overlapping and numerous — three actions resolving an AoE can ask
 * for eight sounds inside one frame — and that needs pooled voices, which is
 * precisely what an `HTMLAudioElement` cannot do: play it again while it is
 * already playing and it restarts instead of layering.
 *
 * **Silent until the files exist.** `public/audio/sfx/` ships empty, the same
 * way `public/audio/` does. Howler reports a load failure per cue, which is
 * recorded once and then never retried or logged again — a missing file is the
 * expected state, not an error, and a console warning per hit in a long fight
 * would be worse than the silence.
 *
 * Nothing here touches React. The store reads volume and mute; the caller
 * passes them in.
 */

export interface SfxSettings {
  volume: number;
  muted: boolean;
}

interface Voice {
  howl: Howl;
  /** Set once loading fails. Stops every later request for this cue dead. */
  broken: boolean;
  lastPlayedAt: number;
}

export interface SfxBus {
  play: (cue: SfxCue, settings: SfxSettings) => void;
  /** Cues that failed to load — the honest answer to "why is it quiet". */
  missing: () => SfxCue[];
  dispose: () => void;
}

export interface SfxBusOptions {
  /** Injected so tests can step time rather than wait out a throttle. */
  now?: () => number;
  /** Injected so tests never construct a real Howl. */
  createHowl?: (src: string, volume: number) => Howl;
}

const defaultCreateHowl = (src: string, volume: number): Howl =>
  new Howl({
    src: [src],
    volume,
    // Effects are short. Preloading them costs one request each and removes a
    // first-play delay that would land exactly on the first hit of a fight.
    preload: true,
    html5: false,
  });

export function createSfxBus(options: SfxBusOptions = {}): SfxBus {
  const { now = () => Date.now(), createHowl = defaultCreateHowl } = options;

  const voices = new Map<SfxCue, Voice>();

  const voiceFor = (cue: SfxCue): Voice => {
    const existing = voices.get(cue);
    if (existing) return existing;

    const def = SFX[cue];
    const howl = createHowl(def.src, def.gain);
    const voice: Voice = { howl, broken: false, lastPlayedAt: -Infinity };
    // Recorded once. `loaderror` fires per cue, and the whole manifest being
    // absent is the normal state of this repo today.
    howl.once("loaderror", () => {
      voice.broken = true;
    });
    voices.set(cue, voice);
    return voice;
  };

  return {
    play(cue, settings) {
      if (settings.muted || settings.volume <= 0) return;

      const def = SFX[cue];
      const voice = voiceFor(cue);
      if (voice.broken) return;

      const at = now();
      // Eight simultaneous hits should sound like a hit, not a click.
      if (def.throttleMs > 0 && at - voice.lastPlayedAt < def.throttleMs) return;
      voice.lastPlayedAt = at;

      // Per-cue trim multiplied by the player's setting, matching how the
      // music deck resolves its own level.
      voice.howl.volume(def.gain * settings.volume);
      voice.howl.play();
    },

    missing() {
      return SFX_CUES.filter((cue) => voices.get(cue)?.broken === true);
    },

    dispose() {
      voices.forEach((voice) => voice.howl.unload());
      voices.clear();
    },
  };
}

/**
 * The app-wide bus.
 *
 * A module singleton rather than context: effects are fired from the battle
 * sequencer and from stores, neither of which sits under a provider, and
 * threading a ref through both to play a click would be ceremony.
 */
let shared: SfxBus | null = null;

export function getSfxBus(): SfxBus {
  if (!shared) shared = createSfxBus();
  return shared;
}

/** Test seam — replaces the singleton, so a suite never builds a real Howl. */
export function setSfxBus(bus: SfxBus | null): void {
  shared = bus;
}
