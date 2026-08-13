import type { BattleCharacter } from "@/types/character";
import type { SequencedBattleEvent } from "@/store/gameStore";
import { ultGaugeMax } from "@/lib/game/ultGauge";

/**
 * A finished battle, written for a machine to read.
 *
 * Tanveer never reads these — they exist so a saved fight can be analysed for
 * balance and kit behaviour (2026-08-13). So this drops the prose report it
 * replaces and emits JSON: complete, deduplicated, with the aggregates
 * precomputed and the obvious anomalies already flagged.
 *
 * The markdown version had three problems that made analysis unreliable:
 *
 *  1. **The raw string log double-printed actions.** Turn 14 of the 08-13 run
 *     showed seven Lyra actions where the event stream showed two — the HP
 *     arithmetic proved only two resolved. Anything counted from that log was
 *     wrong. Consecutive duplicates are collapsed here, and the count of what
 *     was collapsed is reported rather than hidden.
 *  2. **No opening statline.** Only the final teams were recorded, so a hit
 *     couldn't be read against the HP it was aimed at, and start-of-battle
 *     auras were invisible.
 *  3. **Everything was derived by hand at read time**, which is slow and
 *     inconsistent between readings.
 *
 * `events` is the authority for anything numeric. `rawLog` is kept because it
 * is still the only record of buff/debuff *application*, which the structured
 * stream doesn't model (Open Issue #22) — but it is an appendix, not a source.
 */

export interface ReportUnit {
  instanceId: string;
  characterId: string;
  name: string;
  color: string;
  isSub: boolean;
  /** Max HP after progression, stage effects and any battle-start aura. */
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  ultGauge: number;
  ultGaugeMax: number;
  /** Present when the unit carries progression (player side, mostly). */
  level?: number;
  ascension?: number;
  ultLevel?: number;
  tags?: string[];
  passiveName?: string;
}

export interface UnitTotals {
  instanceId: string;
  name: string;
  team: "player" | "enemy";
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  healingReceived: number;
  /** Cards resolved. An AoE is one action regardless of how many it hit. */
  actions: number;
  ultsUsed: number;
  cardsByRank: { r1: number; r2: number; r3: number };
  kills: number;
  crits: number;
  timesEvaded: number;
  countersLanded: number;
  /** Attacks that resolved for exactly zero damage — see `anomalies`. */
  zeroDamageHits: number;
  died: boolean;
  /** Turn index the unit hit 0 HP, if it did. */
  diedOnTurn?: number;
}

export interface ReportAnomaly {
  kind:
    | "zero-damage-attack"
    | "chip-damage-attack"
    | "never-acted"
    | "duplicate-log-lines";
  detail: string;
  turn?: number;
}

export interface BattleReport {
  schema: "toll-battle-report/1";
  meta: {
    result: string;
    timestamp: string;
    turnsElapsed: number;
    playerTurns: number;
    enemyTurns: number;
    /** Where the fight came from, when the caller knows — a chapter id, an
     *  event id, or "practice". */
    context?: string;
    fieldCap?: number;
  };
  teams: {
    /** Statlines as the battle began, including battle-start auras. */
    opening: { player: ReportUnit[]; enemy: ReportUnit[] };
    final: { player: ReportUnit[]; enemy: ReportUnit[] };
  };
  totals: {
    player: { damage: number; healing: number; actions: number };
    enemy: { damage: number; healing: number; actions: number };
    byUnit: UnitTotals[];
  };
  /** Damage per side per turn — the shape of the fight in one array. */
  damageByTurn: Array<{ turn: number; player: number; enemy: number }>;
  /** Things worth a human's attention, found automatically. */
  anomalies: ReportAnomaly[];
  events: SequencedBattleEvent[];
  rawLog: {
    /** Consecutive duplicates removed. */
    lines: string[];
    collapsedDuplicates: number;
  };
}

export interface BattleReportInput {
  result: string;
  /** 0-based turn index the battle ended on. */
  turn: number;
  playerTurns: number;
  enemyTurns: number;
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  /** Snapshot taken when the battle began. Falls back to the final teams,
   *  which is wrong but better than nothing and flagged as such. */
  openingPlayerTeam?: BattleCharacter[];
  openingEnemyTeam?: BattleCharacter[];
  events: SequencedBattleEvent[];
  rawLog: string[];
  timestamp: string;
  context?: string;
  fieldCap?: number;
}

