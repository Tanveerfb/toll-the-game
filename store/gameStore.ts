import { create } from "zustand";
import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import { ActionCard } from "@/types/action";
import { AnyBattleEvent } from "@/types/battleEvent";
import {
  applyAdjacentMerges,
  initialCardsFor,
  previewCardsFor,
  maxHandCapacity,
  refillHand,
} from "@/lib/game/deck";
import { ultGaugeMax } from "@/lib/game/ultGauge";

export type SequencedBattleEvent = AnyBattleEvent & { id: number };

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
  /** True while an R3/ultimate reveal has visual focus (spec §1 "Big-hit
   *  focus") — surrounding UI (the hand, team bar) recedes/dims, then
   *  restores. Published here (not local sequencer state) so components
   *  outside BattleArena's tree, like Deck, can react to it too. */
  bigHitFocus: boolean;

  // Deck System
  /** Preview mode (spec §7): the hand is a hardcoded full rank/ultimate set
   *  (previewCardsFor) and is never RNG-refilled. Set per battle launch. */
  isPreview: boolean;
  deck: ActionCard[];
  /** Enemy side's hidden hand — same 7DS GC rules as the player deck, played
   * by the AI (headless, no manual merging). Managed by the battle loop. */
  enemyDeck: ActionCard[];
  actionQueue: ActionCard[];
  selectedEnemyMarker: string | null;
  selectedAllyMarker: string | null;
  /**
   * Deck card id waiting for a single-ally target pick. Set when a single-ally
   * skill is selected; the arena shows a living-ally chooser modal, and the
   * card is only queued once `confirmAllyTarget` resolves it.
   */
  pendingAllyCardId: string | null;
  /**
   * Number of action slots filled with a plain pass (null action) this turn.
   * A pass occupies a slot but plays no card — no effect, no ult gauge. Counts
   * toward the 3-slot cap alongside actionQueue.
   */
  queuedNullCount: number;
  interactionNotice: string | null;
  /** A boss just broke into a new phase — drives the cinematic flourish. */
  phaseBreak: { name: string; phase: number; key: number } | null;
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
  addBattleEvent: (event: AnyBattleEvent) => void;
  setBattleSpeed: (speed: number) => void;
  setBigHitFocus: (focused: boolean) => void;
  resetBattle: () => void;

  // Deck Actions
  setEnemyMarker: (instanceId: string | null) => void;
  setAllyMarker: (instanceId: string | null) => void;
  setInteractionNotice: (message: string | null) => void;
  clearInteractionNotice: () => void;
  setPhaseBreak: (name: string, phase: number) => void;
  clearPhaseBreak: () => void;
  initializeDeck: () => void;
  drawCards: () => void;
  /** Toggle preview mode (hardcoded full-set hand, no RNG refill). */
  setPreviewMode: (preview: boolean) => void;
  /** Seed the enemy hand from the living field enemies (battle start). */
  initializeEnemyDeck: () => void;
  /** RNG-refill the enemy hand to capacity, auto-merging (grants enemy gauge). */
  drawEnemyCards: () => void;
  /** Replace the enemy hand (the battle loop consumes cards as the AI plays). */
  setEnemyDeck: (deck: ActionCard[]) => void;
  selectCard: (cardId: string) => void;
  /** Resolve a pending single-ally card by queuing it against `allyInstanceId`. */
  confirmAllyTarget: (allyInstanceId: string) => void;
  /** Dismiss the ally chooser without queuing the card. */
  cancelAllyTarget: () => void;
  /** Fill an empty action slot with a plain pass (no card, no effect). */
  addNullAction: () => void;
  /** Remove one queued pass. */
  removeNullAction: () => void;
  deselectCard: (cardId: string) => void;
  reorderDeckCard: (draggedCardId: string, targetCardId: string) => void;
  mergeDeckCard: (cardId: string) => void;
  removeDeadCharacterCards: (instanceId: string) => void;
  setActionQueue: (queue: ActionCard[]) => void;
  snapshotHand: () => void;
  resetHand: () => void;
}

