---
name: standardize-combat-descriptions
description: "Audit and standardize character JSON descriptions for skills, ultimates, and passives using technical phrasing. Use when rewriting flavor-heavy text, normalizing combat wording, or enforcing consistent ATK/DEF/HP terminology and debuff language (lowers/greatly lowers/massively lowers)."
argument-hint: "Scope to audit (all characters, changed files only, or specific character ids)"
user-invocable: true
---

# Standardize Combat Descriptions

## What This Skill Produces

- Updated character JSON files with consistent, technical descriptions for:
- `skills[].description`
- `ultimate.description`
- `passive.description`
- Optional nested mechanic descriptions when they are player-facing

## When To Use

- Flavor text is too narrative and not mechanical enough
- Description quality is inconsistent across characters
- You want deterministic wording for combat logs, tooltips, and archive pages
- You need fast content QA before balancing or localization

## Inputs

- Character JSON files under `data/characters/*.json`
- lib\game\mechanicGlossary.ts for existing mechanic descriptions and keywords
- Existing mechanics fields (`mechanics`, `damageRanked`, `damage`, `statMultiplier`, durations, percentages)

## Procedure

1. Audit target files.
2. Extract all relevant description fields for skills, ultimates, passives.
3. Rewrite each description using technical wording that preserves exact gameplay behavior.
4. Normalize target phrasing:

- Use `one enemy` or `all enemies` explicitly when known.

5. Normalize stat wording:

- Use `ATK-scaled`, `DEF-scaled`, `HP-scaled` for scaling language.
- Damage wording is percentage-based by default unless explicitly non-percentage in source text.

6. Normalize debuff wording:

- Use `lowers ATK` / `lowers DEF` for 20% tier effects.
- Use `greatly lowers ATK/DEF` for 50% tier effects.
- Use `massively lowers ATK/DEF` for 80% tier effects.
- For dual-stat effects, use `lowers ATK and DEF` (or corresponding tier adjective).

7. Normalize composition order:

- Action sequence should read in execution order: apply/buff/debuff/consume, then damage, then aftermath clauses.

8. Remove flavor-only text and redundancy.
9. If a mechanic has a KeywordHighlighter entry, keep the skill line concise and avoid duplicating that mechanic explanation in the same description.
10. Infer missing targets from mechanics when possible (`aoe` => all enemies). If ambiguous and unsupported by mechanics, avoid guessing.
11. Preserve exact values and timing (percentages, turns, triggers, max stacks, rank conditions).
12. Validate JSON integrity and run lint/checks used in the workspace.
13. Only use "to one enemy" or "to all enemies" when the target is explicitly defined in the mechanics. If the target is ambiguous and cannot be reliably inferred from mechanics, omit target count to avoid incorrect assumptions.

## Decision Rules

- If damage is zero and the action is purely utility, do not force damage language.
- If target count is ambiguous and no reliable mechanic field disambiguates it, avoid inventing target count.
- If rank-dependent values exist but exact display format is unclear, use `based on rank` instead of guessed numbers.
- For rank-based damage lines, use percentage phrasing and fill values from `damageRanked` when available.
- Keep existing canonical glossary wording when explicitly required by project rules.

## Style Rules

- Prefer concise, technical sentences over lore.
- Keep terms uppercase where appropriate: `ATK`, `DEF`, `HP`.
- Avoid duplicate target phrases (for example, do not repeat `to one enemy` twice).
- Avoid vague verbs like `devastates` when measurable wording is available.
- If keyword tooltips already describe a mechanic, keep the skill sentence as a short keyword-based statement.

## Quality Checks

- Every updated line is mechanically equivalent to source fields.
- No missing description on any `ultimate` object.
- Debuff phrasing follows tier rules consistently.
- No contradictory target or duration statements.
- JSON remains valid and parsable.

## Example Prompts

- `/standardize-combat-descriptions audit all character json files and normalize to technical text`
- `/standardize-combat-descriptions standardize only duke, yalina, and gabrist debuff wording`
- `/standardize-combat-descriptions rewrite descriptions for changed files and keep rank ambiguity as based on rank`