/** Below this share of the target's max HP, a hit is chip — worth flagging
 *  when it happens repeatedly, because it usually means flat DEF has eaten
 *  the card rather than that the card is weak. */
const CHIP_DAMAGE_RATIO = 0.02;

function toReportUnit(unit: BattleCharacter): ReportUnit {
  const withProgress = unit as BattleCharacter & {
    level?: number;
    ascension?: number;
    ultLevel?: number;
    tags?: string[];
    passive?: { name?: string };
  };
  return {
    instanceId: unit.instanceId,
    characterId: unit.id,
    name: unit.name,
    color: unit.color,
    isSub: unit.isSub === true,
    maxHp: unit.hp,
    currentHp: Math.max(0, unit.currentHP),
    atk: unit.currentAttack ?? unit.atk,
    def: unit.currentDefense ?? unit.def,
    ultGauge: unit.ultGauge,
    ultGaugeMax: ultGaugeMax(unit),
    level: withProgress.level,
    ascension: withProgress.ascension,
    ultLevel: withProgress.ultLevel,
    tags: withProgress.tags,
    passiveName: withProgress.passive?.name,
  };
}

function emptyTotals(
  instanceId: string,
  name: string,
  team: "player" | "enemy",
): UnitTotals {
  return {
    instanceId,
    name,
    team,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    healingReceived: 0,
    actions: 0,
    ultsUsed: 0,
    cardsByRank: { r1: 0, r2: 0, r3: 0 },
    kills: 0,
    crits: 0,
    timesEvaded: 0,
    countersLanded: 0,
    zeroDamageHits: 0,
    died: false,
  };
}

/** Consecutive identical lines collapsed. The engine's string log repeats
 *  entries the event stream records once; keeping both copies made every
 *  count read off it wrong. */
function dedupeConsecutive(lines: string[]): {
  lines: string[];
  collapsedDuplicates: number;
} {
  const out: string[] = [];
  let collapsed = 0;
  for (const line of lines) {
    if (out.length > 0 && out[out.length - 1] === line) {
      collapsed += 1;
      continue;
    }
    out.push(line);
  }
  return { lines: out, collapsedDuplicates: collapsed };
}

