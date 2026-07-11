import { create } from "zustand";
import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import { ActionCard } from "@/types/action";
import { BattleActionEvent } from "@/types/battleEvent";

export type SequencedBattleEvent = BattleActionEvent & { id: number };

// Ally-friendly skill that hits ONE ally at this card's rank (no aoe, and
// aoeRanked inactive at the rank) — the player must mark the ally target.
export function isSingleAllyTarget(card: ActionCard): boolean {
  if (!["buff", "heal"].includes(card.skill.type)) return false;
  const mechanics =
    (card.skill as { mechanics?: Array<Record<string, unknown>> }).mechanics ??
    [];
  const rankIndex = (card.rank ?? 1) - 1;
  const aoeActive = mechanics.some(
    (m) =>
      m.type === "aoe" ||
      (m.type === "aoeRanked" &&
        Array.isArray(m.ranks) &&
        m.ranks[rankIndex] === true),
  );
  return !aoeActive;
}

function canCardsAutoMerge(left: ActionCard, right: ActionCard): boolean {
  return (
    left.rank < 3 &&
    right.rank < 3 &&
    left.sourceInstanceId === right.sourceInstanceId &&
    left.skill.skillName === right.skill.skillName &&
    left.rank === right.rank
  );
}

function applyAdjacentMerges(cards: ActionCard[]): {
  deck: ActionCard[];
  mergeCount: number;
  mergeSourceIds: string[];
  notices: string[];
} {
  const next = [...cards];
  const mergeSourceIds: string[] = [];
  const notices: string[] = [];
  let mergeCount = 0;

  let index = 0;
  while (index < next.length - 1) {
    const current = next[index];
    const neighbor = next[index + 1];

    if (!canCardsAutoMerge(current, neighbor)) {
      index += 1;
      continue;
    }

    const newRank = Math.min(3, current.rank + 1) as 1 | 2 | 3;
    next[index] = {
      ...current,
      rank: newRank,
    };
    next.splice(index + 1, 1);

    mergeCount += 1;
    mergeSourceIds.push(current.sourceInstanceId);
    notices.push(`${current.skill.skillName} auto-merged to R${newRank}.`);

    if (index > 0) {
      index -= 1;
    }
  }

  return {
    deck: next,
    mergeCount,
    mergeSourceIds,
    notices,
  };
}

function moveCardById(
  cards: ActionCard[],
  draggedCardId: string,
  targetCardId: string,
): ActionCard[] {
  if (draggedCardId === targetCardId) {
    return cards;
  }

  const fromIndex = cards.findIndex((c) => c.id === draggedCardId);
  const toIndex = cards.findIndex((c) => c.id === targetCardId);

  if (fromIndex === -1 || toIndex === -1) {
    return cards;
  }

  const reordered = [...cards];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  return reordered;
}

interface BattleState {
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  currentTurn: number;
  playerTurns: number;
  enemyTurns: number;
  battleLog: string[];
  /** Structured action events for the animation sequencer */
  battleEvents: SequencedBattleEvent[];
  battlePhase: BattlePhase;
  battleSpeed: number;

  // Deck System
  deck: ActionCard[];
  actionQueue: ActionCard[];
  selectedEnemyMarker: string | null;
  selectedAllyMarker: string | null;
  interactionNotice: string | null;
  // Turn-start snapshot for Reset Hand (undoes queuing AND selection merges,
  // including the ult gauge those merges granted)
  handSnapshot: {
    deck: ActionCard[];
    ultGauges: Record<string, number>;
  } | null;

