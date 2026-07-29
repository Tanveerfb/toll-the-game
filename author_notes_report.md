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

## 2026-07-29 (batch 2 — remaining passive rewrites)

Tanveer wrote structured `#`/`-`/`--` + emoji passive text for the 13 remaining characters (Duke, Gabrist, Gon, Killua, Leorio, Lyra, Master Tao, Meliodas, Mustafa, Sara, Seras, Siddiq, Yalina) directly into `author_notes.md`. Cross-checked each against its actual `mechanics[]` data before wiring into `data/characters/<id>.json`, then removed the whole "Passive style overhaul" section from author_notes since it's now implemented. `npm run check` green (409/409) after.

Minor inconsistencies found and handled:
- **Duke** — heading read "While using a skill When there are 3 stacks of [Flowing Ruin]" (merged double clause) and the ATK-down bullet had no duration even though the data (`atkDownDuration: 2`) says 2 turns. Asked Tanveer; he chose to fix the heading to "When there are 3 stacks of [Flowing Ruin]" and add "for 2 turns" to the bullet.
- **Seras** — his line had the arrow trailing the whole sentence ("...all stats 10% during battle 👆") instead of right after the value, breaking his own established "value then arrow" rule and inconsistent with the parallel Mustafa line right next to it. Moved the arrow to right after "10%" without asking — low-risk, matches his standing rule and the sibling line.
- **Meliodas, Sara, Seras** — each had one plain un-prefixed sentence sitting alongside a `#`-headed section in the same description. The markup parser (`passiveMarkup.ts`) treats a description as "structured" the moment any `#` line appears, and then silently drops any line that isn't `#`/`-`/`--` prefixed — so those plain sentences would have vanished from the UI entirely. Fixed by prefixing them with `- ` (a headless bullet), which the parser already supports. Pure formatting fix, no wording change.
- **Lyra** — original flat prose said the DEF buff was "unstackable and uncancellable"; his new bullet only said "uncancellable." Kept "Unstackable" in the wired text since it's a real, distinct mechanic flag (`unstackable: true` in the data) not implied by "once per turn."

Only **Isolde** remained on old flat prose (not part of this batch).

## 2026-07-29 (batch 3 — Isolde, migration complete)

Tanveer gave Isolde's rewrite in chat directly: "All allies max HP. recovery rate and lifesteal 10%👆 during battle (Uncancellable)". Checked against her `aura` mechanics (hp/recoveryRate/lifesteal all +10%, `worksFromSub: true`) — exact match, no issues. Wired in (comma-fixed the stray period after "HP"), no heading needed since it's a single unconditional always-active aura, same convention as Mustafa/Gabrist's flat one-liners. `npm run check` green (409/409). All 18 playable passives now on the structured format — migration done.
