# Agent Handoff — Toll the Game

Read this first. It exists so a fresh agent can work on this project without re-deriving context.

## What This Is

Turn-based card battle webapp (Element Clash IP), heavily inspired by **Seven Deadly Sins: Grand Cross** (card/merge system) and **Dokkan Battle** (card art, story-mode structure). Solo developer: **Tanveer** (`tanveerfb@gmail.com`). The game is the only active track of the IP — a webtoon/animation track existed and was **dropped**; never plan around it.

## The One Rule That Matters

**Tanveer owns game design.** Skill names, mechanical effects, damage multipliers, character kits, balance — all his. You implement, document, and build UI. When a kit or mechanic is ambiguous, **ask him** (he explicitly welcomes kit questions) — do not invent numbers or rebalance. UI/frontend/code architecture decisions are yours to make, professionally organized, space-efficient (dokkaninfo.com is his reference for data-heavy pages).

## Orientation

| Doc | Contents |
|---|---|
| `README.md` | Stack, setup, routes, layout |
| `docs/ARCHITECTURE.md` | How the battle engine works end to end — **read before touching `lib/game/` or `hooks/`** |
| `docs/STATUS.md` | Living snapshot: what works, open issues |
| `docs/ROADMAP.md` | Phased plan with completion history |
| `docs/ART_PIPELINE.md` | AI art generation: model, prompt template, seeds, per-character notes |
| `AGENTS.md` | Condensed rules (loaded automatically by most agent harnesses) |

## Design Rulings Ledger (all from Tanveer, don't re-litigate)

1. Card rank (R1–R3 via merging, 7DSGC style): scales `damageRanked` AND `*Ranked` mechanic values; flat values (weakpoint ×3, amplify 10%) never scale; ultimates have no ranks (ult level-up system MAY come later).
2. Ultimates are stronger than any R3 skill in power and utility.
3. Any non-heal skill with `damageRanked > 0` deals damage regardless of skill type.
4. Enemy side takes **3 actions per turn** — any living field enemy, any order, no pattern.
5. Duke's Flowing Ruin: skills AND ultimate build stacks (max 3) and can consume; empowered action = +50% damage + 20% ATK-down (2 turns) on **every** target hit.
6. Teams: any 1–4 units. Format 4v4 = all field; 3v3 = 4th member is the sub **automatically**. Lone sub auto-converts to field.
7. Subs: passive active from bench; no cards; untargetable; enter the field **only at the start of a new turn** after a teammate died.
8. Deck: loads field units' cards at battle start; **never resets**; refills one random card at a time with **auto-merge on adjacent identical cards** (+1 gauge per merge) until full; no deck interaction outside the player's turn; a gauge filled mid-refill guarantees the ult **next turn**, never the same refill.
9. UI stack is **shadcn/ui + Tailwind 4** (HeroUI removed — never reintroduce).
10. Art is **fully AI-generated** (no salvaged assets), style = Dokkan card art × 7DSGC renders. Tanveer supplies locked designs or blueprints for characters that lack one; generate from those via `docs/ART_PIPELINE.md`. Mustafa + Siddiq arts are AI-invented placeholders awaiting his designs.
11. **Type advantage** (2026-07-07): Dark > Light > Dark (mutual); Red > Green > Blue > Red. Advantage +20% damage, disadvantage −10%, neutral ±0. Applies to all attacks; CRITICAL attacks ignore it both ways.
12. **Evade** (= dodge, same thing): base 0% for **everyone**; only passives/buffs add it. An evaded attack deals no damage and applies no effects. More evade characters may come.
13. **Shock**: each application is an independent, cleansable DoT worth 30% of the damage dealt by the applying hit, 4 turns.
14. **Synergy scope**: tag-based synergies (e.g. Seras's [Powerful Opponent] +10% all stats) apply to *every* teammate carrying the tag; Seras's is flat (not per-carrier scaling like Batra's KHALSA).
15. New character kits arrive via the template at the top of `newchars.md`; once implemented, the kit is removed from that file (`data/characters/*.json` becomes the source of truth).

## Working Style He Expects

- Work **batch by batch**; commit per batch with tests + lint + build green; update `docs/` in the same commit.
- Use up-to-date packages; verify with context7 MCP, not training data. Firebase MCP has access to his account (project `toll-the-game`) for env/config.
- He was burned by this project before ("more headaches than progression") — don't create friction: verify in-browser (Playwright MCP) before claiming done, keep the engine pure/testable.
- Repo history note: the repo was once "decommissioned" (`027843f`) and resurrected (`c3040f7`). If something looks deleted, check git history before recreating it.

## Dev Loop

```bash
npm run dev     # localhost:3000 (kill stale servers on 3000 first)
npm run test    # vitest, tests/ — keep green
npm run lint    # eslint 9
npm run build   # must pass before commit
```

- Engine logic lives in `lib/game/` as pure functions — test them in `tests/`, don't bury logic in React.
- `hooks/BattleProvider.tsx` = phase machine + turn resolution; `store/gameStore.ts` = battle/deck state (Zustand, directly testable).
- Character kits = `data/characters/*.json` (source of truth; numbers belong to Tanveer).
- Art generation: start ComfyUI (`E:\Installed\ComfyUI_windows_portable\run_nvidia_gpu.bat`), follow `docs/ART_PIPELINE.md`, register new art in `lib/game/characterArt.ts`.

## Gotchas

- Windows: PowerShell 5.1 quirks; `app/archive/[id]` brackets break some tools' globbing — use `-LiteralPath`.
- CRLF warnings on commit are normal noise.
- TypeScript 6 / ESLint 10 deliberately NOT installed (Next 16 support unconfirmed at the time).
- `.env.local` (gitignored) holds `NEXT_PUBLIC_FIREBASE_*`; without it the app runs guest mode by design.

## Where Work Stops Currently

See `docs/ROADMAP.md`. Short version: Phase 2 nearly done (mobile pass + sound remain); Phase 3 (story mode, more characters) blocked on Tanveer's kit/stage designs; Phase 4 = auth persistence + Vercel deploy.
