import type { CharacterData, CharacterSkillData } from "@/lib/game/characterCatalog";

// Balance heuristics for the Kit Lab. Pure, engine-agnostic: given a draft kit
// and a reference roster, surface stat outliers and kit-authoring mistakes so
// Tanveer catches them before saving. Advisory only — nothing here blocks a
// save (the Zod schema does that); these are yellow "look again" nudges.

export interface BalanceBaselines {
  atkMedian: number;
  defMedian: number;
  hpMedian: number;
}

export interface BalanceFlag {
  severity: "warn" | "error";
  field: string;
  message: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeRosterBaselines(
  roster: CharacterData[],
): BalanceBaselines {
  return {
    atkMedian: median(roster.map((c) => c.atk)),
    defMedian: median(roster.map((c) => c.def)),
    hpMedian: median(roster.map((c) => c.hp)),
  };
}

function maxRankedDamage(skill: CharacterSkillData): number {
  if (Array.isArray(skill.damageRanked) && skill.damageRanked.length > 0) {
    return Math.max(...skill.damageRanked);
  }
  return skill.damage ?? 0;
}

function pctDelta(value: number, baseline: number): number {
  if (baseline === 0) return 0;
  return (value - baseline) / baseline;
}

const OUTLIER_THRESHOLD = 0.4; // +/-40% vs roster median

function flagStat(
  field: string,
  value: number,
  baseline: number,
): BalanceFlag | null {
  const delta = pctDelta(value, baseline);
  if (Math.abs(delta) < OUTLIER_THRESHOLD) return null;
  const pct = Math.round(Math.abs(delta) * 100);
  const dir = delta > 0 ? "above" : "below";
  return {
    severity: "warn",
    field,
    message: `${field.toUpperCase()} ${value} is ${pct}% ${dir} the roster median (${baseline}).`,
  };
}

/**
 * Analyze a draft kit against the roster. Returns advisory flags, most severe
 * first. `roster` should exclude the draft itself so it isn't compared to its
 * own numbers.
 */
export function analyzeKitBalance(
  draft: CharacterData,
  roster: CharacterData[],
): BalanceFlag[] {
  const flags: BalanceFlag[] = [];
  const baselines = computeRosterBaselines(roster);

  const atkFlag = flagStat("atk", draft.atk, baselines.atkMedian);
  const defFlag = flagStat("def", draft.def, baselines.defMedian);
  const hpFlag = flagStat("hp", draft.hp, baselines.hpMedian);
  if (atkFlag) flags.push(atkFlag);
  if (defFlag) flags.push(defFlag);
  if (hpFlag) flags.push(hpFlag);

  // Ruling: the ultimate must hit harder than any rank-3 skill.
  if (draft.ultimate) {
    const ultDamage = draft.ultimate.damage ?? maxRankedDamage(draft.ultimate);
    const strongestSkill = Math.max(
      0,
      ...draft.skills.map((s) => maxRankedDamage(s)),
    );
    if (ultDamage > 0 && strongestSkill > 0 && ultDamage <= strongestSkill) {
      flags.unshift({
        severity: "error",
        field: "ultimate",
        message: `Ultimate damage (${ultDamage}%) is not higher than a rank-3 skill (${strongestSkill}%). Ults must hit harder than any rank-3 skill.`,
      });
    }
  }

  // Per-skill checks.
  draft.skills.forEach((skill, i) => {
    const label = `skill ${i + 1} (${skill.skillName || "unnamed"})`;

    if (Array.isArray(skill.damageRanked)) {
      const [r1, r2, r3] = skill.damageRanked;
      const allZero = skill.damageRanked.every((v) => v === 0);
      if (skill.type === "attack" && allZero) {
        flags.push({
          severity: "warn",
          field: label,
          message: `${label} is an attack with 0 damage at every rank.`,
        });
      }
      if (!allZero && !(r1 <= r2 && r2 <= r3)) {
        flags.push({
          severity: "warn",
          field: label,
          message: `${label} damageRanked [${r1}/${r2}/${r3}] does not increase with rank.`,
        });
      }
    }
  });

  return flags;
}
