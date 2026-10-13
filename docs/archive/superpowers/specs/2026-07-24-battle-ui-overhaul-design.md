# Battle UI Overhaul — Design

**Status:** Approved 2026-07-24 (brainstormed with visual companion mockups). Ready for implementation planning.

**Problem:** The combat UI reads as "basic and cheaply crafted" next to reference games (7DS Grand Cross, Dokkan Battle). This is three overlapping gaps — visual impact/juice, layout & information density on phone, and art/presentation polish (card frames, portraits, effect icons reading as generic). Fixed as one holistic pass, since all three live on the same screen and redesigning layout without accounting for reveal-animation space would cause rework.

**Reference split (locked earlier):** 7DSGC owns the skill-deck/hand system, info panels, and character-detail screens (fidelity gap, not a wrong reference). Dokkan owns battle flow, team-panel/turn structure, and Super-Attack-style reveal cutscenes on big hits. These are inspiration, not blueprints — only the parts named here are in scope.

---

## 1. Battle screen layout — "Balanced Stack"

Single portrait viewport, mobile-first, no scroll. Top-to-bottom:

1. **Turn counter + menu** — thin top strip (turn number left/center, `☰` menu right).
2. **Enemy row** — enemy portrait-cards in a row, each with an HP bar. The currently-targeted enemy gets **red corner brackets** overlaid directly on its card (camera-reticle style, from `7dsgc-enemy-target-marker.jpg`) — not a separate arrow/glow.
3. **Battle stage (center)** — the focal area where all attack VFX and reveal animations play (see §2). Static card art for attacker/target; element-colored effects travel across it. This replaces the old idle-pose/terrain area.
4. **Ally row** — ally portrait-cards with HP bars (+ gauge indicator).
5. **Card hand (always visible)** — a fanned row of playable skill cards (see §3). Never a button list.
6. **Team bar** — compact per-unit dots/thumbnails, bottom edge.

**Big-hit focus (narrow steal from the "cinematic" option):** on R3/ultimate reveals the center stage momentarily expands/takes visual focus (surrounding UI dims/recedes), then restores. This is a transient state during the reveal only — **not** a permanent hand-drawer. The hand stays persistently visible in normal play.

**Layout status:** the previously "locked" single-viewport HUD convention (`tanveer-ui-layout-preferences`) was explicitly reopened for this redesign. Amber/zinc palette and portrait-tile language survive by choice, not by prior lock.

---

## 2. Reveal escalation

Animation intensity scales by significance. Element color per the locked type system (Dark / Light / Red / Green / Blue) drives every effect's tint. **Card-based VFX only** — effects travel over static card art (beam/projectile/burst A→B). No character sprite or 3D-model animation of any kind (the ComfyUI pipeline produces one static portrait per character, not a consistent multi-pose model; that's a separate future experiment, not a dependency here).

| Tier | Treatment |
|------|-----------|
| **Basic attack** | Fast tiny spark, no fanfare. Fires constantly, stays cheap. |
| **R1 skill** | Element projectile A→B + burst ring at target. Reads as "a move." |
| **R2 skill** | Bigger projectile, target shake, stage brightness pulse. A step up. |
| **R3 skill** | Caster wind-up zoom, beam sweep, screen shake + brief white flash. |
| **Ultimate** | Screen dims → caster card slams in with a name banner → mega beam → heavy shake → white flash → restore. Full cutscene moment. |

Curve confirmed via animated mockups: basic stays silent (tiering starts at R1), gentle ramp, ultimate is the only full-cutscene tier — R3 gets shake+flash but not the dim/slam/banner treatment reserved for ultimate.

**Implementation note:** evolve the existing `hooks/useBattleSequencer.ts` and `components/game/BattleEffectsOverlay.tsx` rather than greenfield. Reveal tier is a property of the played card's rank/type; the sequencer already sequences battle events.

---

## 3. Card frames — "Clean"

Rank must read at a glance without reading text. Minimal flat frames, rank by border color + weight + accent:

