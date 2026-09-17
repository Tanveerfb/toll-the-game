import { getCharacterById } from "@/lib/game/characterCatalog";
import { executeSkill } from "@/lib/game/combat";
import { freshAITurnContext, getAIMove, noteAIAction } from "@/lib/game/ai";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { createMechanicQueue } from "@/lib/game/mechanicQueue";
import { registerCharacterPassives } from "@/lib/game/passive";
import { applyDefeatPassives } from "@/lib/game/onDefeat";
import { transitionBossPhases } from "@/lib/game/phases";
import { promoteSubs } from "@/lib/game/sub";
import { tickTeamBuffs, tickTeamDebuffs } from "@/lib/game/tick";
import { FIELD_CAP, TEAM_CAP } from "@/lib/game/format";
import { progressedStats } from "@/lib/game/progression";
import { bonusActionsFor, stageAdjustedStats } from "@/lib/game/stageEffects";
import type { StageEffect } from "@/types/stageEffects";
import type { BattleCharacter } from "@/types/character";

/**
 * Headless battle simulation.
 *
 * **Why this exists.** Ruling **#57** says card frequency swings *4x* between
 * 1v1 and 4v4, so a conclusion drawn from a duel is not a conclusion — Duke
 * read as overtuned in a 1v1 and is mid-pack in a team. That ruling has been in
 * the ledger since July and the only way to honour it was to play the fights by
 * hand, which nobody does often enough to be sure of anything. This turns it
 * into a number.
 *
 * **What it drives.** The real engine, not a model of it: `executeSkill` for
 * every action, `getAIMove` for every decision, the same buff/debuff ticks in
 * the same phase order as `BattleProvider`, the same sub promotion, the same
 * boss phase transitions, and the same passive queue (`createMechanicQueue`,
 * extracted from `MechanicProvider` for exactly this reason). If the engine
 * changes, these numbers change with it.
 *
 * **What it does NOT model, and you must not read past:**
 *
 *  - **Card draw.** Both sides pick from every skill their living units have,
 *    which is what `getAIMove` does natively. A human's hand is a *random*
 *    subset refilled per turn, and merging ranks cards up. So this measures
 *    kits against each other with the deck's variance removed — deliberately,
 *    because that variance is the noise you are usually trying to see past,
 *    but it means a kit whose strength is cheap repeatable cards is
 *    under-represented here.
 *  - **Player skill.** Both sides run the enemy AI. A result is "how these
 *    kits trade under identical, mediocre play", not "how good a player does".
 *  - ~~**Levels, ascension, ult level.** Everyone fights at catalog base
 *    stats.~~ **No longer true since 2026-09-16** — a unit may be given a
 *    `level` / `ascension` / `ultLevel`, and a bare id still means the catalog
 *    statline, so every existing balance comparison is unchanged. See
 *    `UnitSpec`. Progression was added because tuning an *encounter* is a
 *    different job from comparing kits: the First Ascension Trial is aimed at
 *    a specific player power level, and that question cannot even be asked at
 *    base stats.
 *
 * Read a win rate as a comparison between kits under fixed conditions. Do not
 * read it as a prediction of live play.
 */

export interface SimResult {
  /** Fights won by the left-hand side. */
  wins: number;
  losses: number;
  /** Neither side dead when the turn cap hit — usually a sign that two
   *  defensive kits cannot finish each other, which is itself a finding. */
  draws: number;
  runs: number;
  /** Mean turns across decisive fights. A very low number on a fight you
   *  expected to be close usually means one side one-shots the other. */
  averageTurns: number;
  /** Mean surviving units on the winning side, 0–4. High means a stomp. */
  averageSurvivors: number;
}

/**
 * A unit as the simulator fields it.
 *
 * A bare string is the catalog statline — level 1, unascended, ult level 1 —
 * which is what every kit-vs-kit comparison wants and what this file did
 * exclusively before 2026-09-16.
 */
export type UnitInput = string | UnitSpec;

export interface UnitSpec {
  id: string;
  /**
   * Fought at this level. Remember the ascension gate: `maxLevelForAscension`
   * caps an unascended unit at level 1, level 20 needs ascension 1, 30 needs
   * 2 and 40 needs 3. Passing `{ level: 20 }` with no ascension models a unit
   * the game cannot produce, so `playerBand` exists to spell the real pairs.
   */
  level?: number;
  ascension?: number;
  ultLevel?: number;
}

