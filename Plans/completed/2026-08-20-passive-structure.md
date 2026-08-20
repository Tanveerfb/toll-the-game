# Spec — passives: multiple condition blocks, and conditions on the target

> **BUILT 2026-08-20.** `PassiveBlock` in `types/passive.ts`, `lib/game/passiveBlocks.ts` as the sole reader (enforced by a scan in `tests/passiveBlocks.test.ts`), one queue registration per block, and `targetTagBonus` for §4. Molvarr's phase-passive ARRAY was left as authored — it flattens identically. The text below is the record of why, kept as written.

**Status:** built 2026-08-20 (see the banner above). Found 2026-08-20 while mapping Dokkan passives
onto our kit format, at Tanveer's direction: *"you can ignore what's not in our
game pretty much. but learn from how the dokkan words and frames the
descriptions."*

**Two independent changes.** §3 (condition blocks) and §4 (target conditions) do
not depend on each other and can ship separately.

---

## 1. What prompted it

Two real Dokkan passives, one modern and one old. The old one is the honest
target — it is close to our shape and still doesn't fit:

> **Super Saiyan for Starters**
> **Basic effect(s)** — ATK & DEF 110%, damage reduction rate 21%
> **When attacking an Extreme Class enemy** — Ki +3, ATK 10%, DEF 40%

Dokkan's Super/Extreme classes are hero/villain. Tanveer's mapping: *"just assume
it would target a tag such as 'Powerful Opponent' or something instead of extreme
class enemy."*

So in our terms:

```
# Basic effects
- ATK 110% 👆 and DEF 110% 👆
- Damage reduction 21% 👆

# When attacking a [Demon] enemy
- ATK 10% 👆
- DEF 40% 👆
```

Two things stop that being authorable. Neither is about complexity — the modern
passive had seven blocks and fails for the same two reasons the old one does.

**On the numbers, for calibration:** damage reduction **21% is inside our band**
(Iron Wall 25/30/40, Mustafa 25/40/60). The **110%** is not — our passive auras
sit near 10% (Seras's synergy). Their stat economy is an order of magnitude
above ours; their *structure* is what transfers.

## 2. What already works — do not rebuild it

- **Multiple `#` blocks in the markdown.** Chiara's "Cut the Deck" already has
  two headings. The *display* format is fine; it is the mechanics behind it that
  are single-trigger.
- **An attacker's passive inspecting its target.** `bossDamageMultiplierVsTarget`
  (`lib/game/bossPassives.ts:62`) already reads target state and returns a damage
  multiplier:

  ```ts
  const corroded = target.debuffs.some((d) => d.type === "corrosion");
  ```

  It reads a debuff rather than a tag, but the plumbing exists. And the family is
  **not boss-locked** — the comment at `bossPassives.ts:20` says the `boss`
  prefix is historical, and `activeBossMechanics` falls back to a non-phased
  unit's single passive, so a playable kit can author one.
- **Enemy kits carry tags.** `molvarr` is `["Demon"]`, `wild_beast` is
  `["Beast"]`, the rest `["Human"]`. A target-tag condition has real data to read.
- **The vocabulary.** `SynergyMechanic` already has `conditionTags` and
  `conditionColors` (`types/mechanic.ts:236`). They are aimed at teammates; the
  fields themselves need no design.

## 3. Change one — one passive, made of blocks

### The shape, settled 2026-08-20

Tanveer, asked to choose between giving playable kits a `passives` array and
adding per-mechanic conditions, picked **neither**:

> *"Keep it the dokkan way. it basically is a single but possibly long passive.
> this means molvarr passives can be combined into one per phase too."*

So a character has **exactly one passive**, and that passive is a list of
**blocks** — each with its own trigger and its own mechanics. A Dokkan passive is
one named ability with several condition headings, and ours becomes the same
thing.

```ts
interface PassiveBlock {
  trigger: PassiveTrigger;
  mechanics: Mechanic[];
  /** The `#` heading this block renders under. */
  heading?: string;
}

