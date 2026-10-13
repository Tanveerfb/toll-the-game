# Battle UI polish — 7DSGC-inspired (spec)

**Date:** 2026-07-19 · **Status:** approved, building slice 1

Adapts 7DSGC's battle-UI information design onto our existing single-viewport
HUD. **Direction (Tanveer):** keep our amber/zinc dark palette + portrait tiles;
adopt 7DSGC's *layout*, not its 3D scene. Screen-by-screen, one slice fully
polished before the next.

## Colour convention (locked)
- 🟦 **Buff = blue** (sky) · 🟥 **Debuff = red** (rose) · ⬜ **Effect
  (uncancellable) = grey** (zinc). Switches our old *green* buff to blue app-wide.

## Panels (7DSGC splits status into three surfaces)
- **A · Effects quick-panel** — click the status icons above a unit's HP bar →
  compact popup: team switcher, quick ATK/DEF/HP, list of active effects.
- **B · Full Info Panel** — the deep screen (full-body art, stat callouts,
  skill-card row, `?` → derived detailed stats). *(later slice)*
- Tile **status icons** (small colored squares above the HP bar) feed A.

---

## Slice 1 — Effects quick-panel + tile status icons  (THIS BUILD)

### Tile status icons (`TeamUnitTile`)
Replace the tiny `▲2 ▼1 ◆1` text counters with a row of small square chips —
one per active status, colored by category (blue/red/grey), a lucide glyph
inside (ArrowUp / ArrowDown / Sparkles), and a stack count when >1. Cap the row
(~6) with a `+N` overflow chip. The whole row is a button → opens the quick-panel
for that unit (`stopPropagation` so it doesn't also mark an enemy). The old
`EffectCounters` hover-tooltip is removed (superseded by the panel).

### `EffectsQuickPanel` (new component)
Modal card (amber/zinc), opened from the tile chips. Props: the tapped unit +
`playerTeam` + `enemyTeam` (for teammate switching and source lookup). Internal
`selectedInstanceId` state.

- **Team switcher (top):** avatars of the tapped unit's on-field team; selected
  is amber-ringed; tap to switch the viewed unit.
- **Stat strip:** effective ATK / DEF / HP (current/max) with lucide
  Sword/Shield/Heart icons.
- **Effect list:** buffs (blue) → debuffs (red) → effects (grey). Each row:
  category icon · **name** (`effect.name` ?? prettified type) · ⏳duration (if
  any) · ×stacks (if >1) · **description** (from `mechanicGlossary[type]`, else
  `describeEffect`; numbers tinted amber) · **source portrait** on the right when
  `effect.sourceId` resolves to a unit.
- Empty state: "No active effects." Close: ✕ + click-scrim.

Categorization (ruling #30): `buff` = buffs w/o `uncancellable`; `debuff` =
debuffs w/o `uncancellable`; `effect` = any `uncancellable` from either list.

### Also
- `STATUS_TONE.buff` (used by the existing `UnitDetailPanel`) recolored to blue
  for app-wide consistency.

### Out of scope this slice
Full Info Panel (B), NEXT telegraph, enemy hidden-deck display, controls cluster
(AUTO/pause), capsule HP-bar restyle — later slices.

**STATUS: DONE 2026-07-19 (commit 1bf5592).**

---

## Slice 2 — Vertical unit-card redesign  (Tanveer 2026-07-20)

Redesign `TeamUnitTile` into a proper **vertical card**. Tanveer's ask +
"optimize per your own choice":

- **Header on TOP** (currently our status/HP sits at the BOTTOM — flip it):
  - **Element indicator** (unit's color — Light/Red/Blue/Green/Dark) as a crest.
  - **Status chips** (the blue/red/grey squares from slice 1).
  - **HP bar** + **ult-gauge pips**, and the HP number.
- **Body: character artwork** below the header, filling the card.
- Keep name, target/sub/queued-hit badges, DOWN stamp, info affordance, and the
  flash/shake FX hooks — recomposed. Amber/zinc palette.

Reference: 7DSGC bars ride ABOVE each unit (Images 1/5) — element crest left of
the bar, HP capsule, ult pips beneath, status squares above.

### Also note — solo-boss layout (Image 5)
A single boss is centered + enlarged (vs the 3-across party). Our arena grids
enemies 2/4-up. Consider centering/enlarging a lone boss tile.

**STATUS: DONE 2026-07-20 (commit 8ba7105).**

---

## Slice 3 — Full character Info Panel (Images 2/3)

Redesigned `UnitDetailPanel`: header (close · name + element crest + tags +
Elite · teammate ‹ › nav), big ATK/DEF (left) + Remaining/Max HP (right)
callouts flanking the art with deltas, `?` → Detailed Info (eff ATK/DEF w/
delta, Crit Chance, Evade, Ult Gauge), ult pips + passive readout + `KitDetails`
below. Buffs/debuffs removed (they live in the quick-panel). Image-3 stats we
don't have (Pierce/Crit-Dmg/Recovery/Lifesteal as char stats) are omitted; no
Lv field (leveling unbuilt).

**STATUS: DONE 2026-07-20 (commit 63fcb5b).**

---

## Slice 4 — Battle HUD

- **Enemy hidden-deck strip** (face-down cards = enemy hand size, honest) +
  **capsule HP bars**. DONE 2026-07-20 (commit 2774281).
- **AUTO / auto-battle:** SKIPPED (Tanveer 2026-07-20) — pairs with the
  world-boss/farming update later.
- **Per-enemy NEXT telegraph:** SKIPPED — our AI is dynamic, a committed NEXT
  would be inaccurate; the hidden-deck strip telegraphs hand size honestly.
- **Pause:** N/A (turn-based/manual).

**Battle-UI polish batch COMPLETE.** Next in the roadmap batch: SFX + music
(audio system + royalty-free assets, Tanveer approves), then Misc.

## Testing
`npm run check` green; `/practice` 200; drive a boss fight and open the panel on
a unit carrying Corrosion/buffs. (No unit tests — presentational; verify live.)
