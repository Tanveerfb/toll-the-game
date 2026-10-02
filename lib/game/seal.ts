import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Which skills a seal blocks — one answer for the engine, the AI and the hand.
 *
 * A seal's `sealType` names a category of skill:
 *  - "attack"       any attack-type skill (the original, default case)
 *  - "debuff"       any debuff-type skill
 *  - "attackDebuff" an attack-type skill that ALSO carries a hostile
 *                   debuff-category mechanic (Chiara's House Rules — a
 *                   conceptual category, not a literal `skill.type`)
 *  - "ultimate"     the ultimate. Tanveer's `ult-disable` (2026-09-26):
 *                   *"it will basically seal only ultimate cards, similar to
 *                   how attack or atk-debuff seals work"*. Worded on cards as
 *                   "disables ultimate moves". The gauge is untouched.
 *
 * Until 2026-10-02 ultimates were never sealed by anything, and the engine
 * said so. The check below always compared `sealType` to `skill.type`, so the
 * engine half needed no change; the hand and the AI did, and checked "attack"
 * by name.
 */
export const DEBUFF_CATEGORY_MECHANICS: ReadonlySet<string> = new Set([
  "debuff",
  "stun",
  "freeze",
  "seal",
  "taunt",
  "shock",
  "bleed",
  "decay",
  "corrosion",
  "ignite",
  "extort",
]);

interface SkillLike {
  type: string;
  mechanics?: ReadonlyArray<{ type: string }>;
}

/** Whether one seal entry blocks `skill`. */
export function sealBlocks(seal: StatusEffect, skill: SkillLike): boolean {
  if (seal.type !== "seal") return false;
  if (seal.sealType === "attackDebuff") {
    return (
      skill.type === "attack" &&
      (skill.mechanics ?? []).some((m) => DEBUFF_CATEGORY_MECHANICS.has(m.type))
    );
  }
  return (seal.sealType ?? "attack") === skill.type;
}

/** The seal on `unit` that blocks `skill`, if any. */
export function activeSealFor(
  unit: Pick<BattleCharacter, "debuffs"> | undefined,
  skill: SkillLike,
): StatusEffect | undefined {
  return unit?.debuffs.find((d) => sealBlocks(d, skill));
}

/** The status-entry name a seal of this type carries. */
export function sealName(sealType: string): string {
  return sealType === "ultimate" ? "Ultimate Seal" : "Attack Seal";
}

/** How a seal reads in a log line or an effects row. */
export function sealPhrase(sealType: string | undefined): string {
  return sealType === "ultimate"
    ? "ultimate moves disabled"
    : `${sealType ?? "attack"} skills sealed`;
}
