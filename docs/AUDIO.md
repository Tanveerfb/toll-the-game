# Audio — what to drop in, and where

Music only. There is no SFX system and none is planned in the current batches
(Tanveer, 2026-08-09) — no battle sounds, no UI clicks, no text blips.

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
