# Plans

Specced-but-unbuilt work. Tanveer builds these in **dedicated sessions** — don't
start one mid-conversation.

Every file here is written to be executed cold: what prompted it, what the code
does today with file:line, what is already done so nobody redoes it, what is
still his to decide, and how to verify. A plan whose code has since changed is
**stale and says so, or goes** — same rule as the project skills.

**`project-rules.md` §SPECS (v3.4.0) names `docs/specs/` for this job.** The
next plan is written there; this folder moves when it is next emptied
(`conventions.md`, "v3 sections").

## Open — sorted 2026-10-13

| Plan | Status | What is left |
| --- | --- | --- |
| [`2026-09-16-pve-structure.md`](2026-09-16-pve-structure.md) | **His vision, in his words.** Not a build plan | Read before any PvE content work. Nothing to build from it directly |
| [`2026-09-17-character-headings.md`](2026-09-17-character-headings.md) | 23 of 31 approved, 2 in workshop, 6 open (the generics) | His picks on the open eight; then the data change |
| [`2026-09-17-code-quality-audit.md`](2026-09-17-code-quality-audit.md) | Measured 2026-09-17; the layout items (L1–L7) are built, the rest is queued in `conventions.md` (M2, S2, Q1…) | Nothing to pick up on its own: `conventions.md` is the live queue |
| [`2026-09-17-fight-phases.md`](2026-09-17-fight-phases.md) | Approved in principle, not built | The build, in a dedicated session |
| [`2026-09-17-growth-modal.md`](2026-09-17-growth-modal.md) | Proposal, nothing built. Growth became a bottom sheet on 2026-10-03 (#180), which changes the page the proposal measured | Re-measure before building; may be moot |
| [`2026-09-26-foundation-audit.md`](2026-09-26-foundation-audit.md) | F1–F5, S1, L2–L3 done; **S2, S3-rest, P1–P3, L1, T1, Q1, Q4, C2 open** | He takes them one section at a time |

## Completed

Each file is kept as written — the record of what was decided and why — and
none describes unbuilt work any more.

| Spec | What shipped |
|---|---|
| [substat-stats-arrays](completed/2026-08-20-substat-stats-arrays.md) | `entryTouchesStat` with an explicit "does `all` count?" flag; `getDamageDealtMultiplier` and `getDamageReductionMultiplier` now read `stats` arrays; evade and damage reduction read debuffs, clamped |
| [placeholder-disambiguation](completed/2026-08-20-placeholder-disambiguation.md) | `[x-ranked.duration]` — positional refs take a field, so two mechanics of the same type are both addressable. Zero-clause dropping (#44) follows |
| [guard-and-effective](completed/2026-08-20-guard-and-effective.md) | `resolveTypeModifier` (ruling #111). Guard on the defender, Effective on the skill, both cancelling to 1.0; `critical` bypasses both by construction. **No kit authors either word — that is his call** |
| [passive-structure](completed/2026-08-20-passive-structure.md) | One passive made of blocks, one registration per block, `lib/game/passiveBlocks.ts` as the only reader. Plus `targetTagBonus`, an attacker's passive reading the target's tags (ruling #114) |
| [mechanic-application](completed/2026-08-20-mechanic-application.md) | **Part A** `applyTo` / `applyToRanked` with self as the default audience (ruling #112); **Part B** `requiresDamage`, a self buff that lands after the hit and only once (ruling #113) |
| [layout-system](completed/2026-09-17-layout-system.md) | `Screen`, `Panel`, `SectionHeader`, the width and tracking tokens; every screen renders through `Screen` (2026-09-26). Its Q-a to Q-d were folded into the 2026-10-03 four-values audit |
| [shonen-ink-foundation](completed/2026-09-26-shonen-ink-foundation.md) | One token set, shadcn for every control, Combat Terminal deleted (2026-09-27). The look itself is under redesign since 2026-10-13 (#185); the foundation stands |

### Deliberately left out of those builds

- **`aoe` narrowing to enemies-only** (mechanic-application A4d). A heal skill's
  targets still come from `aoe` plus the skill type, because a heal amount has
  no audience of its own — narrowing `aoe` first would aim every ally heal at
  the enemy team. `aoeRanked` stays on Leorio and Siddiq for the same reason.
  Recorded in ruling #112.
- **Rewriting Molvarr's phase passives as blocks.** The array form still loads
  and flattens identically; converting it is authoring cosmetics with real
  transcription risk, and buys nothing the block reader doesn't already give.
- **Guard stacking.** Built as a fixed floor — a second source of Guard changes
  nothing. Still unconfirmed by him (`completed/2026-08-20-guard-and-effective.md` §5).

## Highest-value thing not yet specced

**Counting the character's own attacks.** Three separate Dokkan passive blocks
collapse into this one missing mechanic, and Tanveer rewrote a fourth around it
(*"every time after launching 4 attacks in battle"*), which removes the need for
an on-enter trigger entirely.

The shape is well established — repeating, capped, stat-shifting — but every
existing counter has the wrong subject: `statShiftAfterAttacks` and
`chargedStacks` count attacks **received**, `momentumStacks` counts cards the
**team** plays. Nothing counts what this character did.

Details in [passive-structure §5](completed/2026-08-20-passive-structure.md),
recorded as roadmap rather than as a gap.

## Verification, for anything new

- `npm run check` — the baseline is in `docs/STATUS.md` ("Verified").
- Build with `NEXT_DIST_DIR` set. **:3000 is his dev server — never start or kill
  one.**
- **The visual pass is his.** Several of these touch `lib/game/combat.ts`, the
  most ruling-dense file in the repo; a green suite is necessary and not
  sufficient there.

## Moved out

- `2026-09-20-arc-one-manifest-rework.md` → `docs/archive/` (2026-10-13): story
  mode was removed on 2026-09-26 (#152), so the manifest it reworks has no
  consumer until story returns.
