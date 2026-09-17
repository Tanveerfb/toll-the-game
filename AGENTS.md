<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# toll-the-game — Project Documentation

Turn-based card battle game for the Element Clash IP. **Agents: read `docs/HANDOFF.md` first** — context, design rulings ledger, working style. Architecture in `docs/ARCHITECTURE.md`; current state in `docs/STATUS.md`; plan in `docs/ROADMAP.md`; art generation in `docs/ART_PIPELINE.md`.

**Never block on missing art.** If a feature needs an image the game doesn't have, append a request to `docs/ART_REQUESTS.md`, ship the feature with a fallback, and move on — ComfyUI runs in its own dedicated sessions, and that file is what they read.

## Project Skills

`.claude/skills/` holds the workflows this project repeats. Invoke the skill instead of re-deriving its rules — that is the whole reason they exist.

| Skill | Use it when |
| --- | --- |
| `FillerAssist` | Authoring or reworking a story chapter — canon read, filler under his approval, then `data/story/chapter-N.json` |
| `kitwords` | Writing the player-facing text for a kit — skill and passive descriptions, in the game's voice |
| `kitcheck` | Before shipping any edit to `data/characters/*.json`. Audits wording and structure; **never** touches a number |
| `mobilecheck` | Before shipping a screen, or when reworking one built before 2026-08-18. One screen per run |
| `ruling` | He settles a design question. Numbered entry, his words, supersede links, propagation |
| `comfypending` | A feature needs art the game doesn't have |

`Plans/` holds specced-but-unbuilt work — dated design files a future session can pick up cold. Tanveer builds those in their own dedicated sessions; **don't start one mid-conversation**, and don't let a plan rot silently: if the code it describes changes, the plan is stale and says so or goes.

**A project skill names the files it owns, and dies with them.** Every skill carries a "Where the truth lives" section listing its sources. When those files are deleted, the skill is deleted in the same commit. `latticePlan` outlived `lib/game/route.ts` by one commit and spent it teaching a system that no longer existed — docs get skimmed, skills get followed, so a stale skill does more damage than a stale doc.

## Stack

| Technology          | Role                                             |
| ------------------- | ------------------------------------------------ |
| Next.js 16          | App framework (App Router)                       |
| TypeScript (strict) | Type safety across all files                     |
| shadcn/ui + Tailwind CSS 4 | UI components and styling (radix-nova style) |
| Firebase            | Auth + Firestore player persistence (optional — guest mode without env) |
| Zod                 | Runtime schema validation                        |
| Framer Motion       | UI animations                                    |
| Zustand             | Global game state management                     |
| Vitest              | Unit tests (`tests/*.test.ts`) + component tests in real Chromium (`tests/*.browser.test.tsx`) |

UI primitives live in `components/ui/` (shadcn) and already default to the Combat Terminal look — add new ones with `npx shadcn@latest add <component>`, and don't restate the theme at the usage (ruling #84).

**Mobile first, desktop second (Tanveer, 2026-08-18).** Most players willing to try the game arrive on a phone, so a phone is the primary target and desktop is the secondary one — not the other way round. Concretely: design canvas **390×844** (9:16 portrait); desktop renders the same column centred at a capped width, never a re-laid-out wide variant; **`dvh`, never `vh`** (Tailwind 4 compiles `screen` to `100vh`, the largest viewport); touch targets **≥44px** with primaries in the thumb-reachable lower third; no affordance that exists only on hover; one vertical scroll per screen, with wide content scrolling inside its own container. **Verify phone width before desktop** — a break at 390px is a blocker, a break at 1440px is a bug. Ruling #107 in `docs/HANDOFF.md`.

Two of those rules are **enforced in code, so don't re-implement them per screen** (rulings #119–120, 2026-08-21):

- **The 44px floor lives in `components/ui/`.** `button`, `input`, `select` and `slider` all carry it, so a control built from a primitive is already touch-safe and a screen adding `h-9` to one is fighting the scale. Opting out needs `min-h-0` **and** a comment saying why. Pinned by `tests/touchTargets.test.ts`.
- **Anything explanatory uses `components/ui/Hint.tsx`, never a `Tooltip`.** A radix `Tooltip` on a `<span>` fires on neither tap nor focus, which is how the whole mechanic glossary came to be invisible on a phone. `Hint` is a `Popover` with a real button trigger and **one interaction on every device: click, tap or keyboard**. It does *not* open on hover — that was built first and removed the same day, because a mouse fires `pointerenter` before `click`, so hovering opened it and the click closed it again (`tests/hint.browser.test.tsx`). `tests/touchTargets.test.ts` forbids `TooltipTrigger` outside the primitive — and, since **ruling #125** (2026-09-01), any `title=` on a lowercase JSX tag, which is the same hover-only failure arriving through the DOM instead of through radix. Ten of those were live, including the summon banner's twelve featured tiles, whose character names lived nowhere else on the page.