  // Actions
  setPlayerTeam: (team: BattleCharacter[]) => void;
  setEnemyTeam: (team: BattleCharacter[]) => void;
  updateTeams: (
    playerTeam: BattleCharacter[],
    enemyTeam: BattleCharacter[],
  ) => void;
  setCurrentTurn: (turn: number | ((prev: number) => number)) => void;
  setPlayerTurns: (turn: number | ((prev: number) => number)) => void;
  setEnemyTurns: (turn: number | ((prev: number) => number)) => void;
  setBattlePhase: (phase: BattlePhase) => void;
  addToBattleLog: (entry: string) => void;
  addBattleEvent: (event: BattleActionEvent) => void;
  setBattleSpeed: (speed: number) => void;
  resetBattle: () => void;

  // Deck Actions
  setEnemyMarker: (instanceId: string | null) => void;
  setAllyMarker: (instanceId: string | null) => void;
  setInteractionNotice: (message: string | null) => void;
  clearInteractionNotice: () => void;
  initializeDeck: () => void;
  drawCards: () => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  reorderDeckCard: (draggedCardId: string, targetCardId: string) => void;
  mergeDeckCard: (cardId: string) => void;
  removeDeadCharacterCards: (instanceId: string) => void;
  setActionQueue: (queue: ActionCard[]) => void;
  snapshotHand: () => void;
  resetHand: () => void;
}

