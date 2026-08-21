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
 *  - **Levels, ascension, ult level.** Everyone fights at catalog base stats.
 *    That is the point for balance work and wrong for anything else.
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
  id: string,
  team: "player" | "enemy",
  index: number,
  isSub: boolean,
): BattleCharacter {
  const raw = getCharacterById(id);
  if (!raw) throw new Error(`Unknown character id: ${id}`);
  return {
    ...(raw as unknown as BattleCharacter),
    instanceId: `${team[0]}${index + 1}_${id}`,
    currentAttack: raw.atk,
    currentDefense: raw.def,
    currentHP: raw.hp,
    ultGauge: 0,
    ultLevel: 1,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    isSub,
  };
}

function buildTeam(
  ids: string[],
  team: "player" | "enemy",
  fieldCap: number,
): BattleCharacter[] {
  return ids
    .slice(0, TEAM_CAP)
    .map((id, i) => buildUnit(id, team, i, i >= fieldCap));
}

const living = (team: BattleCharacter[]) =>
  team.filter((u) => u.currentHP > 0);
const livingOnField = (team: BattleCharacter[]) =>
  team.filter((u) => u.currentHP > 0 && !u.isSub);

/** One fight. Returns the winner and how long it took. */
async function runOneBattle(
  leftIds: string[],
  rightIds: string[],
  fieldCap: number,
  maxTurns: number,
  rng: () => number,
): Promise<{ winner: "left" | "right" | null; turns: number; survivors: number }> {
  let teams = {
    // "player"/"enemy" are engine roles, not sides of a match — a synergy that
    // reads `team` has to see a coherent one. Left is player, right is enemy.
    playerTeam: buildTeam(leftIds, "player", fieldCap),
    enemyTeam: buildTeam(rightIds, "enemy", fieldCap),
  };

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
        return { winner: "right", turns: turn + 1, survivors: living(teams.enemyTeam).length };
      }
      if (livingOnField(teams.enemyTeam).length === 0) {
        return { winner: "left", turns: turn + 1, survivors: living(teams.playerTeam).length };
      }

      // Actions = living field members + 1, capped at 3 — both sides, same
      // rule (`actionEconomy.ts`).
      const actions = actionsForTurn(
        side === "player" ? teams.playerTeam : teams.enemyTeam,
        0,
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
        return { winner: "right", turns: turn + 1, survivors: living(teams.enemyTeam).length };
      }
      if (livingOnField(teams.enemyTeam).length === 0) {
        return { winner: "left", turns: turn + 1, survivors: living(teams.playerTeam).length };
      }
    }
  }

  return { winner: null, turns: maxTurns, survivors: 0 };
}

/** Run a matchup N times and report how it goes. */
export async function simulate(
  leftIds: string[],
  rightIds: string[],
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
