# Spec — placeholders can't tell two same-type mechanics apart

**Status:** found 2026-08-20, not built. Small, self-contained, no design
decisions pending — it can land in any session.

**Impact:** a kit shape that is routine in the source material cannot be authored
without literal numbers in the prose, which is the one thing the description
grammar exists to prevent.

---

## 1. The failure

A skill with **two mechanics of the same type carrying different values** cannot
address the second one. Found while mapping this Dokkan super:

> Greatly raises DEF for 4 turns, greatly raises ATK for 1 turn and causes
> immense damage to all enemies

Two self-buffs, same `type: "buff"`, durations 4 and 1. Both placeholder forms
fail, verified by rendering:

| Authored | Renders | Why |
|---|---|---|
| `for [buff.duration] turns` … `for [buff.duration] turns` | "DEF for **4** turns, ATK for **4** turns" | `resolveByMechanicType` takes the **first** mechanic of that type; the second is unreachable |
| `for [x-ranked] turns` … `for [y-ranked] turns` | "DEF for **50** turns, ATK for **50** turns" | positional refs have **no field support** — `resolveByMechanicIndex` calls `resolveMechanicField` with no field, which picks `valuePercent` first |

The second row is the nastier one: it silently prints a stat percentage where a
duration belongs, and nothing errors.

## 2. Why the existing tools don't cover it

- `[type.field]` — `descriptionTranslator.ts`, regex
  `\[([a-zA-Z_]+)(?:\.([a-zA-Z_]+))?\]`. Resolves by **type name**, so it can
  only ever reach the first mechanic of a given type.
- `[x-ranked]` / `[y-ranked]` — regex `\[([xyzwv])-ranked\]`. Resolves by
  **position**, which is exactly the disambiguation needed — but takes no field,
  so it cannot ask for a duration.

Chiara's House Rules is the precedent that positional refs were built for: two
`seal` mechanics on different rank ladders. It works there only because the value
being printed *is* the ranked value, not a duration.

## 3. Today's workaround, and why it is not good enough

Write the numbers literally: `"…for 4 turns; …for 1 turn"`. That renders
correctly and is what the shipped kits do (Gon's "for 1 turn" is literal).

It violates the rule the whole placeholder system exists for — *never type a
number the mechanic owns* — so the prose and the data drift the first time the
kit is retuned. Ruling **#5** is the recorded cost of exactly that drift, in a
different file.

## 4. Proposed fix

Give positional refs a field, matching the syntax `[type.field]` already uses:

```
[x-ranked.duration]   [y-ranked.value]   [z-ranked.stacks]
```

Change is confined to one regex and one call in `descriptionTranslator.ts`:

```ts
// currently
result = result.replace(/\[([xyzwv])-ranked\]/gi, (_, letter) =>
  resolveByMechanicIndex(skill, LETTER_INDEX[letter], rankIndex),
);
```

`resolveByMechanicIndex` gains an optional `field` and forwards it to
`resolveMechanicField`, which **already accepts one** — so the plumbing exists
and only the parsing is missing.

**Backwards compatible.** The fieldless form keeps its current meaning, so
Chiara's House Rules and the bare-word `x-ranked` variant (a second regex at the
line below) are untouched.

### Also worth deciding at the same time

`dropZeroValueClauses` matches placeholders with its own copies of both regexes
to find a clause whose value resolves to `0` (#44). A new field form must be
added there too, or a zero-duration clause authored positionally will fail to
hide. That is the one place this change could silently regress.

## 5. Verification

- Render a two-buff skill with durations 4 and 1 and assert both appear.
- Assert `[x-ranked.duration]` and bare `[x-ranked]` disagree when a mechanic has
  both a `valuePercent` and a `duration` — that disagreement is the whole bug.
- Assert a rank-0 clause authored as `[y-ranked.duration]` still drops (#44).
- Chiara's House Rules renders unchanged at all three ranks.
- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.

## 6. Related

- Until this ships, `kitwords` tells the author to use literal durations for the
  second same-type mechanic **and to say so in the reply**, so the drift risk is
  visible rather than silent.
