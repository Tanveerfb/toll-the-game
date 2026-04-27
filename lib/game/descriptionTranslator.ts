import type { CharacterSkillData } from "@/lib/game/characterCatalog";

const TARGET_PATTERN =
  /\bto\s+(?:1|one|all)\s+enemies?\b|\bto\s+a\s+single\s+enemy\b/i;

const LETTER_INDEX: Record<string, number> = {
  x: 0,
  y: 1,
  z: 2,
  w: 3,
  v: 4,
};

function cleanText(value: string): string {
  return value.trim().replace(/\.$/, "");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function getMechanics(
  skill: CharacterSkillData,
): Array<Record<string, unknown>> {
  if (!Array.isArray(skill.mechanics)) {
    return [];
  }

  return skill.mechanics.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
}

export function getMechanicTypes(skill: CharacterSkillData): string[] {
  const types = getMechanics(skill)
    .map((entry) => entry.type)
    .filter(
      (type): type is string => typeof type === "string" && type.length > 0,
    );

  return Array.from(new Set(types));
}

function inferTargetFromMechanics(
  skill: CharacterSkillData,
): string | undefined {
  const lowerTypes = getMechanicTypes(skill).map((type) => type.toLowerCase());
  if (lowerTypes.includes("aoe")) {
    return "to all enemies";
  }

  return undefined;
}

function getRankDamage(
  skill: CharacterSkillData,
  rankIndex: number,
): number | undefined {
  if (Array.isArray(skill.damageRanked) && skill.damageRanked.length > 0) {
    const rankValue = skill.damageRanked[rankIndex] ?? skill.damageRanked[0];
    return typeof rankValue === "number" ? rankValue : undefined;
  }

  if (typeof skill.damage === "number") {
    return skill.damage;
  }

  return undefined;
}

function getRankedValue(
  values: unknown,
  rankIndex: number,
): number | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const rankValue = values[rankIndex] ?? values[0];
  return typeof rankValue === "number" ? rankValue : undefined;
}

function resolveMechanicField(
  mechanic: Record<string, unknown>,
  rankIndex: number,
  field?: "value" | "duration" | "stacks",
): number | undefined {
  if (field === "duration") {
    return (
      getRankedValue(mechanic.durationRanked, rankIndex) ??
      (typeof mechanic.duration === "number" ? mechanic.duration : undefined)
    );
  }

  if (field === "stacks") {
    return (
      getRankedValue(mechanic.stacksRanked, rankIndex) ??
      (typeof mechanic.stacks === "number" ? mechanic.stacks : undefined)
    );
  }

  const rankedCandidates = [
    getRankedValue(mechanic.valueRanked, rankIndex),
    getRankedValue(mechanic.stacksRanked, rankIndex),
    getRankedValue(mechanic.durationRanked, rankIndex),
  ];
  for (const candidate of rankedCandidates) {
    if (typeof candidate === "number") {
      return candidate;
    }
  }

  const scalarCandidates = [
    mechanic.valuePercent,
    mechanic.value,
    mechanic.damagePercent,
    mechanic.damage,
    mechanic.stacks,
    mechanic.duration,
  ];
  for (const candidate of scalarCandidates) {
    if (typeof candidate === "number") {
      return candidate;
    }
  }

  return undefined;
}

function resolveByMechanicIndex(
  skill: CharacterSkillData,
  mechanicIndex: number,
  rankIndex: number,
): string {
  const mechanic = getMechanics(skill)[mechanicIndex];
  if (!mechanic) {
    return "";
  }

  const value = resolveMechanicField(mechanic, rankIndex);
  return typeof value === "number" ? formatNumber(value) : "";
}

function resolveByMechanicType(
  skill: CharacterSkillData,
  mechanicType: string,
  rankIndex: number,
  field?: "value" | "duration" | "stacks",
): string {
  const mechanic = getMechanics(skill).find(
    (entry) =>
      typeof entry.type === "string" &&
      entry.type.toLowerCase() === mechanicType.toLowerCase(),
  );

  if (!mechanic) {
    return "";
  }

  const value = resolveMechanicField(mechanic, rankIndex, field);
  return typeof value === "number" ? formatNumber(value) : "";
}

