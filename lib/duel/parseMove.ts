import type { BattleCharacter } from "@/types/character";
import type { Action } from "@/types/action";
import type { ActionCard } from "@/types/action";

/**
 * Validates the move Claude wrote to `.duel/move.json` and turns it into
 * engine `Action`s.
 *
 * Everything here is defensive on purpose. A malformed move must never reach
 * `executeSkill` — a bad target or a card that isn't in hand would corrupt a
 * live battle mid-run, including a story battle carrying real rewards. Invalid
 * input is rejected with a reason and the caller falls back to the scripted
 * AI, which is always a legal move.
 */

export interface DuelMoveAction {
  /** Index into the hand as presented in `state.md`. */
  cardIndex?: number;
  /** Optional — omitted means the engine picks a living field target. */
  targetInstanceId?: string;
  /** Deliberately take no action with this slot. */
  pass?: boolean;
}

export interface DuelMove {
  /** 0-based turn the move was written for. Guards against a stale file. */
  turn: number;
  actions: DuelMoveAction[];
  /** Free text, appended to the duel log. Not used by the engine. */
  reasoning?: string;
}

export type ParseResult =
  | { ok: true; actions: Array<Action | null>; reasoning?: string }
  | { ok: false; reason: string };

export interface ParseContext {
  enemyTeam: BattleCharacter[];
  playerTeam: BattleCharacter[];
  hand: ActionCard[];
  /** Current 0-based turn. */
  turn: number;
  actionBudget: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses raw file text. Never throws — malformed JSON is a rejection. */
export function parseDuelMove(raw: string, context: ParseContext): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "move.json is not valid JSON" };
  }
  if (!isRecord(data)) return { ok: false, reason: "move.json must be an object" };

  if (typeof data.turn !== "number") {
    return { ok: false, reason: "move.json is missing a numeric `turn`" };
  }
  // Stale-move guard: a file left over from an earlier turn must not be
  // replayed into the current one.
  if (data.turn !== context.turn) {
    return {
      ok: false,
      reason: `move.json is for turn ${data.turn}, but it is turn ${context.turn}`,
    };
  }

  if (!Array.isArray(data.actions)) {
    return { ok: false, reason: "move.json is missing an `actions` array" };
  }
  if (data.actions.length > context.actionBudget) {
    return {
      ok: false,
      reason: `move.json has ${data.actions.length} actions but only ${context.actionBudget} are allowed this turn`,
    };
  }

  const usedCards = new Set<string>();
  const actions: Array<Action | null> = [];

  for (const [index, entry] of data.actions.entries()) {
    if (!isRecord(entry)) {
      return { ok: false, reason: `action ${index} is not an object` };
    }
    if (entry.pass === true) {
      actions.push(null);
      continue;
    }

    if (typeof entry.cardIndex !== "number") {
      return { ok: false, reason: `action ${index} needs a numeric \`cardIndex\` (or \`pass: true\`)` };
    }
    const card = context.hand[entry.cardIndex];
    if (!card) {
      return {
        ok: false,
        reason: `action ${index} refers to card ${entry.cardIndex}, which is not in a hand of ${context.hand.length}`,
      };
    }
    // One physical card, one play — the same index twice would play a card
    // that has already left the hand.
    if (usedCards.has(card.id)) {
      return { ok: false, reason: `action ${index} plays card ${entry.cardIndex} twice` };
    }
    usedCards.add(card.id);

    // The card's owner has to still be able to act.
    const source = context.enemyTeam.find(
      (u) => u.instanceId === card.sourceInstanceId,
    );
    if (!source || source.currentHP <= 0) {
      return { ok: false, reason: `action ${index}: ${card.sourceInstanceId} is not alive to play that card` };
    }
    if (source.isSub) {
      return { ok: false, reason: `action ${index}: ${source.name} is benched and cannot act` };
    }
    if (source.debuffs.some((d) => d.type === "stun")) {
      return { ok: false, reason: `action ${index}: ${source.name} is stunned` };
    }

    let targetInstanceId = "";
    if (typeof entry.targetInstanceId === "string") {
      const target = [...context.playerTeam, ...context.enemyTeam].find(
        (u) => u.instanceId === entry.targetInstanceId,
      );
      if (!target) {
        return { ok: false, reason: `action ${index}: no unit "${entry.targetInstanceId}"` };
      }
      if (target.currentHP <= 0) {
        return { ok: false, reason: `action ${index}: ${target.name} is already down` };
      }
      // Subs are untargetable (ruling #7) — a targeted sub would otherwise
      // silently retarget and read as a bug during a duel.
      if (target.isSub) {
        return { ok: false, reason: `action ${index}: ${target.name} is benched and untargetable` };
      }
      targetInstanceId = target.instanceId;
    }

    actions.push({
      sourceInstanceId: card.sourceInstanceId,
      skill: card.skill,
      targetInstanceId,
      rank: card.rank,
      cardId: card.id,
    } as Action);
  }

  return {
    ok: true,
    actions,
    reasoning: typeof data.reasoning === "string" ? data.reasoning : undefined,
  };
}
