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

### System ticks (ruling #21 — literal durations)

Durations mean exactly what they say: N turns = N procs / N blocked turns.

- **Buffs/stances/HoT** tick at the **owner's turn START** (`tickTeamBuffs`): reset per-turn passive flags, proc HoT, decrement `buffDuration`, drop expired. A 1-turn buff applied on your turn survives the whole opposing turn.
- **Debuffs/DoT/stun/seal** tick at the **victim's turn END** (`tickTeamDebuffs`): proc DoT (`damageOverTime`, `decay`), decrement `debuffDuration`, drop expired. The victim always gets their own turn to cleanse before the first proc; a 1-turn stun blocks exactly one turn.
- Durationless effects persist until removed by other means.

## Sub (Bench) Units — `lib/game/sub.ts`

Battle format sets the field cap: **4v4** = all four on field, **3v3** = three on field and a 4th team member is the **sub automatically**. Teams may be any size 1–4; teams smaller than the cap are all-field. `ensureFieldUnit` guarantees at least one field unit (a lone sub auto-converts).

- A sub's **passive stays active** from the bench (phase-queue and inline passives both run).
- A sub contributes **no cards** to the deck, takes no AI actions, and **cannot be targeted** (single-target or AoE, damage or heal).
- Subs enter the field **only at the start of a new turn** (`OnPlayerTurnStart` / `OnEnemyTurnStart`): mid-turn deaths leave the slot open for the rest of that turn. One promotion per death; dead subs never promote. A promoted player sub's cards are drawn immediately via the turn-start top-up draw.
- If the whole player field dies mid-turn while a sub waits, the Deck auto-passes the empty hand so the battle proceeds to the promotion.
- Defeat still requires the **whole team** dead, subs included.

## Deck / Card System (`store/gameStore.ts`)

- **Init:** each living on-field team member contributes their 2 skills as rank-1 `ActionCard`s.
- **Hand capacity:** 4/5/7/8 cards for 1/2/3/4 field characters.
- **Draw (7DS GC behavior):** the hand is never reset — leftover cards persist. New cards are drawn **one at a time, purely at random** from living field units' skill pools at turn-end phases (and a turn-start top-up for freshly promoted subs), **auto-merging** adjacent identical cards as they land (+1 ult gauge per merge), until the hand is full. If a character's `ultGauge ≥ 5` **before the refill starts**, their ultimate is guaranteed-drawn (one copy in hand max). A gauge filled by merges during a refill guarantees the ultimate on the **next turn's** draw, never the same refill.
- **Merging:** two cards, same character + same skill + same rank → one card of rank+1 (max 3). Three paths: explicit merge button, auto-merge when dragged adjacent, and auto-merge on draw. Each merge grants +1 ult gauge to the card's owner.
- **Interaction lock:** the deck can only be touched (select/merge/drag) during `PlayerAction`.
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
effectiveDefense = target.def × (1 − pierce%/100) × (1 − criticalIgnore%/100)
base             = max(1, baseDamage − effectiveDefense)
extra            = base × 0.10 × igniteStacks          (always, if target ignited)
                 + base × 0.20 × target.ultGauge        (if skill has detonate)
                 + base × 2.0                           (if skill has weakpoint AND target has any debuff)
subtotal         = base + extra
final            = subtotal × typeModifier              (normal attacks)
                 = subtotal × (1 + criticalBonus%/100)  (critical attacks — type ignored)
