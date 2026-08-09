# Story Presentation & Music — Design

> Date: 2026-08-09 · Status: approved · Owner of art direction and audio content: **Tanveer**

## Problem

Tanveer's verdict on the story experience: *"it's not good right now."* Pressed for specifics, three of four candidate problems landed:

1. **Scenes look cheap.** Portraits are 224–320px hard-cropped squares with a heavy border, floating at the screen edges — they read as UI thumbnails, not characters present in a place. Narration and dialogue render in the identical box, with unattributed narration showing `· · ·` as a speaker.
2. **No pacing or weight.** Text appears instantly and entirely; a 60-word narration block lands in one frame. Every panel has the same rhythm, nothing is emphasised, and the whole thing is silent.
3. **The battle handoff is flat.** Scenes end and the arena simply appears. There is no VS beat, nothing distinguishes a canon story fight from a practice sandbox fight, and there is no chapter-complete moment before the rewards card.

The fourth candidate — too many list screens before reaching content — he explicitly dismissed. Navigation stays as-is.

## Decisions (Tanveer, 2026-08-09)

| # | Decision |
|---|---|
| 1 | **Backgrounds are deferred.** Environment art is the biggest lever on "cheap", but it is an art-direction commitment he isn't making yet. No generated plates, no blurred-character fallback, no stylised abstract backdrops this batch. Scene backdrops stay as they are. |
| 2 | **Audio is in scope, and it is music only.** He supplies the background OST himself. No SFX of any kind — no battle sounds, no UI blips, no text-advance clicks. |

Decision 1 constrains the rest: without backgrounds, "looks cheap" has to be fixed through **portrait framing, typographic separation of narration from dialogue, and motion** — everything except the environment.

## Scope

**In:** typewriter reveal, narration/dialogue treatment, portrait reframing, scene backlog, skip confirmation, chapter title card, VS splash, story identity in the battle shell, chapter-complete beat, and a complete music layer (channel, per-screen tracks, crossfade, volume/mute settings, autoplay handling).

**Out:** environment backgrounds, all SFX, node-path stage map, story Parts 3–6, mission objectives, difficulty tiers.

---

## Part 1 — Music layer

Music only. Every module name says `music`, not `audio`, so a future SFX bus lands beside it rather than inside it.

### Track manifest — `lib/audio/tracks.ts`

Tracks are addressed by **role**, not filename, so screens never name a file and Tanveer can swap what plays where by editing one map:

```ts
export type MusicRole =
  | "menu"        // home hub, archive, news, profile
  | "story"       // part select, chapter list, brief
  | "storyScene"  // intro/outro scene reader
  | "battle"      // VS splash + any battle
  | "victory";    // chapter complete + rewards

export interface MusicTrack {
  role: MusicRole;
  /** Path under /public. */
  src: string;
  /** Per-track level trim, 0–1 — different masters land at different loudness. */
  gain: number;
  loop: boolean;
}
```

The manifest ships **fully populated with paths but no files**: `public/audio/` is empty except a `.gitkeep`. A missing file is a first-class expected state, not an error (see below), so the game is silent until Tanveer drops the OST in. `docs/AUDIO.md` lists exactly which filenames each role wants.

An optional per-chapter override (`musicId` on a chapter) is **not** built. Roles cover every screen this batch touches; a per-chapter override is one optional schema field to add later if he wants a specific track for a specific fight.

### Controller — `lib/audio/music.ts`

A module-level singleton, not a React provider — the root layout already pays for `AuthProvider`, and music state has no reason to re-render a tree.

- **Two `HTMLAudioElement`s, A/B.** Switching roles fades the outgoing element down and the incoming up over ~700ms via a `requestAnimationFrame` ramp. Two elements rather than a Web Audio graph: no `AudioContext` lifecycle to manage, no resume-after-suspend dance beyond the gesture gate, and loop-gapless is the browser's problem.
- **Autoplay gate.** Browsers refuse `play()` before a user gesture. The controller keeps the requested role as `pending` and registers one-shot `pointerdown`/`keydown` listeners; the first interaction anywhere starts whatever the current screen asked for. Nothing throws, nothing is logged in production.
- **Missing files are silent, not broken.** `play()` rejections and `error` events resolve to "this role has no audio", recorded once per src so a missing track can't spam the console on every screen change.
- **SSR-safe.** No `Audio` construction at module scope; the first call from an effect creates the elements.
- **Volume** is `settings.musicVolume × track.gain`, recomputed on every settings change; `musicMuted` forces 0 without stopping playback, so unmuting resumes in place.

### Screen hook — `hooks/useScreenMusic.ts`

```ts
useScreenMusic(role: MusicRole | null): void
```

Requests a role for as long as the component is mounted. Passing the same role across a navigation is a no-op — walking part select → chapter list → brief must not restart the story theme. Passing `null` (or unmounting the last requester) fades out.

### Settings — `store/settingsStore.ts`

Gains `musicVolume` (0–1, default `0.6`) and `musicMuted` (default `false`), persisted alongside `battleSpeed` in the existing `toll-settings` localStorage slice. No migration: zustand-persist's shallow merge supplies the defaults for anyone with an older stored object.

### Control surface — `components/ui/AudioControl.tsx`