/**
 * The progression pairs the game can actually reach, by ascension band.
 *
 * Levels and ascension are not independent — a player at "level 20" is
 * necessarily ascension 1, because that is the band that unlocks the level.
 * Tuning against `{ level: 20, ascension: 0 }` would measure a 1.322x team
 * that cannot exist instead of the real 1.489x one, which is a 13% error in
 * the direction that makes an encounter look harder than it is.
 */
export const PLAYER_BANDS = {
  1: { level: 1, ascension: 0 },
  20: { level: 20, ascension: 1 },
  30: { level: 30, ascension: 2 },
  40: { level: 40, ascension: 3 },
} as const;

/** A full team at one band — the usual way to state "a Lv20 roster". */
export function playerBand(
  ids: string[],
  band: keyof typeof PLAYER_BANDS,
  ultLevel = 1,
): UnitSpec[] {
  const { level, ascension } = PLAYER_BANDS[band];
  return ids.map((id) => ({ id, level, ascension, ultLevel }));
}

function toSpec(input: UnitInput): UnitSpec {
  return typeof input === "string" ? { id: input } : input;
}

export interface SimOptions {
  /** Fights to run. Win rate stabilises around a few hundred. */
  runs?: number;
  /** Fights are called a draw past this many turns. */
  maxTurns?: number;
  /** Field size. The 4th unit of a 4-strong team benches at 3 (`format.ts`). */
  fieldCap?: number;
  /** Deterministic runs — same seed, same result, which is what makes a
   *  before/after comparison mean anything. */
  seed?: number;
}

/**
 * Mulberry32. Small, fast, and seedable, which `Math.random` is not — a
 * balance number you cannot reproduce is a rumour.
 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildUnit(
  input: UnitInput,
  team: "player" | "enemy",
  index: number,
  isSub: boolean,
  /** HP to start at, for a unit carrying damage in from an earlier fight. */
  startHp?: number,
): BattleCharacter {
  const { id, level = 1, ascension = 0, ultLevel = 1 } = toSpec(input);
  const raw = getCharacterById(id);
  if (!raw) throw new Error(`Unknown character id: ${id}`);
  // Same call `BattleProvider` makes, so a simulated unit and a played one are
  // the same statline. `raw` is untouched — it is the shared catalog object.
  const stats = progressedStats(raw, { level, ascension });
  return {
    ...(raw as unknown as BattleCharacter),
    ...stats,
    instanceId: `${team[0]}${index + 1}_${id}`,
    currentAttack: stats.atk,
    currentDefense: stats.def,
    currentHP: startHp === undefined ? stats.hp : Math.min(startHp, stats.hp),
    ultGauge: 0,
    ultLevel,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    isSub,
  };
}

function buildTeam(
  inputs: UnitInput[],
  team: "player" | "enemy",
  fieldCap: number,
  /** Character id → HP, for a fight run. Absent ids start at full. */
  carryHp: Record<string, number> = {},
  /** The encounter's modifiers, applied to this side (ruling #69). */
  effects?: StageEffect[],
): BattleCharacter[] {
  return inputs.slice(0, TEAM_CAP).map((input, i) => {
    const unit = buildUnit(input, team, i, i >= fieldCap, carryHp[toSpec(input).id]);
    if (!effects?.length) return unit;
    // Same helper the battle uses, so a simulated arena and a played one
    // cannot drift. Baked into base stats, not applied as a buff — which is
    // why it is done here rather than pushed onto `buffs`.
    const adjusted = stageAdjustedStats(unit, effects, team);
    return {
      ...unit,
      ...adjusted,
      currentAttack: adjusted.atk,
      currentDefense: adjusted.def,
      // An HP boost raises the ceiling; a unit carrying damage in keeps its
      // damage rather than being topped up by the arena.
      currentHP: Math.min(unit.currentHP === unit.hp ? adjusted.hp : unit.currentHP, adjusted.hp),
    };
  });
}

const living = (team: BattleCharacter[]) =>
  team.filter((u) => u.currentHP > 0);
