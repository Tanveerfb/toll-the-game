import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import { resolveDotDuration } from "@/lib/game/dotDurations";

/**
 * Any mention of an enemy counts as the target already being stated. Loose on
 * purpose, and symmetric with ALLY_TARGET_PATTERN below: Yalina's Attention
 * Drawer says "taunts all enemies" without the word "to", and still had "to
 * all enemies" stapled onto the end (Tanveer, 2026-08-10).
 */
const TARGET_PATTERN = /\benem(?:y|ies)\b/i;

/**
 * The ally-side twin of TARGET_PATTERN. Deliberately looser: an ally-facing
 * skill names its target in prose ("Grants all allies…", "Heals the lowest-HP
 * ally"), not in the fixed "to all X" shape hostile skills use. Any mention of
 * an ally means the target is already stated and the suffix must not be added
 * — "Grants all allies Debuff Immunity … to all allies" said it twice
 * (Tanveer, 2026-08-10).
 */
const ALLY_TARGET_PATTERN = /\ballies?\b/i;

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
  if (!lowerTypes.includes("aoe")) return undefined;

  // `aoe` only means "everyone on the other side" for a hostile skill. On a
  // supportive one it means the caster's own team, and calling that "to all
  // enemies" read as though Isolde's Starbound Ward attacked the party.
  const friendly = ["buff", "cleanse", "heal", "healovertime",
    "debuffimmunity", "stance"];
  const hasAllyMechanic = getMechanics(skill).some(
    (entry) =>
      typeof entry.type === "string" &&
      friendly.includes(entry.type.toLowerCase()) &&
      entry.targetSelf !== true,
  );
  // Must also deal no damage, matching the engine's own rule — Chiara's All In
  // buffs (targetSelf) and then hits everyone, and stays "to all enemies".
  // A heal skill's `damageRanked` is the HEAL amount, not damage: Prism's
  // Blessing Light read "…cleanses their debuffs to all enemies" because its
  // 90/120/170 heal looked hostile here (Tanveer, 2026-08-10).
  const dealsDamage =
    skill.type !== "heal" &&
    ((typeof skill.damage === "number" && skill.damage > 0) ||
      (Array.isArray(skill.damageRanked) &&
        skill.damageRanked.some((value) => value > 0)));
  return hasAllyMechanic && !dealsDamage ? "to all allies" : "to all enemies";
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
      const typeMatches = [
        ...clause.matchAll(/\[([a-zA-Z_]+)(?:\.([a-zA-Z_]+))?\]/g),
      ];
      if (
        typeMatches.some(
          ([, mechanicType, field]) =>
            resolveByMechanicType(skill, mechanicType, rankIndex, field) ===
            "0",
        )
      ) {
        return false;
      }

      // Same zero-hiding rule for [x-ranked]/[y-ranked]-style positional
      // refs — needed when a skill has two mechanics of the SAME type
      // (e.g. two "seal" entries) and can't disambiguate them by type name
      // alone (Chiara's "House Rules": seals two different skill
      // categories, each with its own per-rank on/off duration).
      const indexMatches = [...clause.matchAll(/\[([xyzwv])-ranked\]/gi)];
      return !indexMatches.some(([, letter]) => {
        const index = LETTER_INDEX[letter.toLowerCase()];
        return (
          typeof index === "number" &&
          resolveByMechanicIndex(skill, index, rankIndex) === "0"
        );
      });
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

/**
 * Appends "for N turns" to an Ignite or Bleed mention that doesn't already
 * state one.
 *
 * These descriptions are hand-authored strings ("applies Ignite.", "Bleed."),
 * so the duration was simply never stated — the player had no way to know an
 * Ignite lasts 3 turns and a Bleed 2 (Tanveer, 2026-08-09). Deriving it from
 * the mechanic rather than editing every kit's prose means the text can't
 * drift from the data, and it covers every current and future proc for free.
 *
 * Skipped when the author already wrote a duration, so a hand-written phrasing
 * always wins.
 */
function annotateDotDurations(
  description: string,
  skill: CharacterSkillData,
  rankIndex: number,
): string {
  const mechanics = getMechanics(skill);
  let text = description;

  (["ignite", "bleed"] as const).forEach((type) => {
    const mechanic = mechanics.find((m) => m.type === type);
    if (!mechanic) return;
    const turns = resolveDotDuration(mechanic, rankIndex);
    if (turns <= 0) return;

    const label = type === "ignite" ? "Ignite" : "Bleed";
    // (?!...) — leave any mention the author already qualified alone.
    const pattern = new RegExp(
      `\\b${label}\\b(?!\\s+for\\s+\\d+\\s+turns?)`,
      "i",
    );
    text = text.replace(
      pattern,
      `${label} for ${turns} turn${turns > 1 ? "s" : ""}`,
    );
  });

  return text;
}

