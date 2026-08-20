---
name: kitcheck
description: Audit a character kit JSON against the design rules that are easy to get wrong — one-entry-per-effect, substat semantics, tier words, semicolon clauses, stat bands, one scaling stat, rank ceilings. Use before shipping any edit to data/characters/*.json, after drafting a collab kit, when a description reads oddly, or when Tanveer says "/kitcheck", "audit this kit", "does this kit follow the rules". Reports findings with the ruling each one cites. NEVER authors or changes a number — those are his.
---

# kitcheck

An **auditor**. It reads kits and reports what breaks a rule. It does not balance,
retune, or invent — `AGENTS.md`: *"Tanveer owns skill names, mechanical effects,
damage multipliers, and character-kit JSON decisions."*

The line this skill must not cross: **wording and structure are auditable;
values are not.** Ruling #56 closes that explicitly — *"Values are free. A number
that doesn't land on a tier is intentional, not a bug… Don't audit kit numbers
against this scale."* Lyra's 150% DEF is just 150%. Flag the **word**, never the
number behind it.

## Where the truth lives

- `data/characters/*.json` — the kits, and the source of truth for every value.
  27 files.
- `docs/design/KIT_DESIGN.md` — bands, wording rules, the draft checklist.
  **Read it before auditing a draft**, per `AGENTS.md`.
- `docs/HANDOFF.md` — the rulings each finding cites.
- `lib/game/characterSchema.ts` — the Zod contract; `descriptionTranslator.ts` —
  what the player actually reads, which is where a wording bug becomes visible.

## Do this first

1. **Read the kit whole**, not the field you were asked about. Most findings here
   are relationships between fields — a description that doesn't match its
   mechanic, a stat that scales something elsewhere.
2. **Read `KIT_DESIGN.md` §5 (wording) and §7 (engine facts)** if you have not
   this session. They are the two sections a session skims and then violates.
3. **Note the character's role and scaling stat** before judging anything. Half
   the rules below are conditional on them.

## Structural checks

| Check | Cites |
|---|---|
| `"raises ATK and DEF"` is **one** entry — `stats: ["atk","def"]`. Not two entries, and not `stat: "all"` (which sweeps in HP and substats) | #55 |
| `stat: "all"` appears only on **Seras's and Batra's** synergies. Anywhere else it is a bug | #14, #55 |
| Substat modifiers **add percentage points** — 10% lifesteal buffed 5% is 15%, not 10.5%. Basic stats multiply; substats add | #55 |
| One scaling stat per kit — ATK *or* HP *or* DEF, **heals included** | #67, KIT_DESIGN §2 |
| Skill ranks never exceed 3; ultimates carry no rank | #1 |
| Only `damageRanked` and `*Ranked` values scale with rank; flat values never do | #1 |
| Synergies target **basic stats** unless they are Seras's or Batra's | #14 |
| A friendly mechanic that the prose says hits allies declares `applyTo` (or `applyToRanked`). **Silence means self** — an undeclared ally buff is a self buff, not a bug the engine will guess around | #55, mechanic-application spec |
| `applyTo` reads `self` / `oneAlly` / `allies` / `alliesExceptSelf` / `enemies`, and `aoe` means **all enemies**, never all allies | — |
| A self buff written *after* the damage clause carries `requiresDamage: true`; one written before does not | #22 |
| A passive's `#` headings line up with its blocks, and an unconditional block is headed `# Basic effects` | — |
| Passes `characterSchema.ts` | — |

## Wording checks

| Check | Cites |
|---|---|
| Tier words match their thresholds — **only where a tier word is actually used**. Up: 30 "raises" / 50 "greatly" / 100 "massively". Down: 30 / 50 / **80** (the ceiling is lower on purpose — a stat can't reach zero) | #26, #56 |
| **The brackets in his draft decide what scales — nothing else does.** `[350]%` is ranked; `for 1 turn` written plain is flat, and so is a magnitude with no bracket. Inventing a `valueRanked` for an unbracketed value is the failure that produces every other finding in this row: *"Raises DEF for 1 turn and does [350]% damage"* became a ranked `[25,40,50]` DEF buff, which then made the tier word wrong at both ends. **A tier word and a ranked value are mutually exclusive** — a tier word means flat and unstated (*"Raises ATK and DEF for 2 turns"*), a `[buff.value]%` placeholder means shown and neutral (*"Increases all allies' ATK by [buff.value]%"*). To vary the word, the sanctioned form is a conditional (`[debuff? greatly lowers : lowers]`), which keys off state, not rank. **When a draft and the JSON disagree, re-read the draft — do not repair the JSON from memory** | #1, #26 |
| Semicolons separate the distinct parts of a description | #28 |
| Permanence is shown by **clause scope**, never by the word "Permanently" — it is gone from descriptions and from pill keys alike ("no comma, no perma"). A **debuff** must always state a duration; permanence is buff-side only | #110, amends #28 |
| One hover pill per distinct effect; phrase-level keys, not per-word pills. Generic words like "stance" are not glossary keys | #27 |
| No "own" — a raise always means the skill user | #26 |
| Durations and flags live in the text; the tooltip shows the **percentage only** | #26 |
| DoT durations are **derived** (Ignite 3, Bleed 2) and never authored into prose | #52 |
| A clause whose ranked value resolves to 0 at that rank is dropped, not written | #44 |

## Band checks — report, never adjust

HP **2900–4000**, ATK broadly unchanged, DEF at ~1.6x its pre-2026-08-10 value
(ruling #68). Buff magnitudes stay small because they multiply: **self-buff
25/50/75, team-wide 20/30/50** (KIT_DESIGN §6).

Report an out-of-band value as an **observation with the band quoted**, never as
a defect. He tunes deliberately and has moved bands before. The one thing worth
stating plainly: **inflating a stat silently buffs everything that scales off
it**, so an out-of-band stat on a kit that scales from it is worth his eye.

`storyOnly` enemy kits are **exempt** — ruling #54, they exist to diverge, and
their bands are still marked unassigned at `docs/design/KIT_DESIGN.md:83`. Passives
stay in sync with the playable twin; stats and multipliers need not.

## Judging a kit, if asked to

Never from one format. Ruling **#57**: card frequency swings **4x** between 1v1
and 4v4, so a conclusion from a duel is not a conclusion. Walk 1v1 / 3v1 / 3v3 /
4v4 before saying anything about a kit's strength — Duke read as overtuned from a
duel and is mid-pack in a team.

Remember the two engine defaults that change every fight and are easy to forget:
**5% lifesteal on everyone** (`lib/game/substats.ts`) and **0% base crit/evade**.

## The boundary

- **Never edit a multiplier, a stat, a skill name, or a mechanic.** Report and ask.
- **Never rebalance unprompted**, even when a finding looks obviously wrong.
- **Never self-select a character to work on** — `AGENTS.md`, he picks.
- A finding you cannot trace to a ruling or to `KIT_DESIGN.md` is **not a
  finding** — it is an opinion, and it goes in a separate paragraph labelled as
  one, if at all.

## Finish

A table: `file` · field · what breaks · the ruling it cites. Then one line on
whether the kit is shippable as-is, and any question that needs his answer before
it is.
