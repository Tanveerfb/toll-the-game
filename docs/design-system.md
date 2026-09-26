# Design system — Shōnen Ink

**Who updates this:** whoever changes a token, a type step or a rule below, in
the same change. **The values live in `styles/globals.css`**; this file says
what each one is *for*, which is the part code cannot say. A token added to
the CSS without a line here is a token nobody else knows how to use.

**Read this before any UI work.** `project-rules.md` §12–§14 apply: no raw hex,
font size or spacing value in a component, and every control is a customised
shadcn primitive (ruling #154).

---

## The motif

**Shōnen Ink** (ruling #154, 2026-09-26, chosen from four drawn options in
`docs/design/mockups/motif-options.html`). The game is a manga page: **ink
outlines, halftone screens, skewed panel cuts, offset slab shadows**, over the
anime card art.

It replaces **Combat Terminal** (2026-08-11), a tactical-HUD look of hairlines,
chamfers and cyan. Screens still painting in it are mid-migration, not a second
style; `Plans/2026-09-26-shonen-ink-foundation.md` tracks which.

### The one rule that keeps it readable

**The loud parts go on headers and primary actions only.** Skew, the action
yellow, halftone and speed lines mark *what to look at and what to press*. Kit
text, logs, lists and anything read for more than a second sit on a **plain
paper panel** with no slant. A loud motif applied everywhere is no emphasis
at all, and the kit document is the densest text in the game.

*This rule is Claude's, proposed with the mockup (#154 flags it), not his
words. He can overrule it.*

**One exception, his pick (ruling #155): the keyword marker.** In kit text a
tappable keyword wears `ink-marker`, a yellow highlighter stroke across the
lower half of the word. Yellow there is the interaction cue ("tap this"), the
same job it does on a button. See **Kit text** below.

---

## Colour

Two grounds, and every text colour belongs to one of them.

- **The ground** is the dark halftone page everything sits on.
- **Paper** is the light panel content is read on.

Ink on paper, light on ground. Never ink on ground or light on paper.

| Token (shadcn name) | Value | Job |
| --- | --- | --- |
| `--background` | `#0d0d10` | The ground |
| `--foreground` | `#f7f7f2` | Text on the ground: page titles, section labels |
| `--ground-dim` | `#b9b9b2` | Secondary text on the ground |
| `--ground-raised` | `#1c1c21` | An inactive control sitting on the ground (a tab, a chip) |
| `--ground-line` | `#33333a` | An edge on the ground. Ink is invisible there |
| `--halftone` | `#25252c` | The ground's dot screen |
| `--slab` | `#2b2b33` | Offset slab shadow cast onto the ground |
| `--card` / `--popover` | `#f5f5f0` | Paper: panels, sheets, dialogs, popovers |
| `--card-foreground` / `--popover-foreground` | `#111114` | Ink: text on paper |
| `--muted` / `--accent` | `#e7e7df` | Paper, one step down: insets, stat boxes, hovered rows |
| `--muted-foreground` | `#5d5d63` | Secondary text on paper |
| `--border` / `--input` | `#111114` | Ink outline, on paper |
| `--color-rule` (`border-rule`) | muted ink at 30% | A hairline divider on paper: list rows, a header's underline |
| `--primary` | `#ffd400` | **Action yellow.** The one thing to press, the active tab, focus |
| `--primary-foreground` | `#111114` | Text on yellow |
| `--secondary` | `#f5f5f0` | A secondary action: a paper button |
| `--secondary-foreground` | `#111114` | Text on it |
| `--ring` | `#ffd400` | Focus |
| `--destructive` | `#ff5a4e` | Forfeit, exit, anything not taken back (the red element hue, as before) |

**Yellow is system chrome, never identity.** It is what cyan `signal` was in
Combat Terminal: actions, the active state, focus, counts. It never marks a
unit, an element or a rarity.

### Element hues: unchanged

The five hues belong to **units and nothing else**, exactly as before, and the
four skill roles alias them rather than adding colours.

| Token | Value | | Token | Aliases |
| --- | --- | --- | --- | --- |
| `--color-el-light` | `#e8d174` | | `--color-role-attack` | red |
| `--color-el-red` | `#ff5a4e` | | `--color-role-heal` | green |
| `--color-el-blue` | `#37a6ff` | | `--color-role-control` | dark |
| `--color-el-green` | `#35d48b` | | `--color-role-ultimate` | light |
| `--color-el-dark` | `#a874ff` | | | |

On paper, an element hue is a **frame or a fill, never text**: most of the five
fail contrast as text on `#f5f5f0`. Put the name in ink beside the colour.

---

## Type

| Face | Token | Job |
| --- | --- | --- |
| **Bangers** | `font-heading` | Display: titles, names, primary buttons. Uppercase by design |
| **M PLUS 1p** (400 / 700 / 800) | `font-body` | Everything read. Replaced Rajdhani with this motif |

**The scale.** The floor was his pick, 2026-09-26: **"10px, 9px on cards
(Recommended)"**, an option label he selected rather than his words. Measured
before it existed: **304 hard-coded sizes across 61 files**, nine distinct
values from 7px to 17px.

| Utility | Size | Job |
| --- | --- | --- |
| `text-micro` | 9px | **Fixed-width tiles only**: the 47px hand card, unit tiles. Nowhere else |
| `text-label` | 10px | Uppercase micro-labels, badges. **The floor everywhere else** |
| `text-caption` | 11px | Secondary lines, small print |
| `text-xs` | 12px | Tailwind's own, unchanged from here up |
| `text-sm` | 14px | Body in dense panels |
| `text-base` | 16px | Body |
| `text-lg` / `xl` / `2xl` / `3xl` / `4xl` | 18 / 20 / 24 / 30 / 36px | Headings |

**Folding the old sizes:** 7px and 8px become `text-micro` on a card and
`text-label` anywhere else. 9px becomes `text-label` unless it is on a card.
12.5px, 13px, 15px and 17px go to the nearest step, judged on the screen.

**Tracking** is unchanged: `tracking-title` 0.08em, `tracking-label` 0.14em,
`tracking-eyebrow` 0.22em (Tanveer, 2026-09-17).

---

## Shape

| Treatment | Where | Never |
| --- | --- | --- |
| **Square corners.** `--radius` is 0 | Everywhere | Pills, rounded cards |
| **Ink outline**, 2px | Paper panels, controls on paper | On the ground, where ink vanishes: use `--ground-line` |
| **Skew**, −8° | Section headers, the active tab, badges | Body text, lists, anything read |
| **Parallelogram cut** | The primary button | Secondary buttons, cards |
| **Offset slab shadow**, 4–5px down-right | A paper panel lifted off the ground; the primary button | Stacked on every card in a list |
| **Halftone** | The ground | Paper |
| **Speed lines** | Behind a hero image (a boss, a pull reveal) | Behind text |
| **Section label** | `SectionHeader size="page"` (h1) or `"section"` (h2): a skewed paper label on a yellow slab, on the ground | Inside a paper panel |

---

## Kit text (ruling #155)

Kit text is **always on paper**, wherever it renders (the archive, the battle
detail panel, a dialog). The kit blocks own their paper card for that reason.

| Thing | Treatment |
| --- | --- |
| Tappable keyword | `ink-marker`: yellow highlighter, ink letters. **Paper only** |
| Footnote term (※) | The same marker, so it visibly explains the marked word |
| Number | Heavy ink (`font-extrabold`), no colour |
| Heal amount | `HEAL_NUMBER_CLASS`: a green fill behind the number |
| Stat arrow | A small green (up) or red (down) fill with an ink glyph |
| Limiter note `( … )` | The surface's colour at 70% |
| Skill slot chip | `SKILL_TYPE_CHIP`: the class hue as a fill, ink on it |
| Uncancellable | `Badge variant="ink"` |

`prose.tsx` (kit documents and news posts) is **surface-agnostic**: no colour
of its own, secondary text by opacity, rules in `currentColor`. It reads on
paper and on the ground alike.

---

## Motion

`project-rules.md` §18 as written: 150–250ms, ease-out in and ease-in out,
transform and opacity only, removed under `prefers-reduced-motion`. **The one
orchestrated moment is the battle's hit**: the existing `battle-shake` family
stays as it is.

---

## Excluded

- **Blur and glass** (`backdrop-filter`). Costly on a phone mid-battle, and it
  is the other option's look (Prism Glass).
- **Gradients**, except the ultimate's five-hue frame (#133).
- **Glow** and neon. That was Combat Terminal.
- **Rounded pills and soft shadows.**
- **Anything hover-only** (#120).
- **A sixth colour.** Yellow, ink, paper and the five element hues are the
  whole vocabulary.

---

## The battle: a split page (ruling #156)

His pick from three drawn in `docs/design/mockups/battle-ink.html`:

- **The enemy's half is the ground.** Dark tiles, framed in the element hue,
  with a slab and light text.
- **Your half is paper**, from a diagonal ink cut down through your row, the
  queue, the hand and the controls. Your tiles are ink on paper, with no
  slab: they lie on the sheet.
- **The cut carries VS** as a yellow sticker.
- **Ownership is the layout's job, not a label's.** "Enemy" and "Your team"
  are screen-reader only. His words: *"we don't want to keep the labels if
  it's obvious."*
- **A number that must read over either half is an ink chip with its meaning
  as the fill:** damage floaters, effect counts, the log's damage and heals.
- **Don't design for a flipped arena.** He: *"nothing planned that will put
  the user team on top."*

---

## Meaning, as fills

A number's meaning is a hue BEHIND it with ink on it, never coloured text:
`INK_TONE` in `components/ui/inkTone.ts`.

| Tone | Hue | Means |
| --- | --- | --- |
| `gain` | green | Gained, healed, survived, reached |
| `loss` | red | Lost, fallen, spent |
| `reward` | gold | A reward or an unlock |

A **note** is `Alert` (`components/ui/alert.tsx`): opaque paper with a heavy
left rule. `default` is ink (nothing to do), `info` yellow (worth knowing),
`destructive` red (a blocker).

---

## Components

A control comes from shadcn and is customised in `components/ui/`, once
(#154).

**Two loud buttons, never more.** `default` is the yellow primary, the one
thing to press. `ink` (ink on a yellow slab) is for the second action on a
screen that has two worth pressing, beside the primary: the character page's
Preview next to Growth (#157). Everything else is `secondary`, `outline` or
`ghost`. **A className at a usage adds what the variant cannot know** (a width,
a grid position) and never restates the look (#84). The dev-only gallery at
`/dev/ui` renders every primitive in every variant: check it before and after
touching one.
