---
name: train-copilot-on-style
description: "Train Copilot behavior for this project using iterative examples, rewrite rules, acceptance checks, and correction loops. Use when refining writing style, combat description format, or domain-specific wording standards."
argument-hint: "Behavior to train (for example: technical combat descriptions, archive tone, debuff phrasing)"
user-invocable: true
---

# Train Copilot On Style

## What This Skill Produces

- A repeatable training loop for improving output quality in this repository.
- Stable style behavior through examples, explicit rules, and QA checks.
- Faster convergence with fewer correction rounds.

## When To Use

- Copilot output is close but inconsistent.
- You want to enforce project-specific language standards.
- You want to reduce repeated manual correction in future tasks.

## Training Loop

1. Define target behavior in one sentence.
2. Provide 3 to 10 good examples and 3 to 10 bad examples.
3. Convert feedback into explicit rules.
4. Add decision rules for edge cases.
5. Run a small pilot batch (1 to 3 files).
6. Review deltas, mark pass or fail, and explain failures precisely.
7. Apply the corrected rules to full scope.
8. Save the finalized rules into a skill or instruction file.

## Rule Writing Format

- Preferred pattern: `Do X in format Y`
- Forbidden pattern: `Never use Z`
- Tie each rule to measurable checks.

## Example Rule Set For Combat Text

- Use technical style over flavor text.
- Use `one enemy` and `all enemies` wording when target is known.
- Keep damage wording percentage-based unless explicitly non-percentage in source text.
- Use rank-driven percentage wording from `damageRanked` and preserve stat scale (`ATK`, `DEF`, `HP`).
- Use `lowers`, `greatly lowers`, `massively lowers` for debuff tiers.
- Infer missing targets from mechanics when available.
- If a mechanic keyword has tooltip text, keep the main description concise and do not duplicate that mechanic explanation.
- Keep action order in execution order: apply or consume first, then damage, then aftermath.
- Preserve values exactly (percent, turns, stacks, trigger).

## Correction Protocol

- For each failed line, provide:
- Original line
- Corrected line
- Rule violated
- Why the correction is mechanically more accurate

## Quality Gates

- Mechanical equivalence preserved.
- No invented targets, values, or durations.
- No duplicate target phrase in one sentence.
- No missing required descriptions.

## Prompt Templates

- `/train-copilot-on-style train technical combat descriptions from these examples and apply to changed files only`
- `/train-copilot-on-style build rewrite rules from good and bad examples, then run a 2-file pilot before full rollout`
- `/train-copilot-on-style enforce debuff tier wording and report each violation with corrected line`

## Maintenance

- Update this skill when new exceptions appear.
- If a rule changes globally, also update relevant instruction files.
- Keep examples current with real project data, not hypothetical lines.
