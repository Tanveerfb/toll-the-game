# Technical / Engineering Audit — 2026-07-21

> Read-only audit pass covering the combat engine, battle/story UI layer, character
> data + test coverage, bundle/build perf, the gacha/banner system, the archive/roster
> UI, the save/persistence layer, and crash resilience.
>
> **Status (2026-07-30): closed out.** Almost the entire backlog below turned out to
> already be fixed by the time implementation started (landed incidentally in an
> unrelated passive-formatting session, or by Tanveer directly) — each item was
> re-verified against current code before being marked resolved rather than assumed.
> The handful of genuinely open items were implemented in the same pass that also
> added the chance-tier glossary system (`author_notes.md` idea #1). Three items are
> intentionally deferred (see bottom) and one is confirmed still-design-only (gacha).

## 1. Correctness bugs (combat engine) — ALL RESOLVED

- Corrosion comment (`bossPassives.ts:14`) now correctly says "remaining HP"; the
  logic was already correct.
- Taunt: same-source override + most-recent-wins + live-taunter fallback — all three
  implemented (`combat.ts`, `stripOwnEffect` helper + backwards taunt scan).
- Ignite now resets `debuffDuration` on stack merge, matching the other DoTs.
- The three "reapply the same effect" implementations (debuff, Extort, Duke's Flowing
  Ruin) now share one `stripOwnEffect` helper instead of drifting independently.
- Benched (`isSub`) units were already guarded against DoT/HoT ticks — the original
  audit claim here was inaccurate, no fix was needed.

Skip (unchanged, still not worth touching): dead `maxTriggers`/`targetSelf` fields,
non-null-assertion style, spite/deathblow zero-guards. `duke.json`'s ultimate still has
no `mechanics` array (schema outlier) — harmless, not fixed.

## 2. Perf/leak fixes (battle sequencer + store) — RESOLVED

- `useBattleSequencer.ts` timer tracking (`scheduleTimeout`/`clearAllTimeouts`) and
  `skip()` clearing them was already fixed.
- `BattleArena.tsx` had already been converted to per-field `useGameStore` selectors
  and `TeamUnitTile` was already `React.memo`-wrapped.
- `hooks/BattleProvider.tsx`'s whole-store `useGameStore()` subscription (the one
  genuinely open item) is now per-field selectors. Its `handlePhase` effect and
  `resolveplayerTurnWrapper` both read `playerTeam`/`enemyTeam`/`battlePhase` via
  `useGameStore.getState()` at time-of-use (matching the pattern
  `resolveEnemyTurnWrapper` already used) rather than relying on render-frequency for
  freshness — correctness no longer depends on how often the component re-renders.

Skip (unchanged): the inline-object/no-op-callback churn (`tileFx`, `onMark={() => {}}`)
— marginal now that `TeamUnitTile` is memoized.

## 3. Mobile/a11y UX — RESOLVED

- The "SAVE BATTLE LOG" debug button is already gated behind
  `process.env.NODE_ENV !== "production"`.
- `UnitDetailPanel` step buttons, the "?" toggle, and the Info button already meet the
  44px guideline with `aria-label`s in place.
- `StatusChips` already had `aria-label="View status effects"`; its touch target
  (previously ≈34px tall) now has `min-h-11` added.
- `CharacterBrowser.tsx`: search input now has `aria-label="Search characters"`, filter
  chips (`Toggle`) now expose `aria-pressed`, the Filters disclosure button now exposes
  `aria-expanded`, and `CHIP_BASE` now includes `min-h-11` so every chip built from it
  clears the touch-target guideline.

## 4. Content/test coverage — RESOLVED

- `lyra_npc.json` is already synced to playable Lyra (passive % and both shared
  skills' damage match exactly; only the ultimate's boss-bumped damage differs, which
  is intentional).
- `tests/passiveDescriptionSync.test.ts` already exists and guards the exact drift
  class that caused the original Diane bug.
- Of the six "missing test" claims, five already had coverage (Master Tao, Leorio,
  Gon/Killua, Siddiq, Batra all have dedicated tests in `tests/characterMechanics.test.ts`
  / `tests/hxhKits.test.ts`). Only Mustafa's `lowerUltGauge` was genuinely untested —
  added two tests (R1/R3 ranked value) to `tests/characterMechanics.test.ts`.

