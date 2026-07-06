# Status Audit — 2026-07-06

Snapshot of where the codebase actually is, from a full code survey. Repo was "decommissioned" in commit `027843f` (2026-05-04): package.json, lockfile, tsconfig, next/postcss/eslint configs, README, AGENTS.md removed. **All source code survived** (49 tracked files). Configs are being restored from `5bce3ad` (the last working commit).

## What Works (implemented and coherent)

- **Battle phase engine** — full state machine with automated tick phases, win/loss detection, 4v4 test battle from `/practice`.
- **Deck system** — draw with per-team-size hand caps, guaranteed ultimate draws at full gauge, card merging (manual + drag-adjacent auto-merge), rank 1–3, ult gauge economy, dead-character card cleanup.
- **Combat resolution** — targeting (single/AoE/taunt redirect), stat-scaled damage with rank substitution, pierce/ignite/detonate/weakpoint damage formula, on-hit mechanics (stun, decay, ignite stacks, gauge drain, cancels, stat debuffs), heals/buffs/stances/cleanses.
- **Dynamic damage styles** — spite, concentrate, amplify, momentum (Yalina), consumeIgnite (Tao).
- **Passives** — battle-start synergies/auras (KHALSA, FEMALE, Gabrist aura), beforeSkill HP consume (Batra), onFirstAction (Lyra), onLethalDamage survive (Sara), onDamageDealt lifesteal (Siddiq).
- **9 character kits** in JSON, matching `_dev/new_chars_DONE.md` specs.
- **UI** — main menu, battle arena, deck with previews and translated descriptions, character archive.
- **Enemy AI** — priority-based skill selection with taunt respect.

## Known Gaps / Issues (found in survey, not yet fixed)

| # | Issue | Where | Severity |
|---|---|---|---|
| 1 | Mechanic values don't scale with card rank — `normalizeMechanic(m, 0)` always uses rank index 0; only `damageRanked` gets rank substitution (in `BattleProvider`) | `lib/game/combat.ts:146-150` | High — rank system half-wired |
| 2 | Duke's passive incomplete — Flowing Ruin stacks accumulate (`afterSkill`) but the 3-stack consume/empower/ATK-debuff effect is never applied | `lib/game/combat.ts:496-500` | High |
| 3 | Enemy turn resolves only the FIRST AI action, then advances phase — with 4 enemies, 3 never act | `hooks/BattleProvider.tsx:303-333` | High (unless intentional 1-action-per-round design — Tanveer to confirm) |
| 4 | Menu links to `/login` and `/profile` — routes don't exist, 404 | `app/page.tsx:17` | Medium |
| 5 | `require()` for character JSON inside client component — brittle under Turbopack/App Router | `hooks/BattleProvider.tsx:335` | Medium |
| 6 | Ultimates have no rank (always full value) while skills rank up — consistent with `UltimateCard` type, but worth confirming intended | `types/ultimateCard.ts` | Low (design question) |
| 7 | `Character.passive: any` and pervasive `as any` casts around mechanics — type safety hole across the engine | `types/character.ts:17` | Medium (refactor) |
| 8 | No tests of any kind. Combat engine is pure-functional and highly testable | — | Medium |
| 9 | Stun ticks down on turn start — a "2 turn" stun applied during player action decays at next turn start; verify durations behave as designed | `hooks/BattleProvider.tsx:174-183` | Low (verify) |
| 10 | `mergeDeckCard` removal-index ternary has identical branches (harmless, works correctly) | `store/gameStore.ts:399-400` | Cosmetic |
| 11 | 4 MB background PNG shipped raw | `public/bg-images/` | Cosmetic |

## Not Built Yet (product scope)

- Team selection (practice battle uses hard-coded 4v4 roster)
- Story mode (menu button disabled)
- Login/profile pages (Firebase auth context exists, no UI)
- Player progression/collection (playerStore is a stub)
- Card art integration (Leonardo pipeline assets exist in `element_clash_assets`)
- Deployment (no hosting configured; `.vercel`/`.open-next` dirs exist from past experiments)

## Environment Notes

- Node 24 local. Deps updated 2026-07-06 (see ROADMAP Phase 0). Known remaining `npm audit` finding: postcss <8.5.10 nested inside `next` — upstream issue, wait for a Next.js patch release.
- Firebase config in `.env.local` (gitignored); app runs in guest mode without it.
- `.next` build cache exists; safe to delete.
- `data/index/characters.json` lists the roster for the archive browser.
