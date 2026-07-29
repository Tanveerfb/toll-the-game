# Author Notes Report

Log of what happened to each `author_notes.md` entry once I've acted on it or confirmed it's already true in the codebase, so the notes file only ever holds what's still open.

## 2026-07-29

- **Chiara full kit spec** — implemented (`data/characters/chiara.json`), committed 2026-07-25. Removed from author_notes.
- **Isolde full kit spec** — implemented (`data/characters/isolde.json`), committed 2026-07-25. Removed from author_notes.
- **Substat wishlist** (crit damage, recovery rate, lifesteal, crit resistance; base values 50/100/5/10) — implemented exactly as specced (`types/character.ts:32-39`, `lib/game/substats.ts`). Removed from author_notes.
- **"Basic stats" vs "all stats" distinction** — already a live distinction in the engine (`descriptionTranslator.ts`, `passive.ts`, boss passives). Removed from author_notes, definition moved to `docs/ARCHITECTURE.md` → Design Glossary.
- **Effect color legend** (Grey/Blue/Red), **skill-type Q&A** (Attack / Attack Debuff / Debuff / Buff), **sub-passive activation Q&A**, and the **Power Strike / type-neutral / Debuff Immunity / Recovery Rate / Lifesteal** definitions — all confirmed still accurate against current code. Migrated to `docs/ARCHITECTURE.md` → new "Design Glossary" section as the permanent reference. Removed from author_notes (settled knowledge, not a pending task).
- Cross-checked the sub-passive `worksFromSub` list against actual character JSON fields — matches exactly: Leorio/Mustafa/Gabrist/Isolde = `true`; Ban/Batra/Chiara/Diane/Gon/Killua/Meliodas/Sara/Seras = `false`; Duke/Lyra/Siddiq/Yalina/Master Tao have no field (defaults to `false`, consistent).

**Still open in author_notes** (not touched): Knuckle Bine kit, Isaac Netero kit (both "Not finalized"), probability tier-word system idea, "X-related stats" categorization idea.
