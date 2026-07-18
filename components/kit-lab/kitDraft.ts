import { characterSchema } from "@/lib/game/characterSchema";
import type {
  CharacterData,
  CharacterSkillData,
} from "@/lib/game/characterCatalog";

// Editable draft shapes for the Kit Lab. Loosely typed while editing (fields
// can be mid-entry / invalid); characterSchema is the gate on save.

export type DraftMechanic = Record<string, unknown> & { type: string };

export interface DraftSkill {
  skillName: string;
  characterId: string;
  type: string;
  statMultiplier: "atk" | "def" | "hp";
  description?: string;
  damageRanked?: number[];
  damage?: number;
  mechanics?: DraftMechanic[];
}

export interface DraftPassive {
  name: string;
  description: string;
  trigger: string;
  mechanics?: DraftMechanic[];
}

export interface DraftKit {
  id: string;
  name: string;
  color: "light" | "red" | "blue" | "green" | "dark";
  atk: number;
  def: number;
  hp: number;
  tags?: string[];
  lore?: string;
  storyOnly?: boolean;
  tier?: "elite";
  skills: DraftSkill[];
  ultimate?: DraftSkill;
  passive?: DraftPassive;
}

export function blankSkill(name: string): DraftSkill {
  return {
    skillName: name,
    characterId: "",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 130, 160],
    mechanics: [],
  };
}

export function blankKit(): DraftKit {
  return {
    id: "",
    name: "",
    color: "red",
    atk: 150,
    def: 60,
    hp: 900,
    tags: [],
    lore: "",
    skills: [blankSkill("Skill 1"), blankSkill("Skill 2")],
  };
}

/** Stamp characterId onto every skill/ult so the export matches kit conventions. */
export function normalizeKit(kit: DraftKit): DraftKit {
  const stamp = (s: DraftSkill): DraftSkill => ({ ...s, characterId: kit.id });
  return {
    ...kit,
    skills: kit.skills.map(stamp),
    ultimate: kit.ultimate
      ? { ...stamp(kit.ultimate), type: "ultimate" }
      : undefined,
  };
}

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

export function validateKit(kit: DraftKit): ValidationResult {
  const result = characterSchema.safeParse(normalizeKit(kit));
  if (result.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: result.error.issues.map(
      (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
    ),
  };
}

/** A best-effort CharacterData view for the preview/sim/balance (they tolerate
 * partial kits; damageRanked defaults keep the math safe). */
export function asCharacterData(kit: DraftKit): CharacterData {
  return normalizeKit(kit) as unknown as CharacterData;
}

export type { CharacterSkillData };