**Navigation is a bottom tab bar below `sm`** (ruling #123, 2026-09-01) — five destinations in the thumb third, portalled to `<body>` because the nav's `backdrop-filter` makes `fixed` resolve against the nav rather than the viewport. It stands down while `[data-battle-active]` is on screen. Heights compose through `--tabbar-h`; `.screen-below-nav` subtracts both bars. The archive's filters moved into a sheet the same day (#124).

**No mobile debt is outstanding.** The 2026-08-21 sweep took every screen, battle included: its controls moved off a side rail into a sheet, merge arms from a button, and press-and-hold opens a card's or a unit's details — the gesture set is **tap = act, hold = explain** (#118). `docs/design/mockups/battle-mobile.html` records those decisions, and `battle-mobile-v2.html` the 2026-09-01 revisions.

Two corrections to the above, both from measuring it (2026-09-01). **Hand cards floor at 44px, not 56** — 56 was the fix for cards shrinking to 43px slivers, and it then hid two of a full hand of eight off the edge of a 370px scroller. Eight is the hard maximum (4v4) and the arithmetic is fixed: full-bleed 390px, 2px gaps, **47px a card**. And **it is browser-verified now** — geometry and behaviour are, at 390×844 against a live 4v4. Taste still is not, and never is; that pass is his.

**Anything pinned to the bottom edge clears the tab bar** via `bottom-[var(--tabbar-h)]`, which is `0rem` wherever that bar does not render. A plain `bottom-0` sits *under* it: that is how `TeamSelect`'s START and `StageBrief`'s launch bar were both covered outright the day #123 shipped, leaving practice and the world boss unstartable on a phone. Pinned by `tests/overlayStacking.test.ts`.

## Folder Structure

```
app/                  Next.js App Router — /, /practice, /story, /events (world boss),
                      /gacha,
                      /archive, /archive/[id], /archive/npc, /news, /login, /profile
components/
  ui/                 shadcn primitives + KeyworkHighlighter + prose.tsx (document
                      typography, shared with mdx-components.tsx)
  game/               Deck, CharacterBrowser, KitDetails, SkillDocument, TeamSelect,
                      PlayerHud, BattleArena (arena shell only)
  game/story/         Story mode v2 screens: ChapterList, StageList, StageBrief,
                      WaveBreak, StageResult, StoryBackdrop, StoryStage
  game/battle/        Battle overlays split out of BattleArena: TeamUnitTile,
                      UnitDetailPanel, TeamDetailsList, BattleLogDrawer, EffectsList
  gacha/              BannerScreen, PullReveal, RatesModal, MilestonePicker,
                      ConfirmPullModal (summon confirm + currency-shift preview)
  news/               NewsFeedTabs, NewsPostLayout
hooks/                BattleProvider (phase engine), MechanicProvider (phase queue),
                      AuthProvider, useBattleSequencer (cinematics)
lib/
  firebase.ts         Optional Firebase init (null exports without env)
  game/               combat.ts, damage.ts, ai.ts, passive.ts, tick.ts, phases.ts,
                      damagePreview.ts (kit preview), descriptionTranslator.ts,
                      characterCatalog.ts, characterVfx.ts, battleReport.ts,
                      effectDiff.ts
  gacha/  news/       Banner + pull logic; MDX post loading
  nav/routes.ts       GAME_ROUTES — single source of truth for what modes exist
store/                gameStore.ts (battle + deck), playerStore.ts, storyStore.ts,
                      settingsStore.ts
content/news/         MDX patch notes (updates/ + notices/)
data/characters/      Character kit JSON (source of truth for kits)
data/story/           Story chapters (chapter-N.json); data/banners/ gacha banners
types/                Shared TypeScript contracts
tests/                Unit tests (engine, stores, gacha, previews), plus
                      *.browser.test.tsx — component tests in real Chromium
scripts/sim.ts        Headless balance simulator (npm run sim), ruling #57
```

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm run test` / `npm run check`
- `npm run test:browser` — component tests in real Chromium. **Separate from `test` on purpose**: a browser launch is not what you want in a tight loop, and `check` runs the unit suite only. Run it before shipping anything whose behaviour is timing- or pointer-dependent, because that is the half a simulated DOM cannot judge.
- `npm run sim -- <left> <right>` — headless balance simulation across all four formats (ruling #57). `npm run sim -- --roster <id>` sweeps one kit against the whole roster. **Read the limits at the top of `lib/game/simulate.ts` before quoting a number**: no card draw, AI plays both sides. **"Base stats only" stopped being true on 2026-09-16** — a unit may carry `level`/`ascension`/`ultLevel` and a bare id still means the catalog statline, so kit comparisons are unchanged while an *encounter* can be tuned against a real player band (`playerBand`). `simulateRun` fights multi-wave runs on one HP bar. The AI plays the PLAYER side too, so a clear rate is a floor, not a prediction.

**A green guard is not a working guard — prove a new one fails before trusting that it passes.** Reintroduce the bug it exists to catch and watch it go red. On 2026-09-16 this found that **three of the four checks in `tests/kitDescriptionRules.test.ts` had never run**, green since the day they were written: `/\braises\b/` had been authored through a heredoc that turned each `\b` into a literal `0x08` byte, and two more used `` new RegExp(`\b${word}\b`) ``, where a **template literal** turns `\b` into a backspace at runtime. Both spellings match nothing and throw nothing. Write a regex with a `\b` into a file with the Write tool, not a heredoc, and use `\\b` inside a template literal.

**And line endings are mixed, not uniform.** An earlier note here claimed `lib/game/combat.ts` was the only CRLF file in the repo. **It is not** — measured 2026-09-17, **55 of 327 source files are CRLF**, including `store/playerStore.ts`, `hooks/BattleProvider.tsx`, `components/ui/TopNav.tsx` and twenty test files. A patch script that asserts LF, or anchors on LF-only text, fails or silently misses on any of them — the `wave`->`fight` rename died half way through on exactly this. **Read and write with `newline=''` so a file keeps the endings it had**; do not normalise in passing, or the real change drowns in an unreviewable diff.

**Every field added to `playerStore` needs a cloud-sync decision, and the decision has to be written down.** A field persists to localStorage automatically and syncs to Firestore only if it is named in `CLOUD_FIELDS` (`lib/game/cloudSave.ts`), so "not synced" used to be the silent default. `clearedEvents` and `autoClearTickets` were added on 2026-08-13 and missed by the sync pass that same day: a second device re-demanded a manual clear before Auto Clear would unlock **and paid the first-clear bundle a second time** — the identical defect that pass had just fixed for `claimedOrders`. Signing out and back in on one device reproduced it, since `AuthProvider` resets local state on sign-out. Every persisted field must now appear in `CLOUD_FIELDS` or `DEVICE_LOCAL_FIELDS`, and `tests/cloudSave.test.ts` fails the build when one appears in neither.

**`test:browser` is outside `check`, so a shipped number can go stale there unseen.** `hand.browser.test.tsx` asserted the retired 56px hand-card floor and was red on `master` from the commit that changed it to 44 until 2026-09-16, because the checkpoint ran `check` alone. **Run `npm run test:browser` at the point a number it pins actually moves**, not only before shipping pointer-dependent work.

## Engine Rules (see docs/ARCHITECTURE.md for detail)

- `executeSkill` (lib/game/combat.ts) is pure: takes teams, returns new teams.
- `Action.rank` (1–3) scales `damageRanked` and `*Ranked` mechanic values; flat mechanic values do not scale; ultimates have no rank.
- Any non-heal skill with damageRanked > 0 deals damage regardless of skill type.
- Actions per turn = living field members + 1, capped at 3 — **both sides**
  (`lib/game/actionEconomy.ts`). A side with `tier: "elite"` present always gets
  the full 3, so a lone boss still acts three times. Any living unit, any order.
- Effect durations: duration N survives N−1 turn-start ticks.
- Sub (bench) units (`BattleCharacter.isSub`): passive active, no cards, untargetable, can't act; promoted to field only at turn start after a teammate died (`lib/game/sub.ts`). Battle format (4v4/3v3) sets the field cap; the 4th unit in 3v3 is the sub automatically.

## How work is judged, and who owns what

**His three engineering values, in his order: consistency, modularization, QOL**
(ruling #139, 2026-09-17). **"It works" is not the bar.** A change that adds a
seventh variant of an existing button is a regression against *consistency* even
though the feature ships; a fix landing in one screen rather than in the shared
primitive is a regression against *modularization*. **QOL** is specifically the
affordances that make a feature usable rather than merely functional — *"when you
create a new table, without QOL you don't add any search field, you don't add any
filters, sort options, animations"*. `components/game/CharacterBrowser.tsx` is the
benchmark: search, sort, filter sheet, active-filter count.

**The split, precisely (#139).** Claude owns **site structure and data types** —
schemas, naming, architecture, what is measurable — and implements his UX
direction, which is programming rather than design. **He owns UI and UX
direction**, story, mechanics, kits, numbers and characters. **Claude does not
originate UX direction**: the mobile rules below are the *record* of his
direction, not licence to invent more, though pointing out a screen that breaks
one is measurement and is welcome. One invitation-only carve-out: he may ask for
**names or kits for low-significance characters** (NPCs), by request only — it
never loosens #65 and never reaches a character who matters to the story.

**A dominant strategy is a missing counter, not a defect** (ruling #138). The
game is built on counterplay cycles — *"there will never be a problem that will
interfere in the game for too long. We will always have a solution in some shape
or form."* When a measurement shows something dominating, report it as **"X
currently has no counter"** with the interaction named. **Never propose a nerf**,
never call it a defect or an exploit, and never tune an encounter to route around
a kit he can change himself. Naming an unanswered strategy tells him where the
next mechanic goes.

**A green suite is not a working screen — open the page when he grants a
browser.** On 2026-09-17, with **1,506 tests passing**, ten minutes of looking
at `/events` at 390x844 found two defects no test could have caught:

- The First Ascension Trial was **unenterable**. The brief gated its Enter
  button on `!!event.enemyId`, which is **null on a trial** — while
  `eventLockReason` reported the same trial as unlocked. **Two conditions
  answering one question**, and only one was updated when trials gained
  encounters. A test asserted the lock reason; the screen used the other check.
- The trial brief was **boss-shaped** — a world-level difficulty ladder over
  copy about drop tables and auto clear, on a `repeatable: false` event that
  has none of them.

Both are the same shape: a second code path that quietly disagrees with the one
under test. **Tests pin what you thought to check; the screen shows what you
did not.** Browser access is granted per session and never carries over — when
it is granted, spend some of it looking at the screens that changed, not only
at the ones you built.

**Verify on a scratch build, never on his server.** `NEXT_DIST_DIR=.next-verify
npx next build`, then `npx next start -p 3210`; kill by PID from `netstat`,
remove `.next-verify`, and `git checkout tsconfig.json`. To reach gated content,
edit `toll-player-storage` in the browser's own localStorage rather than
touching `data/` — it is that viewer's copy and nothing in the repo changes.

**Plan in detail first, build second.** The mobile pass worked because he
specified every section — down to card and deck sizes — *before* implementation,
and it took **four passes** (#107, #118–120, #123–126, plus 2026-09-16
corrections) rather than one. The ascension trial was built before that
conversation happened, which is why ruling #136 is marked PROVISIONAL. For a
feature with any design content, write the plan with him first.

## Design Ownership

Tanveer owns skill names, mechanical effects, damage multipliers, and character-kit JSON decisions. Do not invent or rebalance mechanics unprompted — ask. **He also picks which characters get drafted** — never self-select one.

**Filler story content is allowed since 2026-08-18 (ruling #108), under approval.** Claude may draft filler stages, scenes and NPCs so story mode has enough to play — but **nothing enters the game unapproved**, filler must never contradict or resolve canon (source: `E:\Toll - Web toon`), and **NPC kit numbers stay his**: draft the role, personality and combat concept, then ask. Approved content is recorded in `Filler/Approved_chapter_N.md`, proposals and rejects in `Filler/Drafts.md`, and every filler stage and scene carries `origin: "filler"` in the JSON.

**Before drafting or rebalancing any kit, read `docs/design/KIT_DESIGN.md`.** It carries the stat bands, the wording rules, and the constraints that are easy to get wrong: buffs multiply so magnitudes stay small (self-buff 25/50/75, team-wide 20/30/50), one scaling stat per kit including heals, skill ranks never exceed 3, and inflating a stat silently buffs anything that scales off it.

**A new event needs two answers, not one** (ruling #127, 2026-09-01). *When may it be seen* and *when may it be entered* are separate questions, and the events on the board answer them differently — the First Ascension Trial is visible at rank 1 and locked until 20, the Second is withheld entirely until the First is cleared. **Ask him for both before authoring an event**, and expect to ask: he said to log this so the question gets put to him if he forgets to volunteer it. `GameEvent.visibleWhen` carries the first; `requiredRank` and `eventLockReason` carry the second.

**Character stat bands changed on 2026-08-10** (ruling #68): HP now sits at 2900–4000, ATK broadly unchanged, DEF ~1.6x its old value. `data/characters/*.json` is the source of truth — statlines quoted in older docs and in `author_notes.md` predate this.
