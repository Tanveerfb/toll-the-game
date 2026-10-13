# Battle UI Overhaul — Implementation Plan

> **For agentic workers:** Execute task-by-task on branch `battle-ui-overhaul`. Spec: `docs/superpowers/specs/2026-07-24-battle-ui-overhaul-design.md` — read it first, it's the source of truth. Steps use `- [ ]` for tracking.

**Goal:** Rebuild the battle screen to reference-game fidelity (7DSGC deck/panels + Dokkan flow/reveals), fix mobile gaps, repurpose Kit Lab into a player Preview.

**Architecture:** Evolve existing components, don't greenfield. Reuse `BattleArena`, `useBattleSequencer`, `BattleEffectsOverlay`, `UnitDetailPanel`/`EffectsQuickPanel`, `mechanicGlossary`, `damagePreview`/`startCustomBattle`. Palette stays amber/zinc. Card VFX only (no sprites).

**Tech stack:** Next.js 16, React 19, Zustand, Tailwind 4, shadcn, framer-motion, Vitest.

**Global rules:**
- TDD where logic is testable (reveal-tier selection, Kit Lab internals, glossary parsing). Visual/layout/CSS work → verify live in Chrome (mobile 375px + desktop), no fake unit tests.
- `npm run check` (tsc + eslint + vitest) green after **each** task before moving on. Commit per task.
- Do **not** touch anything in the spec's "Out of scope" list.
- Mechanics/balance are **[Tanveer]**'s domain — if a task would change a game rule/number, stop and flag, don't guess.
- Existing battle flow, deck/merge mechanic, and archive screens must not regress.

---

### Task 1: Viewport meta fix

**Files:** Modify `app/layout.tsx`.

- [ ] Add `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` (Next.js App Router convention, import `Viewport` type from `next`). Do not disable zoom.
- [ ] Verify in Chrome DevTools device toolbar (375px) that the app renders at device width, not zoomed-out ~980px.
- [ ] `npm run check` green. Commit.

---

### Task 2: Touch targets + aria on battle screen

**Files:** Modify `components/game/BattleArena.tsx` (StatusChips icon buttons, Info button), `components/game/UnitDetailPanel.tsx` (step buttons, "?" toggle). Cross-check items in `docs/TECH_AUDIT.md`.

- [ ] Bump each sub-44px control to ~44px hit area via padding/min-width/min-height only — icon glyph size unchanged. No layout redesign.
- [ ] Add `aria-label` to every icon-only button touched (alongside existing `title`).
- [ ] Verify hit areas in Chrome device toolbar. `npm run check` green. Commit.

---

### Task 3: Card frame component — "Clean" style

**Files:** Locate the current hand/skill card component under `components/game/` (read first to find it). Modify it; add rank/type styling. Test any pure helper (rank→style mapping) in a new `tests/` file.

- [ ] Frames by rank: R1 thin bronze border, R2 thin silver, R3 gold + top accent bar, ultimate cyan/frost + cyan accent bar. Ultimate is a distinct frame class, not "beyond gold."
- [ ] Every card shows a type dot (element-colored: Dark/Light/Red/Green/Blue) and star-count = rank.
- [ ] Target enemy card gets red corner brackets (reticle style) — reuse/verify against `docs/design/references/battle-ui-refs/7dsgc-enemy-target-marker.jpg`.
- [ ] Rank-up-by-merge feedback: merged card's star/rank indicator updates; a Reset/undo affordance appears to unwind the staged merge before the turn locks. Match `7dsgc-battle-screen-after-merge.jpg`.
- [ ] Verify all 4 tiers + target bracket + merge feedback in Chrome. `npm run check` green. Commit.

---

### Task 4: Substat inline drawer

**Files:** New reusable component under `components/game/` (e.g. `SubstatDrawer.tsx`). Consumes the 4 built substats via existing `lib/game/substats.ts` getters.

