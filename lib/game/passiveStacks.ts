import { BattleCharacter } from "@/types/character";
import { getCharacterById } from "@/lib/game/characterCatalog";

// Per-character passive readout for the battle info panel. Several shapes,
// dispatched in priority order by getPassiveReadout() below — see
// docs/superpowers/specs/2026-07-29-passive-status-icons-design.md for the
// full character-by-character mapping this file implements.

export type ActivationMode = "buildup" | "once";

export interface PassiveSubState {
  label: string;
  active: boolean;
}

export interface PassiveReadout {
  label: string;
  /**
   * Omitted on most readouts — the activation-mode tag (⏱∞ / !1) is the
   * exception, not the rule. Only set to "buildup" when the stack itself
   * grants a live, incrementally-growing benefit as it accumulates (Seras,
   * Diane, Ban, Yalina), or "once" for a genuine once-per-battle trigger
   * (Gon, Killua, Sara, Chiara's rank-up). Everything else (thresholds like
   * Duke/Tao, conditional pills, always-active markers, multi-ticks, derived
   * lines) shows no tag — tagging them adds no information the player
   * doesn't already see live.
   */
  activationMode?: ActivationMode;
  /** Stack counter, when the passive tracks discrete stacks. */
  stacks?: { current: number; max: number };
  ready?: boolean;
  readyMessage?: string;
  /** Progress toward a one-shot trigger (Gon/Killua/Chiara's rank-up),
   *  distinct from `stacks` because reaching `required` fires once and then
   *  the whole readout permanently switches to a fired/ACTIVE state. */
  progress?: { current: number; required: number };
  fired?: boolean;
  /** Conditional pill (Siddiq) — lit/unlit based on a live boolean check. */
  conditionMet?: boolean;
  /** One-shot pill (Sara) — stays visible after firing, just dims. */
  oneShot?: { available: boolean };
  /** Multi-tick row (Leorio) — one labeled tick per named sub-clause. */
  subStates?: PassiveSubState[];
  /** Always-active marker (Gabrist/Isolde/Mustafa/Batra's synergy half) —
   *  true renders a plain "ACTIVE" badge with no number. */
  alwaysActive?: boolean;
  note?: string;
  /** Derived stat lines, e.g. "+12% damage", "+12% crit chance". */
  lines?: string[];
}

export interface PassiveReadoutContext {
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  currentTurn: number;
}

interface StackKeyConfig {
  key: string;
  fallbackLabel: string;
  defaultMax: number;
  note?: string;
  /** Filled in when current >= max. */
  readyMessage?: string;
  /** Show the green ready-tick when current >= max. */
  showTickAtMax: boolean;
  activationMode?: ActivationMode;
  /** Which kit-mechanic field to read the real max from (readMaxFromKit). */
  maxField?: "maxStacks" | "maxTriggers";
}

