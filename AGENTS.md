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
- **Anything explanatory uses `components/ui/Hint.tsx`, never a `Tooltip`.** A radix `Tooltip` on a `<span>` fires on neither tap nor focus, which is how the whole mechanic glossary came to be invisible on a phone. `Hint` is a `Popover` with a real button trigger and **one interaction on every device: click, tap or keyboard**. It does *not* open on hover — that was built first and removed the same day, because a mouse fires `pointerenter` before `click`, so hovering opened it and the click closed it again (`tests/hint.browser.test.tsx`). `tests/touchTargets.test.ts` forbids `TooltipTrigger` outside the primitive.

**No mobile debt is outstanding.** The 2026-08-21 sweep took every screen, battle included: its controls moved off a side rail into a sheet, hand cards floor at 56px, merge arms from a button, and press-and-hold opens a card's or a unit's details — the gesture set is **tap = act, hold = explain** (#118). `docs/design/mockups/battle-mobile.html` records those decisions. None of it is browser-verified; the visual pass is his.

## Folder Structure

```
app/                  Next.js App Router — /, /practice, /story, /world-boss, /gacha,
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
                      characterCatalog.ts, characterVfx.ts, battleLogMarkdown.ts
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
- `npm run sim -- <left> <right>` — headless balance simulation across all four formats (ruling #57). `npm run sim -- --roster <id>` sweeps one kit against the whole roster. **Read the limits at the top of `lib/game/simulate.ts` before quoting a number**: no card draw, AI plays both sides, base stats only.

## Engine Rules (see docs/ARCHITECTURE.md for detail)

- `executeSkill` (lib/game/combat.ts) is pure: takes teams, returns new teams.
- `Action.rank` (1–3) scales `damageRanked` and `*Ranked` mechanic values; flat mechanic values do not scale; ultimates have no rank.
- Any non-heal skill with damageRanked > 0 deals damage regardless of skill type.
- Actions per turn = living field members + 1, capped at 3 — **both sides**
  (`lib/game/actionEconomy.ts`). A side with `tier: "elite"` present always gets
  the full 3, so a lone boss still acts three times. Any living unit, any order.
- Effect durations: duration N survives N−1 turn-start ticks.
- Sub (bench) units (`BattleCharacter.isSub`): passive active, no cards, untargetable, can't act; promoted to field only at turn start after a teammate died (`lib/game/sub.ts`). Battle format (4v4/3v3) sets the field cap; the 4th unit in 3v3 is the sub automatically.

## Design Ownership

Tanveer owns skill names, mechanical effects, damage multipliers, and character-kit JSON decisions. Do not invent or rebalance mechanics unprompted — ask. **He also picks which characters get drafted** — never self-select one.

**Filler story content is allowed since 2026-08-18 (ruling #108), under approval.** Claude may draft filler stages, scenes and NPCs so story mode has enough to play — but **nothing enters the game unapproved**, filler must never contradict or resolve canon (source: `E:\Toll - Web toon`), and **NPC kit numbers stay his**: draft the role, personality and combat concept, then ask. Approved content is recorded in `Filler/Approved_chapter_N.md`, proposals and rejects in `Filler/Drafts.md`, and every filler stage and scene carries `origin: "filler"` in the JSON.

**Before drafting or rebalancing any kit, read `docs/design/KIT_DESIGN.md`.** It carries the stat bands, the wording rules, and the constraints that are easy to get wrong: buffs multiply so magnitudes stay small (self-buff 25/50/75, team-wide 20/30/50), one scaling stat per kit including heals, skill ranks never exceed 3, and inflating a stat silently buffs anything that scales off it.

**Character stat bands changed on 2026-08-10** (ruling #68): HP now sits at 2900–4000, ATK broadly unchanged, DEF ~1.6x its old value. `data/characters/*.json` is the source of truth — statlines quoted in older docs and in `author_notes.md` predate this.
