import { buildBattleReport } from "@/lib/game/battleReport";
import { liveBonusMechanics } from "@/lib/game/liveBonus";
import type { SequencedBattleEvent } from "@/store/gameStore";
import type { BattleActionEvent } from "@/types/battleEvent";
import type { BattleCharacter } from "@/types/character";

/**
 * Per-fight statistics for the balance simulator - opt-in
 * (`simulate(..., { collectStats: true })`), so a plain run is unchanged.
 *
 * **Reuses `buildBattleReport`** (lib/game/battleReport.ts), the same reducer
 * that turns a saved fight's event stream into per-unit totals. The simulator
 * feeds it the events `executeSkill` already emits, so a simulated fight and a
 * played one are read by one piece of code. What the report does not carry is
 * added here, from the same events: damage per skill, overkill, damage-over-
 * time, and passive telemetry.
 *
 * ## Overkill
 *
 * An action's reported damage is the full figure the engine computed, which can
 * exceed the HP the target had left. `damageDealt` and `damageTaken` keep that
 * reported figure (identical to a saved battle report), so for a clean fight
 * **what one side dealt equals what the other took**, counters included.
 * `overkillTaken` is the part that landed past 0 HP, so `effective damage =
 * damage - overkill` is how much HP was really chewed through. Damage over time
 * is not an action: it arrives as a tick, is counted in `tickTaken`, and is
 * the only thing that makes taken exceed what the opposition dealt.
 *
 * ## Passive telemetry
 *
 * Read off the real unit, never recomputed: the `liveBonus` buff entries the
 * engine keeps on the unit (`liveBonusKey`) and the counters the engine writes
 * into `passiveState`. Sampled after every action, so a peak is a peak the unit
 * actually stood at, and a mean is a mean over those samples.
 *
 * ## What it cannot see
 *
 * Healing and lifesteal that happen inside `executeSkill` without an event
 * (lifesteal, a passive heal) are not in `healingDone`; passive-queue HP
 * changes are not either. Healing here is what heal *skills* restored.
 */

export interface Spread {
  mean: number;
  min: number;
  max: number;
}

/** One unit, one fight. */
export interface UnitFight {
  characterId: string;
  name: string;
  team: "player" | "enemy";
  damageDealt: number;
  damageTaken: number;
  /** The part of `damageTaken` that landed past 0 HP. */
  overkillTaken: number;
  /** Damage over time taken from ticks (not in `damageDealt` of anyone). */
  tickTaken: number;
  healingDone: number;
  healingReceived: number;
  actions: number;
  ultsUsed: number;
  died: boolean;
  /** 1-based turn the unit fell on. */
  diedOnTurn?: number;
  /** Damage dealt by skill or ultimate name; counters under "(counter)". */
  bySkill: Record<string, number>;
}

/** Series sampled from a unit's live passive entries, one fight. */
interface SeriesFight {
  peak: number;
  sum: number;
  count: number;
  /** Samples at which the value was above zero. */
  active: number;
}

export interface TelemetryFight {
  series: Record<string, SeriesFight>;
  /** Repeating attacks-received shifts reached. */
  rampTriggers: number;
  /** Debuffs removed by `turnStartCleanse`. */
  debuffsCleansed: number;
  sealsResisted: number;
  /** Counter damage prevented by `counterDamageReduction`. */
  counterDamagePrevented: number;
  /** Heals earned by `onKill` passives. */
  killHeals: number;
}

export interface FightRecord {
  winner: "left" | "right" | null;
  turns: number;
  units: Record<string, UnitFight>;
  /** Total reported damage per side. */
  sideDamage: { player: number; enemy: number };
  telemetry: Record<string, TelemetryFight>;
}