function resolveConditionByMechanicType(
  skill: CharacterSkillData,
  mechanicType: string,
  rankIndex: number,
): boolean {
  const mechanic = getMechanics(skill).find(
    (entry) =>
      typeof entry.type === "string" &&
      entry.type.toLowerCase() === mechanicType.toLowerCase(),
  );

  if (!mechanic) {
    return false;
  }

  if (Array.isArray(mechanic.ranks)) {
    const value = mechanic.ranks[rankIndex] ?? mechanic.ranks[0];
    return Boolean(value);
  }

  if (typeof mechanic.active === "boolean") {
    return mechanic.active;
  }

  if (typeof mechanic.enabled === "boolean") {
    return mechanic.enabled;
  }

  return true;
}

function replaceMechanicPlaceholders(
  description: string,
  skill: CharacterSkillData,
  rankIndex: number,
): string {
  let result = description;

  result = result.replace(
    /\[([a-zA-Z_]+)\?\s*([^:\]]+?)\s*:\s*([^\]]+?)\]/g,
    (_, mechanicType: string, truthyValue: string, falsyValue: string) =>
      resolveConditionByMechanicType(skill, mechanicType, rankIndex)
        ? truthyValue.trim()
        : falsyValue.trim(),
  );

  result = result.replace(/\[([xyzwv])-ranked\]/gi, (_, letter: string) => {
    const index = LETTER_INDEX[letter.toLowerCase()];
    return typeof index === "number"
      ? resolveByMechanicIndex(skill, index, rankIndex)
      : "";
  });

  result = result.replace(/\b([xyzwv])-ranked\b/gi, (_, letter: string) => {
    const index = LETTER_INDEX[letter.toLowerCase()];
    return typeof index === "number"
      ? resolveByMechanicIndex(skill, index, rankIndex)
      : "";
  });

  result = result.replace(
    /\[([a-zA-Z_]+)(?:\.(value|duration|stacks))?\]/g,
    (_, mechanicType: string, field?: "value" | "duration" | "stacks") =>
      resolveByMechanicType(skill, mechanicType, rankIndex, field),
  );

  return result;
}

function injectDamagePercent(
  description: string,
  damage: number,
  statMultiplier: string,
): string {
  const stat = statMultiplier.toUpperCase();
  return description
    .replace(/\bATK-scaled\b/gi, `${formatNumber(damage)}% ATK`)
    .replace(/\bDEF-scaled\b/gi, `${formatNumber(damage)}% DEF`)
    .replace(/\bHP-scaled\b/gi, `${formatNumber(damage)}% HP`)
    .replace(
      /\bDoes\s+(?:ATK|DEF|HP)\s+damage\b/i,
      `Does ${formatNumber(damage)}% ${stat} damage`,
    );
}

function ensureTargetText(text: string, targetText?: string): string {
  if (!targetText || TARGET_PATTERN.test(text)) {
    return text;
  }

  const trimmed = cleanText(text);
  return `${trimmed} ${targetText}`;
}

function removeDuplicateTarget(text: string): string {
  return text
    .replace(/(to\s+(?:1|one|all)\s+enemies?)(?:\s+\1)+/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDescriptionForRank(
  skill: CharacterSkillData,
  rankIndex: number,
): string {
  const raw = cleanText(skill.description ?? "");
  const damage = getRankDamage(skill, rankIndex);

  let description = replaceMechanicPlaceholders(raw, skill, rankIndex);
  if (typeof damage === "number" && damage > 0) {
    description = injectDamagePercent(
      description,
      damage,
      skill.statMultiplier,
    );
  }

  description = ensureTargetText(description, inferTargetFromMechanics(skill));
  description = removeDuplicateTarget(description);

  return `${cleanText(description)}.`;
}

export function buildRankedSkillDescriptions(
  skill: CharacterSkillData,
): string[] {
  if (Array.isArray(skill.damageRanked) && skill.damageRanked.length > 0) {
    return skill.damageRanked.map((_, index) =>
      buildDescriptionForRank(skill, index),
    );
  }

  return [buildDescriptionForRank(skill, 0)];
}

export function buildSingleDescription(skill: CharacterSkillData): string {
  return buildDescriptionForRank(skill, 0);
}
