import { BattleCharacter } from "@/types/character";
import { getCharacterById } from "@/lib/game/characterCatalog";

// Per-character passive readout for the battle info panel. Two shapes:
//  - stack passives park a counter under a unique passiveState key (Duke's
//    Flowing Ruin, Seras's Charged, …) → shown as [current/max] with an
//    optional "ready" callout.
//  - derived passives compute live values off the unit's current state
//    (Meliodas's Deathblow scales damage + crit with missing HP) → shown as
//    stat lines.

export interface PassiveReadout {
  label: string;
  /** Stack counter, when the passive tracks discrete stacks. */
  stacks?: { current: number; max: number };
  ready?: boolean;
  readyMessage?: string;
  note?: string;
  /** Derived stat lines, e.g. "+12% damage", "+12% crit chance". */
  lines?: string[];
}

interface StackKeyConfig {
  key: string;
  fallbackLabel: string;
  defaultMax: number;
  note?: string;
  /** Filled in when current >= max. */
  readyMessage?: string;
}

const STACK_KEYS: StackKeyConfig[] = [
  {
    key: "flowingRuinStacks",
    fallbackLabel: "Flowing Ruin",
    defaultMax: 3,
    readyMessage: "Next attack is enhanced (+50% damage)!",
  },
  {
    key: "chargedStacks",
    fallbackLabel: "Charged",
    defaultMax: 5,
    note: "+5% evade per stack",
  },
  {
    key: "momentumStacks",
    fallbackLabel: "Momentum",
    defaultMax: 5,
    note: "spent to empower a skill",
  },
  {
    key: "turnRampStacks",
    fallbackLabel: "Ramp",
    defaultMax: 5,
    note: "ATK ramps each turn",
  },
  {
    key: "maxHpShredStacks",
    fallbackLabel: "Shred",
    defaultMax: 5,
    note: "enemy max HP shred",
  },
];

/** Every mechanic object declared anywhere in a kit (passive + skills + ult). */
function kitMechanics(unitId: string): Array<Record<string, unknown>> {
  const kit = getCharacterById(unitId);
  if (!kit) return [];
  return [
    ...(kit.passive?.mechanics ?? []),
    ...kit.skills.flatMap((s) => s.mechanics ?? []),
    ...(kit.ultimate?.mechanics ?? []),
  ];
}

function readMaxStacksFromKit(unitId: string): number | undefined {
  for (const mech of kitMechanics(unitId)) {
    const max = mech?.maxStacks;
    if (typeof max === "number" && max > 0) return max;
  }
  return undefined;
}

/**
 * Deathblow-style readout: damage + crit scale by `damagePerStepPercent` /
 * `critPerStepPercent` for every `hpStepPercent` of the unit's max HP lost.
 * `unit.hp` is the runtime max (synergy HP gains are baked into it).
 */
function deathblowReadout(unit: BattleCharacter): PassiveReadout | null {
  const mech = kitMechanics(unit.id).find((m) => m.type === "deathblow");
  if (!mech) return null;
  const step = (mech.hpStepPercent as number) || 3;
  const dmgPerStep = (mech.damagePerStepPercent as number) || 0;
  const critPerStep = (mech.critPerStepPercent as number) || 0;
  const hpLostPercent = unit.hp > 0 ? (1 - unit.currentHP / unit.hp) * 100 : 0;
  const steps = Math.floor(hpLostPercent / step);
  const lines: string[] = [];
  if (dmgPerStep > 0) lines.push(`+${steps * dmgPerStep}% damage dealt`);
  if (critPerStep > 0) lines.push(`+${steps * critPerStep}% crit chance`);
  return {
    label: unit.passive?.name ?? "Deathblow",
    lines,
    note: `${Math.floor(hpLostPercent)}% max HP lost`,
  };
}

/**
 * The active passive readout for a unit, or null if its passive tracks nothing
 * displayable (or hasn't accrued anything yet). Derived passives (Deathblow)
 * take priority; otherwise the first present stack counter is used.
 */
export function getPassiveReadout(
  unit: BattleCharacter,
): PassiveReadout | null {
  const derived = deathblowReadout(unit);
  if (derived) return derived;

  const state = unit.passiveState ?? {};
  for (const cfg of STACK_KEYS) {
    if (!(cfg.key in state)) continue;
    const current = (state[cfg.key] as number) || 0;
    const max = readMaxStacksFromKit(unit.id) ?? cfg.defaultMax;
    const ready = current >= max;
    return {
      label: unit.passive?.name ?? cfg.fallbackLabel,
      stacks: { current, max },
      ready,
      readyMessage: ready ? cfg.readyMessage : undefined,
      note: cfg.note,
    };
  }
  return null;
}