interface Passive {
  name: string;
  description?: string;   // markdown; its headings are the blocks
  worksFromSub?: boolean;
  blocks: PassiveBlock[];
}
```

**This removes a split rather than adding one.** Today bosses have
`passives?: Passive[]` (`types/character.ts:22`) while playable kits have
`passive?: Passive` (`:59`), and the type comment calls that difference
deliberate. Under his direction both become one passive with blocks — Molvarr's
**three** phase-1 and **four** phase-2 passives collapse into one per phase, and
the playable/boss asymmetry disappears entirely.

### What it fixes for free

The markdown headings can now **map 1:1 to blocks**. Today the display is
authored prose and the mechanics are a flat array with nothing tying a heading to
the mechanics under it — `tests/passiveDescriptionSync.test.ts` only checks that
every "N%" in the prose appears *somewhere* in the data. With `heading` on the
block, that coupling can be checked properly instead of loosely.

### Migration — wide and mechanical

Every existing passive has one trigger and one mechanics array, so it becomes a
single block. Purely a re-shape, no behaviour change.

The cost is the read sites: **105 references to `.passive` / `.passives` across
15 files** —

`lib/game/` — `passive.ts` (registration), `combat.ts` (Deathblow crit, the
attack-shift counter), `evade.ts` (charged stacks), `bossPassives.ts`,
`passiveStacks.ts`, `lethal.ts`, `tick.ts`, `phases.ts`, `damagePreview.ts`,
`characterCatalog.ts`, `battleReport.ts`; plus `hooks/BattleProvider.tsx`,
`components/game/KitPhases.tsx`, `components/game/battle/UnitDetailPanel.tsx`,
`lib/duel/serializeState.ts`.

Most read `char.passive?.trigger` or `char.passive?.mechanics`. **A helper that
flattens blocks to mechanics** (`activeMechanics(char, trigger)`) would let most
of those sites change in one line each rather than being rewritten — worth
building first and migrating onto, rather than editing 105 call sites by hand.

`activeBossMechanics` in `bossPassives.ts` already does something close for the
phase case and is the natural model.

### Settled: `worksFromSub` stays per passive

Tanveer, 2026-08-20: *"stays per passive."* It remains a property of the whole
passive as it is today (`types/passive.ts`), not per block — so a passive is
bench-active or it isn't, and every block inside inherits that.

### Settled: the heading for unconditional effects

Dokkan's "Basic effect(s)" block has no *named* equivalent here. Leorio's passive
puts its unconditional line as a **leading bullet before any heading**, which
works but is implicit; Chiara's opens straight into a condition, leaving an
always-on effect nowhere natural to sit.

**`# Basic effects`** — Tanveer, 2026-08-20: *"'always' block can be renamed to
'basic effects' block i guess. much more generalized but simple."* Use that
heading verbatim. With blocks (§3) it stops being only a display convention: it
becomes the `heading` of the block whose trigger is `aura` or `always`.

Record it in `kitwords` when this ships — not before, since the format cannot
hold it yet.

## 4. Change two — conditions on the target's tag

Nothing reads the target's tags. Given §2, this is a small step: the same shape
as `bossDamageMultiplierVsTarget`, reading `target.tags` instead of
`target.debuffs`, with `conditionTags` / `conditionColors` reused from
`SynergyMechanic`.

