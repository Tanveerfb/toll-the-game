# lib/game — the engine, the simulator and the save

Loaded when work touches this folder (project-rules §SCALE). The root
`AGENTS.md` holds the project-wide rules; this file holds only what is true
of the engine, and each fact lives here alone. `docs/ARCHITECTURE.md` is the
map. Moved out of `AGENTS.md` on 2026-10-13, his yes.

## Engine rules

- `executeSkill` (`combat.ts`) is pure: takes teams, returns new teams.
- `Action.rank` (1–3) scales `damageRanked` and `*Ranked` mechanic values;
  flat mechanic values do not scale; ultimates have no rank.
- Any non-heal skill with `damageRanked > 0` deals damage regardless of
  skill type.
- Actions per turn = living field members + 1, capped at 3 — **both sides**
  (`actionEconomy.ts`). A side with `tier: "elite"` present always gets the
  full 3, so a lone boss still acts three times. Any living unit, any order.
- Effect durations: duration N survives N−1 turn-start ticks.
- **Every unit is built by `buildBattleUnit` (`buildUnit.ts`) and every stat
  goes through `battleStats`: catalog (or phase) → progression → stage
  effects.** The battle, the simulator, a boss's phase change, the boss brief
  and the team picker all use it. A second path is how Molvarr's second phase
  ignored difficulty for weeks (2026-09-26); never build combat stats any
  other way.
- **A battle belongs to the screen that started it** (ruling #153;
  `BattleOwner`, persisted with the battle). `BattleLock` holds the player on
  that screen until the battle is resolved, reload included — his rule:
  *"they should not be allowed to go anywhere else and ignore the battle."*
  A new screen that launches fights passes `owner` to `startCustomBattle`
  and rebuilds its view from it.
- Sub (bench) units (`BattleCharacter.isSub`): passive active, no cards,
  untargetable, can't act; promoted to field only at turn start after a
  teammate died (`sub.ts`). Battle format (4v4/3v3) sets the field cap; the
  4th unit in 3v3 is the sub automatically.
- The enemy side only ever plays Rank 1 (ruling #116).

## The simulator

`npm run sim -- <left> <right>` runs all four formats (ruling #57);
`npm run sim -- --roster <id>` sweeps one kit against the roster. **Read the
limits at the top of `simulate.ts` before quoting a number**: no card draw,
the AI plays both sides. A unit may carry `level` / `ascension` / `ultLevel`
(since 2026-09-16) and a bare id still means the catalog statline, so kit
comparisons are unchanged while an *encounter* is tuned against a real player
band (`playerBand`). `simulateRun` fights multi-fight runs on one HP bar. The
AI plays the PLAYER side too, so **a clear rate is a floor, not a
prediction**. A team that cannot lose is reported as *"X currently has no
counter"* with the interaction named (ruling #138), never as a defect and
never with a nerf.

## The save

- Every persisted field is named in `CLOUD_FIELDS` or `DEVICE_LOCAL_FIELDS`
  (`cloudSave.ts`), and `tests/cloudSave.test.ts` fails when one is in
  neither. The `savefield` skill walks a new field through the decision, the
  migration and the guards.
- **A cloud document must be something Firestore accepts**: no array inside
  an array, no `undefined`. `firestoreShapeProblems` walks `cloudDocument()`
  in the tests; `epicClears[*].teams` is one key per team (`teamKey`) for
  this reason (issue #28, v11 migration).
- **When a write happens is `cloudSync.ts`**, not the provider: nothing
  before the first read succeeds, one write per burst, a flush on sign-out
  and on a hidden tab. `hooks/AuthProvider.tsx` only wires it to Firebase.

## Measuring

A green guard is not a working guard: reintroduce the bug and watch the
test go red before trusting it (the root `AGENTS.md` has the regex `\b`
story). `tests/` for this folder are the engine, store, gacha and preview
suites; `npm run check` runs them.