const STACK_KEYS: StackKeyConfig[] = [
  {
    key: "flowingRuinStacks",
    fallbackLabel: "Flowing Ruin",
    defaultMax: 3,
    readyMessage: "Next attack is enhanced (+50% damage)!",
    showTickAtMax: true,
  },
  {
    key: "chargedStacks",
    fallbackLabel: "Charged",
    defaultMax: 5,
    note: "+5% evade per stack",
    showTickAtMax: false,
    activationMode: "buildup",
  },
  {
    key: "momentumStacks",
    fallbackLabel: "Momentum",
    defaultMax: 5,
    note: "spent to empower a skill",
    showTickAtMax: true,
    activationMode: "buildup",
  },
  {
    key: "turnRampStacks",
    fallbackLabel: "Ramp",
    defaultMax: 5,
    note: "ATK ramps each turn",
    showTickAtMax: false,
    activationMode: "buildup",
  },
  {
    key: "maxHpShredStacks",
    fallbackLabel: "Shred",
    defaultMax: 5,
    note: "enemy max HP shred",
    showTickAtMax: false,
    activationMode: "buildup",
  },
  {
    key: "igniteConsumeTriggers",
    fallbackLabel: "Healing Flames",
    defaultMax: 3,
    showTickAtMax: false,
    maxField: "maxTriggers",
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

function readMaxFromKit(
  unitId: string,
  field: "maxStacks" | "maxTriggers",
): number | undefined {
  for (const mech of kitMechanics(unitId)) {
    const max = mech?.[field];
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

/** Molvarr's Growing Malice: +X% ATK, X = percentPerDebuff * enemy debuff count. */
function bossDebuffAtkReadout(
  unit: BattleCharacter,
  context: PassiveReadoutContext,
): PassiveReadout | null {
  const mech = unit.passive?.mechanics?.find((m) => m.type === "bossDebuffAtk");
  if (!mech || mech.type !== "bossDebuffAtk") return null;
  const opposingTeam =
    unit.team === "player" ? context.enemyTeam : context.playerTeam;
  const debuffCount = opposingTeam.reduce(
    (sum, c) => sum + c.debuffs.length,
    0,
  );
  const percentPerDebuff = mech.percentPerDebuff ?? 10;
  return {
    label: unit.passive!.name,
    lines: [`+${debuffCount * percentPerDebuff}% ATK`],
    note: `${debuffCount} enemy debuff${debuffCount === 1 ? "" : "s"}`,
  };
}

/** Gon/Killua's Rookie Hunter/Prodigy Assassin: progress toward the one-time
 *  stat shift after `attacksRequired` attacks received. */
function attacksReceivedShiftReadout(unit: BattleCharacter): PassiveReadout | null {
  const mech = unit.passive?.mechanics?.find(
    (m) => m.type === "statShiftAfterAttacks",
  );
  if (!mech || mech.type !== "statShiftAfterAttacks") return null;
  const required = mech.attacksRequired ?? 10;
  const fired = Boolean(unit.passiveState?.statShiftTriggered);
  const current = fired
    ? required
    : ((unit.passiveState?.attacksReceived as number) || 0);
  return {
    label: unit.passive!.name,
    activationMode: "once",
    progress: { current, required },
    fired,
  };
}

/** Siddiq's Vampiric Roots: a conditional pill lit whenever the live HP gate
 *  is satisfied — toggles all battle, not a one-shot. */
function conditionalHpReadout(unit: BattleCharacter): PassiveReadout | null {
  const mech = unit.passive?.mechanics?.find((m) => m.type === "healLifesteal");
  if (!mech || mech.type !== "healLifesteal") return null;
  const hpConditionPercent = mech.hpConditionPercent ?? 50;
  const conditionMet = unit.currentHP < unit.hp * (hpConditionPercent / 100);
  return {
    label: unit.passive!.name,
    conditionMet,
  };
}

/** Sara's Nine Lives: a one-shot pill, stays visible (dimmed) after firing. */
function oneShotPillReadout(unit: BattleCharacter): PassiveReadout | null {
  const mech = unit.passive?.mechanics?.find((m) => m.type === "surviveLethal");
  if (!mech) return null;
  return {
    label: unit.passive!.name,
    activationMode: "once",
    oneShot: { available: !unit.passiveState?.lethalSurvived },
  };
}

/** Chiara's Cut the Deck: only the "ranks up own deck at turn N" half gets a
 *  readout (the random per-turn buff/debuff half already shows up in the
 *  normal battlefield buff list — Tanveer's call not to duplicate it). */
function rankUpCountdownReadout(
  unit: BattleCharacter,
  context: PassiveReadoutContext,
): PassiveReadout | null {
  const mech = unit.passive?.mechanics?.find((m) => m.type === "rankUpOwnDeck");
  if (!mech || mech.type !== "rankUpOwnDeck") return null;
  const atTurn = mech.atTurn ?? 3;
  const fired = Boolean(unit.passiveState?.rankUpOwnDeckTriggered);
  const displayedTurn = context.currentTurn + 1;
  const current = fired ? atTurn : Math.min(displayedTurn, atTurn);
  return {
    label: unit.passive!.name,
    activationMode: "once",
    progress: { current, required: atTurn },
    fired,
  };
}

/** Leorio's Kind Hearted Friend: two independently-lit ticks mirroring the
 *  exact conditions registerCharacterSynergy (lib/game/passive.ts) checks —
 *  "Bond" (any required ally present, dead-or-alive, sub counts) and
 *  "Together" (all required allies alive and on-field). */
function multiTickReadout(
  unit: BattleCharacter,
  context: PassiveReadoutContext,
): PassiveReadout | null {
  const mech = unit.passive?.mechanics?.find(
    (m) => m.type === "characterSynergy",
  );
  if (!mech || mech.type !== "characterSynergy") return null;
  const requiredIds = mech.requiredCharacterIds ?? [];
  const ownTeam = unit.team === "player" ? context.playerTeam : context.enemyTeam;
  const bondActive = ownTeam.some((c) => requiredIds.includes(c.id));
  const togetherActive = requiredIds.every((id) =>
    ownTeam.some((c) => c.id === id && c.currentHP > 0 && !c.isSub),
  );
  return {
    label: unit.passive!.name,
    subStates: [
      { label: "Bond", active: bondActive },
      { label: "Together", active: togetherActive },
    ],
  };
}

// Mechanic types that mean "this passive is more than a plain always-active
// synergy/aura" — excluded from alwaysActiveReadout so it doesn't preempt a
// more specific reader (or wrongly fire on Diane/Ban/Seras, whose synergy
// mechanic is a secondary tag-bonus alongside their real stack mechanic).
const NON_ALWAYS_ACTIVE_TYPES = new Set([
  "chargedStacks",
  "momentumStacks",
  "turnRamp",
  "maxHpShred",
  "characterSynergy",
  "buff",
  "conditionalBuff",
  "statShiftAfterAttacks",
  "healLifesteal",
  "surviveLethal",
  "randomTurnEffect",
  "rankUpOwnDeck",
  "bossDebuffAtk",
  "deathblow",
]);

/** Gabrist/Isolde (plain aura) and Mustafa/Batra (tag- or color-conditioned
 *  synergy with nothing else interesting going on) — a flat "ACTIVE" marker,
 *  no number, no tag. */
function alwaysActiveReadout(unit: BattleCharacter): PassiveReadout | null {
  const mechanics = unit.passive?.mechanics ?? [];
  const types = mechanics.map((m) => m.type);
  const hasAura = types.includes("aura");
  const hasOnlyPlainSynergy =
    types.includes("synergy") &&
    !types.some((t) => NON_ALWAYS_ACTIVE_TYPES.has(t));
  if (!hasAura && !hasOnlyPlainSynergy) return null;
  return {
    label: unit.passive!.name,
    alwaysActive: true,
  };
}

/**
 * The active passive readout for a unit, or null if its passive tracks
 * nothing displayable (or hasn't accrued anything yet). Bespoke readers are
 * tried first (each checks for its own specific mechanic type and no-ops
 * otherwise), falling back to the generic stack-counter table, falling back
 * to null.
 */
export function getPassiveReadout(
  unit: BattleCharacter,
  context: PassiveReadoutContext,
): PassiveReadout | null {
  const bespoke =
    deathblowReadout(unit) ??
    bossDebuffAtkReadout(unit, context) ??
    attacksReceivedShiftReadout(unit) ??
    conditionalHpReadout(unit) ??
    oneShotPillReadout(unit) ??
    rankUpCountdownReadout(unit, context) ??
    multiTickReadout(unit, context) ??
    alwaysActiveReadout(unit);
  if (bespoke) return bespoke;

  const state = unit.passiveState ?? {};
  for (const cfg of STACK_KEYS) {
    if (!(cfg.key in state)) continue;
    const current = (state[cfg.key] as number) || 0;
    const max =
      readMaxFromKit(unit.id, cfg.maxField ?? "maxStacks") ?? cfg.defaultMax;
    const ready = cfg.showTickAtMax && current >= max;
    return {
      label: unit.passive?.name ?? cfg.fallbackLabel,
      activationMode: cfg.activationMode,
      stacks: { current, max },
      ready,
      readyMessage: ready ? cfg.readyMessage : undefined,
      note: cfg.note,
    };
  }
  return null;
}