export const useGameStore = create<BattleState>((set, get) => ({
  playerTeam: [],
  enemyTeam: [],
  currentTurn: 0,
  playerTurns: 0,
  enemyTurns: 0,
  battleLog: [],
  battleEvents: [],
  battlePhase: "initializing",
  battleSpeed: 1,

  deck: [],
  actionQueue: [],
  selectedEnemyMarker: null,
  selectedAllyMarker: null,
  interactionNotice: null,
  handSnapshot: null,

  setPlayerTeam: (team) => set({ playerTeam: team }),
  setEnemyTeam: (team) => set({ enemyTeam: team }),
  updateTeams: (playerTeam, enemyTeam) => set({ playerTeam, enemyTeam }),
  setCurrentTurn: (turn) =>
    set((state) => ({
      currentTurn: typeof turn === "function" ? turn(state.currentTurn) : turn,
    })),
  setPlayerTurns: (turn) =>
    set((state) => ({
      playerTurns: typeof turn === "function" ? turn(state.playerTurns) : turn,
    })),
  setEnemyTurns: (turn) =>
    set((state) => ({
      enemyTurns: typeof turn === "function" ? turn(state.enemyTurns) : turn,
    })),
  setBattlePhase: (phase) => set({ battlePhase: phase }),
  addToBattleLog: (entry) =>
    set((state) => ({ battleLog: [...state.battleLog, entry] })),
  addBattleEvent: (event) =>
    set((state) => ({
      battleEvents: [
        ...state.battleEvents,
        { ...event, id: state.battleEvents.length + 1 },
      ],
    })),
  // Speed is a player preference — deliberately not reset by resetBattle
  setBattleSpeed: (speed) => set({ battleSpeed: speed }),

  resetBattle: () =>
    set({
      playerTeam: [],
      enemyTeam: [],
      currentTurn: 0,
      playerTurns: 0,
      enemyTurns: 0,
      battleLog: [],
      battleEvents: [],
      battlePhase: "initializing",
      deck: [],
      actionQueue: [],
      selectedEnemyMarker: null,
      selectedAllyMarker: null,
      interactionNotice: null,
      handSnapshot: null,
    }),

  setEnemyMarker: (instanceId) => set({ selectedEnemyMarker: instanceId }),
  setAllyMarker: (instanceId) => set({ selectedAllyMarker: instanceId }),
  setInteractionNotice: (message) => set({ interactionNotice: message }),
  clearInteractionNotice: () => set({ interactionNotice: null }),

  setActionQueue: (queue) => set({ actionQueue: queue }),

  // Captured when PlayerAction begins — Reset Hand restores this state
  snapshotHand: () => {
    const { deck, playerTeam } = get();
    const ultGauges: Record<string, number> = {};
    playerTeam.forEach((c) => {
      ultGauges[c.instanceId] = c.ultGauge;
    });
    set({ handSnapshot: { deck: [...deck], ultGauges } });
  },

  // Discard the queued actions and rewind the hand to the turn start —
  // selection-time merges are reversed, including their ult gauge grants
  resetHand: () => {
    const { handSnapshot, playerTeam } = get();
    if (!handSnapshot) return;
    set({
      deck: [...handSnapshot.deck],
      actionQueue: [],
      playerTeam: playerTeam.map((c) =>
        handSnapshot.ultGauges[c.instanceId] !== undefined
          ? { ...c, ultGauge: handSnapshot.ultGauges[c.instanceId] }
          : c,
      ),
      interactionNotice: null,
    });
  },

  initializeDeck: () => {
    const { playerTeam } = get();
    // Subs contribute no cards until promoted to the field
    const living = playerTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    const initialCards: ActionCard[] = [];

    living.forEach((c) => {
      // 2 skills from each char
      c.skills.forEach((skill) => {
        initialCards.push({
          id: Math.random().toString(36).substring(2, 9),
          sourceInstanceId: c.instanceId,
          skill,
          rank: 1,
        });
      });
    });

    set({ deck: initialCards, actionQueue: [] });
  },

  drawCards: () => {
    const { playerTeam, deck, actionQueue } = get();
    // Subs contribute no cards until promoted to the field
    const livingChars = playerTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    const fieldCount = playerTeam.filter((c) => !c.isSub).length;

    // Max amount is 4/5/7/8 for 1/2/3/4 field characters
    const maxCapacityMap = [0, 4, 5, 7, 8];
    const maxCapacity = maxCapacityMap[fieldCount] || 8;

    if (deck.length >= maxCapacity || livingChars.length === 0) return;

    // The hand is never reset: leftover cards persist and new cards are
    // drawn purely at random from the living field units' skill pools,
    // one at a time, auto-merging adjacent identical cards as they land
    // (7DS GC behavior; each merge grants that character +1 ult gauge)
    // until the hand is full.
    let currentDeck = [...deck];
    let updatedTeam = playerTeam;
    const notices: string[] = [];
    let totalMerges = 0;

    const pool: { charId: string; skill: any }[] = [];
    livingChars.forEach((c) => {
      c.skills.forEach((s) => {
        pool.push({ charId: c.instanceId, skill: s });
      });
    });
    if (pool.length === 0) return;

    // Ult eligibility is snapshotted BEFORE this refill: a gauge filled by
    // merges during the refill guarantees the ultimate on the NEXT turn's
    // draw, never in the same refill.
    const ultEligible = new Set(
      livingChars
        .filter(
          (c) =>
            c.ultGauge >= 5 &&
            c.ultimate &&
            ![...deck, ...actionQueue].some(
              (card) =>
                card.sourceInstanceId === c.instanceId &&
                card.skill.type === "ultimate",
            ),
        )
        .map((c) => c.instanceId),
    );

    const nextCard = (): ActionCard => {
      // A pre-refill full gauge guarantees that character's ultimate
      // (one copy in hand/queue at a time)
      const ultReadyId = livingChars.find((c) =>
        ultEligible.has(c.instanceId),
      )?.instanceId;
      if (ultReadyId) {
        ultEligible.delete(ultReadyId);
        const owner = livingChars.find((c) => c.instanceId === ultReadyId)!;
        return {
          id: Math.random().toString(36).substring(2, 9),
          sourceInstanceId: owner.instanceId,
          skill: owner.ultimate!,
          rank: 1,
        };
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      return {
        id: Math.random().toString(36).substring(2, 9),
        sourceInstanceId: picked.charId,
        skill: picked.skill,
        rank: 1,
      };
    };

    while (currentDeck.length < maxCapacity) {
      currentDeck.push(nextCard());

      const mergeResult = applyAdjacentMerges(currentDeck);
      currentDeck = mergeResult.deck;

      if (mergeResult.mergeCount > 0) {
        totalMerges += mergeResult.mergeCount;
        notices.push(...mergeResult.notices);
        updatedTeam = updatedTeam.map((char) => {
          const gains = mergeResult.mergeSourceIds.filter(
            (sourceId) => sourceId === char.instanceId,
          ).length;
          if (gains <= 0) return char;
          return { ...char, ultGauge: Math.min(5, char.ultGauge + gains) };
        });
      }
    }

    set({
      deck: currentDeck,
      playerTeam: updatedTeam,
      interactionNotice:
        totalMerges > 0
          ? `${notices.join(" ")} +${totalMerges} Ult Gauge.`
          : get().interactionNotice,
    });
  },

  selectCard: (cardId: string) => {
    const {
      deck,
      actionQueue,
      enemyTeam,
      playerTeam,
      selectedEnemyMarker,
      selectedAllyMarker,
    } = get();
    if (actionQueue.length >= 3) {
      set({ interactionNotice: "Action queue is full (3/3)." });
      return;
    }

    const cardIndex = deck.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = deck[cardIndex];
    const char = playerTeam.find((c) => c.instanceId === card.sourceInstanceId);
    if (char && char.debuffs.some((d) => d.type === "stun")) {
      set({ interactionNotice: `${char.name} is stunned and cannot act.` });
      return;
    }

    const requiresEnemyTarget = [
      "attack",
      "debuff",
      "disable",
      "ultimate",
    ].includes(card.skill.type);

    const aliveEnemies = enemyTeam.filter((e) => e.currentHP > 0);

    let targetId: string | undefined;

    if (requiresEnemyTarget) {
      if (aliveEnemies.length <= 0) {
        set({ interactionNotice: "No valid enemy target available." });
        return;
      }

      const markedEnemyIsAlive =
        selectedEnemyMarker &&
        aliveEnemies.some((e) => e.instanceId === selectedEnemyMarker);

      if (!markedEnemyIsAlive) {
        set({
          interactionNotice: "Select an enemy target before queuing this card.",
        });
        return;
      }

      targetId = selectedEnemyMarker || undefined;
    } else if (isSingleAllyTarget(card)) {
      // Single-target ally skills (e.g. Leorio's rank-1 Member of the Zodiac)
      // require the player to pick the ally — including the caster
      const aliveAllies = playerTeam.filter((p) => p.currentHP > 0 && !p.isSub);
      const markedAllyIsAlive =
        selectedAllyMarker &&
        aliveAllies.some((p) => p.instanceId === selectedAllyMarker);

      if (!markedAllyIsAlive) {
        set({
          interactionNotice: "Select an ally target before queuing this card.",
        });
        return;
      }

      targetId = selectedAllyMarker || undefined;
    } else {
      targetId = char?.instanceId;
    }

    const newDeck = [...deck];
    newDeck.splice(cardIndex, 1);

    // Leftover cards auto-merge if removing this one made identical
    // neighbors adjacent (each merge still grants +1 ult gauge; Reset Hand
    // reverses both)
    const mergeResult = applyAdjacentMerges(newDeck);
    let updatedTeam = playerTeam;
    if (mergeResult.mergeCount > 0) {
      updatedTeam = playerTeam.map((c) => {
        const gains = mergeResult.mergeSourceIds.filter(
          (sourceId) => sourceId === c.instanceId,
        ).length;
        if (gains <= 0) return c;
        return { ...c, ultGauge: Math.min(5, c.ultGauge + gains) };
      });
    }

    set({
      deck: mergeResult.deck,
      playerTeam: updatedTeam,
      actionQueue: [...actionQueue, { ...card, targetInstanceId: targetId }],
      interactionNotice:
        mergeResult.mergeCount > 0 ? mergeResult.notices.join(" ") : null,
    });
  },

  deselectCard: (cardId: string) => {
    const { deck, actionQueue } = get();
    const cardIndex = actionQueue.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = actionQueue[cardIndex];
    const newQueue = [...actionQueue];
    newQueue.splice(cardIndex, 1);

    // Put it back at the end of the deck; auto-merge if it lands next to
    // an identical card (same rule as draws and selection)
    const { playerTeam } = get();
    const mergeResult = applyAdjacentMerges([...deck, card]);
    let updatedTeam = playerTeam;
    if (mergeResult.mergeCount > 0) {
      updatedTeam = playerTeam.map((c) => {
        const gains = mergeResult.mergeSourceIds.filter(
          (sourceId) => sourceId === c.instanceId,
        ).length;
        if (gains <= 0) return c;
        return { ...c, ultGauge: Math.min(5, c.ultGauge + gains) };
      });
    }

    set({
      actionQueue: newQueue,
      deck: mergeResult.deck,
      playerTeam: updatedTeam,
      interactionNotice:
        mergeResult.mergeCount > 0 ? mergeResult.notices.join(" ") : null,
    });
  },

  reorderDeckCard: (draggedCardId: string, targetCardId: string) => {
    const { deck, playerTeam } = get();
    const reordered = moveCardById(deck, draggedCardId, targetCardId);

    if (reordered === deck) {
      return;
    }

    const mergeResult = applyAdjacentMerges(reordered);

    let updatedPlayerTeam = playerTeam;
    if (mergeResult.mergeCount > 0) {
      updatedPlayerTeam = playerTeam.map((char) => {
        const gains = mergeResult.mergeSourceIds.filter(
          (sourceId) => sourceId === char.instanceId,
        ).length;
        if (gains <= 0) return char;
        return { ...char, ultGauge: Math.min(5, char.ultGauge + gains) };
      });
    }

    set({
      deck: mergeResult.deck,
      playerTeam: updatedPlayerTeam,
      interactionNotice:
        mergeResult.mergeCount > 0
          ? `${mergeResult.notices.join(" ")} +${mergeResult.mergeCount} Ult Gauge.`
          : null,
    });
  },

  mergeDeckCard: (cardId: string) => {
    const { deck, playerTeam } = get();
    const cardIndex = deck.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const baseCard = deck[cardIndex];
    if (baseCard.rank >= 3) {
      set({
        interactionNotice: `${baseCard.skill.skillName} is already max rank.`,
      });
      return;
    }

    const materialIndex = deck.findIndex(
      (c, idx) =>
        idx !== cardIndex &&
        c.sourceInstanceId === baseCard.sourceInstanceId &&
        c.skill.skillName === baseCard.skill.skillName,
    );

    if (materialIndex === -1) {
      set({
        interactionNotice: `Need another ${baseCard.skill.skillName} card to merge.`,
      });
      return;
    }

    const mergedDeck = [...deck];
    const updatedBase = {
      ...mergedDeck[cardIndex],
      rank: Math.min(3, mergedDeck[cardIndex].rank + 1) as 1 | 2 | 3,
    };
    mergedDeck[cardIndex] = updatedBase;

    mergedDeck.splice(materialIndex, 1);

    const updatedPlayerTeam = playerTeam.map((char) =>
      char.instanceId === baseCard.sourceInstanceId
        ? { ...char, ultGauge: Math.min(5, char.ultGauge + 1) }
        : char,
    );

    set({
      deck: mergedDeck,
      playerTeam: updatedPlayerTeam,
      interactionNotice: `${baseCard.skill.skillName} ranked up to R${updatedBase.rank}. +1 Ult Gauge.`,
    });
  },

  removeDeadCharacterCards: (instanceId: string) => {
    const { deck, actionQueue } = get();
    set({
      deck: deck.filter((c) => c.sourceInstanceId !== instanceId),
      actionQueue: actionQueue.filter((c) => c.sourceInstanceId !== instanceId),
    });
  },
}));

// Dev console access for debugging battle state (stripped from prod builds)
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__gameStore = useGameStore;
}
