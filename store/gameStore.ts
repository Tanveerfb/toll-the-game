import { create } from "zustand";
import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import { ActionCard } from "@/types/action";

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
  battlePhase: BattlePhase;

  // Deck System
  deck: ActionCard[];
  actionQueue: ActionCard[];
  selectedEnemyMarker: string | null;
  interactionNotice: string | null;

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
  resetBattle: () => void;

  // Deck Actions
  setEnemyMarker: (instanceId: string | null) => void;
  setInteractionNotice: (message: string | null) => void;
  clearInteractionNotice: () => void;
  initializeDeck: () => void;
  drawCards: () => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  reorderDeckCard: (draggedCardId: string, targetCardId: string) => void;
  mergeDeckCard: (cardId: string) => void;
  removeDeadCharacterCards: (instanceId: string) => void;
  clearActionQueue: () => void;
}

export const useGameStore = create<BattleState>((set, get) => ({
  playerTeam: [],
  enemyTeam: [],
  currentTurn: 0,
  playerTurns: 0,
  enemyTurns: 0,
  battleLog: [],
  battlePhase: "initializing",

  deck: [],
  actionQueue: [],
  selectedEnemyMarker: null,
  interactionNotice: null,

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

  resetBattle: () =>
    set({
      playerTeam: [],
      enemyTeam: [],
      currentTurn: 0,
      playerTurns: 0,
      enemyTurns: 0,
      battleLog: [],
      battlePhase: "initializing",
      deck: [],
      actionQueue: [],
      selectedEnemyMarker: null,
      interactionNotice: null,
    }),

  setEnemyMarker: (instanceId) => set({ selectedEnemyMarker: instanceId }),
  setInteractionNotice: (message) => set({ interactionNotice: message }),
  clearInteractionNotice: () => set({ interactionNotice: null }),

  initializeDeck: () => {
    const { playerTeam } = get();
    const living = playerTeam.filter((c) => c.currentHP > 0);
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
    const livingChars = playerTeam.filter((c) => c.currentHP > 0);

    // Max amount is 4/5/7/8 for 1/2/3/4 characters
    const maxCapacityMap = [0, 4, 5, 7, 8];
    const maxCapacity = maxCapacityMap[playerTeam.length] || 8;
    const currentSpaces = maxCapacity - deck.length;

    if (currentSpaces <= 0) return;

    const pool: { charId: string; skill: any }[] = [];
    const guaranteedUlts: { charId: string; skill: any }[] = [];

    livingChars.forEach((c) => {
      if (c.ultGauge >= 5 && c.ultimate) {
        const hasUltInHand = [...deck, ...actionQueue].some(
          (card) =>
            card.sourceInstanceId === c.instanceId &&
            card.skill.type === "ultimate",
        );
        if (!hasUltInHand) {
          guaranteedUlts.push({ charId: c.instanceId, skill: c.ultimate });
        }
      }
      c.skills.forEach((s) => {
        pool.push({ charId: c.instanceId, skill: s });
      });
    });

    const newCards: ActionCard[] = [];
    while (guaranteedUlts.length > 0 && newCards.length < currentSpaces) {
      const u = guaranteedUlts.shift()!;
      newCards.push({
        id: Math.random().toString(36).substring(2, 9),
        sourceInstanceId: u.charId,
        skill: u.skill,
        rank: 1,
      });
    }

    while (newCards.length < currentSpaces && pool.length > 0) {
      const randIdx = Math.floor(Math.random() * pool.length);
      const picked = pool[randIdx];
      newCards.push({
        id: Math.random().toString(36).substring(2, 9),
        sourceInstanceId: picked.charId,
        skill: picked.skill,
        rank: 1,
      });
    }

    set({ deck: [...deck, ...newCards] });
  },

  selectCard: (cardId: string) => {
    const { deck, actionQueue, enemyTeam, playerTeam, selectedEnemyMarker } =
      get();
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
    } else {
      targetId = char?.instanceId;
    }

    const newDeck = [...deck];
    newDeck.splice(cardIndex, 1);

    set({
      deck: newDeck,
      actionQueue: [...actionQueue, { ...card, targetInstanceId: targetId }],
      interactionNotice: null,
    });
  },

  deselectCard: (cardId: string) => {
    const { deck, actionQueue } = get();
    const cardIndex = actionQueue.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = actionQueue[cardIndex];
    const newQueue = [...actionQueue];
    newQueue.splice(cardIndex, 1);

    // Put it back at the end of the deck
    set({
      actionQueue: newQueue,
      deck: [...deck, card],
      interactionNotice: null,
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

    const removalIndex =
      materialIndex > cardIndex ? materialIndex : materialIndex;
    mergedDeck.splice(removalIndex, 1);

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

  clearActionQueue: () => set({ actionQueue: [], interactionNotice: null }),
}));
