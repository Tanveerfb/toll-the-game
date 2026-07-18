import { BattleCharacter } from "@/types/character";
import { Action, ActionCard } from "@/types/action";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";

/** Cap on actions the enemy side takes per enemy turn — any living enemy may act, in any order, no fixed pattern. */
export const ENEMY_ACTIONS_PER_TURN = 3;

/**
 * Enemy action economy (ruling 2026-07-12, amends #39/#4). Counting only
 * living field members (subs grant none):
 *
 *  - Elite tier present (named bosses — `tier: "elite"`): the side always
 *    takes the full 3 actions, even a lone boss like Lyra/Tao/Seras.
 *  - Otherwise (low-mid mobs): the side gets its member count +1, so a
 *    single mob acts twice and two mobs act three times.
 *
 * Either branch is capped at ENEMY_ACTIONS_PER_TURN (3), so 3+ living
 * members — up to a 5-enemy pack — still take 3 actions.
 */
export function enemyActionsForTurn(enemyTeam: BattleCharacter[]): number {
  const livingField = enemyTeam.filter((e) => e.currentHP > 0 && !e.isSub);
  if (livingField.length === 0) return 0;
  const hasElite = livingField.some((e) => e.tier === "elite");
  const actions = hasElite
    ? ENEMY_ACTIONS_PER_TURN
    : livingField.length + 1;
  return Math.min(ENEMY_ACTIONS_PER_TURN, actions);
}

/**
 * Per-team-turn accounting so the priority caps (one buff, one stance, one
 * debuff across the whole enemy turn) hold across the 3 getAIMove calls. The
 * caller seeds a fresh context each enemy turn and bumps it from the chosen
 * action's skill type via `noteAIAction`.
 */
export interface AITurnContext {
  buffsUsed: number;
  stancesUsed: number;
  debuffsUsed: number;
}

export function freshAITurnContext(): AITurnContext {
  return { buffsUsed: 0, stancesUsed: 0, debuffsUsed: 0 };
}

/** Bump the per-turn caps after an action is chosen, based on its skill type. */
export function noteAIAction(context: AITurnContext, skillType: string): void {
  if (skillType === "buff") context.buffsUsed += 1;
  else if (skillType === "stance") context.stancesUsed += 1;
  else if (skillType === "debuff" || skillType === "disable")
    context.debuffsUsed += 1;
}

/** A buff is worth casting only if it adds a stat buff the unit lacks. */
function buffAddsSomethingNew(
  enemy: BattleCharacter,
  skill: SkillCard,
): boolean {
  const buffMech = (skill.mechanics ?? []).find((m) => m.type === "buff") as
    | { stat?: string }
    | undefined;
  const stat = buffMech?.stat;
  if (!stat) return true; // can't tell — let it through
  return !enemy.buffs.some(
    (b) => !b.preApplied && b.type === "buff" && b.stat === stat,
  );
}

/** One thing an enemy can do this action: a skill, plus (when it came from the
 * hand) the card's rank and id so the loop can resolve rank + consume it. */
interface Play {
  skill: SkillCard | UltimateCard;
  rank?: 1 | 2 | 3;
  cardId?: string;
}

/**
 * Picks a single AI action from the current battle state. Call once per enemy
 * action so each decision sees the previous one's result; pass the shared
 * `context` so the per-turn caps hold. Returns null when no enemy can act or
 * no player is alive.
 *
 * When `hand` is provided, the enemy plays ONLY cards in that hand (the headless
 * 7DS GC deck — same RNG/merge fairness as the player), and the returned action
 * carries the card's rank + id. When omitted, it falls back to picking from each
 * enemy's full skill list at rank 1 (legacy / tests).
 *
 * Priority (ruling 2026-07-13): ultimate → a NEW buff (max 1/turn) or a heal
 * when an ally is under 50% → stance (max 1/turn, not already in one) →
 * debuff/disable (max 1/turn) → attack → any remaining skill.
 */