const livingOnField = (team: BattleCharacter[]) =>
  team.filter((u) => u.currentHP > 0 && !u.isSub);

/** How a fight ended, plus what the left side had left — a fight run needs the
 *  second part to build the next fight. */
interface BattleOutcome {
  winner: "left" | "right" | null;
  turns: number;
  survivors: number;
  /** Left-side survivors, id → HP as the fight ended. */
  leftHp: Record<string, number>;
  /** Left-side ids that fell. */
  leftFallen: string[];
  /**
   * Total max HP the left side started this fight with.
   *
   * Returned rather than recomputed by the caller because **max HP is not
   * constant** — `scaleMaxHp` lets a buff raise it mid-fight, so a pool
   * computed from a freshly built team is the wrong denominator and reports
   * over 100% remaining. Measuring against what this fight actually started
   * with is the honest number; it can still exceed 100% while a max-HP buff
   * is live, and that is a real thing that happened rather than an error.
   */
  leftStartPool: number;
}

/** One fight. Returns the winner and how long it took. */
async function runOneBattle(
  left: UnitInput[],
  right: UnitInput[],
  fieldCap: number,
  maxTurns: number,
  rng: () => number,
  carryHp: Record<string, number> = {},
  effects?: StageEffect[],
): Promise<BattleOutcome> {
  let teams = {
    // "player"/"enemy" are engine roles, not sides of a match — a synergy that
    // reads `team` has to see a coherent one. Left is player, right is enemy.
    playerTeam: buildTeam(left, "player", fieldCap, carryHp, effects),
    enemyTeam: buildTeam(right, "enemy", fieldCap, {}, effects),
  };
  // Captured before a single skill resolves — see `leftStartPool`.
  const leftStartPool = teams.playerTeam.reduce((sum, u) => sum + u.hp, 0);

  /**
   * The outcome, read off whatever `teams` holds right now.
   *
   * A closure rather than five hand-written object literals: the left side's
   * surviving HP has to be captured at every exit, and an exit that forgot it
   * would silently hand the next fight a full-health team.
   */
  const finish = (winner: "left" | "right" | null, turns: number): BattleOutcome => ({
    winner,
    turns,
    survivors:
      winner === "left"
        ? living(teams.playerTeam).length
        : winner === "right"
          ? living(teams.enemyTeam).length
          : 0,
    leftHp: Object.fromEntries(
      living(teams.playerTeam).map((u) => [u.id, Math.max(1, Math.round(u.currentHP))]),
    ),
    leftFallen: teams.playerTeam
      .filter((u) => u.currentHP <= 0)
      .map((u) => u.id),
    leftStartPool,
  });

  const noop = () => {};
  const queue = createMechanicQueue();
  [...teams.playerTeam, ...teams.enemyTeam].forEach((unit) =>
    registerCharacterPassives(unit, queue.register),
  );
  teams = await queue.process("OnBattleStart", teams, noop);

  for (let turn = 0; turn < maxTurns; turn += 1) {
    for (const side of ["player", "enemy"] as const) {
      const startPhase =
        side === "player" ? "OnPlayerTurnStart" : "OnEnemyTurnStart";
      const endPhase = side === "player" ? "OnPlayerTurnEnd" : "OnEnemyTurnEnd";
      const key = side === "player" ? "playerTeam" : "enemyTeam";

      // Buffs and HoT expire at the owner's turn START (ruling #21).
      teams = { ...teams, [key]: tickTeamBuffs(teams[key], noop) };
      applyDefeatPassives(teams, noop);
      teams = await queue.process(startPhase, teams, noop);

      teams = {
        playerTeam: promoteSubs(teams.playerTeam, noop),
        enemyTeam: promoteSubs(teams.enemyTeam, noop),
      };

      if (livingOnField(teams.playerTeam).length === 0) {
        return finish("right", turn + 1);
      }
      if (livingOnField(teams.enemyTeam).length === 0) {
        return finish("left", turn + 1);
      }

      // Actions = living field members + 1, capped at 3 — both sides, same
      // rule (`actionEconomy.ts`).
      const actions = actionsForTurn(
        side === "player" ? teams.playerTeam : teams.enemyTeam,
        bonusActionsFor(effects, side),
      );
      const context = freshAITurnContext();

      for (let i = 0; i < actions; i += 1) {
        const acting = side === "player" ? teams.playerTeam : teams.enemyTeam;
        const opposing = side === "player" ? teams.enemyTeam : teams.playerTeam;
        if (livingOnField(acting).length === 0) break;
        if (livingOnField(opposing).length === 0) break;

        const move = getAIMove(acting, opposing, context);
        if (!move) break;
        noteAIAction(context, move.skill.type);

        // `executeSkill` always takes { playerTeam, enemyTeam } in engine
        // terms, so the enemy side's move is passed with the same shape.
        teams = executeSkill(move, teams, noop, i, rng);
      }

      // Debuffs and DoT proc and expire at the victim's turn END.
      teams = { ...teams, [key]: tickTeamDebuffs(teams[key], noop) };
      applyDefeatPassives(teams, noop);
      teams = await queue.process(endPhase, teams, noop);

      const phaseStep = transitionBossPhases(teams.enemyTeam);
      teams = { ...teams, enemyTeam: phaseStep.team };

      if (livingOnField(teams.playerTeam).length === 0) {
        return finish("right", turn + 1);
      }
      if (livingOnField(teams.enemyTeam).length === 0) {
        return finish("left", turn + 1);
      }
    }
  }

  return finish(null, maxTurns);
}

