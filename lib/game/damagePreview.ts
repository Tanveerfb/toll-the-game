import {
  type CharacterData,
  type CharacterPassiveData,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";

export const DAMAGE_PREVIEW_DUMMY = {
  atk: 100,
  def: 50,
  hp: 2000,
} as const;

interface PreviewScenario {
  id: string;
  label: string;
  attackerHpPercent?: number;
  attackerBuffCount?: number;
  enemyCount?: number;
  targetIgniteStacks?: number;
  targetUltGauge?: number;
  targetHasDebuff?: boolean;
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
}

interface NormalizedMechanic {
  type: string;
  stat?: string;
  effect?: string;
  targetSelf?: boolean;
  ranks?: boolean[];
  value?: number;
  valuePercent?: number;
  valuePerStackPercent?: number;
  damagePercent?: number;
  duration?: number;
  stacks?: number;
}

const STANDARD_SCENARIO: PreviewScenario = {
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
  };
}

function hasMechanic(skill: CharacterSkillData, type: string): boolean {
  return (
    skill.mechanics?.some(
      (mechanic) => typeof mechanic.type === "string" && mechanic.type === type,
    ) ?? false
  );
}

function getRelevantScenarios(
  character: CharacterData,
  skill: CharacterSkillData,
): PreviewScenario[] {
  switch (character.id) {
    case "batra":
      if (hasMechanic(skill, "spite")) {
        return [
          {
            id: "hp-100",
            label: "100% HP",
            attackerHpPercent: 100,
            note: "Batra loses 5% max HP before the hit from Fierce Dedication.",
          },
          {
            id: "hp-50",
            label: "50% HP",
            attackerHpPercent: 50,
            note: "Shows Spite scaling from mid-health plus the passive HP cost.",
          },
          {
            id: "hp-10",
            label: "10% HP",
            attackerHpPercent: 10,
            note: "Shows near-lethal Spite scaling after the passive HP cost.",
          },
        ];
      }
      return [STANDARD_SCENARIO];

    case "duke":
      return skill.type === "heal"
        ? [STANDARD_SCENARIO]
        : [
            STANDARD_SCENARIO,
            {
              id: "flowing-ruin-3",
              label: "Flowing Ruin x3",
              empoweredSkillMultiplierPercent: 50,
              note: "Assumes the next skill is empowered by Duke's passive at 3 stacks.",
            },
          ];

    case "master_tao":
      if (hasMechanic(skill, "consumeIgnite")) {
        return [
          {
            id: "ignite-0",
            label: "0 Ignite",
            targetIgniteStacks: 0,
          },
          {
            id: "ignite-3",
            label: "3 Ignite",
            targetIgniteStacks: 3,
            note: "Includes Tao's passive heal trigger once.",
          },
          {
            id: "ignite-6",
            label: "6 Ignite",
            targetIgniteStacks: 6,
            note: "Includes Tao's passive heal trigger twice.",
          },
        ];
      }
      return [STANDARD_SCENARIO];

    case "sara":
      if (hasMechanic(skill, "concentrate")) {
        return [
          {
            id: "enemies-4",
            label: "4 enemies",
            enemyCount: 4,
            note: "No Concentrate bonus with four enemies present.",
          },
          {
            id: "enemies-2",
            label: "2 enemies",
            enemyCount: 2,
            note: "Concentrate gains its two-target damage bonus.",
          },
          {
            id: "enemies-1",
            label: "1 enemy",
            enemyCount: 1,
            note: "Concentrate gains its maximum single-target bonus.",
          },
        ];
      }
      return [STANDARD_SCENARIO];

    case "siddiq":
      if (skill.type === "heal") {
        return [STANDARD_SCENARIO];
      }
      return [
        STANDARD_SCENARIO,
        {
          id: "passive-active",
          label: "40% HP",
          attackerHpPercent: 40,
          note: "Vampiric Roots is active below 50% HP.",
        },
      ];

    case "yalina":
      if (hasMechanic(skill, "amplify")) {
        return [
          {
            id: "no-buffs",
            label: "0 buffs",
            attackerBuffCount: 0,
            momentumStacks: 0,
          },
          {
            id: "two-buffs",
            label: "2 buffs",
            attackerBuffCount: 2,
            momentumStacks: 0,
            note: "Shows Amplify from two active buffs.",
          },
          {
            id: "two-buffs-momentum-5",
            label: "2 buffs + 5 Momentum",
            attackerBuffCount: 2,
            momentumStacks: 5,
            note: "Combines Amplify with Yalina's capped passive stacks.",
          },
        ];
      }
      return [STANDARD_SCENARIO];

    default:
      return [STANDARD_SCENARIO];
  }
}

