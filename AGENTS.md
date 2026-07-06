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
app/                  Next.js App Router — /, /practice, /archive, /archive/[id], /login, /profile
components/
  ui/                 shadcn primitives + KeyworkHighlighter
  game/               BattleArena, Deck, CharacterBrowser, BattleEffectsOverlay
hooks/                BattleProvider (phase engine), MechanicProvider (phase queue), AuthProvider
lib/
  firebase.ts         Optional Firebase init (null exports without env)
  game/               combat.ts, damage.ts, ai.ts, passive.ts, tick.ts,
                      damagePreview.ts, descriptionTranslator.ts, characterCatalog.ts
store/                gameStore.ts (battle + deck), playerStore.ts
data/characters/      Character kit JSON (source of truth for kits)
types/                Shared TypeScript contracts
tests/                Vitest unit tests for the battle engine
```

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm run test`

## Engine Rules (see docs/ARCHITECTURE.md for detail)

- `executeSkill` (lib/game/combat.ts) is pure: takes teams, returns new teams.
- `Action.rank` (1–3) scales `damageRanked` and `*Ranked` mechanic values; flat mechanic values do not scale; ultimates have no rank.
- Any non-heal skill with damageRanked > 0 deals damage regardless of skill type.
- Enemy side takes 3 actions per enemy turn — any living enemy, any order.
- Effect durations: duration N survives N−1 turn-start ticks.
- Sub (bench) units (`BattleCharacter.isSub`): passive active, no cards, untargetable, can't act; promoted to field only at turn start after a teammate died (`lib/game/sub.ts`). Battle format (4v4/3v3) sets the field cap; the 4th unit in 3v3 is the sub automatically.

## Design Ownership

Tanveer owns skill names, mechanical effects, damage multipliers, and character-kit JSON decisions. Do not invent or rebalance mechanics unprompted — ask.
