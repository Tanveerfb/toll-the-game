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
16. **Crit** (2026-07-07): base crit chance 0% for everyone; a crit proc applies the full CRITICAL package (50% DEF ignore, type-immune, +50% damage). Currently sourced by Meliodas's Deathblow.
17. **Counters** (Full Counter): the attacked unit still takes the damage, then counters — unless the hit killed it. Counters don't chain.
18. **Extort**: per-stat mapping (stolen ATK→ATK, stolen DEF→DEF), self-gain lasts as long as the enemy debuff, recasting refreshes (never stacks). Ult Extort = 50% for 2 turns.
19. **Extort Life**: full revert — taking ANY damage (incl. DoT/counters) restores enemy max HP and zeroes the stacks; no free heal on revert (current HP keeps its clamped value).
20. **Stat buffs/debuffs are real**: effective ATK/DEF (`lib/game/stats.ts`) = current stat × percent entries + flat entries. `preApplied` entries are display badges for already-baked gains (synergy, ramps) and are skipped.
21. **Literal effect durations** (2026-07-11, replaces old tick semantics): "N turns" means exactly N procs / N blocked turns. Harmful effects (debuffs, DoT, stun, seal) tick at the END of the victim's team turn — the victim always gets their own turn to cleanse before a proc lands. Beneficial effects (buffs, stances, HoT) tick at the START of the owner's team turn — a 1-turn buff protects through the whole opposing turn. His walkthrough: "t1 player (applies debuff) -> t1 enemy -> debuff procs once -> t2 player -> t2 enemy -> debuff procs and then expires -> t3 player".
22. **Self-buff-then-hit order** (2026-07-11): a skill that raises the caster's stats and deals damage applies the buff BEFORE the damage calc — the same strike benefits (Gon's Jajanken Rock, both HxH ults).
23. **Undurationed ult stat raises are permanent** (2026-07-11): Gon/Killua ult +30% raises last the rest of the battle and stack.
24. **Kind Hearted Friend semantics** (2026-07-11): base +10% is decided once at battle start if Gon OR Killua is a team member (sub counts, survives their death); the extra +10% is dynamic — active only while both are alive on the field, drops when one dies.
25. **Effect pill colors on hover keywords** (2026-07-11): red = attack-based effects, purple = debuffs (incl. attack-applied ones), green = heals + cleanses, yellow = stances, white = cancels. S1/S2 chips follow the same scheme; ULT stays yellow. Keep skill text short — mechanics stay a mystery for players to discover.
26. **Dokkan description wording** (2026-07-11): tiered words replace numbers — "raises" (<50%), "greatly raises" (50–79%), "massively raises" (80%+), same tiers for "lowers". Hovering the word shows that skill's exact values (per-rank dynamic glossary). No "own" — a raise always means the skill user. Effects are cancellable and stackable by default; exceptions are called out in the description text. Hover tooltips show the percentage ONLY (e.g. "Increases ATK by 30%") — duration and flags belong to the text.
27. **One pill per unique effect** (2026-07-11): a skill description gets exactly one hover pill per distinct effect/modifier — phrase-level keys ("cancels buffs and stances", "cancels stances") instead of pilling every word; generic words like "stance" are not glossary keys. **Pierce is a flat 50% DEF ignore for every card** — no per-card pierce values anymore.
28. **Explicit permanence + semicolon clauses** (2026-07-11, amends #26): permanent stat changes say it — "Permanently raises ATK" — instead of implying it by omitting a duration; the permanence prefix joins the pill ("Permanently raises ATK and DEF" is one pill). Semicolons separate the distinct parts of a skill description ("Permanently raises ATK; greatly raises DEF for 1 turn; then does 500% ATK damage to one enemy."). Applied roster-wide.
29. **Lethal survival catches DoT deaths; revivals cleanse everything** (2026-07-11): Nine Lives triggers on lethal DoT procs too (`trySurviveLethal` in `lib/game/lethal.ts`, shared by combat.ts and tick.ts). On ANY revival/survival trigger the unit loses ALL buffs and debuffs, uncancellable included — the rule applies to every future revival mechanic.
30. **Uncancellable entries are "effects", not buffs/debuffs** (2026-07-11, playtest): synergy bonuses, ramp stacks, and every other uncancellable entry don't count for buff/debuff-counting mechanics (Rupture, Amplify, Weakpoint), can't be cleansed, and don't trigger AI cleanse decisions. They still modify stats. UI shows them grey (◆ counter, "Effects" section) — helpers in `lib/game/effects.ts`.
31. **Cancelling stances breaks the target's taunts** (2026-07-11, playtest): cancelStances/cancelBuffs on a unit also removes every taunt redirect marker that unit authored (taunt debuffs on the opposing team with its sourceId). Yalina's Attention Drawer is a real stance now.
32. **Extort is a linked pair** (2026-07-11, playtest): the thief's self-buff lives only while at least one LIVING enemy still carries a matching Extort debuff (tagged with the thief's sourceId). Death, cleanse, or expiry of the last debuff drops the buff — `syncExtortLinks`, run after every action and every debuff tick.
33. **Deck QoL** (2026-07-11, playtest): Reset Hand button rewinds the hand to the turn start — queued actions return, selection-time merges are reversed, merge-granted ult gauge is refunded (`snapshotHand`/`resetHand`, snapshot taken as PlayerAction opens). Leftover cards auto-merge whenever queuing/unqueuing makes identical neighbors adjacent (same rule as draws). Battle screen page gets a user-friendliness overhaul in a future batch, once all mechanics work as expected.
34. **Momentum is field-only, fed by every card** (2026-07-11, playtest 2): Yalina gains a Momentum stack from EVERY card her team plays — including her own — but only while she is on the field (not benched) and alive.
35. **Tag synergies without `flatBonus` scale per carrier** (2026-07-11, playtest 2, confirms existing data): Sara's [Female] synergy is 5% damageDealt × number of Female carriers (15% with 3 Females), applied to every carrier. Synergy entries are named `[Tag] Synergy` in the UI (typed `buff`, never `amplify`).
36. **damageDealt / damageReduction stack multiplicatively** (2026-07-11, closes old STATUS #19): the damage engine consumes both — outgoing damage × ∏(1 + damageDealt%/100) from the attacker's entries, then × ∏(1 − damageReduction%/100) from the target's (`getDamageDealtMultiplier`/`getDamageReductionMultiplier` in `lib/game/stats.ts`, applied at the end of `calculateDamage`, counters included). Two 40% DRs = 64% total reduction, diminishing returns.
37. **"Permanently" implies cancel-proof** (2026-07-11, closes old STATUS #17): permanent stat raises (Gon/Killua ults) stay `uncancellable` in data — buff-cancels can't strip them, and they render as grey effects per ruling #30. Text needs no extra "(cannot be cancelled)".
38. **Extort recasts OVERWRITE, never stack** (2026-07-11, playtest 2): a new Extort strips the thief's previous Extort debuffs from every opposing unit before applying — even if the old steal was more potent. The self-buff is rebuilt from the new steal only.
39. **Enemy actions scale with living field members** (2026-07-11, playtest 2, amends #4): the enemy side takes 1 action per living field member, capped at 3 (`enemyActionsForTurn`). Subs grant no actions.

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