A speaker button in `TopNav` opening a small popover with a volume slider and a mute toggle.

`/profile` was the obvious home for a settings control and is the wrong one: it redirects guests to `/login`, and guest mode is a supported way to play. TopNav is reachable from every screen by every player. **The bar's fixed `h-11` is load-bearing** — the battle shell sizes itself to `100dvh - 2.875rem` — so the control must fit inside that height and not grow the row.

The slider is a native `<input type="range">` styled with Tailwind rather than a new Radix dependency for a single control.

---

## Part 2 — Scene reader

`StorySceneReader.tsx` is rewritten. Its testable logic moves to `lib/game/storyScene.ts` (pure), keeping the component to rendering and event wiring.

### Typewriter reveal

Text reveals at ~28ms/character. The interaction contract is the visual-novel standard and fixes the wall-of-text problem directly:

- **Tap while revealing** → complete the line instantly.
- **Tap once complete** → advance to the next scene.

`prefers-reduced-motion` renders every line complete immediately and the first tap advances, so the reveal never becomes an obstacle.

An **AUTO** toggle advances on its own after a dwell proportional to line length (a floor plus ~45ms/character), cancelled by any manual tap. Cheap once the reveal state machine exists, and it is what makes a long narration sequence watchable rather than tappable.

### Narration versus dialogue

A scene with no `speaker` is narration and gets a visibly different treatment: centred, wider measure, larger leading, no name plate, no `· · ·` filler, and thin letterbox bars top and bottom. Dialogue keeps the name plate and box. This is the main lever available for "looks cheap" once backgrounds are off the table — the two kinds of text currently being indistinguishable is why an eight-panel intro reads as one undifferentiated block.

### Portraits

- Framed **3:4 portrait** rather than square, larger, with the heavy border replaced by a soft bottom fade so the figure sits in the scene instead of floating as a tile.
- **The previous speaker stays on the opposite side, dimmed and desaturated.** Today only the active speaker's side is mounted at all, so a two-hander is one portrait popping between two empty slots. Remembering the last portrait per side is what makes a conversation look like a conversation.
- The existing two-independent-slots structure is kept verbatim — it exists because a shared container teleported mid-exit and flashed the wrong character (Tanveer, 2026-07-20). That bug does not get reintroduced.

### Backlog, skip, title card

- **HISTORY** opens the lines already shown in the current sequence. Today a mis-tap loses a line permanently.
- **Skip asks for confirmation** when the chapter has never been cleared. One stray tap on a top-right control currently destroys an unseen intro. On a replay it skips immediately — the brief's SKIP STORY already covers that intent.
- A **chapter title card** (number + title) holds for ~1.4s before the first intro scene, tap to dismiss. The chapter title is currently a small grey label in the corner.

---

## Part 3 — Battle handoff

Three new beats, all in `components/game/story/`, all skippable by tap, all honouring `prefers-reduced-motion`.

- **`VersusSplash.tsx`** — between the intro scenes and the arena: player art left, enemy art right, VS struck through the middle, chapter title beneath, ~1.6s with an impact flash and shake. This is the missing stakes moment.
- **Story identity in the arena** — the battle shell shows the chapter it belongs to, so a canon fight doesn't look byte-identical to a practice sandbox. It renders inside the existing status strip and must not change the shell's height; `BattleArena`'s root still must not set a z-index (it would trap the fixed drawer and modals under the sticky nav).
- **`ChapterCompleteCard.tsx`** — before the rewards card, on a **first clear only**. A farm run skips straight to rewards; a completion fanfare on the fortieth clear is noise.

### View machine

`app/story/page.tsx` gains three states — `title`, `versus`, `complete`:

```
chapters → brief → title → intro → versus → battle → outro → complete → rewards
                     └──────── skip scenes (cleared) ────────┘         ↑ first clear only
```

The skip path (a cleared chapter) bypasses `title`, `intro`, `outro` and `complete`, going brief → versus → battle → rewards. `versus` is kept on the skip path deliberately: it is short, it is the beat that makes a fight feel like a fight, and it covers the battle's start-up.

---

## Testing

- `tests/music.test.ts` — role switching is a no-op for the same role; a different role crossfades; a missing/failing source resolves silently and is only recorded once; volume is `settings × gain`; mute forces 0 without stopping; the autoplay gate replays the pending role on first gesture. `HTMLAudioElement` is stubbed; no real playback.
- `tests/storyScene.test.ts` — typewriter slicing per elapsed time; reduced motion completes instantly; the tap contract (reveal → complete → advance); auto-advance dwell scales with length; narration vs dialogue classification; per-side portrait memory across a speaker alternation.
- Existing story tests must stay green; the reader's public props are unchanged apart from additions.

## Risks

- **A silent game reads as a broken feature.** Mitigated by shipping `docs/AUDIO.md` with the exact filenames, and by the control surface showing music as available-but-absent rather than pretending nothing exists.
- **Typewriter fighting the skip path.** The reveal state must reset per scene index, or a completed line leaks into the next panel. Covered by tests.
- **Autoplay gate never firing.** If a player somehow reaches a screen with no interaction, music simply never starts — acceptable, and the next tap fixes it.
- **TopNav height.** The audio control is the first thing added to that bar since the battle shell started measuring against it. Verify `h-11` is unchanged at 375px.
