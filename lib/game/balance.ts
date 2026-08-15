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

/**
 * How much a skill's own pre-hit self-buffs multiply its damage (ruling #22:
 * the buff lands before the damage calc, so the same strike benefits).
 *
 * Only buffs that touch the skill's OWN scaling stat count — Chiara's ultimate
 * raises ATK and evade, and only the ATK half reaches her ATK-scaled damage.
 * `stat: "all"` covers basic stats, so it counts too (ruling #55). Buffs
 * compound multiplicatively, matching `effectiveStat` in `lib/game/stats.ts`.
 */
function selfBuffMultiplier(skill: CharacterSkillData): number {
  const scalingStat = skill.statMultiplier;
  return (skill.mechanics ?? []).reduce((mult, mech) => {
    if (mech.type !== "buff" || mech.targetSelf !== true) return mult;
    const stats = Array.isArray(mech.stats) ? (mech.stats as string[]) : [];
    const touchesScalingStat =
      mech.stat === scalingStat ||
      mech.stat === "all" ||
      stats.includes(scalingStat);
    if (!touchesScalingStat) return mult;
    return mult * (1 + (Number(mech.valuePercent) || 0) / 100);
  }, 1);
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

  // Ruling #2: the ultimate must hit harder than any rank-3 skill.
  //
  // Two things this comparison must NOT do, both of which it did until
  // 2026-08-14, between them flagging 5 of the 18 shipped kits:
  //
  // 1. **Count a heal as a damage skill.** `damageRanked` on a heal is the heal
  //    size, not damage — Siddiq's 680% heal read as a "rank-3 skill" his 400%
  //    ultimate had to beat.
  // 2. **Ignore the pre-hit self-buff (ruling #22).** A skill that raises the
  //    caster's stats and then attacks benefits from its own buff on the same
  //    strike, so the raw percentages are not comparable. Chiara's 333%
  //    ultimate out-damages her 400% card because it self-buffs +30/+33 first;
  //    Mustafa's 225% likewise. Both measured higher through `executeSkill`
  //    while reading lower on paper.
  //
  // The correction is a percentage-point allowance derived from the ultimate's
  // own pre-hit self-buffs rather than a full engine call — this module is
  // deliberately engine-agnostic (it runs on an unsaved Kit Lab draft, which
  // may not be a legal `BattleCharacter` yet).
  if (draft.ultimate) {
    // Judge the ultimate at its CEILING, not at ult level 1.
    //
    // Since 2026-08-14 every playable ultimate authors a six-value ladder and
    // level 1 is deliberately below the old flat figure — Duke's 500 became
    // 350 → 575, Meliodas's 700 became 450 → 700. An un-invested ultimate is
    // now *meant* to trail a rank-3 card; the ladder is what you spend coins
    // on. Comparing at level 1 would flag most of the roster for working as
    // designed, so ruling #2 is read against the top of the ladder.
    const ladder = draft.ultimate.damageByUltLevel;
    const ultDamage =
      Array.isArray(ladder) && ladder.length > 0
        ? ladder[ladder.length - 1]
        : (draft.ultimate.damage ?? maxRankedDamage(draft.ultimate));
    const effectiveUlt = ultDamage * selfBuffMultiplier(draft.ultimate);
    const strongestSkill = Math.max(
      0,
      ...draft.skills
        .filter((s) => s.type !== "heal")
        .map((s) => maxRankedDamage(s)),
    );
    if (ultDamage > 0 && strongestSkill > 0 && effectiveUlt <= strongestSkill) {
      flags.unshift({
        severity: "error",
        field: "ultimate",
        message:
          effectiveUlt === ultDamage
            ? `Ultimate damage (${ultDamage}%) is not higher than a rank-3 skill (${strongestSkill}%). Ults must hit harder than any rank-3 skill.`
            : `Ultimate damage (${ultDamage}%, ${Math.round(effectiveUlt)}% after its own pre-hit self-buff) is not higher than a rank-3 skill (${strongestSkill}%). Ults must hit harder than any rank-3 skill.`,
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
