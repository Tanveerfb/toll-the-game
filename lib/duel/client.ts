import type { Action } from "@/types/action";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";
import { serializeDuelState } from "@/lib/duel/serializeState";
import { parseDuelMove } from "@/lib/duel/parseMove";
import { useDuelStore } from "@/store/duelStore";

/** How long to wait before handing the turn back to the AI on its own. */
export const DUEL_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 1500;

export interface DuelTurnRequest {
  enemyTeam: BattleCharacter[];
  playerTeam: BattleCharacter[];
  hand: ActionCard[];
  turn: number;
  actionBudget: number;
  recentEvents?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Publishes the battle state and waits for Claude's move.
 *
 * Returns the actions to take, or **null** meaning "the scripted AI should
 * take this turn". Null is returned for every failure mode — aborted by the
 * player, timed out, network error, or an invalid move — because the one
 * outcome that must never happen is a battle stuck with no legal way forward.
 * A rejected move is logged to `.duel/duel-log.md` so the reason is visible
 * rather than silently swallowed.
 */
export async function requestDuelMove(
  request: DuelTurnRequest,
): Promise<Array<Action | null> | null> {
  const { beginWait, setStatus, endWait } = useDuelStore.getState();

  let aborted = false;
  beginWait(() => {
    aborted = true;
  });

  const finish = <T,>(value: T): T => {
    endWait();
    return value;
  };

  try {
    const state = serializeDuelState(request);
    const published = await fetch("/api/dev/duel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, turn: request.turn }),
    }).catch(() => null);

    if (!published || !published.ok) {
      // Route missing or 404 in a production build — behave exactly as if
      // duel mode were off.
      return finish(null);
    }

    const startedAt = Date.now();
    for (;;) {
      if (aborted) {
        await clearMove("Turn handed to the scripted AI by the player.");
        return finish(null);
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed > DUEL_TIMEOUT_MS) {
        await clearMove("Timed out waiting for Claude; the scripted AI took the turn.");
        return finish(null);
      }

      const res = await fetch("/api/dev/duel").catch(() => null);
      const body = res && res.ok ? await res.json().catch(() => null) : null;

      if (body && body.pending === false && typeof body.move === "string") {
        const parsed = parseDuelMove(body.move, {
          enemyTeam: request.enemyTeam,
          playerTeam: request.playerTeam,
          hand: request.hand,
          turn: request.turn,
          actionBudget: request.actionBudget,
        });
        if (!parsed.ok) {
          // Don't corrupt a live battle with a bad move — say why and let the
          // AI play this turn.
          await clearMove(`Move rejected: ${parsed.reason}`, true);
          setStatus(`Move rejected: ${parsed.reason}`);
          return finish(null);
        }
        await clearMove(
          parsed.reasoning ? `Claude: ${parsed.reasoning}` : "Move accepted.",
        );
        return finish(parsed.actions);
      }

      setStatus(`Waiting for Claude… ${Math.round(elapsed / 1000)}s`);
      await sleep(POLL_MS);
    }
  } catch {
    return finish(null);
  }
}

/**
 * Signals the end of a duelled battle.
 *
 * Without this a finished fight writes nothing, so a watcher polling for the
 * next state waits forever and never learns the result — which is exactly what
 * happened in the first duel (2026-08-09). `outcome` is from the *player's*
 * side: "victory" means Tanveer won and Claude lost.
 */
export async function publishDuelResult(input: {
  outcome: "victory" | "defeat";
  enemyTeam: BattleCharacter[];
  playerTeam: BattleCharacter[];
  turn: number;
  recentEvents?: string[];
}): Promise<void> {
  const claudeResult = input.outcome === "victory" ? "LOST" : "WON";
  const lines = [
    `# Battle over — Claude ${claudeResult}`,
    "",
    `Ended on turn ${input.turn + 1}. (\`${input.outcome}\` is from the player's side.)`,
    "",
    "## Final state — your units",
    ...input.enemyTeam.map(
      (u) => `- ${u.name}: ${u.currentHP}/${u.hp} HP${u.currentHP <= 0 ? " — DOWN" : ""}`,
    ),
    "",
    "## Final state — opponent",
    ...input.playerTeam.map(
      (u) => `- ${u.name}: ${u.currentHP}/${u.hp} HP${u.currentHP <= 0 ? " — DOWN" : ""}`,
    ),
  ];
  if (input.recentEvents && input.recentEvents.length > 0) {
    lines.push("", "## Closing events", ...input.recentEvents.slice(-15).map((e) => `- ${e}`));
  }

  await fetch("/api/dev/duel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: lines.join("\n") }),
  }).catch(() => null);
}

async function clearMove(note: string, rejected = false) {
  const query = `note=${encodeURIComponent(note)}${rejected ? "&rejected=1" : ""}`;
  await fetch(`/api/dev/duel?${query}`, { method: "DELETE" }).catch(() => null);
}