/** Run a matchup N times and report how it goes. */
export async function simulate(
  leftIds: UnitInput[],
  rightIds: UnitInput[],
  options: SimOptions = {},
): Promise<SimResult> {
  const {
    runs = 200,
    maxTurns = 40,
    fieldCap = FIELD_CAP,
    seed = 1,
  } = options;

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let turnTotal = 0;
  let decisive = 0;
  let survivorTotal = 0;

  for (let i = 0; i < runs; i += 1) {
    // A fresh stream per fight, derived from the seed, so one fight's RNG
    // consumption can't shift the next one's — that would make the whole run
    // sensitive to a change in how many rolls a single skill happens to make.
    const rng = makeRng(seed + i * 7919);
    const result = await runOneBattle(
      leftIds,
      rightIds,
      fieldCap,
      maxTurns,
      rng,
    );
    if (result.winner === "left") wins += 1;
    else if (result.winner === "right") losses += 1;
    else draws += 1;

    if (result.winner) {
      decisive += 1;
      turnTotal += result.turns;
      survivorTotal += result.survivors;
    }
  }

  return {
    wins,
    losses,
    draws,
    runs,
    averageTurns: decisive > 0 ? turnTotal / decisive : 0,
    averageSurvivors: decisive > 0 ? survivorTotal / decisive : 0,
  };
}

/** Win rate as a percentage of decisive fights, or null if none were. */
export function winRate(result: SimResult): number | null {
  const decisive = result.wins + result.losses;
  return decisive === 0 ? null : (result.wins / decisive) * 100;
}

/**
 * A multi-fight run — consecutive fights on one HP bar.
 *
 * Mirrors `lib/game/stageRun.ts`, which is the rule the game actually plays
 * (ruling #103): **HP carries over and the fallen stay down**. A three-fight
 * encounter is therefore not three fights, it is a resource problem, and
 * simulating the fights separately would miss the entire difficulty of it —
 * fight 3 against a full team is a different fight from fight 3 against two
 * survivors at a third HP, and the second one is what a player meets.
 *
 * Fresh units are rebuilt each fight from spec plus carried HP, which is what
 * `BattleProvider` does between fights: buffs, debuffs, ult gauge and passive
 * state all reset, only HP and death persist.
 */
