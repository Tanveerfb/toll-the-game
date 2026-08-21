# Audio — what to drop in, and where

**Music and sound effects.** This file said *"there is no SFX system and none
is planned"* (Tanveer, 2026-08-09) until **2026-08-21**, when he asked for one.
Both buses now exist and both are **silent until the files arrive** — that is
the designed state, not a bug.

| Bus | Manifest | Player |
|---|---|---|
| Music | `lib/audio/tracks.ts` | `lib/audio/music.ts` (two-deck crossfade) |
| Effects | `lib/audio/cues.ts` | `lib/audio/sfx.ts` (howler, pooled voices) |

The two are deliberately separate modules. Music plays one long file at a time
and wants fades; effects are short, overlapping and numerous, and an
`HTMLAudioElement` restarts rather than layering when asked to play something
already playing.

The game asks for music by **role**, never by filename, so a screen never
names a file. The role → file map is `lib/audio/tracks.ts`.

## Files to add

Drop these into `public/audio/`. Until they exist the game is **silent by
design** — a missing file resolves to "this role has no audio", never an error
or a console warning storm.

| File | Role | Plays on | Loop |
|---|---|---|---|
| `menu.ogg` | `menu` | Home hub, archive, news, profile, gacha | yes |
| `story.ogg` | `story` | Part select, chapter list, chapter brief | yes |
| `story-scene.ogg` | `storyScene` | Intro and outro scene reader | yes |
| `battle.ogg` | `battle` | VS splash and every battle | yes |
| `victory.ogg` | `victory` | Chapter complete and the rewards screen | **no** |

## Sound effects

Drop these into `public/audio/sfx/`. Callers ask for a **cue**, never a
filename, so `lib/audio/cues.ts` is the only place a path appears.

| File | Cue | Fires on |
|---|---|---|
| `card-play.ogg` | `cardPlay` | A card is committed to the action queue |
| `card-merge.ogg` | `cardMerge` | Two cards merge into a higher rank |
| `hit.ogg` | `hit` | A normal attack connects |
| `critical.ogg` | `critical` | A CRITICAL connects |
| `evade.ogg` | `evade` | An attack is evaded |
| `ultimate.ogg` | `ultimate` | An ultimate fires (the cut-in beat) |
| `defeat.ogg` | `defeat` | A unit drops to zero |
| `turn-end.ogg` | `turnEnd` | The turn resolves and passes over |
| `victory.ogg` | `victory` | Battle won |
| `defeat-screen.ogg` | `defeatScreen` | Battle lost |

**Which sounds these are is yours.** The manifest names the *moments* the game
asks about; the character of each is a design call, not an engineering one.

Two behaviours worth knowing before you cut them:

- **Effects fire on the animated beat, not the engine's.** Playback runs up to
  a second behind resolution, and a hit you hear before you see it reads as a
  bug. `hooks/useBattleSequencer.ts` fires each cue at its impact frame.
- **Repeats inside a few frames are throttled** (`throttleMs` per cue). One
  AoE can ask for `hit` eight times in a frame; without it that is one loud
  click rather than eight hits. Raise the value if a cue still stacks.

Levels use the same per-entry `gain` trim as music, multiplied by the player's
volume. There is no separate effects slider — one control governs both, which
is a thing to design once there is something to balance against.

### Format

- **`.ogg`** (Vorbis or Opus). Every browser the game targets supports it, and
  it loops without the encoder-delay gap MP3 has.
- If you'd rather ship `.mp3` or `.m4a`, change the `src` in
  `lib/audio/tracks.ts` — nothing else references the extension.
- Looping tracks should be trimmed so the end meets the start cleanly. The
  player loops via the browser's own `loop` flag; it does not crossfade a track
  into itself.
- `victory.ogg` is a one-shot sting — a few seconds, no loop point needed.

### Levels

Don't worry about matching loudness between tracks by re-exporting. Each role
carries a `gain` trim (0–1) in `lib/audio/tracks.ts`; nudge that instead. The
volume the player actually hears is `their volume setting × that gain`.

## How it behaves

- **Crossfades** between roles over 700ms, so walking from the chapter list
  into a fight doesn't cut.
- **Navigating within a role doesn't restart it.** Part select → chapter list →
  brief is one continuous piece of music.
- **Browsers block audio until the player interacts with the page.** The
  requested track is held and starts on the first tap or keypress. Nothing
  breaks in the meantime; there's just no sound until then.
- **Volume and mute** live in the ♪ button in the top navigation bar, persisted
  in `localStorage` under `toll-settings`. Muting holds the track in place
  rather than stopping it, so unmuting resumes where it was.

## Adding a new role

1. Add the role to `MusicRole` and an entry to `MUSIC_TRACKS`
   (`lib/audio/tracks.ts`).
2. Call `useScreenMusic("yourRole")` in the screen that owns it.
3. Add the file to `public/audio/` and a row to the table above.