export function getAIMove(
  enemyTeam: BattleCharacter[],
  playerTeam: BattleCharacter[],
  context: AITurnContext = freshAITurnContext(),
  hand?: ActionCard[],
): Action | null {
  // Subs cannot act or be targeted
  const alivePlayers = playerTeam.filter((p) => p.currentHP > 0 && !p.isSub);
  if (alivePlayers.length === 0) return null;

  const actingPool = enemyTeam.filter(
    (e) => e.currentHP > 0 && !e.isSub && !e.debuffs.some((d) => d.type === "stun"),
  );
  if (actingPool.length === 0) return null;

  const livingAllies = enemyTeam.filter((e) => e.currentHP > 0 && !e.isSub);
  const someAllyLow = livingAllies.some((e) => e.currentHP <= e.hp * 0.5);
  const lowestPlayer = alivePlayers.reduce(
    (lowest, current) => (current.currentHP < lowest.currentHP ? current : lowest),
    alivePlayers[0],
  );
  const lowestAlly = livingAllies.reduce(
    (lowest, current) => (current.currentHP < lowest.currentHP ? current : lowest),
    livingAllies[0],
  );

  const attackSealed = (e: BattleCharacter) =>
    e.debuffs.some((d) => d.type === "seal" && d.sealType === "attack");

  // The plays available to an enemy: hand cards for that enemy (headless deck),
  // or its full skill list when no hand is supplied.
  const playsFor = (e: BattleCharacter): Play[] => {
    if (hand) {
      return hand
        .filter((c) => c.sourceInstanceId === e.instanceId)
        .map((c) => ({ skill: c.skill, rank: c.rank, cardId: c.id }));
    }
    return e.skills.map((s) => ({ skill: s }));
  };

  const playOfType = (e: BattleCharacter, type: string): Play | undefined =>
    playsFor(e).find(
      (p) => p.skill.type === type && !(attackSealed(e) && p.skill.type === "attack"),
    );

  const ultPlayFor = (e: BattleCharacter): Play | undefined => {
    if (hand) return playsFor(e).find((p) => p.skill.type === "ultimate");
    return e.ultimate && e.ultGauge >= 5 ? { skill: e.ultimate } : undefined;
  };

  // A taunted enemy must strike its taunter; otherwise the lowest-HP player.
  const attackTargetFor = (e: BattleCharacter): BattleCharacter => {
    const tauntedBy = e.debuffs.find((d) => d.type === "taunt" && d.sourceId);
    if (tauntedBy) {
      const tauntTarget = alivePlayers.find(
        (p) => p.instanceId === tauntedBy.sourceId,
      );
      if (tauntTarget) return tauntTarget;
    }
    return lowestPlayer;
  };

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const action = (
    e: BattleCharacter,
    play: Play,
    target: BattleCharacter,
  ): Action => ({
    sourceInstanceId: e.instanceId,
    skill: play.skill,
    targetInstanceId: target.instanceId,
    ...(play.rank ? { rank: play.rank } : {}),
    ...(play.cardId ? { cardId: play.cardId } : {}),
  });

  // Tier 1 — Ultimate.
  const ultReady = actingPool.filter((e) => ultPlayFor(e));
  if (ultReady.length > 0) {
    const e = pick(ultReady);
    return action(e, ultPlayFor(e)!, attackTargetFor(e));
  }

  // Tier 2a — a buff that actually adds something (max 1/turn).
  if (context.buffsUsed < 1) {
    const buffers = actingPool.filter((e) => {
      const p = playOfType(e, "buff");
      return p !== undefined && buffAddsSomethingNew(e, p.skill as SkillCard);
    });
    if (buffers.length > 0) {
      const e = pick(buffers);
      return action(e, playOfType(e, "buff")!, e);
    }
  }

  // Tier 2b — heal/cleanse when an ally is under 50%.
  if (someAllyLow) {
    const healers = actingPool.filter(
      (e) => playOfType(e, "heal") || playOfType(e, "cleanse"),
    );
    if (healers.length > 0) {
      const e = pick(healers);
      const p = (playOfType(e, "heal") || playOfType(e, "cleanse"))!;
      return action(e, p, lowestAlly);
    }
  }

  // Tier 3 — stance (max 1/turn), skipping anyone already holding one.
  if (context.stancesUsed < 1) {
    const stancers = actingPool.filter(
      (e) =>
        playOfType(e, "stance") && !e.buffs.some((b) => b.type === "stance"),
    );
    if (stancers.length > 0) {
      const e = pick(stancers);
      return action(e, playOfType(e, "stance")!, e);
    }
  }

  // Tier 4 — debuff / disable (max 1/turn).
  if (context.debuffsUsed < 1) {
    const debuffers = actingPool.filter(
      (e) => playOfType(e, "debuff") || playOfType(e, "disable"),
    );
    if (debuffers.length > 0) {
      const e = pick(debuffers);
      const p = (playOfType(e, "debuff") || playOfType(e, "disable"))!;
      return action(e, p, attackTargetFor(e));
    }
  }

  // Tier 5 — attack.
  const attackers = actingPool.filter((e) => playOfType(e, "attack"));
  if (attackers.length > 0) {
    const e = pick(attackers);
    return action(e, playOfType(e, "attack")!, attackTargetFor(e));
  }

  // Tier 6 — any remaining usable play (executeSkill safely fizzles a sealed
  // cast if that's all that's left). Enemies with an empty hand can't act.
  const playablePool = actingPool.filter((e) => {
    const plays = playsFor(e);
    return (
      plays.some((p) => !(attackSealed(e) && p.skill.type === "attack")) ||
      plays.length > 0
    );
  });
  if (playablePool.length === 0) return null;
  const e = pick(playablePool);
  const plays = playsFor(e);
  const play =
    plays.find((p) => !(attackSealed(e) && p.skill.type === "attack")) ??
    plays[0];
  return action(e, play, attackTargetFor(e));
}