Skip (unchanged): `duke.json`'s ultimate missing a `mechanics` array — still harmless.

## 5. Save/persistence layer — RESOLVED

- The guest-progress-wipe bug is fixed: `AuthProvider.tsx` now tracks whether the
  session ever saw an authenticated user and only resets on an actual sign-out
  transition, not on every anonymous load.
- `playerStore.ts`/`storyStore.ts` both now have `version`/`migrate` config.
- `battleSpeed` now persists via the settings store (seeded into and mirrored from
  `useSettingsStore`), surviving reload.
- Both stores now expose a `hasHydrated` flag via `onRehydrateStorage`.

Skip (unchanged, accepted risk): no validation on a manually-edited localStorage value
— still fine to leave at hobby-project scope.

## 6. Error boundaries / crash resilience — RESOLVED (mostly)

- `app/error.tsx` exists; both `executeSkill` call sites in `BattleProvider.tsx` are
  wrapped in try/catch that logs and transitions to a "battle crashed" defeat state
  instead of throwing uncaught.
- `characterCatalog.ts`'s `validateCharacters` call is now wrapped in try/catch,
  logging and dropping only the offending character rather than crashing catalog load
  for the whole app (Tanveer's call: drop-and-continue, not fail-closed).
- `app/api/kit-lab/route.ts` no longer exists in the repo (removed/renamed since this
  audit was written), so the original battle-log-vs-kit-lab comparison is moot.
  `battle-log/route.ts` already has a dev-only 404 gate and one explicit 400 path; its
  remaining generic-500 catch-all was left as-is (nothing left to align it to — see
  deferred items below).

Skip (unchanged): no global `window.onerror`/`unhandledrejection` handler, no
error-reporting/monitoring — not proposed unless Tanveer wants real crash telemetry.

## 7. Bundle/build perf — RESOLVED (quick wins + LazyMotion) / DEFERRED (catalog redesign)

- Dead file `lib/game/dataUtils.ts` (zero importers) deleted.
- `"shadcn"` moved from `dependencies` to `devDependencies` in `package.json`.
- `next.config.ts` now has `experimental.optimizePackageImports: ["lucide-react"]`.
- **`LazyMotion`/`domAnimation` adopted (2026-07-30).** New
  `components/providers/MotionProvider.tsx` wraps the app in `app/layout.tsx`; all 24
  `motion.xxx` usages across the only 3 files that used framer-motion
  (`BattleArena.tsx`, `BattleEffectsOverlay.tsx`, `StorySceneReader.tsx`) migrated from
  `motion` to the lazy-loadable `m`. Every usage was confirmed to only need
  `domAnimation` (no `layout`/`layoutId`, no SVG motion, no drag/hover/tap variants
  anywhere) — `domMax` wasn't needed. Verified live via `agent-browser` (system Chrome):
  a full practice battle (card play, floaters, card-detail popup, defeat screen) and a
  story scene advance, no console errors, animations unchanged.

Deferred (see bottom of this doc): the full catalog-to-server-component redesign.

## 8. Gacha/banner system — STILL DESIGN-ONLY, CONFIRMED

No change. `docs/design/GACHA_DESIGN.md` remains the spec; nothing built. Re-confirmed
2026-07-30, no drift since the original audit.

## 9. Archive/roster page UX — RESOLVED

- `CharacterBrowser.tsx`'s search input, filter chips, and Filters button now have the
  a11y attributes and touch-target sizing described in section 3 above (same fix,
  filed once).
- Palette inconsistency fixed: both `/archive` and `/archive/npc` now use the same
  zinc-toned top-right glow (previously sky-blue vs rose) paired with the existing
  shared amber glow, matching the rest of the app's amber/zinc identity. The
  per-character-element theming on `/archive/[id]` detail pages was left alone —
  that's data-driven coloring, not a fixed page accent.

Skip (unchanged): full-array-rescan-per-keystroke filtering, unmemoized `Toggle` chips
— still fine at the current 25-character roster scale.

---

## Deferred (explicit calls, not forgotten)

- **`public/unreleased/` PNGs** (6.7MB, 5 files, zero code references) — Tanveer's
  call (2026-07-30): keep, not staged for deletion.
- **Full catalog-to-server-component redesign** (moving character catalog resolution
  off the client's first route) — still needs its own design session, not a quick
  patch; unchanged since the original audit.