export function buildBattleReport(input: BattleReportInput): BattleReport {
  const openingPlayer = input.openingPlayerTeam ?? input.playerTeam;
  const openingEnemy = input.openingEnemyTeam ?? input.enemyTeam;

  const sideOf = new Map<string, "player" | "enemy">();
  for (const u of openingPlayer) sideOf.set(u.instanceId, "player");
  for (const u of openingEnemy) sideOf.set(u.instanceId, "enemy");
  for (const u of input.playerTeam) sideOf.set(u.instanceId, "player");
  for (const u of input.enemyTeam) sideOf.set(u.instanceId, "enemy");

  const maxHpOf = new Map<string, number>();
  for (const u of [...openingPlayer, ...openingEnemy]) {
    maxHpOf.set(u.instanceId, u.hp);
  }

  const totals = new Map<string, UnitTotals>();
  const totalsFor = (id: string, name: string): UnitTotals => {
    let entry = totals.get(id);
    if (!entry) {
      entry = emptyTotals(id, name, sideOf.get(id) ?? "enemy");
      totals.set(id, entry);
    }
    return entry;
  };
  for (const u of [...openingPlayer, ...openingEnemy]) {
    totalsFor(u.instanceId, u.name);
  }

  const anomalies: ReportAnomaly[] = [];
  const damageByTurn = new Map<number, { player: number; enemy: number }>();
  const acted = new Set<string>();

  for (const event of input.events) {
    const turn = (event as { turn?: number }).turn ?? 0;
    if (!damageByTurn.has(turn)) damageByTurn.set(turn, { player: 0, enemy: 0 });
    const bucket = damageByTurn.get(turn)!;

    if (event.kind === "tick") {
      for (const target of event.targets) {
        const delta = target.hpBefore - target.hpAfter;
        const entry = totalsFor(target.instanceId, target.name);
        if (delta > 0) entry.damageTaken += delta;
        else entry.healingReceived += -delta;
        if (target.hpAfter <= 0 && !entry.died) {
          entry.died = true;
          entry.diedOnTurn = turn;
        }
      }
      continue;
    }

    const source = totalsFor(event.sourceInstanceId, event.sourceName);
    source.actions += 1;
    acted.add(event.sourceInstanceId);
    if (event.isUlt) source.ultsUsed += 1;
    else if (event.rank === 3) source.cardsByRank.r3 += 1;
    else if (event.rank === 2) source.cardsByRank.r2 += 1;
    else source.cardsByRank.r1 += 1;

    let dealtThisAction = 0;
    let landedAnyDamage = false;
    let attemptedDamage = false;

    for (const target of event.targets) {
      const entry = totalsFor(target.instanceId, target.name);
      const damage = target.damage ?? 0;
      const heal = target.heal ?? 0;

      if (target.evaded) source.timesEvaded += 1;
      if (target.crit) source.crits += 1;
      if (damage > 0) {
        landedAnyDamage = true;
        dealtThisAction += damage;
        source.damageDealt += damage;
        entry.damageTaken += damage;

        const maxHp = maxHpOf.get(target.instanceId) ?? 0;
        if (maxHp > 0 && damage / maxHp < CHIP_DAMAGE_RATIO) {
          anomalies.push({
            kind: "chip-damage-attack",
            turn,
            detail: `${event.sourceName}'s ${event.skillName} dealt ${damage} to ${target.name} (${((damage / maxHp) * 100).toFixed(1)}% of ${maxHp} max HP)`,
          });
        }
      }
      if (damage === 0 && !target.evaded && !target.heal) attemptedDamage = true;
      if (heal > 0) {
        source.healingDone += heal;
        entry.healingReceived += heal;
      }
      if (target.killed) {
        source.kills += 1;
        entry.died = true;
        entry.diedOnTurn = turn;
      }
    }

    // A card that resolved, spent an action and changed nothing. Usually flat
    // DEF exceeding the hit — and any effect scaled off that damage lands at
    // zero too, which is how "applied decay (0/turn)" happens.
    if (attemptedDamage && !landedAnyDamage && !event.isUlt) {
      source.zeroDamageHits += 1;
      anomalies.push({
        kind: "zero-damage-attack",
        turn,
        detail: `${event.sourceName}'s ${event.skillName} resolved for 0 damage`,
      });
    }

    for (const counter of event.counters) {
      const by = totalsFor(counter.byInstanceId, counter.byName);
      by.countersLanded += 1;
      by.damageDealt += counter.damage;
      totalsFor(counter.onInstanceId, event.sourceName).damageTaken +=
        counter.damage;
      dealtThisAction += 0;
    }

    if (event.sourceTeam === "player") bucket.player += dealtThisAction;
    else bucket.enemy += dealtThisAction;
  }

  for (const unit of [...openingPlayer, ...openingEnemy]) {
    if (!acted.has(unit.instanceId) && !unit.isSub) {
      anomalies.push({
        kind: "never-acted",
        detail: `${unit.name} took no action all battle`,
      });
    }
  }

  const raw = dedupeConsecutive(input.rawLog);
  if (raw.collapsedDuplicates > 0) {
    anomalies.push({
      kind: "duplicate-log-lines",
      detail: `${raw.collapsedDuplicates} consecutive duplicate line(s) collapsed from the engine's string log — it repeats entries the event stream records once, so do not count anything from it`,
    });
  }

  const byUnit = [...totals.values()];
  const sideTotal = (team: "player" | "enemy") => {
    const units = byUnit.filter((u) => u.team === team);
    return {
      damage: units.reduce((n, u) => n + u.damageDealt, 0),
      healing: units.reduce((n, u) => n + u.healingDone, 0),
      actions: units.reduce((n, u) => n + u.actions, 0),
    };
  };

  return {
    schema: "toll-battle-report/1",
    meta: {
      result: input.result,
      timestamp: input.timestamp,
      turnsElapsed: input.turn + 1,
      playerTurns: input.playerTurns,
      enemyTurns: input.enemyTurns,
      context: input.context,
      fieldCap: input.fieldCap,
    },
    teams: {
      opening: {
        player: openingPlayer.map(toReportUnit),
        enemy: openingEnemy.map(toReportUnit),
      },
      final: {
        player: input.playerTeam.map(toReportUnit),
        enemy: input.enemyTeam.map(toReportUnit),
      },
    },
    totals: {
      player: sideTotal("player"),
      enemy: sideTotal("enemy"),
      byUnit,
    },
    damageByTurn: [...damageByTurn.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([turn, v]) => ({ turn, ...v })),
    anomalies,
    events: input.events,
    rawLog: raw,
  };
}
