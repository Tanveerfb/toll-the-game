# Passive Activation Status Icons — Design

## Context

The Unit Detail Panel (`components/game/BattleArena.tsx`, `UnitDetailPanel`, passive block ~L344-382) already renders a live passive readout via `getPassiveReadout()` (`lib/game/passiveStacks.ts`) as plain `[current/max]` text plus a text "ready" message, highlighted amber. It only covers 6 of the roster's ~19 passives (5 capped-stack mechanics + Deathblow's derived-stat pattern) — everything else (synergy, aura, conditional heals, one-shot triggers, boss-derived values) currently shows nothing.

This spec extends that system to (a) cover every passive in the roster and (b) replace the plain text with an icon-based readout modeled on Dokkan Battle's in-battle mini info panel (icon + live counter, reference: `docs/design/references/battle-ui-refs/dokkan-inbattle-mini-info-panel.jpg`) and its passive-detail modal's activation tags (`dokkan-passive-skill-details-modal.jpg`, reference screenshot supplied by Tanveer): a yellow "⏱∞" pill marking a clause that **stacks up an incrementally growing benefit** (Dokkan's own usage — e.g. "For every attack received: Ki +2 (up to +8)"), and a yellow "!1" pill for effects that fire exactly once per battle. Both tags are **narrow, not universal** — most readouts show neither (Tanveer's correction: don't stamp "⏱∞" on everything that merely persists, only on true build-up-for-growing-benefit stacks like Seras's Charged).

