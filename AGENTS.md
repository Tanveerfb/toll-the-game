<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# toll-the-game — Project Documentation

Turn-based card battle game for the Element Clash IP. **Agents: read `docs/HANDOFF.md` first** — context, design rulings ledger, working style. Architecture in `docs/ARCHITECTURE.md`; current state in `docs/STATUS.md`; plan in `docs/ROADMAP.md`; art generation in `docs/ART_PIPELINE.md`.

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
| Vitest              | Unit tests (`tests/`)                            |

**UI rule: HeroUI was removed 2026-07-06 — do not reintroduce it.** UI primitives live in `components/ui/` (shadcn). Add new ones with `npx shadcn@latest add <component>`.

## Folder Structure

```
app/                  Next.js App Router — /, /practice, /story, /world-boss, /gacha,
                      /archive, /archive/[id], /archive/npc, /news, /login, /profile
components/
  ui/                 shadcn primitives + KeyworkHighlighter + prose.tsx (document
                      typography, shared with mdx-components.tsx)
  game/               Deck, CharacterBrowser, KitDetails, SkillDocument, TeamSelect,
                      PlayerHud, BattleArena (arena shell only)
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
data/story/           Story parts; data/banners/ gacha banners
types/                Shared TypeScript contracts
tests/                Vitest unit tests (engine, stores, gacha, previews)
```

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm run test`

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

**Before drafting or rebalancing any kit, read `docs/design/KIT_DESIGN.md`.** It carries the stat bands, the wording rules, and the constraints that are easy to get wrong: buffs multiply so magnitudes stay small (self-buff 25/50/75, team-wide 20/30/50), one scaling stat per kit including heals, skill ranks never exceed 3, and inflating a stat silently buffs anything that scales off it.

**Character stat bands changed on 2026-08-10** (ruling #68): HP now sits at 2900–4000, ATK broadly unchanged, DEF ~1.6x its old value. `data/characters/*.json` is the source of truth — statlines quoted in older docs and in `author_notes.md` predate this.