- [ ] `▾ Substats` chevron expands the list in place (no modal): Crit Damage, Recovery Rate, Lifesteal, Crit Resistance, each with its effective value.
- [ ] Collapses/expands smoothly; works in a narrow container (it's reused in the cramped in-battle panel).
- [ ] Verify expand/collapse in Chrome. `npm run check` green. Commit.

---

### Task 5: Reveal escalation tiers

**Files:** Modify `hooks/useBattleSequencer.ts` and `components/game/BattleEffectsOverlay.tsx`. Add a pure "reveal tier from played card" helper with unit tests.

- [ ] Pure helper: given a battle action (basic / R1 / R2 / R3 / ultimate + element), return a reveal-tier descriptor. **TDD this** — test each rank maps to the right tier and element→color.
- [ ] Wire tiers into the overlay: basic = silent spark; R1 = projectile + burst; R2 = bigger orb + target shake + brightness pulse; R3 = wind-up zoom + beam + shake + flash; ultimate = dim → caster slam-in + name banner → mega beam → heavy shake → white flash → restore. Element color tints every effect. (Mockup reference: `.superpowers/brainstorm/*/content/reveal-tiers.html`.)
- [ ] Respect `prefers-reduced-motion` (reduce/disable the heavy shake/flash).
- [ ] Verify each tier live in Chrome by triggering the relevant card in a practice battle. `npm run check` green. Commit.

---

### Task 6: Battle layout — "Balanced Stack"

**Files:** Modify `components/game/BattleArena.tsx` (main layout). Uses Task 3 cards + Task 5 stage.

- [ ] Restructure to the vertical stack: turn/menu strip → enemy row (with target brackets) → center battle stage → ally row → always-visible fanned card hand → team bar. Single portrait viewport, no scroll at 375px.
- [ ] Big-hit focus: on R3/ultimate reveal the center stage takes transient visual focus (surrounding UI dims/recedes) then restores. Hand stays persistently visible in normal play — no permanent drawer.
- [ ] Verify no-scroll at 375px height and correct hierarchy in Chrome (mobile + desktop). `npm run check` green. Commit.

---

### Task 7: In-battle mini info panel

**Files:** Evolve `EffectsQuickPanel` / add panel under `components/game/`. Reuses Task 4 drawer and Task 8's Detail Overlay (build Task 8 first if coupling requires; otherwise stub the Details buttons and wire in Task 8).

- [ ] Tap a unit mid-battle → lightweight overlay over dimmed HUD: type/category icons, portrait + name + ATK/DEF/HP, substat drawer, Super ATK + Passive rows with Details buttons.
- [ ] **No live combat-stat tracker row** (deferred — do not build it).
- [ ] Verify in Chrome. `npm run check` green. Commit.

---

### Task 8: Character detail navigation + shared Detail Overlay

**Files:** Evolve `components/game/UnitDetailPanel.tsx`; add a shared `DetailOverlay` component and a `CharacterList` overlay. Reuse Task 4 drawer.

- [ ] Bottom-right cluster → Team Details list (member rows: thumbnail, quick icons, Lv/ATK/DEF, signature skill).
- [ ] Member row → Character Detail card (big art, type badge, HP/ATK/DEF callouts, leader-skill text, substat drawer, swipe across teammates).
- [ ] Super Attack row + Passive row, each with a "Details" button → one shared `DetailOverlay` (parameterized by content, single title-bar/close chrome — not two modals).
- [ ] Passive Details content uses categorized condition headers + bulleted effects.
- [ ] Tag/category chips → Character List overlay (grid of owned chars with that tag, portrait + badge only). Link Skills / Skill Orb / Hidden Potential / ki meter dropped.
- [ ] Verify the full drill-down flow in Chrome. `npm run check` green. Commit.

---

### Task 9: Keyword highlight + glossary footnotes

**Files:** Read `lib/game/mechanicGlossary.ts` + the description-translator first. This is a presentation upgrade, likely no new plumbing.

- [ ] Skill/passive descriptions render named terms with colored/bold inline highlight; each highlighted term gets a `※` footnote glossary line below the description.
- [ ] If the parsing/lookup is pure, **TDD** the term-extraction/lookup. Presentation itself → Chrome verify.
- [ ] Confirm no regression to existing description rendering. `npm run check` green. Commit.

---

### Task 10: Kit Lab → player-facing Preview

**Files:** Delete `app/kit-lab/*` route + `app/api/kit-lab/route.ts`. Keep and repoint `lib/game/damagePreview.ts`, `startCustomBattle`, and the "Test in Battle" launch path. Add a Preview entry from the skill/ultimate info screen (Task 8).

- [ ] Add a "Preview" button on skill/ultimate detail → launches an isolated 1v1 sandbox (card owner vs. a low-HP dummy), full rank/ultimate set available, a Reset to replay effects. Reference `7dsgc-preview-mode.jpg`.
- [ ] Remove the dev-only Kit Lab UI/route; ensure nothing else imports the deleted route. Repointed sandbox internals still function.
- [ ] TDD any preserved logic that has/needs tests. Verify Preview launches + resets in Chrome. `npm run check` green. Commit.

---

## Verification (whole feature)

- `npm run check` green.
- Full practice battle in Chrome start→victory: layout holds at 375px + desktop, reveal tiers fire correctly per rank, card frames read by rank, target brackets track selection, merge feedback works, mini-panel + detail drill-down + substat drawer all open, Preview launches from a skill screen.
- No regression: deck/merge, archive, existing battle end flow.
- `prefers-reduced-motion` honored.