// Removes `deck[cardIndex]`, appends it to the queue with the resolved target,
// and rolls up any ult gauge granted by merges the removal exposed. Shared by
// selectCard (enemy/self targets) and confirmAllyTarget (ally target).
function buildQueueAppend(
  deck: ActionCard[],
  actionQueue: ActionCard[],
  playerTeam: BattleCharacter[],
  cardIndex: number,
  targetId: string | undefined,
): Partial<BattleState> {
  const card = deck[cardIndex];
  const newDeck = [...deck];
  newDeck.splice(cardIndex, 1);

  const mergeResult = applyAdjacentMerges(newDeck);
  let updatedTeam = playerTeam;
  if (mergeResult.mergeCount > 0) {
    updatedTeam = playerTeam.map((c) => {
      const gains = mergeResult.mergeSourceIds.filter(
        (sourceId) => sourceId === c.instanceId,
      ).length;
      if (gains <= 0) return c;
      return { ...c, ultGauge: Math.min(ultGaugeMax(c), c.ultGauge + gains) };
    });
  }

  return {
    deck: mergeResult.deck,
    playerTeam: updatedTeam,
    actionQueue: [...actionQueue, { ...card, targetInstanceId: targetId }],
    interactionNotice:
      mergeResult.mergeCount > 0 ? mergeResult.notices.join(" ") : null,
  };
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
  bigHitFocus: false,

  isPreview: false,
  deck: [],
  enemyDeck: [],
  actionQueue: [],
  selectedEnemyMarker: null,
  selectedAllyMarker: null,
  pendingAllyCardId: null,
  queuedNullCount: 0,
  interactionNotice: null,
  phaseBreak: null,
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
  setBigHitFocus: (focused) => set({ bigHitFocus: focused }),

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
      enemyDeck: [],
      actionQueue: [],
      selectedEnemyMarker: null,
      selectedAllyMarker: null,
      pendingAllyCardId: null,
      queuedNullCount: 0,
      interactionNotice: null,
      phaseBreak: null,
      handSnapshot: null,
      bigHitFocus: false,
      isPreview: false,
    }),

  setEnemyMarker: (instanceId) => set({ selectedEnemyMarker: instanceId }),
  setAllyMarker: (instanceId) => set({ selectedAllyMarker: instanceId }),
  setInteractionNotice: (message) => set({ interactionNotice: message }),
  clearInteractionNotice: () => set({ interactionNotice: null }),
  setPhaseBreak: (name, phase) =>
    set({ phaseBreak: { name, phase, key: Date.now() } }),
  clearPhaseBreak: () => set({ phaseBreak: null }),

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
      pendingAllyCardId: null,
      queuedNullCount: 0,
      interactionNotice: null,
    });
  },

  setPreviewMode: (preview) => set({ isPreview: preview }),

  initializeDeck: () => {
    const { playerTeam, isPreview } = get();
    // Subs contribute no cards until promoted to the field
    const living = playerTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    // Preview: hardcoded full rank/ultimate set; normal: one R1 card per skill.
    set({
      deck: isPreview ? previewCardsFor(living) : initialCardsFor(living),
      actionQueue: [],
    });
  },

  initializeEnemyDeck: () => {
    const { enemyTeam } = get();
    const living = enemyTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    set({ enemyDeck: initialCardsFor(living) });
  },

  setEnemyDeck: (deck) => set({ enemyDeck: deck }),

  drawEnemyCards: () => {
    const { enemyTeam, enemyDeck } = get();
    const living = enemyTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    const fieldCount = enemyTeam.filter((c) => !c.isSub).length;
    const maxCapacity = maxHandCapacity(fieldCount);
    if (enemyDeck.length >= maxCapacity || living.length === 0) return;

    const result = refillHand({
      hand: enemyDeck,
      livingUnits: living,
      maxCapacity,
      reservedCards: enemyDeck,
    });

    const updatedEnemies = enemyTeam.map((c) => {
      const gain = result.gaugeGains[c.instanceId] ?? 0;
      return gain > 0 ? { ...c, ultGauge: Math.min(ultGaugeMax(c), c.ultGauge + gain) } : c;
    });

    set({ enemyDeck: result.deck, enemyTeam: updatedEnemies });
  },

  drawCards: () => {
    const { playerTeam, deck, actionQueue, isPreview } = get();
    // Preview mode keeps its hardcoded full-set hand — never RNG-refill it.
    if (isPreview) return;
    // Subs contribute no cards until promoted to the field
    const livingChars = playerTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    const fieldCount = playerTeam.filter((c) => !c.isSub).length;
    const maxCapacity = maxHandCapacity(fieldCount);

    if (deck.length >= maxCapacity || livingChars.length === 0) return;

    // The hand is never reset: leftover cards persist and new cards are drawn
    // purely at random, auto-merging adjacent identical cards (each merge grants
    // that character +1 ult gauge). Shared with the enemy side via lib/game/deck.
    const result = refillHand({
      hand: deck,
      livingUnits: livingChars,
      maxCapacity,
      reservedCards: [...deck, ...actionQueue],
    });

    const updatedTeam = playerTeam.map((char) => {
      const gain = result.gaugeGains[char.instanceId] ?? 0;
      return gain > 0
        ? { ...char, ultGauge: Math.min(ultGaugeMax(char), char.ultGauge + gain) }
        : char;
    });

    set({
      deck: result.deck,
      playerTeam: updatedTeam,
      interactionNotice:
        result.mergeCount > 0
          ? `${result.notices.join(" ")} +${result.mergeCount} Ult Gauge.`
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
      queuedNullCount,
    } = get();
    if (actionQueue.length + queuedNullCount >= 3) {
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

      // Enemy marker is optional (ruling 2026-07-12): marked = focus fire,
      // unmarked = the engine picks a random living enemy at execution
      const markedEnemyIsAlive =
        selectedEnemyMarker &&
        aliveEnemies.some((e) => e.instanceId === selectedEnemyMarker);

      targetId = markedEnemyIsAlive ? selectedEnemyMarker : undefined;
    } else if (isSingleAllyTarget(card)) {
      // Single-target ally skills (e.g. Leorio's rank-1 Member of the Zodiac):
      // defer queuing and open the living-ally chooser modal. The card is
      // queued by confirmAllyTarget once the player picks. (Re-picking after
      // Reset Hand happens naturally — the card returns to the deck.)
      const aliveAllies = playerTeam.filter((p) => p.currentHP > 0 && !p.isSub);
      if (aliveAllies.length <= 0) {
        set({ interactionNotice: "No valid ally target available." });
        return;
      }
      set({ pendingAllyCardId: cardId, interactionNotice: null });
      return;
    } else {
      targetId = char?.instanceId;
    }

    // Leftover cards auto-merge if removing this one made identical neighbors
    // adjacent (each merge grants +1 ult gauge; Reset Hand reverses both).
    set(buildQueueAppend(deck, actionQueue, playerTeam, cardIndex, targetId));
  },

  confirmAllyTarget: (allyInstanceId: string) => {
    const { deck, actionQueue, playerTeam, pendingAllyCardId, queuedNullCount } =
      get();
    if (!pendingAllyCardId) return;
    const cardIndex = deck.findIndex((c) => c.id === pendingAllyCardId);
    if (cardIndex === -1) {
      set({ pendingAllyCardId: null });
      return;
    }
    if (actionQueue.length + queuedNullCount >= 3) {
      set({
        interactionNotice: "Action queue is full (3/3).",
        pendingAllyCardId: null,
      });
      return;
    }
    const ally = playerTeam.find(
      (p) => p.instanceId === allyInstanceId && p.currentHP > 0 && !p.isSub,
    );
    if (!ally) {
      set({ interactionNotice: "That ally is not a valid target." });
      return;
    }
    set({
      ...buildQueueAppend(deck, actionQueue, playerTeam, cardIndex, allyInstanceId),
      pendingAllyCardId: null,
    });
  },

  cancelAllyTarget: () => set({ pendingAllyCardId: null }),

  addNullAction: () => {
    const { actionQueue, queuedNullCount } = get();
    if (actionQueue.length + queuedNullCount >= 3) return;
    set({ queuedNullCount: queuedNullCount + 1, interactionNotice: null });
  },

  removeNullAction: () => {
    const { queuedNullCount } = get();
    if (queuedNullCount <= 0) return;
    set({ queuedNullCount: queuedNullCount - 1 });
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
        return { ...c, ultGauge: Math.min(ultGaugeMax(c), c.ultGauge + gains) };
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
        return { ...char, ultGauge: Math.min(ultGaugeMax(char), char.ultGauge + gains) };
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
        ? { ...char, ultGauge: Math.min(ultGaugeMax(char), char.ultGauge + 1) }
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