- **R1** — thin bronze border.
- **R2** — thin silver border.
- **R3** — gold border + a top accent bar.
- **Ultimate** — cyan/frost border + cyan accent bar. Its own frame language, distinct from the bronze→silver→gold rank ladder (an ultimate is not "beyond gold," it's a separate class).

Every card carries a **type dot** (element-colored, one corner) and a **star-count** (rank). Chosen over the "ornate" alternative for mobile: less clutter around the art, scales when the hand is crowded.

**Rank-up-by-merge feedback (existing mechanic):** when two same-rank cards merge, the merged card's star/rank indicator updates and a **Reset/undo** affordance appears to unwind the staged merge before the turn locks in (from `7dsgc-battle-screen-after-merge.jpg`). Match this rather than inventing new feedback.

---

## 4. Substats — inline drawer

A `▾ Substats` chevron under the basic ATK/DEF/HP block expands the substat list **in place** (no modal, no screen change). Shows the 4 built substats: Crit Damage, Recovery Rate, Lifesteal, Crit Resistance. Chosen over modal / "?"-button patterns because substats are glance-at reference info, and the drawer degrades cleanly into the cramped in-battle mini-panel where a modal would feel heavy. Same component reused in both the character-detail screen (§5) and the in-battle mini-panel (§6).

---

## 5. Character detail navigation (Dokkan flow, 7DSGC look)

Navigation structure borrowed from Dokkan, visual language stays 7DSGC-referenced. Likely evolves the existing `UnitDetailPanel` / `EffectsQuickPanel` (built 2026-07-19/20), not greenfield — check those first.

- **Bottom-right cluster** (Dokkan's "Next Up" stack) → opens **Team Details list**: every party member as a row (portrait thumbnail, quick icons, Lv/ATK/DEF, signature skill name).
- **Tapping a member row** → **Character Detail card**: big art, type badge, HP/ATK/DEF large callouts, leader-skill-equivalent text, substat drawer (§4), with swipe/pagination across teammates.
- **Character Detail card** has a **Super Attack row** and a **Passive Skill row**, each with its own **"Details" button** → opens a shared **Detail Overlay** component (one reusable overlay parameterized by content — not two separate modals; same title-bar + close chrome).
- **Passive Details content pattern:** categorized condition headers (e.g. "Basic effect(s)", "When attacking", "Every turn") each followed by a bulleted effect list. A legible template for multi-effect passives (e.g. Molvarr boss passives) vs. one dense paragraph.
- **Tag/category chips** are in scope → tapping a chip opens a **Character List overlay** (grid of every owned character carrying that tag, portrait + badge only, no stats).
- **Keyword highlighting + glossary footnotes:** skill/passive descriptions highlight named terms inline (colored/bold) with a `※` footnote glossary line per term. **Reuses the existing `lib/game/mechanicGlossary.ts` + description-translator** — this is a presentation upgrade (inline colored highlights + footnote), not new plumbing. Compare against current implementation first.

**Explicitly dropped (no equivalent mechanic):** Link Skills, Skill Orb, Hidden Potential, ki meter/gauge.

---

## 6. In-battle mini info panel

Tapping a unit **during battle** opens a lightweight overlay layered over the dimmed HUD (distinct from the fuller detail screen in §5). Contents: type/category icon row, portrait + name + ATK/DEF/HP, the **substat drawer (§4)**, and the Super ATK / Passive rows with Details buttons (reusing the §5 Detail Overlay).

**No live combat-stat tracker row in this pass** (attacks/crits/hits-taken/evades counters). Deferred to a later pass — the panel ships with stats + skill/passive details only. Good candidate to extend the existing `EffectsQuickPanel` tap-to-open pattern.

---

## 7. Folded-in fixes

Small adjacent items on the same screens, included here rather than as separate tickets:

- **Viewport meta:** `app/layout.tsx` has no `viewport` export. Without `width=device-width`, mobile renders at ~980px desktop width and zooms out — alone enough to make the game feel cramped/tiny on phone. Add `export const viewport` per Next.js App Router convention (one line).
- **Touch targets:** bump sub-44px controls on the battle screen (StatusChips icon buttons, UnitDetailPanel step buttons, the "?" toggle, the Info button) to ~44px hit area via padding — icon size unchanged, not a layout redesign. Add `aria-label` to icon-only buttons. (Already itemized in `docs/TECH_AUDIT.md`.)
- **Kit Lab → player Preview:** the dev-only Kit Lab sandbox is unused. Retire `/kit-lab` + `app/api/kit-lab/route.ts`; **keep and repoint** its reusable simulator internals (`damagePreview.ts`, `startCustomBattle`, the "Test in Battle" launch path) into a **player-facing Preview** feature — launched from a "Preview" button on a skill/ultimate info screen, running an isolated 1v1 sandbox vs. a dummy enemy (from `7dsgc-preview-mode.jpg`), with the full rank/ultimate set available and a Reset to replay effects.

---

## Out of scope (confirmed)

- Enemy "NEXT" action telegraph (AI is dynamic; a committed telegraph would lie).
- AUTO / speed-multiplier toggles (deferred to the world-boss/farming update).
- Character sprite / 3D-model animation.
- Victory/results-screen polish (captured for a later pass).
- The 5 candidate future substats (Pierce Rate, Resistance, Regeneration Rate, Crit Chance, Crit Defense) — reference for a future brainstorm, not this build.
- Live combat-stat tracker row in the mini-panel (§6).

---

## Testing / verification

- Engine/logic changes (reveal-tier selection, Kit Lab internals repoint) covered by Vitest, `npm run check` green.
- Visual work (layout, frames, reveals, panels) verified live in Chrome at mobile and desktop viewports — screenshot/interaction review, since animation timing isn't unit-testable.
- Touch targets + viewport verified in Chrome DevTools device toolbar.
- No regression to existing battle flow, deck/merge mechanic, or archive screens.

## Component touch-list (starting points, not exhaustive)

- `components/game/BattleArena.tsx` — main battle screen layout.
- `hooks/useBattleSequencer.ts`, `components/game/BattleEffectsOverlay.tsx` — reveal VFX.
- `components/game/UnitDetailPanel.tsx`, `EffectsQuickPanel` — detail/mini panels, substat drawer.
- `lib/game/mechanicGlossary.ts` + description-translator — keyword highlight/footnotes.
- `lib/game/damagePreview.ts`, `startCustomBattle`, `app/api/kit-lab/route.ts` — Kit Lab → Preview.
- `app/layout.tsx` — viewport meta.
- Card component(s) for the hand — frame/rank/type styling.