function ensureTargetText(text: string, targetText?: string): string {
  const pattern = targetText?.includes("allies")
    ? ALLY_TARGET_PATTERN
    : TARGET_PATTERN;
  if (!targetText || pattern.test(text)) {
    return text;
  }

  const trimmed = cleanText(text);
  return `${trimmed} ${targetText}`;
}

/**
 * "1 turns" → "1 turn", and the same for stacks.
 *
 * Authored descriptions write a fixed plural around a `[…]` placeholder
 * ("for [buff.duration] turns"), which reads wrong whenever the value resolves
 * to 1. Kits used to dodge it by writing "turn(s)". Normalising here means the
 * prose can just say "turns" and come out right at every rank.
 */
function fixSingulars(text: string): string {
  return (
    text
      // Collapse the hand-written "(s)" hedge FIRST — otherwise "1 turn(s)"
      // becomes "1 turns" after the singular fix has already run.
      .replace(/\bturn\(s\)/g, "turns")
      .replace(/\bstack\(s\)/g, "stacks")
      .replace(/\bgauge\(s\)/g, "gauges")
      // An adjective can sit between the count and the noun ("1 ultimate
      // gauge"), so allow up to two words in between.
      .replace(/\b1 ((?:\w+ ){0,2})turns\b/g, "1 $1turn")
      .replace(/\b1 ((?:\w+ ){0,2})stacks\b/g, "1 $1stack")
      .replace(/\b1 ((?:\w+ ){0,2})gauges\b/g, "1 $1gauge")
  );
}

