# Architecture

How a battle actually runs, from page load to victory screen.

## Big Picture

```
app/practice ──► BattleProvider.startFullTest()
                     │  loads data/characters/*.json → BattleCharacter instances
                     │  registers battle-start passives (passive.ts → MechanicProvider queue)
                     ▼
              Zustand gameStore  ◄──────────────┐
                     │                          │
        battlePhase state machine               │ updateTeams / deck actions
                     │                          │
   ┌─────────────────┼──────────────────┐       │
   ▼                 ▼                  ▼       │
BattleProvider   MechanicProvider   combat.ts ──┘
(phase engine,   (phase-triggered   (executeSkill: targeting,
 turn ticks)      passive queue)     damage, mechanics, passives)
                                        │
                                        ▼
                                    damage.ts (defense, pierce, ignite,
                                               detonate, weakpoint)
```

UI (`BattleArena`, `Deck`) reads the store and calls `BattleProvider` wrappers. All battle mutation happens through `executeSkill` + the phase engine; components never mutate combat state directly.

## Battle Phase State Machine

`types/mechanic.ts` → `BattlePhase`:

```
initializing → OnBattleStart → OnPlayerTurnStart → PlayerAction
    → OnPlayerTurnEnd → OnEnemyTurnStart → EnemyAction → OnEnemyTurnEnd
    → (turn++) → OnPlayerTurnStart → …            (victory | defeat exit anywhere)
```

- **Automated phases** (`On*` phases) run in `BattleProvider`'s `useEffect`: system ticks, passive queue processing, death cleanup, win/loss check, then auto-advance after 500ms.
- **Interactive phases** (`PlayerAction`, `EnemyAction`) wait for `resolveplayerTurnWrapper()` / `resolveEnemyTurnWrapper()` from the UI.

### System ticks (both `OnPlayerTurnStart` and `OnEnemyTurnStart`, both teams)

1. Reset per-turn passive flags.
2. Apply DoT (`damageOverTime`, `decay` with captured damage) and HoT.
3. Tick down `buffDuration` / `debuffDuration`; drop expired effects. Durationless effects persist.

## Deck / Card System (`store/gameStore.ts`)

- **Init:** each living team member contributes their 2 skills as rank-1 `ActionCard`s.
- **Hand capacity:** 4/5/7/8 cards for team size 1/2/3/4. Refilled on both turn-end phases.
- **Draw:** random from living characters' skills. If a character's `ultGauge ≥ 5`, their ultimate is guaranteed-drawn (one copy in hand max).
- **Merging:** two cards, same character + same skill + same rank → one card of rank+1 (max 3). Two paths: explicit merge and auto-merge when dragged adjacent. Each merge grants +1 ult gauge to the card's owner.
- **Action queue:** up to 3 cards queued per player turn. Enemy-targeting card types (`attack`, `debuff`, `disable`, `ultimate`) require a marked enemy target at selection time. Stunned characters' cards can't be queued.
- **Rank effect:** on resolution, `BattleProvider` substitutes `damageRanked[rank-1]` as the damage multiplier. (Mechanic `*Ranked` values currently do not scale — see STATUS.md.)

## Skill Resolution (`lib/game/combat.ts` → `executeSkill`)

Order of operations per action:

1. Stun check on source → skip action.
2. Pre-skill passives (`beforeSkill`, e.g. HP consumption).
3. `onFirstAction` passive trigger (first queued action of the turn).
4. Ally skill-use trackers (`onAllySkill` momentum stacks).
5. Targeting: AoE → whole opposing (or allied, for heal/buff) team; single-target attacks respect taunt redirection.
6. Base damage = source stat (`atk`/`def`/max `hp` per `statMultiplier`) × skill multiplier.
7. Dynamic multipliers: spite (missing-HP scaling), concentrate (fewer enemies = more damage), amplify (per-buff scaling), momentum consumption, consumeIgnite (stack conversion).
8. Per-target: `calculateDamage` (see below), lethal-survival passives (`onLethalDamage`), then on-hit mechanic application (decay, ignite stacking, ult-gauge drain, stun, buff/stance cancels, stat debuffs, taunt) and friendly buffs/cleanses.
9. Post-damage passives (`onDamageDealt` lifesteal) and `afterSkill` stack accumulation.

Teams are deep-copied per action — `executeSkill` is pure with respect to its inputs and returns new team arrays.

## Damage Formula (`lib/game/damage.ts`)

```
effectiveDefense = target.def × (1 − pierce%/100)
base             = max(1, baseDamage − effectiveDefense)
extra            = base × 0.10 × igniteStacks          (always, if target ignited)
                 + base × 0.20 × target.ultGauge        (if skill has detonate)
                 + base × 2.0                           (if skill has weakpoint AND target has any debuff)
final            = base + extra
```

## Passives

Two delivery mechanisms:

1. **Phase-queue passives** (`lib/game/passive.ts` + `MechanicProvider`): triggers that map to a battle phase — currently battle-start `synergy` (tag/color-conditional team stat buffs, e.g. KHALSA, FEMALE) and `aura` (e.g. team HP if no dead allies). Registered per character at battle setup, processed when the phase runs.
2. **Inline combat passives** (hard-coded checks in `combat.ts` keyed on `passive.trigger`): `beforeSkill`, `onFirstAction`, `onAllySkill`, `onLethalDamage`, `onDamageDealt`, `afterSkill`.

`passiveState: Record<string, unknown>` on each `BattleCharacter` carries per-battle counters (momentum stacks, lethal-survival used, etc.).

## Enemy AI (`lib/game/ai.ts`)

Per living enemy, priority order: heal/cleanse if an ally ≤50% HP or debuffed → ultimate if gauge ≥5 → buff/debuff → attack → stance → fallback skill 0. Default target: lowest-HP player character; taunt overrides.

## Character Data (`data/characters/*.json`)

Each character: `id, name, color, atk, def, hp, tags?, skills[2], ultimate?, passive?`. Skills carry `damageRanked [R1, R2, R3]` and a `mechanics[]` array typed by `MechanicType` (24 types — see `types/mechanic.ts`). Rank-scalable mechanic fields use `valueRanked` / `stacksRanked` / `durationRanked`.

Roster (9): Duke, Lyra, Master Tao (story cast) + Mustafa, Siddiq, Batra, Gabrist, Sara, Yalina (exam-arc side cast; kit specs in `_dev/new_chars_DONE.md`).

## Supporting Pieces

- `lib/game/damagePreview.ts` — pre-calculates expected damage for card UI.
- `lib/game/descriptionTranslator.ts` + `mechanicGlossary.ts` + `KeyworkHighlighter` — turn mechanic data into human-readable, keyword-highlighted card text.
- `hooks/AuthProvider.tsx` + `lib/firebase.ts` — Firebase auth context (login/profile routes not yet implemented).
- `components/game/BattleEffectsOverlay.tsx` — visual feedback layer.