function getDamageMultiplier(
  skill: CharacterSkillData,
  rankIndex?: number,
): number {
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

    if (mechanic.stat === "atk") {
      atk *= 1 + percent / 100;
      notes.push(`Self ATK buff included (+${percent}%).`);
    }

    if (mechanic.stat === "def") {
      def *= 1 + percent / 100;
      notes.push(`Self DEF buff included (+${percent}%).`);
    }

    if (mechanic.stat === "hp") {
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
  const consumeHpMechanic = passive?.mechanics?.find(
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

  if (mechanics.some((mechanic) => mechanic.type === "spite")) {
    const missingHpPercent = 100 - (currentHp / character.hp) * 100;
    const spiteBonusPercent = missingHpPercent * 2;
    modifiedDamage *= 1 + spiteBonusPercent / 100;
    notes.push(`Spite bonus applied (+${Math.floor(spiteBonusPercent)}%).`);
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

  if (character.id === "yalina" && passive?.trigger === "onAllySkill") {
    const momentumMechanic = passive.mechanics?.find(
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
    const piercePercent = pierceMechanic.value ?? 0;
    effectiveDefense *= 1 - piercePercent / 100;
    notes.push(`Pierce applied (${piercePercent}% DEF ignored).`);
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

  if (skill.type === "heal") {
    return 0;
  }

  return Math.floor(effectiveBaseDamage + extraDamage);
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
    const passiveHealMechanic = passive?.mechanics?.find(
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
    passive?.trigger === "onDamageDealt" &&
    damage > 0
  ) {
    const healMechanic = passive.mechanics?.find(
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
): DamagePreviewRow {
  const mechanics = (skill.mechanics ?? []).map((mechanic) =>
    normalizeMechanic(mechanic, rankIndex ?? 0),
  );
  const multiplier = getDamageMultiplier(skill, rankIndex);
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

  return {
    id: `${skill.skillName}-${rankIndex ?? "ultimate"}-${scenario.id}`,
    abilityName: skill.skillName,
    rankLabel:
      typeof rankIndex === "number"
        ? `Rank ${rankIndex + 1}`
        : skill.type === "ultimate"
          ? "Ultimate"
          : "Base",
    multiplierLabel: formatMultiplierLabel(skill, multiplier),
    scenarioLabel: scenario.label,
    resultLabel: `${damage} damage`,
    notes: allNotes.join(" "),
  };
}

export function buildCharacterDamagePreview(
  character: CharacterData,
): DamagePreviewRow[] {
  const passive = character.passive;
  const rows: DamagePreviewRow[] = [];

  character.skills.forEach((skill) => {
    const scenarios = getRelevantScenarios(character, skill);

    if (Array.isArray(skill.damageRanked) && skill.damageRanked.length > 0) {
      skill.damageRanked.forEach((_, rankIndex) => {
        scenarios.forEach((scenario) => {
          rows.push(
            buildPreviewRow(character, skill, passive, scenario, rankIndex),
          );
        });
      });
      return;
    }

    scenarios.forEach((scenario) => {
      rows.push(buildPreviewRow(character, skill, passive, scenario));
    });
  });

  if (character.ultimate) {
    const ultimateScenarios = getRelevantScenarios(
      character,
      character.ultimate,
    );
    ultimateScenarios.forEach((scenario) => {
      rows.push(
        buildPreviewRow(character, character.ultimate!, passive, scenario),
      );
    });
  }

  return rows;
}
