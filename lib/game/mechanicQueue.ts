import type { BattleCharacter } from "@/types/character";
import type { BattlePhase } from "@/types/mechanic";

/**
 * The passive queue, as a plain object.
 *
 * This logic lived inside `MechanicProvider` — a React context — which meant
 * the only way to run a passive was to render a component tree. That was fine
 * while the only consumer was the battle screen, and became a problem the
 * moment anything headless needed the same behaviour: the balance simulator
 * (`scripts/sim.ts`) has no DOM, and a simulator that skipped passives would
 * report win rates for a game nobody plays.
 *
 * So the runner is here and the provider is a thin wrapper over it. One
 * implementation, two callers, and no chance of the simulated fight and the
 * real one drifting apart.
 *
 * `QueueItem` and `QueueAction` moved here with it. They were imported *from a
 * hook* by `lib/game/passive.ts`, which had the dependency arrow pointing the
 * wrong way — engine code should not reach into the React layer.
 */

export type QueueAction = (
  source: BattleCharacter,
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  log: (entry: string) => void,
) => Promise<{ playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] }>;

export interface QueueItem {
  id: string;
  phase: BattlePhase;
  sourceInstanceId: string;
  mechanicId: string;
  action: QueueAction;
  /** Runs even after the source dies — for cleanup-style rechecks that have to
   *  fire on the turn a unit is removed. */
  runWhenDead?: boolean;
}

export interface MechanicQueue {
  register: (item: QueueItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  process: (
    phase: BattlePhase,
    teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
    log: (entry: string) => void,
  ) => Promise<{
    playerTeam: BattleCharacter[];
    enemyTeam: BattleCharacter[];
  }>;
}

export function createMechanicQueue(
  options: {
    /**
     * Pause between items. The battle screen spends it letting an animation
     * land; a simulator running ten thousand fights must not, which is the
     * whole reason this is a parameter and not the hardcoded 800 it used to be.
     */
    stepDelayMs?: number;
  } = {},
): MechanicQueue {
  const { stepDelayMs = 0 } = options;
  let items: QueueItem[] = [];

  return {
    register(item) {
      // Duplicate ids are how a re-registered passive fires twice.
      if (!items.find((q) => q.id === item.id)) items.push(item);
    },

    remove(id) {
      items = items.filter((q) => q.id !== id);
    },

    clear() {
      items = [];
    },

    async process(phase, teams, log) {
      const due = items.filter((q) => q.phase === phase);
      let current = { ...teams };

      for (const item of due) {
        const source =
          current.playerTeam.find(
            (c) => c.instanceId === item.sourceInstanceId,
          ) ??
          current.enemyTeam.find((c) => c.instanceId === item.sourceInstanceId);

        if (!source) continue;
        if (source.currentHP <= 0 && !item.runWhenDead) continue;

        log(`Evaluating mechanics for ${source.name} [${item.mechanicId}]`);
        current = await item.action(source, current, log);

        if (stepDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
        }
      }

      return current;
    },
  };
}