export interface RunResult {
  runs: number;
  /** Runs that cleared every fight. */
  clears: number;
  /** Runs that ended with the whole team down, by the fight that did it —
   *  `wipesByFight[0]` is fight 1. This is the tuning signal: an encounter that
   *  is too hard in the wrong place shows up here rather than in the clear
   *  rate. */
  wipesByFight: number[];
  /** Runs that hit the turn cap without resolving, by fight. A draw is not a
   *  clear, and a stalled fight usually means nothing on the field can finish
   *  anything — worth seeing rather than folding into the loss column. */
  stallsByFight: number[];
  /** Mean fights cleared across every run, 0..fights.length. */
  averageFightsCleared: number;
  /** Mean units still standing when a run cleared. */
  averageSurvivors: number;
  /**
   * How healthy the survivors are after each fight, indexed by fight: their HP
   * over the max HP of **the units that entered that fight**.
   *
   * So it answers "what condition is the team in going into the next fight",
   * not "how much of the original roster is left" — the denominator shrinks as
   * units die, and `wipesByFight` / `averageSurvivors` carry the attrition.
   * Measured against the pool the fight actually started with rather than a
   * freshly built team, because `scaleMaxHp` lets a buff raise max HP
   * mid-fight; it can still read slightly above 1 while such a buff is live,
   * and that is real rather than a rounding artefact.
   */
  hpAfterFight: number[];
  /** Mean player turns a full clear took. */
  averageTurns: number;
}

/**
 * One fight of a run. A bare array is enemies with no arena modifiers; the
 * object form carries this fight's `stageEffects`, which is how a later fight
 * gets harsher without touching a kit (ruling #69).
 */
export type FightInput = UnitInput[] | { enemies: UnitInput[]; stageEffects?: StageEffect[] };

function toFight(input: FightInput): { enemies: UnitInput[]; stageEffects?: StageEffect[] } {
  return Array.isArray(input) ? { enemies: input } : input;
}

export async function simulateRun(
  team: UnitInput[],
  fights: FightInput[],
  options: SimOptions = {},
): Promise<RunResult> {
  const { runs = 200, maxTurns = 40, fieldCap = FIELD_CAP, seed = 1 } = options;

  const wipesByFight = new Array(fights.length).fill(0);
  const stallsByFight = new Array(fights.length).fill(0);
  const hpTotals = new Array(fights.length).fill(0);
  const hpCounts = new Array(fights.length).fill(0);
  let clears = 0;
  let fightsClearedTotal = 0;
  let survivorTotal = 0;
  let turnTotal = 0;

  for (let i = 0; i < runs; i += 1) {
    let carryHp: Record<string, number> = {};
    let fallen: string[] = [];
    let turns = 0;

    for (let w = 0; w < fights.length; w += 1) {
      // One stream per WAVE, not per run — otherwise fight 3's rolls shift
      // whenever fight 1 happens to consume a different number of them, and a
      // tuning change to fight 1 would silently re-roll the whole encounter.
      const rng = makeRng(seed + i * 7919 + w * 104_729);
      const alive = team.filter((unit) => !fallen.includes(toSpec(unit).id));
      const fight = toFight(fights[w]);
      const outcome = await runOneBattle(
        alive,
        fight.enemies,
        fieldCap,
        maxTurns,
        rng,
        carryHp,
        fight.stageEffects,
      );
      turns += outcome.turns;

      if (outcome.winner !== "left") {
        // A stall is not a wipe, and conflating them hides a fight that
        // literally cannot be finished.
        if (outcome.winner === null) stallsByFight[w] += 1;
        else wipesByFight[w] += 1;
        fightsClearedTotal += w;
        break;
      }

      carryHp = outcome.leftHp;
      fallen = [...fallen, ...outcome.leftFallen];
      const remaining = Object.values(carryHp).reduce((a, b) => a + b, 0);
      hpTotals[w] +=
        outcome.leftStartPool > 0 ? remaining / outcome.leftStartPool : 0;
      hpCounts[w] += 1;

      if (w === fights.length - 1) {
        clears += 1;
        fightsClearedTotal += fights.length;
        survivorTotal += Object.keys(carryHp).length;
        turnTotal += turns;
      }
    }
  }

  return {
    runs,
    clears,
    wipesByFight,
    stallsByFight,
    averageFightsCleared: runs > 0 ? fightsClearedTotal / runs : 0,
    averageSurvivors: clears > 0 ? survivorTotal / clears : 0,
    hpAfterFight: hpTotals.map((total, w) =>
      hpCounts[w] > 0 ? total / hpCounts[w] : 0,
    ),
    averageTurns: clears > 0 ? turnTotal / clears : 0,
  };
}

/** Clear rate as a percentage of runs. Unlike `winRate` a stalled run counts
 *  against it — a run that didn't clear didn't clear. */
export function clearRate(result: RunResult): number {
  return result.runs === 0 ? 0 : (result.clears / result.runs) * 100;
}