```

### Type advantage (`lib/game/typeAdvantage.ts`)

Dark > Light > Dark (mutual advantage, never disadvantage); Red > Green > Blue > Red.
Advantage ×1.2, disadvantage ×0.9, neutral/same/cross-group ×1.0. Applies to every
attack via `executeSkill`; `critical` mechanics skip it in both directions.

### Evade (`lib/game/evade.ts`)

Rolled per target before damage, only for attacks from the opposing team. Base evade
is **0% for every unit**; sources add to it (Charged stacks ×5%, future `stat: "evade"`
buffs). An evaded attack deals no damage and applies none of its effects, but still
counts as "receiving an attack" for Charged-style passives. `executeSkill` takes an
injectable `rng` (last param) so tests are deterministic.

### Shock / Bleed

`{ type: "shock" | "bleed", damagePercent, duration }` on an attack pushes an
independent `damageOverTime` debuff per application (named "Shock"/"Bleed"),
valued at `damagePercent` of that hit's dealt damage (Shock 30%, Bleed 90%).
Cleansable like any debuff; ticks via `tick.ts`.

## Passives

Two delivery mechanisms:

1. **Phase-queue passives** (`lib/game/passive.ts` + `MechanicProvider`): triggers that map to a battle phase — currently battle-start `synergy` (tag/color-conditional team stat buffs, e.g. KHALSA, Powerful Opponent) and `aura` (e.g. team HP if no dead allies). Registered per character at battle setup, processed when the phase runs. A passive whose main trigger is combat-time still gets its `synergy`/`aura` mechanics registered at `OnBattleStart` (fallback in `registerCharacterPassives`). Synergy scales per tag carrier by default (Batra); `flatBonus: true` applies the flat percent instead (Seras).
2. **Inline combat passives** (hard-coded checks in `combat.ts` keyed on `passive.trigger`): `beforeSkill`, `onFirstAction`, `onAllySkill`, `onLethalDamage`, `onDamageDealt`, `afterSkill`, `onAttackReceived` (Charged stacks: +ATK/DEF applied to current stats on gain, evade via `evade.ts`; `statShiftAfterAttacks`: Gon/Killua count received AND evaded attacks, at the threshold a permanent signed stat shift is baked into current stats once).

Phase-queue additions: `characterSynergy` (Leorio) registers a static base bonus at `OnBattleStart` when a required character id is on the team, plus a dynamic extra bonus rechecked at the team's turn start — applied/removed as the required characters live and die on the field.

`passiveState: Record<string, unknown>` on each `BattleCharacter` carries per-battle counters (momentum stacks, lethal-survival used, etc.).

**Passive status icons (live, in-battle):** `lib/game/passiveStacks.ts`'s `getPassiveReadout(unit, {playerTeam, enemyTeam, currentTurn})` returns one of 7 display shapes (stack badge, stack+ready-tick, progress-to-once, conditional pill, one-shot pill, always-active marker, multi-tick row, or a derived stat line) rendered in `UnitDetailPanel` (`BattleArena.tsx`). An `activationMode` tag (`buildup`/`once`) is the exception, not the rule — only shown for a genuine per-stack growing benefit (Seras/Diane/Ban/Yalina) or a true once-per-battle trigger (Gon/Killua/Sara/Chiara's rank-up); most readouts carry no tag. Full spec: `docs/superpowers/specs/2026-07-29-passive-status-icons-design.md`.

**Passive description authoring (`data/characters/*.json`'s `passive.description`):** migration complete as of 2026-07-30 — all 18 playable passives plus the story-only/boss roster (Molvarr's 5 distinct passives across both phases, lyra_npc) now use the structured `#`/`-`/`--` format instead of flat prose:

```
# When finishing a turn without receiving damage
- All enemies max HP 8% 👇 (Max 5 times) (Uncancellable)
-- Effects reset after receiving damage
```

`# ` = a trigger/condition heading (displayed, not just internal), `- ` = an effect bullet, `-- ` = a comment on the preceding bullet (dimmer, smaller). Parsed by `lib/game/passiveMarkup.ts`, rendered by `PassiveProse`/the "Passive Details" overlay in `components/game/KitDetails.tsx` (old flat-prose passives keep rendering exactly as before — this is additive per-character; comments render through `KeyworkHighlighter` too, same as bullets). Literal 👇/👆 typed inline become colored `ArrowDown`/`ArrowUp` icons via `KeyworkHighlighter` (a phone-typeable stand-in for the app's real icon, never shown as the raw emoji) — the actual percentage stays as plain visible text next to the arrow (Tanveer: "numbers are important in passives"), unlike skill descriptions' tier-word system which intentionally hides the number behind a fixed-value tooltip.

**Arrow rule:** the arrow only ever substitutes for a raise/lower verb (increases/decreases/raises/lowers), never for a named mechanic/effect (Corrosion, Ignite, Stun, Damage Reduction, Evade, ...) — those stay visible as text with their own explicit arrow following, per the usual `(mechanic) (value%) (arrow)` shape, e.g. "ATK 40% 👆". Enforced in `mechanicGlossary.ts`'s `keywordCategories`: only `buff`/`debuff`-tagged keywords get arrow-substituted by `KeyworkHighlighter`'s `arrowDirectionForKeyword`, so every named-effect noun is tagged `effect` instead (a category that never substitutes) and only the genuine tier-word verbs (raises/lowers + greatly/massively/permanently variants) stay `buff`/`debuff`. A keyword miscategorized as `buff`/`debuff` silently vanishes from the rendered passive, leaving only a bare arrow — check this first if a passive line is ever missing a word.

## Design Glossary

Reference definitions migrated from `author_notes.md` once confirmed stable against the code (see `author_notes_report.md` for when/why).

**Effect coloring:** Grey = uncancellable effect. Blue = cancellable buff. Red = cancellable debuff.

**Skill categories** (descriptive convention, not a data field): *Attack* — damage only, may carry damage-boosting mechanics (weakpoint, detonate) or side effects (stance/buff cancel). *Attack Debuff* — damage + one or more debuffs in the same skill (e.g. "does damage and applies Bleed for 2 turns"); Diane's Rush Rock is Attack-only at rank 1 and becomes Attack Debuff at rank 2+ once it gains attack seal — an intentional per-rank category shift. *Debuff* — no damage, applies debuffs/DoT directly (e.g. Corrosion). *Buff* — no damage, buffs one or more allies.

**Sub-passive activation** (`passive.worksFromSub`, default `false`): only passives that purely grant a buff/effect without needing to interact with an enemy/ally target work from the bench. Confirmed opt-in: Leorio, Mustafa, Gabrist, Isolde. Confirmed opt-out (needs field presence): Chiara (has a literal "while on battlefield" condition), Diane, Meliodas, Ban, Duke, Lyra, Batra, Sara, Yalina, Siddiq, Gon, Killua, Master Tao.

**Mechanic definitions:**
- `[Power Strike]` — damage bonus scaling off enemy DEF: +1% damage per 2 points of enemy DEF.
- `type-neutral` — ignores type advantage/disadvantage in both directions while active.
- `Debuff Immunity` — blocks incoming debuffs for the buff's duration and clears existing debuffs on application.
- Recovery Rate substat — multiplies all incoming healing (heals, HoT, lifesteal) by the percentage; base 100%.
- Lifesteal substat — converts a percentage of damage dealt (skills + counters) into a heal, applied at the end of the attack before the next action resolves; itself scaled by Recovery Rate.
- "Basic stats" = ATK/DEF/HP only. "All stats" = basic stats + crit chance/damage, evade, crit resist, and any future substat.

## Enemy AI (`lib/game/ai.ts`)

Per living enemy, priority order: heal/cleanse if an ally ≤50% HP or debuffed → ultimate if gauge ≥5 → buff/debuff → attack → stance → fallback skill 0. Default target: lowest-HP player character; taunt overrides.

## Character Data (`data/characters/*.json`)

Each character: `id, name, color, atk, def, hp, tags?, skills[2], ultimate?, passive?`. Skills carry `damageRanked [R1, R2, R3]` and a `mechanics[]` array typed by `MechanicType` (**53** types — canonical list is `MECHANIC_TYPES` in `types/mechanic.ts`; the Zod schema rejects anything not in it). Rank-scalable mechanic fields use `valueRanked` / `stacksRanked` / `durationRanked`.

Roster: **28 kits — 18 playable + 10 `storyOnly`** (counted from `data/characters/` on 2026-08-10). Playable: Duke, Lyra, Master Tao (story cast) + Mustafa, Siddiq, Batra, Gabrist, Sara, Yalina (exam-arc side cast; kit specs in `_dev/new_chars_DONE.md`) + Chiara, Isolde + Seras (villain) + Meliodas, Ban, Diane (7DS collab) + Gon, Killua, Leorio (HxH collab). `storyOnly` (hidden from team select and `/archive`, reachable at `/archive/npc`): raider, road_bandit, wild_beast, frost, gale, iron, prism, lyra_npc, lyra_npc_2, molvarr (world boss). `getPlayableCharacters()` is the filter. New kits arrive via the template at the top of `newchars.md` and are removed from it once implemented. Tags: everyone carries [Human] except Diane ([Giant]) and Meliodas ([Demon]); Seras adds [Fairy]/[Hybrid]; HxH units carry [Male]/[Collab]/[Hunter x Hunter]; synergy tag matching is exact-string ("Female", not "FEMALE").

Skill descriptions support placeholders resolved per rank by `descriptionTranslator.ts`: `[mechanicType.field]` reads `<field>Ranked[rank]` or the scalar field (e.g. `[stance.counterDamagePercent]`, `[seal.duration]`, `[extort.value]`). Unresolvable placeholders like `[Red]` are left as-is. Conditional text: `[aoeRanked? all : one]` resolves against the mechanic's `ranks` array.

Dokkan wording (rulings #26–28): descriptions use tiered words instead of numbers — "raises" (<50%), "greatly raises" (50–79%), "massively raises" (80%+), same tiers for "lowers". A stat change with no duration is permanent and says so: the tier gets a "permanently" prefix ("Permanently raises ATK and DEF" is a single pill). Semicolons separate the distinct parts of a description ("Cancels buffs; does 375% ATK damage to all enemies; greatly lowers ATK and DEF for 2 turns."). `buildSkillKeywordGlossary(skill, rank)` generates per-skill hover entries ("permanently raises atk" → "Increases ATK by 30%"), merged over the static `mechanicGlossary` in the archive and deck preview; `KeyworkHighlighter` renders category-colored pills (dynamic keys inherit the base word's category). One pill per unique effect: cancel effects are phrase-level keys ("cancels buffs and stances"); generic words like "stance" don't pill. Pierce is a flat 50% DEF ignore engine-wide.

Chance-tier wording (2026-07-30, `author_notes.md` idea #1): a fixed probability scale — "very low chance" 5%, "low chance" 10%, "medium chance" 30%, "high chance" 50%, "great chance" 70% — lives in `mechanicGlossary` under the non-substituting `"chance"` `KeywordCategory` (same treatment as `effect`/`stance`/`cancel`: colored text + tooltip, no arrow). Unlike raises/lowers there's no threshold-bucketing or per-mechanic tooltip override — these are exact fixed lookups, so a value that doesn't land on one of the five tiers is authored as a literal number with an explicit arrow instead (e.g. "evade chance 44% 👆"). Not yet used anywhere in the roster — infrastructure only, ready for future skills/passives.

## Supporting Pieces

- `lib/game/damagePreview.ts` — **kit preview** (not just damage): every ability at every rank under each scenario that changes the outcome, plus support effects (buffs/stances/heals/cleanses), every phase of a multi-phase kit (rows carry `phaseLabel`), and a row per passive read from its authored description. Backs the `/archive/[id]` Kit Preview table.
- `lib/game/descriptionTranslator.ts` + `mechanicGlossary.ts` + `KeyworkHighlighter` — turn mechanic data into human-readable, keyword-highlighted card text.
- `hooks/AuthProvider.tsx` + `lib/firebase.ts` — Firebase auth context; `/login` (email + Google) and `/profile` are built, with a guest-mode fallback when `.env.local` is absent.
- `components/game/BattleEffectsOverlay.tsx` — visual feedback layer.

## Loading & Bundle Notes

- **The mechanic engine is already data-driven.** `executeSkill` iterates a skill's OWN `mechanics[]` and branches (`skillMechanics.forEach(m => { if (m.type === "shock") … })`) — a 4v4 only ever executes the mechanics its 8 units carry. There is no "run all 53 mechanics" pass to optimise away.
- **Per-battle kit loading isn't worth it** (measured 2026-08-04): all 27 kit JSONs are **9.5 KB gzipped combined**. Lazy-loading them per battle saves ~7 KB while adding an async gate before every fight and a resume path that has to re-fetch mid-battle. The whole client bundle is ~2.4 MB; kits are noise.
- **Firebase is lazy-loaded** (`lib/firebase.ts` → `loadFirebase()`). It used to initialise at module scope and export `auth`/`db` as values, so importing the file anywhere pulled ~555 KB of `@firebase` into the shared chunk — and since `AuthProvider` sits in the root layout, **every route paid for it**, including a practice battle that never touches auth. Now it lives in its own chunk, referenced by no page's initial HTML, and loads after mount. **Rule: never `import { … } from "firebase/*"` as a value.** Type-only imports are fine (erased); a value import anywhere puts the SDK straight back into the shared chunk. Get the API functions off the `FirebaseBundle` (`authApi` / `dbApi`) instead.
- **`import.meta.glob` does NOT work here.** Turbopack compiles it but throws `.glob is not a function` at runtime, failing the prerender (measured 2026-08-04). Vitest supports it; Turbopack does not. Kit registration in `characterCatalog.ts` therefore stays explicit — an import line plus a `rawCharacters` entry per kit — guarded by `tests/characterCatalogRegistration.test.ts`, which fails if a kit JSON on disk isn't registered (the silent-omission failure mode: no build error, the character just doesn't exist).

## UI Layer Conventions

- **`lib/nav/routes.ts` is the single source of truth for what modes exist.** `TopNav` and `HomeMenu` both render `GAME_ROUTES`. They previously kept separate lists and disagreed, leaving World Boss / Gacha / News unreachable from every page except home. Add a route here, not in a component.
- **`components/ui/prose.tsx` owns document typography** — headings, tables, lists — and is consumed by BOTH `mdx-components.tsx` (the `/news` MDX posts) and `app/archive/[id]/page.tsx`. That shared source is what makes the two pages actually match. `ProseSection` = ruled heading + optional note; `ProseTable` = horizontally scrollable table.
- **Two kit renderers, deliberately.** `KitDetails.tsx` is the compact boxed variant used inside battle overlays; `SkillDocument.tsx` is the document variant (ruled heading + metadata line + Rank/Mult/Effect table) used on the archive. `KitPhases` takes a `variant` prop (`compact` | `document`) so a multi-phase boss matches whichever page it's on.
- **`BattleArena.tsx` is the arena shell only.** Overlays live in `components/game/battle/`: `TeamUnitTile`, `UnitDetailPanel`, `TeamDetailsList`, `BattleLogDrawer`, `EffectsList`. It was a 1964-line monolith holding all of them.
  `EffectsList.tsx` no longer exports a list component — it holds
  `categorizeEffects`, `effectCounts`, the `↑4 ↓3` `EffectCountStrip` shared by
  the tile and the panel, and `EffectsTables` for the Detail modal. The itemised
  inline list it was named for was removed 2026-08-13: it expanded inside the
  panel's own scroll zone, which is the wrong home for a list of unbounded
  length.
- **Tap = inspect, on both sides.** `UnitDetailPanel` opens for allies AND enemies (it picks its team from `unit.team`); enemy focus-fire is a separate ◎ button on the enemy tile. One gesture, one meaning.
- **The battle log renders from `battleEvents`, not `battleLog`.** The typed stream carries per-target damage/crit/evade/kill and exact HP snapshots; `turn` and `phase` are stamped in `gameStore.addBattleEvent` (presentation context the engine has no reason to know). The `battleLog` string array survives behind a Raw toggle because it is still the only record of **which buffs/debuffs an action applied** — the event stream doesn't model effect application yet. Emitting that from `combat.ts` is the known follow-up.
- **VFX are a registry, not JSX branches.** `lib/game/characterVfx.ts` maps every character to a tint + shape + accent; the arena's burst renderer switches on `getVfxAccent(shape)`. Adding a flavor is a data edit. Tints must sit visibly away from the character's own element tint (`FLASH_TINTS` in `elementSwatch.ts`) or the flavor is invisible — enforced by `tests/characterVfx.test.ts`.
- **Rank escalation already exists** in `lib/game/revealTier.ts` (basic/R1/R2/R3/ultimate → projectile size, burst strength, shake, flash, wind-up, beam sweep, cutscene). Don't rebuild it.
- **Ult cut-ins use skill art** via `getSkillArt(characterId, skillName) ?? getCharacterArt(...)`.
- **Arena spacing between the team rows is deliberate** (Tanveer, 2026-08-04) — room for UI buttons and a fix for v1's congestion. Not dead space; don't compact it.
