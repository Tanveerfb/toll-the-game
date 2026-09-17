import {
  rawPassiveMechanics,
  rawPassiveTrigger,
} from "@/lib/game/passiveBlocks";
import {
  getCharacterKit,
  getCharacterPhases,
  registerDraftCharacter,
  type CharacterData,
  type CharacterPassiveData,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";

export const DAMAGE_PREVIEW_DUMMY = {
  atk: 100,
  def: 50,
  hp: 2000,
} as const;

/**
 * Player-facing Preview (spec §7, Task 10 — repoints the retired Kit Lab's
 * "Test in Battle" path): a live 1v1 sandbox launched from a skill/ultimate
 * info screen, card owner vs. this low-HP dummy. Deliberately separate stats
 * from DAMAGE_PREVIEW_DUMMY above — that one needs "typical enemy" numbers
 * for the static per-ability table; this one needs to go down fast so a
 * Preview loop (hit -> victory -> Reset) stays snappy.
 */
export const PRACTICE_DUMMY_ID = "practice_dummy";

/**
 * Deliberately absurd (Tanveer 2026-08-04). Preview is a sandbox for trying a
 * kit's whole rank ladder and ultimate — the dummy dying ends the session
 * early and defeats the point. It used to sit at 400 HP so a Preview battle
 * "resolved quickly", which was the wrong goal. At 100k nothing in the roster
 * can drop it: the biggest ultimate in the game is well under 10k per hit.
 */
export const PRACTICE_DUMMY_HP = 100_000;

/** Pure builder — a fresh CharacterData each call, registered at runtime via
 *  registerDraftCharacter (same mechanism the old Kit Lab used for its own
 *  draft kit), never persisted to disk and invisible to the static roster. */
export function buildPracticeDummy(): CharacterData {
  const fillerSkill: CharacterSkillData = {
    skillName: "Practice Strike",
    characterId: PRACTICE_DUMMY_ID,
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [DAMAGE_PREVIEW_DUMMY.atk, DAMAGE_PREVIEW_DUMMY.atk, DAMAGE_PREVIEW_DUMMY.atk],
    description: "Does damage equal to ATK-scaled to one enemy.",
  };
  return {
    id: PRACTICE_DUMMY_ID,
    // Not a real card: 0 sits outside the 100000-999999 range every authored
    // kit uses, so the dummy can never collide with one or reach the archive.
    cardNumber: 0,
    name: "Training Dummy",
    color: "light",
    atk: DAMAGE_PREVIEW_DUMMY.atk,
    def: DAMAGE_PREVIEW_DUMMY.def,
    hp: PRACTICE_DUMMY_HP,
    storyOnly: true,
    tags: ["Dummy"],
    skills: [fillerSkill, { ...fillerSkill }],
  };
}

/** Registers the practice dummy so getCharacterById/startCustomBattle can
 *  resolve it — safe to call every time a Preview launches (re-registering
 *  is a harmless overwrite, not a duplicate). */
export function registerPracticeDummy(): void {
  registerDraftCharacter(buildPracticeDummy());
}

interface PreviewScenario {
  id: string;
  label: string;
  attackerHpPercent?: number;
  attackerBuffCount?: number;
  enemyCount?: number;
  targetIgniteStacks?: number;
  targetUltGauge?: number;
  targetHasDebuff?: boolean;
  targetHasBuff?: boolean;
  momentumStacks?: number;
  empoweredSkillMultiplierPercent?: number;
  note?: string;
}

export interface DamagePreviewRow {
  id: string;
  abilityName: string;
  rankLabel: string;
  multiplierLabel: string;
  scenarioLabel: string;
  resultLabel: string;
  notes: string;
  /** Set only for multi-phase kits — which phase this ability belongs to. */
  phaseLabel?: string;
}

interface NormalizedMechanic {
  type: string;
  stat?: string;
  /** Stats a single combined entry covers ("raises ATK and DEF"). */
  stats?: string[];
  sealType?: string;
  effect?: string;
  targetSelf?: boolean;
  ranks?: boolean[];
  value?: number;
  valuePercent?: number;
  valuePerStackPercent?: number;
  damagePercent?: number;
  duration?: number;
  stacks?: number;
  counterDamagePercent?: number;
  ignoreDefensePercent?: number;
  damageBonusPercent?: number;
}

/**
 * The one state every row is computed in.
 *
 * Full HP, no buffs, one enemy, no stacks - so every number in the table is
 * comparable with every other, across skills and across characters. The
 * per-character scenario switch this replaced gave Batra thirteen rows and
 * Lyra seven for the same question, because six characters had hand-written
 * cases (`batra`, `duke`, `master_tao`, `sara`, `siddiq`, `yalina`) and
 * everyone else fell through to a generic pair. A new character either got a
 * bespoke case written by hand or a thinner table than its neighbours.
 *
 * A conditional bonus (Spite scaling with lost HP, Concentrate with fewer
 * enemies) is described in the skill's own text on the same page; it does not
 * need a second, differently-shaped table to restate it.
 */
const BASELINE: PreviewScenario = {
  id: "standard",
  label: "Standard",
  attackerHpPercent: 100,
  attackerBuffCount: 0,
  enemyCount: 1,
  targetIgniteStacks: 0,
  targetUltGauge: 0,
  targetHasDebuff: false,
  momentumStacks: 0,
};

function normalizeMechanic(
  mechanic: Record<string, unknown>,
  rankIndex: number,
): NormalizedMechanic {
  const valueRanked = Array.isArray(mechanic.valueRanked)
    ? mechanic.valueRanked
    : undefined;
  const stacksRanked = Array.isArray(mechanic.stacksRanked)
    ? mechanic.stacksRanked
    : undefined;
  const durationRanked = Array.isArray(mechanic.durationRanked)
    ? mechanic.durationRanked
    : undefined;

  return {
    type: typeof mechanic.type === "string" ? mechanic.type : "unknown",
    stat: typeof mechanic.stat === "string" ? mechanic.stat : undefined,
    stats: Array.isArray(mechanic.stats)
      ? (mechanic.stats as string[])
      : undefined,
    sealType:
      typeof mechanic.sealType === "string" ? mechanic.sealType : undefined,
    effect: typeof mechanic.effect === "string" ? mechanic.effect : undefined,
    targetSelf: mechanic.targetSelf === true,
    ranks: Array.isArray(mechanic.ranks)
      ? mechanic.ranks.filter(
          (value): value is boolean => typeof value === "boolean",
        )
      : undefined,
    value:
      typeof mechanic.value === "number"
        ? mechanic.value
        : typeof valueRanked?.[rankIndex] === "number"
          ? valueRanked[rankIndex]
          : undefined,
    valuePercent:
      typeof mechanic.valuePercent === "number"
        ? mechanic.valuePercent
        : undefined,
    valuePerStackPercent:
      typeof mechanic.valuePerStackPercent === "number"
        ? mechanic.valuePerStackPercent
        : undefined,
    damagePercent:
      typeof mechanic.damagePercent === "number"
        ? mechanic.damagePercent
        : undefined,
    duration:
      typeof mechanic.duration === "number"
        ? mechanic.duration
        : typeof durationRanked?.[rankIndex] === "number"
          ? durationRanked[rankIndex]
          : undefined,
    stacks:
      typeof mechanic.stacks === "number"
        ? mechanic.stacks
        : typeof stacksRanked?.[rankIndex] === "number"
          ? stacksRanked[rankIndex]
          : undefined,
    counterDamagePercent:
      typeof mechanic.counterDamagePercent === "number"
        ? mechanic.counterDamagePercent
        : Array.isArray(mechanic.counterDamagePercentRanked) &&
            typeof (mechanic.counterDamagePercentRanked as number[])[
              rankIndex
            ] === "number"
          ? (mechanic.counterDamagePercentRanked as number[])[rankIndex]
          : undefined,
    ignoreDefensePercent:
      typeof mechanic.ignoreDefensePercent === "number"
        ? mechanic.ignoreDefensePercent
        : undefined,
    damageBonusPercent:
      typeof mechanic.damageBonusPercent === "number"
        ? mechanic.damageBonusPercent
        : undefined,
  };
}

function hasMechanic(skill: CharacterSkillData, type: string): boolean {
  return (
    skill.mechanics?.some(
      (mechanic) => typeof mechanic.type === "string" && mechanic.type === type,
    ) ?? false
  );
}

function getDamageMultiplier(
  skill: CharacterSkillData,
  rankIndex?: number,
  ultLevelIndex?: number,
): number {
  // An ultimate ladders by ULT LEVEL, not by rank (ruling #92), and its six
  // steps live in `damageByUltLevel`. This function did not read that field at
  // all: it fell through to `skill.damage`, so the preview printed one number
  // for a six-step ladder and Lyra's [350, 385, 430, 475, 520, 575] showed as
  // a single 350% row. Found 2026-09-17.
  if (typeof ultLevelIndex === "number") {
    const byLevel = skill.damageByUltLevel?.[ultLevelIndex];
    if (typeof byLevel === "number") return byLevel / 100;
  }

  if (typeof rankIndex === "number") {
    return (skill.damageRanked?.[rankIndex] ?? 0) / 100;
  }

  return (skill.damage ?? 0) / 100;
}

function formatMultiplierLabel(
  skill: CharacterSkillData,
  multiplier: number,
): string {
  const percent = multiplier * 100;
  const roundedPercent = Number.isInteger(percent)
    ? String(percent)
    : percent
        .toFixed(2)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1");

  return `${roundedPercent}%`;
}

function isAoeActive(
  mechanics: NormalizedMechanic[],
  rankIndex?: number,
): boolean {
  return mechanics.some((mechanic) => {
    if (mechanic.type === "aoe") {
      return true;
    }

    if (mechanic.type !== "aoeRanked") {
      return false;
    }

    if (typeof rankIndex !== "number") {
      return false;
    }

    return mechanic.ranks?.[rankIndex] === true;
  });
}

function applyPreHitSelfBuffs(
  skill: CharacterSkillData,
  mechanics: NormalizedMechanic[],
  baseAtk: number,
  baseDef: number,
  baseHp: number,
): { atk: number; def: number; hp: number; notes: string[] } {
  let atk = baseAtk;
  let def = baseDef;
  let hp = baseHp;
  const notes: string[] = [];

  mechanics.forEach((mechanic) => {
    if (!mechanic.targetSelf || mechanic.type !== "buff") {
      return;
    }

    const percent = mechanic.valuePercent ?? mechanic.value ?? 0;
    if (percent === 0) {
      return;
    }

    // Matches `stat: "atk"` and `stats: ["atk", ...]` alike. One entry may
    // cover several stats — "raises ATK and DEF" is ONE buff (ruling #55) —
    // and reading only `stat` left every such self-buff out of the estimate,
    // understating Duke's Surge and Killua's ultimate. Ruling #22 says a
    // self-buff applies before the damage calc and the same strike benefits,
    // so the preview has to include it or it lies about the hit.
    const touches = (name: string) =>
      mechanic.stat === name ||
      (Array.isArray(mechanic.stats) && mechanic.stats.includes(name));

    if (touches("atk")) {
      atk *= 1 + percent / 100;
      notes.push(`Self ATK buff included (+${percent}%).`);
    }

    if (touches("def")) {
      def *= 1 + percent / 100;
      notes.push(`Self DEF buff included (+${percent}%).`);
    }

    if (touches("hp")) {
      hp *= 1 + percent / 100;
      notes.push(`Self HP buff included (+${percent}%).`);
    }
  });

  if (skill.characterId === "yalina" && skill.skillName === "Draw Fire") {
    const reduction = mechanics.find(
      (mechanic) => mechanic.stat === "damageReduction",
    );
    if (reduction) {
      const percent = reduction.valuePercent ?? reduction.value ?? 0;
      notes.push(`Self damage reduction granted (+${percent}%).`);
    }
  }

  return { atk, def, hp, notes };
}

function getCurrentHpAfterPassive(
  character: CharacterData,
  passive: CharacterPassiveData | undefined,
  scenario: PreviewScenario,
  notes: string[],
): number {
  const initialHp = character.hp * ((scenario.attackerHpPercent ?? 100) / 100);
  const consumeHpMechanic = rawPassiveMechanics(passive).find(
    (mechanic) =>
      typeof mechanic.type === "string" && mechanic.type === "consumeHpPercent",
  );

  if (!consumeHpMechanic) {
    return initialHp;
  }

  const valuePercent =
    typeof consumeHpMechanic.valuePercent === "number"
      ? consumeHpMechanic.valuePercent
      : 0;

  if (valuePercent <= 0) {
    return initialHp;
  }

  const consumed = character.hp * (valuePercent / 100);
  const resultingHp = Math.max(1, initialHp - consumed);
  notes.push(
    `Passive HP cost applied before damage (${Math.round(initialHp)} -> ${Math.round(resultingHp)} HP).`,
  );
  return resultingHp;
}

function applySkillDamageModifiers(
  character: CharacterData,
  skill: CharacterSkillData,
  passive: CharacterPassiveData | undefined,
  mechanics: NormalizedMechanic[],
  scenario: PreviewScenario,
  baseDamage: number,
  currentHp: number,
  notes: string[],
): number {
  let modifiedDamage = baseDamage;

  if (scenario.empoweredSkillMultiplierPercent) {
    modifiedDamage *= 1 + scenario.empoweredSkillMultiplierPercent / 100;
    notes.push(
      `Passive empowerment applied (+${scenario.empoweredSkillMultiplierPercent}%).`,
    );
  }

  const deathblowMechanic = rawPassiveMechanics(passive).find(
    (mechanic) =>
      typeof mechanic.type === "string" && mechanic.type === "deathblow",
  );
  if (deathblowMechanic) {
    const lostPercent = 100 - (currentHp / character.hp) * 100;
    const hpStep =
      typeof deathblowMechanic.hpStepPercent === "number"
        ? deathblowMechanic.hpStepPercent
        : 3;
    const perStep =
      typeof deathblowMechanic.damagePerStepPercent === "number"
        ? deathblowMechanic.damagePerStepPercent
        : 2;
    const bonus = Math.floor(lostPercent / hpStep) * perStep;
    if (bonus > 0) {
      modifiedDamage *= 1 + bonus / 100;
      notes.push(`Deathblow bonus applied (+${bonus}%).`);
    }
  }

  if (mechanics.some((mechanic) => mechanic.type === "spite")) {
    const missingHpPercent = 100 - (currentHp / character.hp) * 100;
    const spiteBonusPercent = missingHpPercent * 2;
    modifiedDamage *= 1 + spiteBonusPercent / 100;
    // Silent at full health: "Spite bonus applied (+0%)" is a note that says
    // nothing, and it appeared on every Batra row once the table moved to a
    // full-HP baseline.
    if (spiteBonusPercent >= 1) {
      notes.push(`Spite bonus applied (+${Math.floor(spiteBonusPercent)}%).`);
    }
  }

  if (mechanics.some((mechanic) => mechanic.type === "concentrate")) {
    const enemyCount = scenario.enemyCount ?? 1;
    let multiplier = 1;

    if (enemyCount === 1) {
      multiplier = 1.5;
    } else if (enemyCount === 2) {
      multiplier = 1.2;
    } else if (enemyCount === 3) {
      multiplier = 1.1;
    }

    modifiedDamage *= multiplier;

    if (multiplier > 1) {
      notes.push(
        `Concentrate bonus applied (+${Math.round((multiplier - 1) * 100)}%).`,
      );
    }
  }

  const amplifyMechanic = mechanics.find(
    (mechanic) => mechanic.type === "amplify",
  );
  if (amplifyMechanic) {
    const attackerBuffCount = scenario.attackerBuffCount ?? 0;
    const valuePerBuff =
      amplifyMechanic.valuePercent ?? amplifyMechanic.value ?? 10;
    const amplifyBonusPercent = attackerBuffCount * valuePerBuff;
    modifiedDamage *= 1 + amplifyBonusPercent / 100;

    if (amplifyBonusPercent > 0) {
      notes.push(
        `Amplify bonus applied (+${amplifyBonusPercent}% from buffs).`,
      );
    }
  }

  if (
    character.id === "yalina" &&
    rawPassiveTrigger(passive) === "onAllySkill"
  ) {
    const momentumMechanic = rawPassiveMechanics(passive).find(
      (mechanic) =>
        typeof mechanic.type === "string" && mechanic.type === "momentumStacks",
    );
    const momentumStacks = scenario.momentumStacks ?? 0;
    const valuePerStack =
      momentumMechanic && typeof momentumMechanic.valuePercent === "number"
        ? momentumMechanic.valuePercent
        : 0;

    if (momentumStacks > 0 && valuePerStack > 0) {
      const momentumBonusPercent = momentumStacks * valuePerStack;
      modifiedDamage *= 1 + momentumBonusPercent / 100;
      notes.push(`Momentum bonus applied (+${momentumBonusPercent}%).`);
    }
  }

  const consumeIgniteMechanic = mechanics.find(
    (mechanic) => mechanic.type === "consumeIgnite",
  );
  if (consumeIgniteMechanic && skill.statMultiplier === "atk") {
    const igniteStacks = scenario.targetIgniteStacks ?? 0;
    const valuePerStack = consumeIgniteMechanic.valuePerStackPercent ?? 0;

    if (igniteStacks > 0 && valuePerStack > 0) {
      const combustionBonusPercent = igniteStacks * valuePerStack;
      modifiedDamage *= 1 + combustionBonusPercent / 100;
      notes.push(
        `Consumed Ignite converted into ATK bonus (+${combustionBonusPercent}%).`,
      );
    }
  }

  return modifiedDamage;
}

function resolveBaseStat(
  skill: CharacterSkillData,
  stats: { atk: number; def: number; hp: number },
): number {
  if (skill.statMultiplier === "atk") {
    return stats.atk;
  }

  if (skill.statMultiplier === "def") {
    return stats.def;
  }

  if (skill.statMultiplier === "hp") {
    return stats.hp;
  }

  return 0;
}

function calculateFinalDamage(
  skill: CharacterSkillData,
  mechanics: NormalizedMechanic[],
  scenario: PreviewScenario,
  baseDamage: number,
  notes: string[],
): number {
  let effectiveDefense = DAMAGE_PREVIEW_DUMMY.def;
  const pierceMechanic = mechanics.find(
    (mechanic) => mechanic.type === "pierce",
  );

  if (pierceMechanic) {
    const piercePercent = pierceMechanic.value ?? 50;
    effectiveDefense *= 1 - piercePercent / 100;
    notes.push(`Pierce applied (${piercePercent}% DEF ignored).`);
  }

  const criticalMechanic = mechanics.find(
    (mechanic) => mechanic.type === "critical",
  );
  if (criticalMechanic) {
    const ignorePercent = criticalMechanic.ignoreDefensePercent ?? 50;
    effectiveDefense *= 1 - ignorePercent / 100;
    notes.push(
      `CRITICAL: ${ignorePercent}% DEF ignored, type matchups ignored.`,
    );
  }

  const effectiveBaseDamage = Math.max(1, baseDamage - effectiveDefense);
  let extraDamage = 0;
  const targetIgniteStacks = scenario.targetIgniteStacks ?? 0;

  if (targetIgniteStacks > 0) {
    extraDamage += effectiveBaseDamage * (0.1 * targetIgniteStacks);
    notes.push(`Ignite damage bonus applied (+${targetIgniteStacks * 10}%).`);
  }

  if (mechanics.some((mechanic) => mechanic.type === "detonate")) {
    const targetUltGauge = scenario.targetUltGauge ?? 0;
    extraDamage += effectiveBaseDamage * (0.2 * targetUltGauge);
    if (targetUltGauge > 0) {
      notes.push(`Detonate bonus applied (+${targetUltGauge * 20}%).`);
    }
  }

  if (
    mechanics.some((mechanic) => mechanic.type === "weakpoint") &&
    scenario.targetHasDebuff
  ) {
    extraDamage += effectiveBaseDamage * 2;
    notes.push("Weakpoint bonus applied (x3 total damage).");
  }

  if (
    mechanics.some((mechanic) => mechanic.type === "rupture") &&
    scenario.targetHasBuff
  ) {
    extraDamage += effectiveBaseDamage * 1;
    notes.push("Rupture bonus applied (x2 total damage).");
  }

  if (skill.type === "heal") {
    return 0;
  }

  let total = effectiveBaseDamage + extraDamage;
  if (criticalMechanic) {
    const bonusPercent = criticalMechanic.damageBonusPercent ?? 50;
    total *= 1 + bonusPercent / 100;
    notes.push(`CRITICAL damage bonus applied (+${bonusPercent}%).`);
  }

  return Math.floor(total);
}

const EMPTY_SKIP: ReadonlySet<string> = new Set();

/** Mechanics `getExtraEffectNotes` already narrates in prose. Summarising them
 *  a second time produced "Stuns for 2 turns. … Stuns (2 turns)." */
const ALREADY_NARRATED: ReadonlySet<string> = new Set(["stun", "seal"]);

const STAT_LABEL: Record<string, string> = {
  atk: "ATK",
  def: "DEF",
  hp: "HP",
  all: "All stats",
  damageReduction: "Damage taken",
  damageDealt: "Damage dealt",
  evade: "Evade",
  critChance: "Crit chance",
  critDamage: "Crit damage",
  recoveryRate: "Recovery rate",
  lifesteal: "Lifesteal",
};

function statLabel(stat: string | undefined, stats?: string[]): string {
  // A combined entry ("raises ATK and DEF") is one effect covering several
  // stats — render it as one label. The preview used to build this by merging
  // two sibling rows; now the kit says it in a single entry.
  if (stats && stats.length > 0) {
    return stats.map((s) => STAT_LABEL[s] ?? s.toUpperCase()).join(" · ");
  }
  if (!stat) return "Stat";
  return STAT_LABEL[stat] ?? stat.toUpperCase();
}

function turns(duration: number | undefined): string {
  if (!duration || duration <= 0) return "";
  return ` (${duration} turn${duration === 1 ? "" : "s"})`;
}

/**
 * Human summary of ONE non-damage mechanic. Returns null for mechanics that
 * only shape damage (pierce, weakpoint, …) — those already surface through the
 * damage number itself and the existing notes.
 */
function describeSupportMechanic(
  mechanic: NormalizedMechanic,
  rankIndex: number,
): string | null {
  // Rank-gated mechanics are inactive at ranks where `ranks[i]` is false —
  // reporting them anyway produced rows reading "No seal at this rank. Seals
  // skills." on the same line.
  if (mechanic.ranks && mechanic.ranks[rankIndex] === false) return null;
  const amount = mechanic.value ?? mechanic.valuePercent;
  // A zero-value entry is a rank where the effect doesn't apply — "−0 enemy
  // ult gauge" is noise, not information.
  if (amount === 0) return null;
  switch (mechanic.type) {
    case "buff":
      return amount === undefined
        ? null
        : `${statLabel(mechanic.stat, mechanic.stats)} +${amount}%${turns(mechanic.duration)}`;
    case "debuff":
      return amount === undefined
        ? null
        : `${statLabel(mechanic.stat, mechanic.stats)} −${amount}%${turns(mechanic.duration)}`;
    case "stance":
      // A damage-reduction stance reads as less damage taken, not "+60% of
      // a stat" — the sign flips relative to a plain buff.
      if (amount === undefined) return null;
      return mechanic.stat === "damageReduction"
        ? `Damage taken −${amount}%${turns(mechanic.duration)}`
        : `${statLabel(mechanic.stat, mechanic.stats)} +${amount}%${turns(mechanic.duration)}`;
    case "healOverTime":
      return amount === undefined
        ? null
        : `Regen ${amount}% per turn${turns(mechanic.duration)}`;
    case "cleanse":
      return "Cleanses debuffs";
    case "debuffImmunity":
      return `Debuff immunity${turns(mechanic.duration)}`;
    case "taunt":
      return `Taunts${turns(mechanic.duration)}`;
    case "stun":
      return `Stuns${turns(mechanic.duration)}`;
    case "seal":
      return `Seals skills${turns(mechanic.duration)}`;
    case "cancelBuffs":
      return "Cancels buffs";
    case "cancelStances":
      return "Cancels stances";
    case "gainUltGauge":
      return amount === undefined ? null : `+${amount} ult gauge`;
    case "lowerUltGauge":
      return amount === undefined ? null : `−${amount} enemy ult gauge`;
    default:
      return null;
  }
}

/**
 * Every non-damage effect a skill carries, deduped and merged: two buffs with
 * the same amount and duration (Leorio's ATK and DEF) read as one line rather
 * than two near-identical ones.
 */
/** Stats `applyPreHitSelfBuffs` already folds into the damage number and
 *  narrates as "Self ATK buff included (+30%)". */
const PRE_HIT_SELF_STATS: ReadonlySet<string> = new Set(["atk", "def", "hp"]);

function summarizeSupportEffects(
  mechanics: NormalizedMechanic[],
  rankIndex = 0,
  skipTypes: ReadonlySet<string> = EMPTY_SKIP,
  skipPreHitSelfBuffs = false,
): string[] {
  const described = mechanics
    .filter((mechanic) => !skipTypes.has(mechanic.type))
    .filter(
      (mechanic) =>
        !(
          skipPreHitSelfBuffs &&
          mechanic.type === "buff" &&
          mechanic.targetSelf === true &&
          mechanic.stat !== undefined &&
          PRE_HIT_SELF_STATS.has(mechanic.stat)
        ),
    )
    .map((mechanic) => ({
      mechanic,
      text: describeSupportMechanic(mechanic, rankIndex),
    }))
    .filter((entry): entry is { mechanic: NormalizedMechanic; text: string } =>
      entry.text !== null,
    );

  const merged: string[] = [];
  const usedIndexes = new Set<number>();
  described.forEach((entry, index) => {
    if (usedIndexes.has(index)) return;
    const { mechanic } = entry;
    const amount = mechanic.value ?? mechanic.valuePercent;
    // Group sibling stat changes that share type, amount and duration.
    const siblings = described.filter(
      (other, otherIndex) =>
        otherIndex !== index &&
        !usedIndexes.has(otherIndex) &&
        other.mechanic.type === mechanic.type &&
        (other.mechanic.value ?? other.mechanic.valuePercent) === amount &&
        other.mechanic.duration === mechanic.duration &&
        other.mechanic.stat !== undefined &&
        mechanic.stat !== undefined,
    );
    if (siblings.length > 0 && mechanic.stat) {
      const stats = [
        statLabel(mechanic.stat, mechanic.stats),
        ...siblings.map((s) => statLabel(s.mechanic.stat, s.mechanic.stats)),
      ];
      siblings.forEach((sibling) =>
        usedIndexes.add(described.indexOf(sibling)),
      );
      const sign = mechanic.type === "debuff" ? "−" : "+";
      merged.push(`${stats.join(" · ")} ${sign}${amount}%${turns(mechanic.duration)}`);
    } else {
      merged.push(entry.text);
    }
    usedIndexes.add(index);
  });

  return merged;
}

function getExtraEffectNotes(
  character: CharacterData,
  skill: CharacterSkillData,
  passive: CharacterPassiveData | undefined,
  mechanics: NormalizedMechanic[],
  rankIndex: number | undefined,
  scenario: PreviewScenario,
  damage: number,
  notes: string[],
): string[] {
  const extraNotes = [...notes];
  const enemyCount = scenario.enemyCount ?? 1;
  const aoeActive = isAoeActive(mechanics, rankIndex);

  if (skill.type === "heal") {
    const healPerTarget = Math.floor(
      damage === 0
        ? getDamageMultiplier(skill, rankIndex) *
            resolveBaseStat(skill, {
              atk: character.atk,
              def: character.def,
              hp: character.hp,
            })
        : 0,
    );
    if (aoeActive) {
      extraNotes.push(`Heals ${healPerTarget} HP to each ally.`);
    } else {
      extraNotes.push(`Heals ${healPerTarget} HP to one ally.`);
    }
  }

  if (aoeActive && damage > 0 && enemyCount > 1) {
    extraNotes.push(
      `Total damage vs ${enemyCount} dummy enemies: ${damage * enemyCount}.`,
    );
  }

  const decayMechanic = mechanics.find((mechanic) => mechanic.type === "decay");
  if (decayMechanic && damage > 0) {
    const decayPercent = decayMechanic.damagePercent ?? 0;
    const decayDamage = Math.floor(damage * (decayPercent / 100));
    const stacks = decayMechanic.stacks ?? 1;
    const duration = decayMechanic.duration ?? 1;
    extraNotes.push(
      `Decay stores ${decayDamage} damage per tick for ${duration} turn${duration === 1 ? "" : "s"} (${stacks} stack${stacks === 1 ? "" : "s"}).`,
    );
  }

  if (character.id === "master_tao" && hasMechanic(skill, "consumeIgnite")) {
    const igniteStacks = scenario.targetIgniteStacks ?? 0;
    const passiveHealMechanic = rawPassiveMechanics(passive).find(
      (mechanic) =>
        typeof mechanic.type === "string" && mechanic.type === "heal",
    );
    const conditionStacks =
      passiveHealMechanic &&
      typeof passiveHealMechanic.conditionStacks === "number"
        ? passiveHealMechanic.conditionStacks
        : 0;
    const healPercent =
      passiveHealMechanic &&
      typeof passiveHealMechanic.valuePercent === "number"
        ? passiveHealMechanic.valuePercent
        : 0;
    const triggers =
      conditionStacks > 0 ? Math.floor(igniteStacks / conditionStacks) : 0;

    if (triggers > 0 && healPercent > 0) {
      extraNotes.push(
        `Healing Flames restores ${Math.floor(character.hp * (healPercent / 100) * Math.min(triggers, 3))} HP.`,
      );
    }
  }

  if (
    character.id === "siddiq" &&
    rawPassiveTrigger(passive) === "onDamageDealt" &&
    damage > 0
  ) {
    const healMechanic = rawPassiveMechanics(passive).find(
      (mechanic) =>
        typeof mechanic.type === "string" && mechanic.type === "healLifesteal",
    );
    const attackerHpPercent = scenario.attackerHpPercent ?? 100;
    const healPercent =
      healMechanic && typeof healMechanic.lifestealPercent === "number"
        ? healMechanic.lifestealPercent
        : 0;

    if (attackerHpPercent < 50 && healPercent > 0) {
      const totalDamage = aoeActive ? damage * enemyCount : damage;
      extraNotes.push(
        `Vampiric Roots restores ${Math.floor(totalDamage * (healPercent / 100))} HP.`,
      );
    }
  }

  // Generic on-hit effect notes (kit-agnostic — covers the newer rosters)
  for (const dot of mechanics) {
    if ((dot.type === "shock" || dot.type === "bleed") && damage > 0) {
      const percent = dot.damagePercent ?? (dot.type === "shock" ? 30 : 90);
      const duration = dot.duration ?? (dot.type === "shock" ? 4 : 1);
      if (duration > 0) {
        const dotName = dot.type === "shock" ? "Shock" : "Bleed";
        extraNotes.push(
          `${dotName} DoT: ${Math.floor(damage * (percent / 100))}/turn for ${duration} turn${duration === 1 ? "" : "s"}.`,
        );
      }
    }
  }

  const lifestealMechanic = mechanics.find(
    (mechanic) => mechanic.type === "lifesteal",
  );
  if (lifestealMechanic && damage > 0) {
    const percent =
      lifestealMechanic.valuePercent ?? lifestealMechanic.value ?? 30;
    const totalDamage = aoeActive ? damage * enemyCount : damage;
    extraNotes.push(
      `Lifesteal recovers ${Math.floor(totalDamage * (percent / 100))} HP.`,
    );
  }

  const extortMechanic = mechanics.find(
    (mechanic) => mechanic.type === "extort",
  );
  if (extortMechanic) {
    const percent = extortMechanic.value ?? extortMechanic.valuePercent ?? 0;
    const duration = extortMechanic.duration ?? 0;
    if (percent > 0) {
      extraNotes.push(
        `Extorts ${percent}% ATK/DEF from each target hit for ${duration} turn${duration === 1 ? "" : "s"}.`,
      );
    }
  }

  // Every seal, not just the first. Chiara's House Rules carries two — a
  // `debuff` seal (active only at R3) and an `attackDebuff` seal (R2+) — and
  // reading `find()` reported "No seal at this rank" at R2, contradicting the
  // skill's own description one section up the page. The seal's `sealType`
  // is named too, instead of always claiming "attack skills".
  const sealMechanics = mechanics.filter((mechanic) => mechanic.type === "seal");
  if (sealMechanics.length > 0) {
    const active = sealMechanics.filter(
      (mechanic) => (mechanic.duration ?? 0) > 0,
    );
    extraNotes.push(
      active.length > 0
        ? active
            .map((mechanic) => {
              const duration = mechanic.duration ?? 0;
              const kind = mechanic.sealType
                ? mechanic.sealType.replace(/([A-Z])/g, " $1").toLowerCase()
                : "attack";
              return `Seals ${kind} skills for ${duration} turn${duration === 1 ? "" : "s"}.`;
            })
            .join(" ")
        : "No seal at this rank.",
    );
  }

  const stunMechanic = mechanics.find((mechanic) => mechanic.type === "stun");
  if (stunMechanic) {
    const duration = stunMechanic.duration ?? 1;
    extraNotes.push(
      duration > 0
        ? `Stuns for ${duration} turn${duration === 1 ? "" : "s"}.`
        : "No stun at this rank.",
    );
  }

  const gaugeMechanic = mechanics.find(
    (mechanic) => mechanic.type === "gainUltGauge",
  );
  if (gaugeMechanic) {
    extraNotes.push(
      `Fills own ultimate gauge by ${gaugeMechanic.value ?? 1}.`,
    );
  }

  if (skill.type === "buff" || skill.type === "debuff") {
    if (damage === 0) {
      extraNotes.push("No direct damage.");
    }
  }

  if (scenario.note) {
    extraNotes.push(scenario.note);
  }

  return extraNotes;
}

function buildPreviewRow(
  character: CharacterData,
  skill: CharacterSkillData,
  passive: CharacterPassiveData | undefined,
  scenario: PreviewScenario,
  rankIndex?: number,
  ultLevelIndex?: number,
): DamagePreviewRow {
  const mechanics = (skill.mechanics ?? []).map((mechanic) =>
    normalizeMechanic(mechanic, rankIndex ?? 0),
  );
  const multiplier = getDamageMultiplier(skill, rankIndex, ultLevelIndex);
  const selfBuffState = applyPreHitSelfBuffs(
    skill,
    mechanics,
    character.atk,
    character.def,
    character.hp,
  );
  const rowNotes = [...selfBuffState.notes];
  const currentHp = getCurrentHpAfterPassive(
    character,
    passive,
    scenario,
    rowNotes,
  );
  const baseStat = resolveBaseStat(skill, selfBuffState);
  const baseDamage = applySkillDamageModifiers(
    character,
    skill,
    passive,
    mechanics,
    scenario,
    baseStat * multiplier,
    currentHp,
    rowNotes,
  );
  const damage = calculateFinalDamage(
    skill,
    mechanics,
    scenario,
    baseDamage,
    rowNotes,
  );
  const allNotes = getExtraEffectNotes(
    character,
    skill,
    passive,
    mechanics,
    rankIndex,
    scenario,
    damage,
    rowNotes,
  );

  // Counter stances (Full Counter): the row's result is the damage dealt
  // back per attack received, computed like the engine does — counter base
  // vs the dummy's DEF, no skill mechanics applied.
  const counterMechanic = mechanics.find(
    (mechanic) =>
      typeof mechanic.counterDamagePercent === "number" &&
      mechanic.counterDamagePercent > 0,
  );
  let multiplierLabel = formatMultiplierLabel(skill, multiplier);
  let scenarioLabel = scenario.label;
  let resultLabel = `${damage} damage`;

  // A skill with no damage multiplier used to report "1 damage" — the engine's
  // max(1, base - def) floor leaking into a row for a skill that deals none.
  // Mustafa's Fortress (a team damage-reduction stance) and Leorio's Member of
  // the Zodiac (a team ATK/DEF buff) both read as "1 damage" with empty notes,
  // which told the player nothing about what the skill actually does.
  const dealsNoDamage = multiplier === 0 && !counterMechanic;
  const supportEffects = summarizeSupportEffects(
    mechanics,
    rankIndex ?? 0,
    // On a damaging skill the prose notes already cover stun/seal and the
    // self-buffs folded into the damage number; on a support skill they're
    // the only description there is.
    dealsNoDamage ? EMPTY_SKIP : ALREADY_NARRATED,
    !dealsNoDamage,
  );
  if (dealsNoDamage) {
    multiplierLabel = "—";
    resultLabel = supportEffects[0] ?? "No damage";
    allNotes.push(...supportEffects.slice(1).map((line) => `${line}.`));
  } else if (skill.type === "heal") {
    // Heals reported "0 damage" in the result column with the actual healing
    // buried in the notes.
    const healNote = allNotes.find((note) => note.startsWith("Heals "));
    if (healNote) {
      resultLabel = healNote.replace(/\.$/, "");
      allNotes.splice(allNotes.indexOf(healNote), 1);
    }
    allNotes.push(...supportEffects.map((line) => `${line}.`));
  } else if (supportEffects.length > 0) {
    // A damaging skill that also buffs/debuffs — keep the damage as the result
    // and list the rest.
    allNotes.push(...supportEffects.map((line) => `${line}.`));
  }

  if (counterMechanic && multiplier === 0) {
    const counterPercent = counterMechanic.counterDamagePercent ?? 0;
    const counterBase = (character.atk * counterPercent) / 100;
    const counterDamage = Math.floor(
      Math.max(1, counterBase - DAMAGE_PREVIEW_DUMMY.def),
    );
    multiplierLabel = `${counterPercent}%`;
    scenarioLabel = "Per counter";
    resultLabel = `${counterDamage} damage`;
    allNotes.push(
      "Dealt back to the attacker each time a hit is received while the stance holds.",
    );
  }

  return {
    id: `${skill.skillName}-${rankIndex ?? ultLevelIndex ?? "ultimate"}-${scenario.id}`,
    abilityName: skill.skillName,
    // An ultimate names its LEVEL, not just "Ultimate". Six rows all labelled
    // "Ultimate" gave the reader no way to tell which step of the ladder each
    // number belonged to.
    rankLabel:
      typeof rankIndex === "number"
        ? `Rank ${rankIndex + 1}`
        : typeof ultLevelIndex === "number"
          ? `Ult Lv ${ultLevelIndex + 1}`
          : skill.type === "ultimate"
            ? "Ultimate"
            : "Base",
    multiplierLabel,
    scenarioLabel,
    resultLabel,
    notes: allNotes.join(" "),
  };
}

function buildKitRows(
  character: CharacterData,
  kit: { skills: CharacterSkillData[]; ultimate?: CharacterSkillData; passives?: CharacterPassiveData[] },
  phaseLabel?: string,
): DamagePreviewRow[] {
  const rows: DamagePreviewRow[] = [];

  const push = (
    skill: CharacterSkillData,
    rankIndex?: number,
    ultLevelIndex?: number,
  ) => {
    const row = buildPreviewRow(
      character,
      skill,
      // The passive is deliberately NOT applied. Tanveer, 2026-09-17: *"the
      // idea was to just show raw numbers, how the character kit would work
      // across different skills and ultimates. The passive doesn't need to be
      // there - it's only the skills and ultimates."* Feeding the passive in
      // put "Passive HP cost applied before damage (3050 -> 2898 HP)" on every
      // one of Batra's rows and made the figures incomparable between
      // characters, which is the opposite of what a raw table is for.
      undefined,
      BASELINE,
      rankIndex,
      ultLevelIndex,
    );
    rows.push(
      phaseLabel ? { ...row, id: `${phaseLabel}-${row.id}`, phaseLabel } : row,
    );
  };

  kit.skills.forEach((skill) => {
    if (Array.isArray(skill.damageRanked) && skill.damageRanked.length > 0) {
      skill.damageRanked.forEach((_, rankIndex) => push(skill, rankIndex));
      return;
    }
    push(skill);
  });

  // Every ult level, not just the first. An ultimate has no rank and ladders
  // by ult level instead (#92), so one row hid five sixths of its progression.
  if (kit.ultimate) {
    const levels = kit.ultimate.damageByUltLevel;
    if (Array.isArray(levels) && levels.length > 0) {
      levels.forEach((_, ultLevelIndex) =>
        push(kit.ultimate as CharacterSkillData, undefined, ultLevelIndex),
      );
    } else {
      push(kit.ultimate);
    }
  }

  return rows;
}

/**
 * Every ability in a character's kit, at every rank, under each scenario that
 * changes the outcome — plus the passives.
 *
 * Multi-phase kits used to be silently truncated: this read `character.skills`
 * and `character.ultimate` directly, so Molvarr's whole second phase (Abyssal
 * Pierce, Devouring Bite, Tidal Cataclysm) never appeared, on a page that
 * otherwise showed his phase switcher. Phases are now walked explicitly and
 * each row carries a `phaseLabel`.
 */
export function buildCharacterDamagePreview(
  character: CharacterData,
): DamagePreviewRow[] {
  const phases = getCharacterPhases(character);

  if (phases.length > 1) {
    return phases.flatMap((_, index) =>
      buildKitRows(
        character,
        getCharacterKit(character, index),
        `Phase ${index + 1}`,
      ),
    );
  }

  return buildKitRows(character, {
    skills: character.skills,
    ultimate: character.ultimate,
    passives: character.passive ? [character.passive] : [],
  });
}