Scope: **Unit Detail Panel only** (Tanveer's call — this is the only screen with live `passiveState`; the compact battlefield tile and the static archive/kit-lab pages are out of scope).

## Icon vocabulary

Seven display shapes, dispatched per passive. An **activation-mode tag** is the exception, not the rule — only two shape instances ever carry one:

- `buildup` → `Infinity` (lucide-react) icon in a neutral zinc pill. Shown **only** when the stack itself grants a live, incrementally-growing benefit as it accumulates (Seras's per-stack ATK/DEF/evade, Diane's per-turn ATK ramp, Ban's per-stack enemy max-HP shred, Yalina's per-stack damage buff). NOT shown on stack counters that are pure thresholds toward a one-time payoff (Duke, Master Tao) or on anything else (conditional pills, always-active markers, multi-ticks, derived lines) — those persist too, but tagging them "⏱∞" adds no information the player doesn't already see, so it's omitted.
- `once` → a small amber pill reading `1×` with a `CircleAlert` (lucide-react) icon — "fires exactly once per battle," mirroring Dokkan's yellow "!1". Only on genuine one-shot triggers.

Shapes:

1. **Stack badge** — `ArrowUp` icon (reused from the existing buff `CHIP_STYLE`) + `current/max` text. No ready-tick.
   - Seras (Charged, /6) — `buildup` tag.
   - Diane (Giant's Will, /5) — `buildup` tag.
   - Ban (Extort Life, /5) — `buildup` tag.
   - Master Tao (Healing Flames, /3 heal-triggers used — see **Engine fix required** below, this passive doesn't fire at all today) — no tag (a fired-count, not a scaling stat).
2. **Stack badge + ready tick** — same as above, plus a green `CheckCircle2` icon when `current === max`, because reaching max actually fires a bonus effect.
   - Yalina (Momentum, /5 → consumed on next hit) — `buildup` tag (each stack itself adds +20% damage before being spent).
   - Duke (Flowing Ruin, /3 → next skill empowered) — no tag (the stack does nothing per-se until the 3rd unlocks a one-time empowered hit; it's a threshold, not a growing benefit).
3. **Progress-to-once counter** — `current/required` text (no icon needed beyond the number) while counting; once fired, replaced by a permanent "ACTIVE" badge (green `CheckCircle2` + label) for the rest of the battle. `once` tag.
   - Gon (Rookie Hunter, attacks received 0→10), Killua (Prodigy Assassin, same).
4. **Conditional pill** — `CheckCircle2` (green, filled) when the live condition is true, `Circle` (grey, outline) when false. Re-evaluated every render. No tag.
   - Siddiq (Vampiric Roots — lit whenever current HP < 50% of max).
5. **One-shot pill** — green "AVAILABLE" (`CheckCircle2`) until consumed, then grey "USED" (`Circle`) — stays visible, never removed. `once` tag.
   - Sara (Nine Lives).
6. **Always-active marker** — a plain "ACTIVE" badge, no number, no tag.
   - Gabrist (Flawless Canvas), Isolde (Woven Blessing), Mustafa (synergy-only passive), and Batra's KHALSA synergy half (Batra's `consumeHpPercent` half of Fierce Dedication gets **no** icon at all — it fires automatically every skill cast with nothing to track live; only the synergy half shows the ACTIVE marker).
7. **Multi-tick row** — one labeled green/grey tick (`CheckCircle2`/`Circle`) per named sub-clause of a single passive. No tag.
   - Leorio (Kind Hearted Friend): tick 1 = "Bond" (Gon or Killua present), tick 2 = "Together" (both alive on field).
8. **Derived value line** — plain text stat line, no icon (existing pattern, already built for Meliodas's Deathblow). No tag.
   - Molvarr (Growing Malice, "+X% ATK" where X = 5 × enemy debuff count).

Chiara (Cut the Deck) is a special case: the random per-turn buff/debuff half needs **no readout at all** (the resulting buff/debuff already appears in the normal battlefield buff list — Tanveer's call, redundant to duplicate it here). Only the "ranks up own deck at turn 3" half gets a readout: a progress-to-once counter ("turns until rank-up: N") with the `once` tag, converting to a permanent "ACTIVE"/fired marker after turn 3 passes.

Characters with no passive at all (Frost, Gale, Iron, Prism, Raider, Road Bandit, Wild Beast) render nothing, as today.

### Engine fix required: Master Tao's Healing Flames doesn't fire

`combat.ts`'s `consumeIgnite` block (~L562-592, the Skill mechanic on Inferno Consumption) only applies the ATK buff — it never checks `updatedSource.passive`, so the separate **passive** ("Healing Flames", trigger `onIgniteConsume`, mechanic `{type: "heal", conditionStacks: 3, valuePercent: 30, maxTriggers: 3}`) never heals Tao at all today. `onIgniteConsume` also isn't in `mapTriggerToPhase` (`lib/game/passive.ts`), so it can't be registered as a queued phase action either — it has to be handled inline in `combat.ts` right where `totalIgnitesConsumed` is already computed, the same way Batra's `consumeHpPercent` (`beforeSkill`) is handled inline rather than through the mechanic queue.

Fix, added right after the existing ATK-buff block in `combat.ts`:

```ts
if (
  totalIgnitesConsumed > 0 &&
  updatedSource.passive?.trigger === "onIgniteConsume"
) {
  const healMech = updatedSource.passive.mechanics?.find(
    (m) => m.type === "heal",
  );
  if (healMech?.conditionStacks) {
    const maxTriggers = healMech.maxTriggers ?? Infinity;
    const triggersUsed =
      (updatedSource.passiveState.igniteConsumeTriggers as number) || 0;
    const triggersEarned = Math.floor(
      totalIgnitesConsumed / healMech.conditionStacks,
    );
    const triggersToApply = Math.min(
      triggersEarned,
      maxTriggers - triggersUsed,
    );
    if (triggersToApply > 0) {
      const healAmount = Math.floor(
        updatedSource.hp * ((healMech.valuePercent ?? 0) / 100) * triggersToApply,
      );
      const { character: healed, healed: actualHealed } = applyHeal(
        updatedSource,
        healAmount,
      );
      Object.assign(updatedSource, healed);
      updatedSource.passiveState.igniteConsumeTriggers =
        triggersUsed + triggersToApply;
      if (actualHealed > 0) {
        log(`${updatedSource.name}'s Healing Flames restores ${actualHealed} HP!`);
      }
    }
  }
}
```

Semantics: each cast independently floors its own `totalIgnitesConsumed` by 3 (no carrying a leftover 1-2 stacks toward a future cast — matches the plain reading of "for every 3 stacks consumed"), and the cumulative trigger count across the whole battle is capped at `maxTriggers` via the new `passiveState.igniteConsumeTriggers` counter (this is also exactly the counter the readout displays as `n/3`).

## Data model

Extend `PassiveReadout` in `lib/game/passiveStacks.ts`:

```ts
export type ActivationMode = "buildup" | "once";

export interface PassiveSubState {
  label: string;
  active: boolean;
}

export interface PassiveReadout {
  label: string;
  /** Omitted on most readouts — only set for a genuine per-stack growing
   *  benefit ("buildup") or a true once-per-battle trigger ("once"). See
   *  "Icon vocabulary" above for exactly which characters get which. */
  activationMode?: ActivationMode;
  stacks?: { current: number; max: number };
  ready?: boolean; // shows the green CheckCircle2 only when true
  readyMessage?: string;
  /** Progress toward a one-shot trigger (Gon/Killua/Chiara's rank-up), distinct
   *  from `stacks` because reaching `required` fires once and then the whole
   *  readout permanently switches to a fired/ACTIVE state. */
  progress?: { current: number; required: number };
  fired?: boolean; // true once a `progress`-tracked one-shot has triggered
  /** Conditional pill (Siddiq) — omitted for passives with no live condition. */
  conditionMet?: boolean;
  /** One-shot pill (Sara) — omitted for passives that aren't a single-use gate. */
  oneShot?: { available: boolean };
  /** Multi-tick row (Leorio). */
  subStates?: PassiveSubState[];
  /** Always-active marker (Gabrist/Isolde/Mustafa/Batra-synergy) — true renders
   *  a plain "ACTIVE" badge with no number. */
  alwaysActive?: boolean;
  note?: string;
  /** Derived stat lines (Molvarr, Meliodas's Deathblow) — unchanged. */
  lines?: string[];
}
```

Only one of `stacks`, `progress`, `conditionMet`, `oneShot`, `subStates`, `alwaysActive`, `lines` is populated per readout (the shapes above are mutually exclusive per passive) — the render layer switches on whichever is present, checked in that order.

## Dispatch / architecture

Keep `getPassiveReadout()`'s existing structure: a table for the simple repeating-stack cases, plus bespoke reader functions for everything else, tried in priority order (mirrors the existing `deathblowReadout` pattern already in the file — no new architecture).

**Table-driven (extend `STACK_KEYS`)** — add `showTickAtMax: boolean` to `StackKeyConfig`, set `true` only for Duke and Yalina:

| passiveState key | label | max | showTickAtMax | activationMode |
|---|---|---|---|---|
| `flowingRuinStacks` (Duke) | Flowing Ruin | 3 (from kit `maxStacks`) | true | *(none)* |
| `chargedStacks` (Seras) | Charged | 6 | false | buildup |
| `momentumStacks` (Yalina) | Momentum | 5 | true | buildup |
| `turnRampStacks` (Diane) | Ramp | 5 | false | buildup |
| `maxHpShredStacks` (Ban) | Shred | 5 | false | buildup |
| `igniteConsumeTriggers` (NEW passiveState key, Master Tao's Healing Flames counter) | Healing Flames | 3 | false | *(none)* |

**Bespoke reader functions** (one per case, same file or a new `lib/game/passiveReadouts/` folder if the file grows past ~300 lines — YAGNI: start in `passiveStacks.ts`, split only if it actually gets unwieldy):

- `attacksReceivedShiftReadout` — Gon/Killua. Reads `passiveState.attacksReceived` / the kit's `attacksRequired`, and `passiveState.statShiftTriggered` for the fired flag.
- `conditionalHpReadout` — Siddiq. Reads live `currentHP / hp` against the kit's `hpConditionPercent`.
- `oneShotPillReadout` — Sara. Reads `passiveState.lethalSurvived`.
- `alwaysActiveReadout` — Gabrist, Isolde, Mustafa, Batra (synergy half only — Batra's `consumeHpPercent` mechanic is explicitly excluded from ever producing a readout).
- `multiTickReadout` — Leorio. Reads team composition live (Gon/Killua present, both alive) the same way `registerCharacterSynergy`'s bond bonus already checks it, without needing new passiveState.
- `rankUpCountdownReadout` — Chiara. Reads `currentTurn` (already available to `UnitDetailPanel` via battle state) against the kit's `rankUpOwnDeck.atTurn`, and a new `passiveState.rankedUpAtTurn3` fired flag.
- `bossDebuffAtkReadout` — Molvarr. Same derived-line pattern as `deathblowReadout`, computed from live enemy-team debuff count.

`getPassiveReadout()` tries each bespoke reader in a fixed order, falling back to the table, falling back to `null` (no passive / nothing displayable) — same overall shape as today, just more branches.

## Rendering

`UnitDetailPanel`'s passive block (BattleArena.tsx ~L344-382) is rewritten to switch on which field is populated:

- `stacks` present → icon (`ArrowUp`) + `current/max`, plus a green `CheckCircle2` if `ready`.
- `progress` present, not `fired` → bare `current/required` text.
- `progress` present and `fired` → green `CheckCircle2` + "ACTIVE".
- `conditionMet` present → `CheckCircle2` (green) or `Circle` (grey).
- `oneShot` present → "AVAILABLE" (green `CheckCircle2`) or "USED" (grey `Circle`), never hidden.
- `subStates` present → a row of labeled ticks.
- `alwaysActive` → plain "ACTIVE" badge.
- `lines` present (and none of the above) → existing derived-stat-line rendering, unchanged.

If `activationMode` is set, the corresponding tag (`Infinity` pill for `buildup`, `1× CircleAlert` pill for `once`) renders next to the label — omitted entirely (no empty pill) when `activationMode` is undefined, which is the common case.

## Testing

- Extend `tests/passiveDetailSections.test.ts` or add a new `tests/passiveReadout.test.ts` covering `getPassiveReadout()` directly (not the rendered JSX) for: Duke at 0/3/3-with-ready (`activationMode` undefined), Seras at max (no ready tick, `activationMode === "buildup"`), Gon/Killua before and after the 10th attack (progress → fired, `activationMode === "once"` throughout), Siddiq above/below the 50% gate (no tag), Sara before/after its one trigger (`once`), Gabrist/Isolde/Mustafa (always-active, no crash when `passiveState` is empty, no tag), Leorio's two independent ticks (bond only vs. both-alive, no tag), Chiara's rank-up countdown before/after turn 3 (`once`), Molvarr's derived ATK line matching `bossDebuffAtkReadout`'s formula (no tag), Master Tao's `n/3` counter (no tag), and the "no passive" characters returning `null`. Explicitly assert `activationMode` is `undefined` for Duke/Tao/Siddiq/Gabrist/Isolde/Mustafa/Leorio/Molvarr — the narrow-tagging rule is easy to accidentally regress back to "tag everything."
- Add an `executeSkill`-level test (`tests/characterMechanics.test.ts`, alongside the existing Master Tao `consumeIgnite` tests) for the new Healing Flames engine fix: a cast consuming exactly 3 stacks heals 30% of max HP once; consuming 6+ in one cast still only earns `floor(consumed/3)` triggers (capped at `maxTriggers`); a 4th cumulative trigger across multiple casts (already at 3 lifetime triggers) heals nothing further; `passiveState.igniteConsumeTriggers` matches what the readout displays.
- `npm run check` must stay green throughout.
- No live Chrome verification is strictly required (this is a pure read/render function, well-covered by unit tests), but a quick manual spot-check of Duke's panel mid-battle is worth doing if Chrome is available when this is implemented.

## Stat-change arrows on passive description text — superseded twice, final form below

This part of the spec went through three iterations in one session; only the **final form** (the third bullet below) is implemented. Recorded in order because each correction rules out a real-looking alternative:

1. **First attempt (abandoned): tier-word substitution.** Reword passive prose to use the skill-description tier words ("raises"/"greatly raises"/"lowers"/"greatly lowers") so the existing `keywordCategories` map (buff/debuff) could drive an arrow. Rejected — Tanveer: "numbers are important in passives." Tier words *hide* the exact percentage behind a fixed-value tooltip (e.g. "lowers" implies exactly 30%), which is backwards for hand-authored passive prose that states its own arbitrary percentage inline. Using a tier word whose implied value didn't match the stated number would also silently produce a wrong tooltip (this is exactly the bug caught live on Duke's passive — see the `feedback-check-conventions-before-inventing-values` project memory).
2. **Second attempt (abandoned): generic verb glossary + word-hiding.** Added `passiveStatVerbGlossary`/`passiveStatVerbCategories` (gains/loses/increases/reduces/rises/falls, kept OUT of the base `mechanicGlossary` since those words also appear in ordinary skill prose — Duke/Leorio/Yalina), and changed `KeyworkHighlighter` to render the arrow icon *instead of* the matched word (not decorating it) — "you don't even need 'gains' in the passive anymore." This worked but Tanveer wanted precise word order (value before the arrow, e.g. "ATK 50%⬇"), which required rewording every sentence so the verb trailed the number ("ATK 50% falls") — workable but fragile: the arrow's position was still tied to wherever a recognized verb happened to sit in hand-written prose, and both mechanisms (tier words AND generic verbs) still carry some false-positive/wrong-tooltip risk long-term.
3. **Final form (implemented): explicit emoji authored directly, converted to the app's arrow icons.** Tanveer author-controls exactly where the arrow lands by typing 👇 (decrease) / 👆 (increase) directly in the JSON description at the exact position wanted — "I am using phone emoji but use our app arrows for that purpose": the emoji is a phone-typeable stand-in for intent, never rendered as-is. `KeyworkHighlighter` matches the literal emoji characters (a new `EMOJI_SRC = "👇|👆"` alternation in the same regex, always-on — not gated by `showStatArrows`, since an author-inserted emoji has zero false-positive risk unlike word detection) and substitutes the matched emoji with a colored `ArrowDown`/`ArrowUp` (lucide-react) icon. No glossary lookup, no tooltip claiming a value — the real percentage sits right next to it in the text, already amber-highlighted by the existing `NUMBER_SRC` matching. This fully supersedes the need for tier-word or generic-verb detection in *new* passive content, though both older mechanisms are still live in the code (harmless — different literal tokens, no conflict) since a handful of already-tweaked passives (Duke, Gon, Killua — see Status below) still use the word-based form.

**Testing**: `tests/keywordArrows.test.ts` covers the tier-word and generic-verb paths (still exercised by not-yet-converted passives). Emoji-arrow substitution itself is exercised end-to-end via `tests/passiveMarkup.test.ts` + live verification, not a dedicated `arrowDirectionForKeyword`-style unit (the emoji match is a straight literal-character swap with no branching logic worth isolating).

## Structured passive-description format (headings + bullets + comments)

A second format change, layered on top of the emoji-arrow work: passives are now authored as one or more trigger headings, each followed by effect bullets, each optionally followed by clarifying sub-comments — not a flat prose sentence. Full grammar and rationale live as doc-comments in `lib/game/passiveMarkup.ts`; summary:

```
# When finishing a turn without receiving damage
- All enemies max HP 8% 👇 (Max 5 times) (Uncancellable)
-- Effects reset after receiving damage
```

- `# ` starts a new heading (the trigger/condition — displayed, not just an internal label). A passive can have multiple headings (Chiara: one for the per-turn random effect, a second for "At the start of turn 3").
- `- ` is an effect bullet under the current heading.
- `-- ` is a comment/clarifier attached to the immediately preceding bullet — rendered smaller/dimmer, not a sibling effect.
- `isStructuredPassiveMarkup()`/`parsePassiveMarkup()` (`lib/game/passiveMarkup.ts`) do the detection/parsing; both `PassiveProse` and the categorized "Passive Details" overlay (`lib/game/passiveDetailSections.ts`'s no-per-mechanic-description fallback path) branch on `isStructuredPassiveMarkup` and render the parsed sections instead of flat paragraphs when present — **old-format (flat-prose) passives are unaffected**, this is purely additive per-character as each one gets converted.
- Each bullet's text is still run through `KeyworkHighlighter` (number/emoji-arrow/keyword rendering all still apply) — the markup parser only handles the outer heading/bullet/comment structure, not the inline content.

**Testing**: `tests/passiveMarkup.test.ts` (8 tests) covers heading/bullet/comment parsing including malformed input (orphan comment, bullet with no heading) and blank-line handling.

## Status (as of 2026-07-29, mid-conversion)

4 of 18 playable passives converted to the final structured-markup + emoji-arrow format: **Ban, Batra, Chiara, Diane**. Tanveer is converting the remaining 14 himself (Duke, Gabrist, Gon, Isolde, Killua, Leorio, Lyra, Master Tao, Meliodas, Mustafa, Sara, Seras, Siddiq, Yalina) and will send batches of 4 for implementation. Duke/Gon/Killua currently sit in an **interim state** — reworded mid-session using the (now-superseded) generic-verb word-hiding mechanism ("ATK 50% falls", "target ATK 50% falls") rather than the final emoji format; these render correctly today but should be converted to the `#`/`-`/`--`+emoji format along with the rest when Tanveer gets to them, for consistency.

## Out of scope

- Compact battlefield tile icon (Tanveer: Unit Detail Panel only, for now).
- Archive/kit-lab static pages (no live `passiveState` there).
- Chiara's random per-turn buff/debuff half (already visible via the normal buff list; Tanveer's call not to duplicate it).
- Stat-change arrows/structured markup on **skill** descriptions (Tanveer: passives only) — skills keep the existing tier-word + `descriptionTranslator.ts` placeholder system untouched.
