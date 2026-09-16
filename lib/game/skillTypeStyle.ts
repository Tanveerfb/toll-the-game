import {
  ArrowBigUp,
  Heart,
  ShieldHalf,
  Sword,
  Swords,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * One taxonomy for what a skill *does*, and one colour per class.
 *
 * Ruling #133 (Tanveer, 2026-09-16):
 *
 *   attack        red     damage, and nothing hostile beyond it
 *   attackDebuff  purple  damage that also afflicts the target
 *   heal          green   heals and cleanses
 *   buff          blue    raises
 *   stance        yellow  stances
 *
 * The ultimate is deliberately NOT a sixth class here. It keeps the glyph of
 * whatever it actually does — a buff ultimate shows a buff — and is marked out
 * by its rainbow frame instead (`cardFrameStyle.ts`). Giving it a class would
 * hide what it does behind the fact that it is an ultimate.
 *
 * Before this there were three disagreeing maps: `Hand.tsx` had the categories
 * but used glyphs only, while `KitDetails.tsx` and `SkillDocument.tsx` each
 * carried a colour map in which a buff was GREEN and a debuff PURPLE. The same
 * skill read as two different colours depending on the screen.
 */

export type SkillTypeCategory =
  | "attack"
  | "attackDebuff"
  | "heal"
  | "buff"
  | "stance";

/**
 * Mechanics that make an attack an *attack-debuff*.
 *
 * Tanveer drew the line himself: Chiara's skill that lowers DEF after damage
 * is an attack-debuff, while a skill that only cancels is *"just a normal
 * attack skill"* — *"as long as they don't apply debuff on the enemy from
 * their skill."* So `cancelBuffs` and `cancelStances` are deliberately absent:
 * removing something the target had is not afflicting it with something new.
 */
const DEBUFF_MECHANICS: ReadonlySet<string> = new Set([
  "debuff",
  "seal",
  "stun",
  "shock",
  "bleed",
  "corrosion",
  "decay",
  "weaken",
  "extort",
  "rupture",
  "disable",
  "ignite",
  "lowerUltGauge",
]);

// Deliberately NOT here: `taunt`. Since #131 a taunt marks the CASTER as part
// of its own stance rather than afflicting the enemies it pulls, so a skill
// that taunts is a stance, not an attack-debuff.

const FRIENDLY_MECHANICS: ReadonlySet<string> = new Set([
  "buff",
  "heal",
  "healOverTime",
  "cleanse",
  "debuffImmunity",
]);

interface SkillLike {
  type?: string;
  mechanics?: { type?: string }[];
}

/**
 * What class a skill belongs to, read from its type and its mechanics.
 *
 * An ultimate is classified by what it DOES rather than by being an ultimate.
 * It used to fall through to the damage branch unconditionally, so Isolde's
 * Starbound Ward — a pure team buff — carried a sword glyph.
 */
export function skillTypeCategory(skill: SkillLike): SkillTypeCategory {
  const mechanics = skill.mechanics ?? [];
  const has = (set: ReadonlySet<string>) =>
    mechanics.some((m) => (m.type ? set.has(m.type) : false));

  // A stance mechanic is decisive, and it is checked BEFORE `skill.type`
  // because the two disagree on real kits. Mustafa's "Earth Stance: Fortress"
  // is typed `buff` and Yalina's "Attention Drawer" is typed `debuff`, yet
  // both put up a stance — which is what the player has to read, and what
  // decides whether `cancelStances` reaches it (#132).
  if (has(new Set(["stance", "taunt"]))) return "stance";

  switch (skill.type) {
    case "heal":
    case "cleanse":
      return "heal";
    case "stance":
      return "stance";
    case "buff":
      return "buff";
    case "debuff":
    case "disable":
      return "attackDebuff";
    case "ultimate": {
      if (has(DEBUFF_MECHANICS)) return "attackDebuff";
      if (has(FRIENDLY_MECHANICS)) {
        return mechanics.some((m) => m.type === "heal" || m.type === "cleanse")
          ? "heal"
          : "buff";
      }
      return "attack";
    }
    default:
      return has(DEBUFF_MECHANICS) ? "attackDebuff" : "attack";
  }
}

/** Text colour per class. */
export const SKILL_TYPE_TEXT: Record<SkillTypeCategory, string> = {
  attack: "text-role-attack",
  attackDebuff: "text-el-dark",
  heal: "text-role-heal",
  buff: "text-el-blue",
  stance: "text-el-light",
};

/** Solid chip per class — the archive's type badge. */
export const SKILL_TYPE_CHIP: Record<SkillTypeCategory, string> = {
  attack: "bg-role-attack text-void",
  attackDebuff: "bg-el-dark text-void",
  heal: "bg-role-heal text-void",
  buff: "bg-el-blue text-void",
  stance: "bg-el-light text-void",
};

/** The glyph a card carries. Shape and colour say the same thing, so the
 *  class survives a colourblind reader and a greyscale screenshot. */
export const SKILL_TYPE_ICON: Record<
  SkillTypeCategory,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  attack: Sword,
  attackDebuff: Swords,
  heal: Heart,
  buff: ArrowBigUp,
  stance: ShieldHalf,
};

/** Human label, for `aria-label` and the archive's metadata line. */
export const SKILL_TYPE_LABEL: Record<SkillTypeCategory, string> = {
  attack: "attack",
  attackDebuff: "attack + debuff",
  heal: "heal",
  buff: "buff",
  stance: "stance",
};