function removeDuplicateTarget(text: string): string {
  return text
    .replace(/(to\s+(?:1|one|all)\s+enemies?)(?:\s+\1)+/gi, "$1")
    .replace(/(to\s+(?:1|one|all)\s+all(?:y|ies))(?:\s+\1)+/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** "A" / "A and B" / "A, B and C". */
function joinList(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Collapses seal clauses that share a duration into one: "seals Debuff skills
 * for 2 turns; seals Attack Debuff skills for 2 turns" becomes "seals Debuff
 * and Attack Debuff skills for 2 turns" (Tanveer, 2026-08-10).
 *
 * Has to run at render time, not in the JSON. Chiara's House Rules seals the
 * two categories on different rank ladders ([0,0,2] and [0,1,2]) — at R2 only
 * Attack Debuff is sealed, so the merged sentence is only correct at R3.
 */
function mergeSealClauses(text: string): string {
  const SEAL = /^seals\s+(.+?)\s+skills\s+for\s+(\d+)\s+turns?$/i;
  type SealGroup = { subjects: string[]; duration: string };
  const parts: (string | SealGroup)[] = [];
  const byDuration = new Map<string, SealGroup>();

  for (const clause of text.split(";").map((c) => c.trim()).filter(Boolean)) {
    const match = clause.match(SEAL);
    if (!match) {
      parts.push(clause);
      continue;
    }
    const [, subject, duration] = match;
    const existing = byDuration.get(duration);
    if (existing) {
      existing.subjects.push(subject);
      continue;
    }
    const group: SealGroup = { subjects: [subject], duration };
    byDuration.set(duration, group);
    parts.push(group);
  }

  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : `seals ${joinList(part.subjects)} skills for ${part.duration} turns`,
    )
    .join("; ");
}

/**
 * Renders the surviving clauses as prose: two become "A and B", three or more
 * "A, B and C" (Tanveer, 2026-08-10 — "can do 'and' and comma over semicolon").
 *
 * Kits still AUTHOR with semicolons. Ruling #28's semicolon segments are what
 * `dropZeroValueClauses` hides on, so the separator has to survive until after
 * that pass — this runs last and only changes what the player reads. Writing
 * "and" into the JSON instead merges the clauses and takes the damage text down
 * with the zero-value effect (Isolde's Severed Ledger at R1).
 */
function joinClausesAsProse(text: string): string {
  const clauses = text
    .split(";")
    .map((clause) => clause.trim())
    .filter(Boolean);
  if (clauses.length < 2) return clauses[0] ?? "";
  const last = clauses[clauses.length - 1];
  // A final clause that already carries its own "and" ("seals Debuff and
  // Attack Debuff skills…") takes a comma instead — "X and seals A and B"
  // reads as one list too many.
  const separator = / and /i.test(last) ? ", " : " and ";
  return `${clauses.slice(0, -1).join(", ")}${separator}${last}`;
}

/**
 * Collapses an ultimate's ult-level ladders down to the flat scalars the rest
 * of this pipeline already understands.
 *
 * An ultimate has no rank, so the index it is rendered at means ult level
 * instead — "ult levels work in a similar fashion to skill ranks... only one of
 * 6 values comes to the battle" (Tanveer, 2026-08-14). Resolving here rather
 * than teaching every placeholder helper about a second ladder keeps the ult
 * path identical to the rank path from this point on.
 *
 * Mechanics below their `minUltLevel` are dropped outright, so a rank-1
 * Starbound Ward doesn't advertise a Debuff Immunity it will not grant.
 */
function resolveUltLevelLadders(
  skill: CharacterSkillData,
  index: number,
): CharacterSkillData {
  if (skill.type !== "ultimate") return skill;
  const ultLevel = index + 1;
  const pick = (arr: unknown, fallback: unknown) =>
    Array.isArray(arr) ? (arr[index] ?? arr[0]) : fallback;

  const mechanics = (skill.mechanics ?? [])
    .filter((m) => {
      const gate = m.minUltLevel as number | undefined;
      return gate == null || ultLevel >= gate;
    })
    .map((m) => ({
      ...m,
      value: pick(m.valueByUltLevel, m.value),
      valuePercent: pick(m.valuePercentByUltLevel, m.valuePercent),
      duration: pick(m.durationByUltLevel, m.duration),
    }));

  return {
    ...skill,
    damage: pick(skill.damageByUltLevel, skill.damage) as number | undefined,
    mechanics,
  } as CharacterSkillData;
}

export function buildDescriptionForRank(
  original: CharacterSkillData,
  rankIndex: number,
): string {
  const skill = resolveUltLevelLadders(original, rankIndex);
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

  description = annotateDotDurations(description, skill, rankIndex);
  description = mergeSealClauses(description);
  description = joinClausesAsProse(description);
  description = ensureTargetText(description, inferTargetFromMechanics(skill));
  description = removeDuplicateTarget(description);
  description = fixSingulars(description);

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
/**
 * Canonical tiers are 30 / 50 / 100 going up and 30 / 50 / 80 going down
 * (Tanveer, 2026-08-09). The top tier differs by direction on purpose: a stat
 * can never be reduced to zero in battle, so 80% is the ceiling a "lowers"
 * effect is written against, while a raise has no such cap and reserves
 * "massively" for 100%+.
 *
 * Thresholds rather than exact matches, so an off-tier value still picks the
 * nearest honest word instead of falling through to the plain one.
 */
function tierWord(value: number, falling: boolean): string {
  const base = falling ? "lowers" : "raises";
  const massivelyAt = falling ? 80 : 100;
  if (value >= massivelyAt) return `massively ${base}`;
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
    // A combined entry ("raises ATK and DEF") is ONE effect covering several
    // stats, so it gets one glossary key — not one per stat.
    const stat = Array.isArray(mech.stats) && mech.stats.length > 0
      ? mech.stats.join("+")
      : typeof mech.stat === "string"
        ? mech.stat
        : undefined;
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
    const statLabel = stat.includes("+")
      ? stat
          .split("+")
          .map((part) => STAT_LABELS[part] ?? part.toUpperCase())
          .join(" and ")
      : (STAT_LABELS[stat] ?? stat.toUpperCase());
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

/**
 * One rendered description per ult level, for an ultimate that authors a
 * ladder.
 *
 * Ultimates deliberately have no rank table (ruling #74 — SP and ULT never
 * enter the deck), but since 2026-08-14 they DO have six authored values, and
 * a player deciding whether to spend a coin needs to see what the next level
 * buys. Returns null for anything without a ladder, which keeps every boss and
 * NPC ultimate rendering as the single line it has always been.
 */
export function buildUltLevelDescriptions(
  skill: CharacterSkillData,
): string[] | null {
  const levels = skill.damageByUltLevel?.length
    ? skill.damageByUltLevel.length
    : // A zero-damage ultimate (Isolde) still ladders, but through its
      // mechanics rather than its damage — look for any ult-level array.
      (skill.mechanics ?? []).reduce((max, m) => {
        const arrays = [
          m.valueByUltLevel,
          m.valuePercentByUltLevel,
          m.durationByUltLevel,
        ];
        return arrays.reduce<number>(
          (acc, arr) => (Array.isArray(arr) ? Math.max(acc, arr.length) : acc),
          max,
        );
      }, 0);
  if (!levels) return null;
  return Array.from({ length: levels }, (_, index) =>
    buildDescriptionForRank(skill, index),
  );
}

export function buildSingleDescription(skill: CharacterSkillData): string {
  return buildDescriptionForRank(skill, 0);
}
