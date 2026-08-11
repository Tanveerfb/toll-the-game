import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
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
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { bonusActionsFor } from "@/lib/game/stageEffects";
import type { StageEffect } from "@/types/stageEffects";
import { useSettingsStore } from "./settingsStore";

export type SequencedBattleEvent = AnyBattleEvent & {
  id: number;
  /** Turn index the event landed in (0-based; UI shows turn + 1). */
  turn: number;
  /** Phase it landed in — distinguishes a player action from an enemy one for
   *  tick events, which carry no team of their own. */
  phase: BattlePhase;
};

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
  /** Encounter-level modifiers for this battle (stage effects). Empty = a
   *  standard fight, which is the default for everything. */
  stageEffects: StageEffect[];
  /** Chapter's early-out threshold. Set per battle launch; `undefined` is the
   *  ordinary fight-to-the-end rule. See lib/game/victoryCondition.ts. */
  victoryAtEnemyHpPercent?: number;
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
  /** How many `battleEvents` the sequencer has finished animating. The turn
   *  resolvers wait on this before executing the next action — see
   *  `lib/game/playback.ts`. */
  playedEvents: number;
  /** A sequencer is mounted and will actually animate. Without one (tests,
   *  the duel watcher, any headless caller) the resolvers must not wait. */
  playbackMounted: boolean;
  /**
   * HP as currently *shown*, keyed by instanceId — the sequencer's exact
   * per-event snapshots. Every HP readout on the battle screen reads this
   * before falling back to `currentHP`, so the tiles, the team dots and the
   * roster stacks can't disagree about whether a unit has died yet. Empty
   * between animations, when `currentHP` is the truth.
   */
  presentedHp: Record<string, number>;

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
  /**
   * Cards cancelled because the fight ended before they could fire, waiting to
   * be dealt back. They take PRIORITY over the random refill at the next turn
   * start rather than reappearing mid-turn (Tanveer, 2026-08-11).
   */
  pendingReturnCards: ActionCard[];

  // Actions
  setPlayerTeam: (team: BattleCharacter[]) => void;
  setEnemyTeam: (team: BattleCharacter[]) => void;
  updateTeams: (
    playerTeam: BattleCharacter[],
    enemyTeam: BattleCharacter[],
  ) => void;
  setStageEffects: (effects: StageEffect[]) => void;
  setVictoryAtEnemyHpPercent: (percent: number | undefined) => void;
  setCurrentTurn: (turn: number | ((prev: number) => number)) => void;
  setPlayerTurns: (turn: number | ((prev: number) => number)) => void;
  setEnemyTurns: (turn: number | ((prev: number) => number)) => void;
  setBattlePhase: (phase: BattlePhase) => void;
  addToBattleLog: (entry: string) => void;
  addBattleEvent: (event: AnyBattleEvent) => void;
  setBattleSpeed: (speed: number) => void;
  setBigHitFocus: (focused: boolean) => void;
  /** Sequencer → store: how many events have finished animating. */
  setPlayedEvents: (played: number) => void;
  /** Sequencer mount/unmount. */
  setPlaybackMounted: (mounted: boolean) => void;
  /** Sequencer → store: the HP to display while animating. */
  setPresentedHp: (
    hp:
      | Record<string, number>
      | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
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
  /** Ranks up every non-ultimate, sub-max-rank card belonging to `instanceId`
   * currently in the given team's hand by 1. Data-driven support for the
   * `rankUpOwnDeck` passive mechanic (Chiara) — called from BattleProvider,
   * which is the only layer with both team + deck state in scope. */
  rankUpCharacterCards: (instanceId: string, team: "player" | "enemy") => void;
  setActionQueue: (queue: ActionCard[]) => void;
  snapshotHand: () => void;
  resetHand: () => void;
  /** Put cancelled cards back in the hand. Used when a queued ultimate never
   *  got to fire because the fight ended first — see
   *  lib/game/targetRequirement.ts. */
  queueCardsForNextDraw: (cards: ActionCard[]) => void;
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

// Inert storage for non-browser contexts (SSR, tests) — persist stays a no-op
// there instead of crashing on an undefined sessionStorage.
const NOOP_STORAGE: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useGameStore = create<BattleState>()(
  persist(
    (set, get) => ({
  playerTeam: [],
  enemyTeam: [],
  stageEffects: [],
  currentTurn: 0,
  playerTurns: 0,
  enemyTurns: 0,
  battleLog: [],
  battleEvents: [],
  battlePhase: "initializing",
  // Seeded from the persisted settings slice so the player's chosen speed
  // survives across battles/reloads instead of resetting to 1x every time.
  battleSpeed: useSettingsStore.getState().battleSpeed,
  bigHitFocus: false,
  playedEvents: 0,
  playbackMounted: false,
  presentedHp: {},

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
  pendingReturnCards: [],

  setStageEffects: (effects) => set({ stageEffects: effects }),
  setVictoryAtEnemyHpPercent: (percent) =>
    set({ victoryAtEnemyHpPercent: percent }),
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
  // Stamped with the turn and phase it landed in. The engine has no reason to
  // know about either — they're presentation context — so they're attached
  // here rather than threaded through executeSkill's emitter.
  addBattleEvent: (event) =>
    set((state) => ({
      battleEvents: [
        ...state.battleEvents,
        {
          ...event,
          id: state.battleEvents.length + 1,
          turn: state.currentTurn,
          phase: state.battlePhase,
        },
      ],
    })),
  // Speed is a player preference — deliberately not reset by resetBattle,
  // and mirrored into the persisted settings slice so it survives reloads.
  setBattleSpeed: (speed) => {
    useSettingsStore.getState().setBattleSpeed(speed);
    set({ battleSpeed: speed });
  },
  setBigHitFocus: (focused) => set({ bigHitFocus: focused }),
  setPlayedEvents: (played) => set({ playedEvents: played }),
  setPlaybackMounted: (mounted) => set({ playbackMounted: mounted }),
  setPresentedHp: (hp) =>
    set((state) => ({
      presentedHp: typeof hp === "function" ? hp(state.presentedHp) : hp,
    })),

  resetBattle: () =>
    set({
      playerTeam: [],
      enemyTeam: [],
      stageEffects: [],
      victoryAtEnemyHpPercent: undefined,
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
      pendingReturnCards: [],
      bigHitFocus: false,
      // `playbackMounted` is deliberately NOT reset — it tracks whether an
      // arena is on screen, which a battle reset doesn't change.
      playedEvents: 0,
      presentedHp: {},
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

  queueCardsForNextDraw: (cards) => {
    if (cards.length === 0) return;
    const { pendingReturnCards, deck } = get();
    // Held, not dealt: they come back at the START of the next turn, ahead of
    // the random refill — not mid-turn into a hand the player is still
    // spending (Tanveer, 2026-08-11).
    const known = new Set([
      ...deck.map((c) => c.id),
      ...pendingReturnCards.map((c) => c.id),
    ]);
    const held = cards.filter((c) => !known.has(c.id));
    if (held.length === 0) return;
    set({ pendingReturnCards: [...pendingReturnCards, ...held] });
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
    const { playerTeam, actionQueue, isPreview, pendingReturnCards } = get();
    // Preview mode keeps its hardcoded full-set hand — never RNG-refill it.
    if (isPreview) return;
    // Subs contribute no cards until promoted to the field
    const livingChars = playerTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    const fieldCount = playerTeam.filter((c) => !c.isSub).length;
    const maxCapacity = maxHandCapacity(fieldCount);

    // Cancelled ultimates are dealt FIRST, ahead of the random refill — they
    // take priority for the seats available this turn. Only cards whose owner
    // is still on the field and alive; a returning card for a unit that died
    // in the meantime is simply dropped.
    let deck = get().deck;
    if (pendingReturnCards.length > 0) {
      const onField = new Set(livingChars.map((c) => c.instanceId));
      const seats = Math.max(0, maxCapacity - deck.length);
      const dealable = pendingReturnCards.filter((c) =>
        onField.has(c.sourceInstanceId),
      );
      const dealt = dealable.slice(0, seats);
      // Anything that didn't fit keeps waiting rather than being lost.
      const stillPending = pendingReturnCards.filter(
        (c) => onField.has(c.sourceInstanceId) && !dealt.includes(c),
      );
      deck = [...deck, ...dealt];
      set({ deck, pendingReturnCards: stillPending });
    }

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
    const cap = actionsForTurn(
      playerTeam,
      bonusActionsFor(get().stageEffects, "player"),
    );
    if (actionQueue.length + queuedNullCount >= cap) {
      set({ interactionNotice: `Action queue is full (${cap}/${cap}).` });
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
    const cap = actionsForTurn(
      playerTeam,
      bonusActionsFor(get().stageEffects, "player"),
    );
    if (actionQueue.length + queuedNullCount >= cap) {
      set({
        interactionNotice: `Action queue is full (${cap}/${cap}).`,
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
    const { actionQueue, queuedNullCount, playerTeam } = get();
    if (actionQueue.length + queuedNullCount >=
      actionsForTurn(playerTeam, bonusActionsFor(get().stageEffects, "player"))) return;
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

  rankUpCharacterCards: (instanceId: string, team: "player" | "enemy") => {
    const rankUp = (cards: ActionCard[]) =>
      cards.map((c) =>
        c.sourceInstanceId === instanceId &&
        c.skill.type !== "ultimate" &&
        c.rank < 3
          ? { ...c, rank: (c.rank + 1) as 1 | 2 | 3 }
          : c,
      );
    if (team === "player") {
      set({ deck: rankUp(get().deck) });
    } else {
      set({ enemyDeck: rankUp(get().enemyDeck) });
    }
  },
    }),
    {
      // Persist an in-progress battle to sessionStorage so a page reload or dev
      // HMR resumes it instead of dropping the player back to the menu. Cleared
      // when the tab closes (sessionStorage) — "persist for the session". The
      // transient animation/UI fields (battleEvents, bigHitFocus, phaseBreak,
      // interactionNotice) are deliberately NOT persisted so a resume doesn't
      // replay stale effects. Passive handlers live in MechanicProvider (not
      // serializable) and are re-registered on resume by BattleProvider.
      name: "toll-battle-session",
      // Real sessionStorage in the browser; an inert no-op everywhere else
      // (SSR, tests) so persist never touches an undefined storage.
      storage: createJSONStorage(() =>
        typeof window !== "undefined" && window.sessionStorage
          ? window.sessionStorage
          : NOOP_STORAGE,
      ),
      partialize: (state) => ({
        playerTeam: state.playerTeam,
        enemyTeam: state.enemyTeam,
        currentTurn: state.currentTurn,
        playerTurns: state.playerTurns,
        enemyTurns: state.enemyTurns,
        battleLog: state.battleLog,
        battlePhase: state.battlePhase,
        battleSpeed: state.battleSpeed,
        isPreview: state.isPreview,
        deck: state.deck,
        enemyDeck: state.enemyDeck,
        actionQueue: state.actionQueue,
        queuedNullCount: state.queuedNullCount,
        selectedEnemyMarker: state.selectedEnemyMarker,
        selectedAllyMarker: state.selectedAllyMarker,
        pendingAllyCardId: state.pendingAllyCardId,
        handSnapshot: state.handSnapshot,
      }),
      // Option A resume: if the tab reloaded mid-automated-phase (enemy turn or
      // a resolving sequence), snap back to the player's action and drop any
      // in-flight queued actions. Runs during hydration, before React renders,
      // so the phase machine never processes the stale automated phase. Battles
      // that were idle on the player's turn (or already over) resume untouched.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const phase = state.battlePhase;
        // A finished battle (victory/defeat) must not resume as a stale results
        // screen — reset to team select instead.
        if (phase === "victory" || phase === "defeat") {
          state.battlePhase = "initializing";
          state.playerTeam = [];
          state.enemyTeam = [];
          state.deck = [];
          state.enemyDeck = [];
          state.actionQueue = [];
          state.queuedNullCount = 0;
          return;
        }
        // An in-progress battle reloaded mid-automated-phase snaps back to the
        // player's action (Option A); one idle on the player's turn resumes as-is.
        if (phase !== "initializing" && phase !== "PlayerAction") {
          state.battlePhase = "PlayerAction";
          state.actionQueue = [];
          state.queuedNullCount = 0;
        }
      },
    },
  ),
);

// Dev console access for debugging battle state (stripped from prod builds)
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__gameStore = useGameStore;
}
