# The growth modal — what is wrong with it, and one idea that fixes most of it

**Date:** 2026-09-17 · **Status:** PROPOSAL, nothing built ·
**Subject:** `components/game/CharacterProgressionPanel.tsx` (390 lines)

He asked for a better way, judged against his three values in his order —
**consistency, modularization, QOL** (ruling #139) — saying the current version
is *"not optimized, to say the least."*

Everything below is measured. Nothing here is a taste claim, because taste is
his (#139); these are counts, and the proposal at the end is a structure.

---

## The one finding that matters

**The levelling loop is a tap counter.**

`feedManualToCharacter` spends **one manual per press**. `xpToNext(level)` is
`100 × level`, and a manual is worth 100 / 400 / 1000 XP by tier:

| journey | XP | basic manuals | advanced | premium |
| --- | ---: | ---: | ---: | ---: |
| Lv 1 → 20 | 19,000 | **190 taps** | 48 | 19 |
| Lv 1 → 40 | 78,000 | **780 taps** | 195 | 78 |
| Lv 1 → 60 | 177,000 | **1,770 taps** | 443 | 177 |

Lv 20 is not an edge case — it is the **First Ascension Trial's entry
requirement**, so 190 taps is on the critical path of the content that exists
today.

**And the fix is already in the same file, twelve lines further down.** The
ultimate control does not work this way. Its own doc comment says why:

> *"A slider rather than a row of +1 buttons because the whole climb is five
> coins: the player picks a destination and pays once, instead of tapping
> through five confirmations."*

**Five confirmations was worth designing around. One hundred and ninety is
not?** The same modal answers the same question — *how do I spend a stack of
things to raise a number?* — two different ways, and the worse way is on the
bigger number.

---

## The other three

### Consistency — three shapes for one interaction

| section | how the player picks | how cost is shown | commit |
| --- | --- | --- | --- |
| **Level** | no target — one manual per tap | a count in each button's own label, `Feed Training Manual (12)` | three buttons |
| **Ascension** | no target — one tier at a time | `AscensionCost` chips, short ones in `el-red` | one button |
| **Ultimate** | **slider to a target level** | one coin line plus the full ladder | one button |

Three sections, three vocabularies. The `AscensionCost` chip is the good one —
icon, cost, held, red when short — and it is used by exactly one of the three.

### Modularization — the same concept written three times

*"Here is the price, here is what you hold, here is the button"* is implemented
independently in each section. A fourth growth axis (and `ascension.ts` already
says bands 4–6 are coming) means writing it a fourth time.

There is also a **`Hint` wearing `buttonVariants` to impersonate a disabled
button** (lines 113–124). The comment explains it well — a real disabled button
cannot be tapped, so its reason is unreachable on a phone — but the outcome is a
button-shaped thing that is not a `Button`, which is the exact drift
`tests/buttonPrimitive.test.ts` exists to stop.

### Performance — the panel subscribes to the whole store

```ts
const state = usePlayerStore();   // line 35, and again at line 228
```

No selector, so **every write to `playerStore` re-renders the entire panel** —
every currency change, every inventory change, every stamina spend.

Measured across `app/` and `components/`: **88 selector subscriptions
(`usePlayerStore((s) => …)`) against 3 whole-store ones — and 2 of the 3 are
this file.** The third is the dev panel. So this is not a style question; it is
one file departing from a convention the other 88 follow.

### QOL — nothing shows what you get

No section previews its result. You spend a pile of sea monster eyes to ascend
and the modal never says what the stats become. `progressedStats()` already
exists in `lib/game/progression.ts` and `CharacterBrowser` already calls it, so
the number is one function call away and is simply not asked for.

---

## The idea

**All three sections are the same interaction. Make them the same component.**

> **Pick a target → see the cost and the result → commit once.**

The ultimate control is already exactly this. The proposal is to stop treating
it as the odd one out and make it the pattern.

### `GrowthStep` — one component, three instances

| slot | Level | Ascension | Ultimate |
| --- | --- | --- | --- |
| **target** | slider to a level | next tier (single step) | slider to an ult level |
| **cost** | `CostChip`s: manuals + coin | `CostChip`s: eyes, seaweed, coin | `CostChip`: character coins |
| **result** | HP/ATK/DEF before → after | before → after, plus the new level cap | the ladder, target marked |
| **commit** | one `Button` | one `Button` | one `Button` |

`AscensionCost` becomes **`CostChip`** and all three use it. That is the
modularization half, and it is small — the component already exists and already
handles the short-of-it case.

### What has to be built underneath

**One store action**, mirroring one that already exists:

```ts
levelUpUltimate(characterId, targetLevel)   // exists today
levelCharacterTo(characterId, targetLevel)  // the proposal
```

Same contract as its sibling: all-or-nothing, forward-only, returns `false`
without changing anything if the player is short. The slider is clamped to what
the inventory can actually reach, so it can never propose a purchase the store
will refuse — which is the rule the ult slider already follows.

### The rest

- **Selectors**, not `usePlayerStore()`. Four or five named reads.
- **Result preview** via `progressedStats` — one row, before → after. This is
  the cheapest QOL win on the list and it applies to all three sections.
- The `Hint`-as-disabled-button goes away on its own: with a target slider,
  "you own no manuals" is a **disabled slider with a reason line beneath it**,
  not three separately-explained dead buttons.

---

## What is his to decide

1. **Which manuals does a target-level commit spend?** Cheapest-first burns the
   basic stack and hoards premiums; largest-first is fewer items but wastes
   overflow XP at the cap. There is a real design opinion in that and it is
   **not mine to pick** — it decides whether premium manuals feel precious.
   A third option: let the player choose, with cheapest-first as the default.

2. **Is one long modal still right?** With result previews added, three stacked
   sections get taller. Level / Ascend / Ultimate as three segments in the modal
   would keep it to one screen at 390px. **His call** — it is layout, and he has
   just been through the archive page being too squeezed.

3. Whether to do this at all, or only the parts that pay for themselves. The
   **target-level slider is the one that matters**; everything else on this page
   is tidying by comparison.
