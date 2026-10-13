# Kit Lab — Design Spec

> **RETIRED 2026-09-17 — the tool no longer exists.** There is no Kit Lab route
> in `app/`, and its last two support modules were deleted on his call:
> `lib/game/mechanicTemplates.ts` (per-mechanic descriptions and field
> skeletons) and `lib/game/balance.ts` (stat-outlier heuristics), together with
> `tests/balance.test.ts`. They had **zero importers** — audit 2026-09-17,
> finding M3. Kept as the record of why that code existed; **do not build
> against this spec** without deciding to revive the tool first. The kit-authoring
> workflow it was meant to replace is the `kitcheck` and `kitwords` skills.

> 2026-07-18. Approved by Tanveer. Dev-only kit-authoring GUI inside the app.
> Goal: a GUI replacement for the `newchars.md` workflow that reuses the real
> engine so the tool and the game never drift.

## Scope (v1)

**In:**
- Dev-only route `/kit-lab` (hidden in production).
- Structured kit **editor** (identity + 2 skills + optional ult + optional passive), with type-specific mechanic fields driven by `types/mechanic.ts`.
- **Mechanics browser** — search all 42 mechanic types + `mechanicGlossary` descriptions; click to add.
- **New-mechanic brief** capture (capture-as-brief model) -> writes `docs/proposed-mechanics/<slug>.md`; kit can reference it as a placeholder flagged "pending engine support".
- **Simulator:** (a) quick numeric preview via `damagePreview.ts`; (b) "Test in Battle" launching the draft into the practice sandbox (`startCustomBattle`).
- **Live preview:** `KitDetails` card + auto-generated Dokkan descriptions (`descriptionTranslator`).
- **Balance snapshot:** draft vs roster medians, outlier flags (new `lib/game/balance.ts`).
- **Save/load:** dev-only API route read/writes `data/characters/*.json`, Zod-validated before write (invalid can't save). Loads existing kits to edit.

**Out (v2):** clone-as-template, ComfyUI art hookup.

## Architecture

- `app/kit-lab/page.tsx` — client page, dev-gated (`process.env.NODE_ENV !== "production"` -> 404/notice).
- `app/api/kit-lab/route.ts` — dev-only Node route: `GET` list/load kit, `POST` save kit (validate first), `POST` (brief) save proposed-mechanic md. Refuses in production.
- `components/kit-lab/`:
  - `KitEditor.tsx` — the form; draft kit state (local/zustand).
  - `MechanicsBrowser.tsx` — searchable mechanic list + glossary; add-to-skill.
  - `MechanicFields.tsx` — renders type-specific fields per mechanic `type`.
  - `PreviewPanel.tsx` — `KitDetails` + generated descriptions.
  - `Simulator.tsx` — damage-preview table + Test-in-Battle launch.
  - `BalanceSnapshot.tsx` — medians + outlier flags.
  - `NewMechanicBrief.tsx` — brief form -> API.
- `lib/game/balance.ts` — roster medians + outlier checks (pure, tested).

## Data flow

Draft kit object (editor state) -> live Zod validate -> feeds preview, damage-preview, balance simultaneously. Save = POST draft -> API validates -> writes JSON (hot reload). Test-in-Battle = inject draft into `startCustomBattle` (accept an ad-hoc `CharacterData`, bypass catalog lookup). Brief = POST -> writes `docs/proposed-mechanics/<slug>.md`.

## Reuse (no reinvention)

`types/mechanic.ts` (field shapes), `characterSchema.ts` (validate), `damagePreview.ts` (numeric sim), `startCustomBattle` + practice shell (battle sim), `KitDetails.tsx` (render), `descriptionTranslator` (wording), `mechanicGlossary.ts` (docs), `characterCatalog.ts` (roster for medians).

## Testing

Unit: `balance.ts` (medians/outlier flags), save-API validation gate (rejects invalid), brief-file writer. Simulator/preview lean on already-tested engine code.

## Key challenges

- **Draft-in-battle:** `startCustomBattle`/battle provider must accept a draft `CharacterData` not in the catalog. Add an injection path.
- **Dev-only fs writes:** API route uses Node `fs`, guarded to non-production; the route + page 404 in prod.
- **Live validation UX:** partial/in-progress kits fail Zod; validate but show errors non-blockingly, only hard-block on Save.

## Open (non-blocking)
Proposed-mechanic briefs -> `docs/proposed-mechanics/*.md` (one file each) — decided.
