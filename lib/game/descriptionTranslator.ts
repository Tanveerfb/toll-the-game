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
  field?: string,
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

  // Any other named field resolves against `<field>Ranked` first, then the
  // scalar — lets descriptions reference fields like counterDamagePercent.
  if (field && field !== "value") {
    const ranked = getRankedValue(mechanic[`${field}Ranked`], rankIndex);
    if (typeof ranked === "number") {
      return ranked;
    }
    const scalar = mechanic[field];
    return typeof scalar === "number" ? scalar : undefined;
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
  field?: string,
): string | undefined {
  const mechanic = getMechanics(skill).find(
    (entry) =>
      typeof entry.type === "string" &&
      entry.type.toLowerCase() === mechanicType.toLowerCase(),
  );

  if (!mechanic) {
    return undefined;
  }

  const value = resolveMechanicField(mechanic, rankIndex, field);
  return typeof value === "number" ? formatNumber(value) : undefined;
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

  // [dmg] resolves to this rank's damage value (the number only). Lets a
  // description place the percent explicitly so the mechanic word can sit
  // between it and "ATK" — the canonical attack wording Tanveer wants:
  // "Does [dmg]% Pierce ATK damage to one enemy" -> "Does 180% Pierce ATK...".
  result = result.replace(/\[dmg\]/gi, () => {
    const value = getRankDamage(skill, rankIndex);
    return typeof value === "number" ? formatNumber(value) : "";
  });

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

  // Unresolvable placeholders (e.g. keyword highlights like [Red]) are left
  // untouched instead of being erased.
  result = result.replace(
    /\[([a-zA-Z_]+)(?:\.([a-zA-Z_]+))?\]/g,
    (match, mechanicType: string, field?: string) =>
      resolveByMechanicType(skill, mechanicType, rankIndex, field) ?? match,
  );

  return result;
}

/**
 * STATUS #16 (Tanveer 2026-07-11): a clause whose ranked placeholder
 * resolves to 0 at this rank is hidden entirely — a rank-1 card reads
 * clean instead of "stuns for 0 turn(s)". Clauses are the semicolon
 * segments of ruling #28.
 */
function dropZeroValueClauses(
  description: string,
  skill: CharacterSkillData,
  rankIndex: number,
): string {
  return description
    .split(";")
    .filter((clause) => {
      const matches = [
        ...clause.matchAll(/\[([a-zA-Z_]+)(?:\.([a-zA-Z_]+))?\]/g),
      ];
      return !matches.some(
        ([, mechanicType, field]) =>
          resolveByMechanicType(skill, mechanicType, rankIndex, field) === "0",
      );
    })
    .join(";");
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

  let description = replaceMechanicPlaceholders(
    dropZeroValueClauses(raw, skill, rankIndex),
    skill,
    rankIndex,
  );
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

const STAT_LABELS: Record<string, string> = {
  atk: "ATK",
  def: "DEF",
  hp: "HP",
  all: "all stats",
  damageReduction: "damage reduction",
};

// Dokkan-style tier words (Tanveer's scheme, mirrors the lowers glossary):
// <50% plain, 50–79% "greatly", 80%+ "massively".
function tierWord(value: number, falling: boolean): string {
  const base = falling ? "lowers" : "raises";
  if (value >= 80) return `massively ${base}`;
  if (value >= 50) return `greatly ${base}`;
  return base;
}

/**
 * Per-skill, per-rank glossary entries for tiered stat wording ("raises",
 * "greatly lowers", …) so descriptions can drop the numbers — hovering the
 * pill shows this skill's actual percentages. Value only (Tanveer's call):
 * duration and cancel flags live in the description text itself.
 */
export function buildSkillKeywordGlossary(
  skill: CharacterSkillData,
  rankIndex: number,
): Record<string, string> {
  const collected: Record<string, Array<{ label: string; text: string }>> = {};

  for (const mech of getMechanics(skill)) {
    if (mech.type !== "buff" && mech.type !== "debuff") continue;
    const stat = typeof mech.stat === "string" ? mech.stat : undefined;
    if (!stat) continue;

    const value =
      getRankedValue(mech.valueRanked, rankIndex) ??
      (typeof mech.valuePercent === "number"
        ? mech.valuePercent
        : typeof mech.value === "number"
          ? mech.value
          : undefined);
    if (!value) continue;

    // No resolvable duration = permanent — the wording says so explicitly
    // ("Permanently raises ATK") instead of relying on omission.
    const duration =
      getRankedValue(mech.durationRanked, rankIndex) ??
      (typeof mech.duration === "number" ? mech.duration : undefined);
    const permanent = duration === undefined;

    const tier = `${permanent ? "permanently " : ""}${tierWord(value, mech.type === "debuff")}`;
    const statLabel = STAT_LABELS[stat] ?? stat.toUpperCase();
    const verb = mech.type === "debuff" ? "Reduces" : "Increases";

    (collected[tier] ??= []).push({
      label: statLabel,
      text: `${verb} ${statLabel} by ${value}%`,
    });
  }

  // The pill spans tier word + stat(s): "raises atk", and for multi-stat
  // phrases "raises atk and def" (longest keys win in the highlighter).
  // Bare tier keys stay as a fallback for looser wording.
  const out: Record<string, string> = {};
  for (const [tier, entries] of Object.entries(collected)) {
    out[tier] = entries.map((e) => e.text).join("; ");
    for (const entry of entries) {
      out[`${tier} ${entry.label.toLowerCase()}`] = entry.text;
    }
    if (entries.length > 1) {
      const combinedKey = `${tier} ${entries
        .map((e) => e.label.toLowerCase())
        .join(" and ")}`;
      out[combinedKey] = entries.map((e) => e.text).join("; ");
    }
  }
  return out;
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