export interface FightRecorder {
  /** Which turn and side is acting, for the events that follow. */
  setTurn(turn: number, side: "player" | "enemy"): void;
  /** The emitter to hand `executeSkill`. */
  emit(event: BattleActionEvent): void;
  /** HP changes made by a tick, from before/after copies of one team. */
  ticks(
    label: string,
    before: readonly BattleCharacter[],
    after: readonly BattleCharacter[],
  ): void;
  /** Read the live passive entries off both teams. */
  sample(teams: {
    playerTeam: BattleCharacter[];
    enemyTeam: BattleCharacter[];
  }): void;
  finish(
    winner: "left" | "right" | null,
    turns: number,
    teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  ): FightRecord;
}

/** The series key for one live bonus: what it counts, and the stats it grants. */
export function liveSeriesKey(counts: string, stats: readonly string[]): string {
  return `${counts}:${stats.join("+")}`;
}

export function createFightRecorder(opening: {
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
}): FightRecorder {
  const events: SequencedBattleEvent[] = [];
  const bySkill = new Map<string, Record<string, number>>();
  const overkill = new Map<string, number>();
  const tickTaken = new Map<string, number>();
  const series = new Map<string, Record<string, SeriesFight>>();
  let turn = 0;
  let side: "player" | "enemy" = "player";

  const addSkill = (id: string, skill: string, amount: number) => {
    if (amount <= 0) return;
    const entry = bySkill.get(id) ?? {};
    entry[skill] = (entry[skill] ?? 0) + amount;
    bySkill.set(id, entry);
  };

  return {
    setTurn(nextTurn, nextSide) {
      turn = nextTurn;
      side = nextSide;
    },

    emit(event) {
      events.push({
        ...event,
        id: events.length,
        turn,
        phase: side === "player" ? "PlayerAction" : "EnemyAction",
      });
      for (const target of event.targets) {
        const damage = target.damage ?? 0;
        if (damage <= 0) continue;
        addSkill(event.sourceInstanceId, event.skillName, damage);
        const over = Math.max(0, damage - (target.hpBefore ?? damage));
        if (over > 0) {
          overkill.set(
            target.instanceId,
            (overkill.get(target.instanceId) ?? 0) + over,
          );
        }
      }
      for (const counter of event.counters) {
        addSkill(counter.byInstanceId, "(counter)", counter.damage);
      }
    },

    ticks(label, before, after) {
      const afterById = new Map(after.map((u) => [u.instanceId, u]));
      const targets = before.flatMap((unit) => {
        const next = afterById.get(unit.instanceId);
        if (!next || next.currentHP === unit.currentHP) return [];
        return [
          {
            instanceId: unit.instanceId,
            name: unit.name,
            hpBefore: unit.currentHP,
            hpAfter: next.currentHP,
          },
        ];
      });
      if (targets.length === 0) return;
      for (const t of targets) {
        if (t.hpAfter < t.hpBefore) {
          tickTaken.set(
            t.instanceId,
            (tickTaken.get(t.instanceId) ?? 0) + (t.hpBefore - t.hpAfter),
          );
        }
      }
      events.push({
        kind: "tick",
        label,
        targets,
        id: events.length,
        turn,
        phase: side === "player" ? "PlayerAction" : "EnemyAction",
      });
    },

    sample(teams) {
      for (const unit of [...teams.playerTeam, ...teams.enemyTeam]) {
        const mechanics = liveBonusMechanics(unit);
        if (mechanics.length === 0) continue;
        const record = series.get(unit.instanceId) ?? {};
        for (const { key, mech } of mechanics) {
          const seriesKey = liveSeriesKey(mech.counts, mech.stats);
          const value =
            unit.buffs.find((b) => b.liveBonusKey === key)?.valuePercent ?? 0;
          const s = record[seriesKey] ?? { peak: 0, sum: 0, count: 0, active: 0 };
          s.peak = Math.max(s.peak, value);
          s.sum += value;
          s.count += 1;
          if (value > 0) s.active += 1;
          record[seriesKey] = s;
        }
        series.set(unit.instanceId, record);
      }
    },

    finish(winner, turns, teams) {
      const report = buildBattleReport({
        result: winner === "left" ? "victory" : winner === "right" ? "defeat" : "draw",
        turn: Math.max(0, turns - 1),
        playerTurns: turns,
        enemyTurns: turns,
        playerTeam: teams.playerTeam,
        enemyTeam: teams.enemyTeam,
        openingPlayerTeam: opening.playerTeam,
        openingEnemyTeam: opening.enemyTeam,
        events,
        rawLog: [],
        timestamp: "",
      });

      const units: Record<string, UnitFight> = {};
      for (const total of report.totals.byUnit) {
        const unit = [...opening.playerTeam, ...opening.enemyTeam].find(
          (u) => u.instanceId === total.instanceId,
        );
        units[total.instanceId] = {
          characterId: unit?.id ?? total.instanceId,
          name: total.name,
          team: total.team,
          damageDealt: total.damageDealt,
          damageTaken: total.damageTaken,
          overkillTaken: overkill.get(total.instanceId) ?? 0,
          tickTaken: tickTaken.get(total.instanceId) ?? 0,
          healingDone: total.healingDone,
          healingReceived: total.healingReceived,
          actions: total.actions,
          ultsUsed: total.ultsUsed,
          died: total.died,
          diedOnTurn:
            total.diedOnTurn === undefined ? undefined : total.diedOnTurn + 1,
          bySkill: bySkill.get(total.instanceId) ?? {},
        };
      }

      const telemetry: Record<string, TelemetryFight> = {};
      for (const unit of [...teams.playerTeam, ...teams.enemyTeam]) {
        const state = unit.passiveState ?? {};
        const own = series.get(unit.instanceId);
        const touched =
          own !== undefined ||
          state.statShiftTriggers !== undefined ||
          state.debuffsCleansed !== undefined ||
          state.sealsResisted !== undefined ||
          state.counterDamagePrevented !== undefined ||
          state.onKillHeals !== undefined;
        if (!touched) continue;
        telemetry[unit.instanceId] = {
          series: own ?? {},
          rampTriggers: (state.statShiftTriggers as number) || 0,
          debuffsCleansed: (state.debuffsCleansed as number) || 0,
          sealsResisted: (state.sealsResisted as number) || 0,
          counterDamagePrevented: (state.counterDamagePrevented as number) || 0,
          killHeals: (state.onKillHeals as number) || 0,
        };
      }

      return {
        winner,
        turns,
        units,
        sideDamage: {
          player: report.totals.player.damage,
          enemy: report.totals.enemy.damage,
        },
        telemetry,
      };
    },
  };
}