**The ally-side twin is smaller still.** Tanveer, 2026-08-20: *"buffs or effects
triggering based on team members will also be a thing in the future. e.g. if a
[human] ally is on the team : atk 50% up."* `characterSynergy` already does
exactly that shape — `requiredCharacterIds: ["gon","killua"]`, a buff when
present and more when both are alive (#24). His version keys on a **tag** instead
of ids, so it is a variant of a shipped mechanic rather than a new concept.

### Settled — key the condition on an authored tag

`[Powerful Opponent]` currently sits on **Seras, a playable character**, and her
synergy grants +10% all stats to every *teammate* carrying it (#14) — where she
is the only carrier. Point a "when attacking a [Powerful Opponent] enemy"
condition at the same string and it means two unrelated things.

His question, 2026-08-20: *"what if seras is an enemy… then would a character
gaining extra abilities when facing 'powerful opponent' work against her?"*

**Answer: yes, because the story kit carries the tag.** Ruling **#54** was
corrected the same day — a `storyOnly` kit *may* diverge from its playable twin,
but is not obliged to, and **tags are shared by convention**: *"i would have tags
shared at the very least."* So `seras_npc` carries `[Powerful Opponent]` and the
condition fires.

**Decision: an authored tag on the kit** (option A). Deriving it from
`tier: "elite"` was considered and **rejected** — his reasoning: *"'tier' or
'elite' is not a tag. its an enemy type I guess."* It is an action-economy
marker (3 actions per turn even solo), a different axis entirely, and overloading
it would couple kit conditions to combat pacing.

The objection raised against option A — that a boss drafted without the tag makes
a boss-killer passive silently inert — is **much weaker under the shared-tag
convention**, since a story kit inherits its twin's tags by authoring habit rather
than needing them remembered from scratch. Worth a schema warning rather than a
different design.

**Settled 2026-08-20 — there is no collision, and no rename.** The concern raised
here was that `[Powerful Opponent]` would mean two things. It does not. Tanveer:
*"Human Fairy Hybrid Female Powerful Opponent tags. her npc version would also
carry those. simple."*

A tag is a property of the **character**, not of a mechanic. Seras's synergy
reads her *teammates'* tags; a boss-facing condition reads the *target's*. Same
string, both readings true, nothing overloaded — the tag says "this unit is a
powerful opponent" and that is as true of enemy Seras as of playable Seras.

This also confirms the shared-tag convention concretely: her NPC kit carries the
same five tags, which is what makes the condition fire (#54).

### The condition is symmetric — reference data

The same mechanism serves both directions. An enemy conditioning on **your**
units' tags is still "attacker inspects target", so it needs no extra code. His
example, 2026-08-20: *"what if an enemy does extra damage against 'human'
characters?"*

Roster tag distribution, counted 2026-08-20 — recorded so it does not have to be
re-derived, **not** as a balance opinion (kits and their balance are his):

| | Count | Which |
|---|---|---|
| Playable | 18 | |
| Carrying `Human` | 15 | |
| Not | 3 | `diane` (Giant) and `meliodas` (Demon), both Collab with no acquisition path (#89); `isolde` (Fairy) |

Enemy side: `molvarr` is `["Demon"]`, `wild_beast` is `["Beast"]`, every other
story kit is `["Human"]`.

One structural note for whoever implements this, not a balance one: **a character
may carry several race tags at once** — Seras is `Human, Fairy, Hybrid` — so a
target-tag condition must be written as "has this tag", never "is this race", and
two different conditions can both match the same unit.

`Master_Context.md` carries the canon race system (Humans, Fairies, Angels,
Demons, Hybrids), so the tag vocabulary has a source of truth outside the kits.

### Bug found in passing

`lib/game/characterCatalog.ts:74` documents the elite bosses as
*"Tao/Seras/Lyra_npc"*, but only `lyra_npc` and `molvarr` actually carry
`tier: "elite"`. Master Tao and Seras are playable kits with no tier at all. The
comment describes an intent the data does not have — same drift family as ruling
**#5**. Fix it whenever someone is in that file; it is not part of this spec.

## 5. Deferred — his roadmap, not rejections

Recorded 2026-08-20 from his own words, so a future session treats these as
*planned and not yet started* rather than as gaps to re-argue or as things ruled
out. His framing: *"this mechanic will definitely come in the future. just our
game isn't complex at this point. baby steps."*

### Counting the character's own attacks — the single highest-value addition

Three separate Dokkan blocks collapse into this one missing piece, and he
confirmed it by rewriting a fourth around it: an entry-turn condition *"can be
rehashed into 'every time after launching 4 attacks in battle'"*.

Nothing counts attacks the character **performs**. What exists:

| Mechanic | Counts | Repeats? |
|---|---|---|
| `statShiftAfterAttacks` | attacks **received** (`combat.ts:137` hard-gates on `onAttackReceived`) | **No** — one-shot via `statShiftTriggered`; `maxTriggers` is never read |
| `chargedStacks` | attacks **received** | Yes, capped by `maxStacks` |
| `momentumStacks` | every card the **team** plays (#34) | Yes, capped |

So the shape (repeating, capped, stat-shifting) is well established; only the
subject is missing. Build this and "every N attacks, gain X up to Y" becomes
authorable, which covers the per-attack ramp, the attack-count trigger, and the
delayed-evade block in one go.

### Ally-tag conditions

*"buffs or effects triggering based on team members will also be a thing in the
future."* See §4 — `characterSynergy` is the precedent, keyed on ids rather than
tags.

### Two gaps that are narrower than they look

Both found 2026-08-20 on a third Dokkan passive, and both are **extensions of a
shipped mechanic rather than new machinery**.

**Action-ordinal conditions.** `onFirstAction` already exists and Lyra's
"First Action: Unbreakable Ice" uses it — *"When performing first in a turn →
DEF 150% for 1 turn"*, unstackable and uncancellable. So conditioning on action
order is supported; the **ordinal is hard-wired to first**. A Dokkan block like
*"when the character is the 2nd attacker"* needs that generalised to an Nth
position, not a new concept invented.

**Losing a buff after N attacks received.** The Dokkan phrasing was *"before
receiving 3 attacks: damage reduction 66%"*, which reads as a buff that expires
on a counter. Tanveer's rewrite, 2026-08-20: *"it can be reworded the opposite
way. like — after receiving 3 attacks: DR 66% down."*

That is exactly `statShiftAfterAttacks`: `onAttackReceived`, fires once at
`attacksRequired`, applies a **signed** shift. Gon runs `-50` ATK / `+100` DEF
through it today. The only thing missing is a damage-reduction field beside
`atkShiftPercent` and `defShiftPercent`.

Worth noting what the rewrite buys: framing it as a **loss after a threshold**
rather than a **grant before one** turns an expiring conditional into a one-shot
the engine already models.

### Genuinely out of scope

- **Additional attacks.** His words: *"which wouldn't be a thing."* Extra actions
  exist only as a stage effect (`bonusActions`, `lib/game/stageEffects.ts`) and
  will not become a per-character mechanic. Every Dokkan clause about launching
  an extra attack or Super Attack is dropped on sight, not translated.
- **Ki.** No equivalent resource; ours is the ult gauge plus card draw, a
  different economy rather than a missing field.
- **Triggers we lack and have not planned:** on-enter (sub promotion fires no
  passive trigger — and his rehash above routes *around* needing it), on-evade
  (`onAttackReceived` fires on being hit), on-revive (`surviveLethal` exists per
  #29 but nothing can hang effects off it).
- **Scoped durations** like "within the character's next attacking turn". We have
  turn counts, not action-relative windows.
- **HP-threshold conditionals.** `conditionalBuff` exists but is Duke-shaped
  (`conditionStacks`, `atkDownPercent`); there is no "when HP ≥ N%" variant.

## 6. Verification, when built

- A playable kit with two passive blocks, each firing on its own condition, with
  the archive rendering both headings.
- A target-tag condition firing against `molvarr` (`Demon`) and not against
  `wild_beast` (`Beast`).
- Every existing passive behaves identically — 27 kits, and `aura`/`always`
  passives especially, since they are the ones §3 restructures.
- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.
- Build with `NEXT_DIST_DIR`. **:3000 is his dev server — never start or kill one.**
- **Visual pass is his** — the archive renders passive markdown, so a structural
  change is visible there before it is visible in a fight.