// --- aggregation ------------------------------------------------------------

function spread(values: number[]): Spread {
  if (values.length === 0) return { mean: 0, min: 0, max: 0 };
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export interface UnitStats {
  instanceId: string;
  characterId: string;
  name: string;
  team: "player" | "enemy";
  damageDealt: Spread;
  damageTaken: Spread;
  overkillTaken: Spread;
  tickTaken: Spread;
  healingDone: Spread;
  actions: Spread;
  ultsUsed: Spread;
  /** Share of fights the unit fell in, 0-1. */
  deathRate: number;
  /** Mean 1-based turn of death, over the fights it died in. */
  meanDeathTurn: number | null;
  /** Mean damage per fight by skill or ultimate name. */
  bySkill: Record<string, number>;
}

export interface SeriesStats {
  /** Mean of each fight's peak. */
  peakMean: number;
  /** Highest value any fight reached. */
  peakMax: number;
  /** Mean over every sample in every fight. */
  mean: number;
  /** Share of samples with the bonus above zero, 0-1. */
  activeShare: number;
}

export interface TelemetryStats {
  series: Record<string, SeriesStats>;
  rampTriggers: Spread;
  debuffsCleansed: Spread;
  sealsResisted: Spread;
  counterDamagePrevented: Spread;
  killHeals: Spread;
  /** Share of fights in which an `onKill` heal fired at least once, 0-1. */
  killHealShare: number;
}

export interface SimStats {
  runs: number;
  turns: Spread;
  outcomes: { wins: number; losses: number; draws: number };
  /** Reported damage per side, per fight and per turn. */
  sides: {
    player: { damage: Spread; damagePerTurn: number };
    enemy: { damage: Spread; damagePerTurn: number };
  };
  units: UnitStats[];
  /** By unit instance id; only units that carry passive telemetry. */
  telemetry: Record<string, TelemetryStats>;
}

export function aggregateFights(records: readonly FightRecord[]): SimStats {
  const runs = records.length;
  const ids = new Map<string, UnitFight>();
  for (const r of records) {
    for (const [id, u] of Object.entries(r.units)) if (!ids.has(id)) ids.set(id, u);
  }

  const units: UnitStats[] = [...ids.entries()].map(([instanceId, first]) => {
    const rows = records.map((r) => r.units[instanceId]).filter(Boolean);
    const of = (pick: (u: UnitFight) => number) => spread(rows.map(pick));
    const deaths = rows.filter((u) => u.died);
    const skillNames = new Set(rows.flatMap((u) => Object.keys(u.bySkill)));
    const bySkill: Record<string, number> = {};
    for (const name of skillNames) {
      bySkill[name] =
        rows.reduce((sum, u) => sum + (u.bySkill[name] ?? 0), 0) / runs;
    }
    return {
      instanceId,
      characterId: first.characterId,
      name: first.name,
      team: first.team,
      damageDealt: of((u) => u.damageDealt),
      damageTaken: of((u) => u.damageTaken),
      overkillTaken: of((u) => u.overkillTaken),
      tickTaken: of((u) => u.tickTaken),
      healingDone: of((u) => u.healingDone),
      actions: of((u) => u.actions),
      ultsUsed: of((u) => u.ultsUsed),
      deathRate: runs === 0 ? 0 : deaths.length / runs,
      meanDeathTurn:
        deaths.length === 0
          ? null
          : deaths.reduce((s, u) => s + (u.diedOnTurn ?? 0), 0) / deaths.length,
      bySkill,
    };
  });

  const telemetry: Record<string, TelemetryStats> = {};
  const telemetryIds = new Set(records.flatMap((r) => Object.keys(r.telemetry)));
  for (const id of telemetryIds) {
    const rows = records.map((r) => r.telemetry[id]).filter(Boolean);
    const keys = new Set(rows.flatMap((t) => Object.keys(t.series)));
    const series: Record<string, SeriesStats> = {};
    for (const key of keys) {
      const all = rows.map((t) => t.series[key]).filter(Boolean);
      const count = all.reduce((s, x) => s + x.count, 0);
      series[key] = {
        peakMean: spread(all.map((x) => x.peak)).mean,
        peakMax: Math.max(...all.map((x) => x.peak)),
        mean: count === 0 ? 0 : all.reduce((s, x) => s + x.sum, 0) / count,
        activeShare:
          count === 0 ? 0 : all.reduce((s, x) => s + x.active, 0) / count,
      };
    }
    telemetry[id] = {
      series,
      rampTriggers: spread(rows.map((t) => t.rampTriggers)),
      debuffsCleansed: spread(rows.map((t) => t.debuffsCleansed)),
      sealsResisted: spread(rows.map((t) => t.sealsResisted)),
      counterDamagePrevented: spread(rows.map((t) => t.counterDamagePrevented)),
      killHeals: spread(rows.map((t) => t.killHeals)),
      killHealShare:
        rows.length === 0
          ? 0
          : rows.filter((t) => t.killHeals > 0).length / rows.length,
    };
  }

  const turnsTotal = records.reduce((s, r) => s + r.turns, 0);
  const side = (team: "player" | "enemy") => {
    const per = records.map((r) => r.sideDamage[team]);
    return {
      damage: spread(per),
      damagePerTurn:
        turnsTotal === 0 ? 0 : per.reduce((a, b) => a + b, 0) / turnsTotal,
    };
  };

  return {
    runs,
    turns: spread(records.map((r) => r.turns)),
    outcomes: {
      wins: records.filter((r) => r.winner === "left").length,
      losses: records.filter((r) => r.winner === "right").length,
      draws: records.filter((r) => r.winner === null).length,
    },
    sides: { player: side("player"), enemy: side("enemy") },
    units,
    telemetry,
  };
}
