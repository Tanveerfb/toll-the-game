import { create } from 'zustand';
import { BattleCharacter } from '@/types/character';
import { BattlePhase } from '@/types/mechanic';
import { ActionCard } from '@/types/action';

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

  // Actions
  setPlayerTeam: (team: BattleCharacter[]) => void;
  setEnemyTeam: (team: BattleCharacter[]) => void;
  updateTeams: (playerTeam: BattleCharacter[], enemyTeam: BattleCharacter[]) => void;
  setCurrentTurn: (turn: number | ((prev: number) => number)) => void;
  setPlayerTurns: (turn: number | ((prev: number) => number)) => void;
  setEnemyTurns: (turn: number | ((prev: number) => number)) => void;
  setBattlePhase: (phase: BattlePhase) => void;
  addToBattleLog: (entry: string) => void;
  resetBattle: () => void;

  // Deck Actions
  setEnemyMarker: (instanceId: string | null) => void;
  initializeDeck: () => void;
  drawCards: () => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
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

  setPlayerTeam: (team) => set({ playerTeam: team }),
  setEnemyTeam: (team) => set({ enemyTeam: team }),
  updateTeams: (playerTeam, enemyTeam) => set({ playerTeam, enemyTeam }),
  setCurrentTurn: (turn) => set((state) => ({ currentTurn: typeof turn === 'function' ? turn(state.currentTurn) : turn })),
  setPlayerTurns: (turn) => set((state) => ({ playerTurns: typeof turn === 'function' ? turn(state.playerTurns) : turn })),
  setEnemyTurns: (turn) => set((state) => ({ enemyTurns: typeof turn === 'function' ? turn(state.enemyTurns) : turn })),
  setBattlePhase: (phase) => set({ battlePhase: phase }),
  addToBattleLog: (entry) => set((state) => ({ battleLog: [...state.battleLog, entry] })),
  
  resetBattle: () => set({
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
  }),

  setEnemyMarker: (instanceId) => set({ selectedEnemyMarker: instanceId }),

  initializeDeck: () => {
    const { playerTeam } = get();
    const living = playerTeam.filter(c => c.currentHP > 0);
    const initialCards: ActionCard[] = [];
    
    living.forEach(c => {
      // 2 skills from each char
      c.skills.forEach(skill => {
        initialCards.push({
          id: Math.random().toString(36).substring(2, 9),
          sourceInstanceId: c.instanceId,
          skill
        });
      });
    });

    set({ deck: initialCards, actionQueue: [] });
  },

  drawCards: () => {
    const { playerTeam, deck, actionQueue } = get();
    const livingChars = playerTeam.filter(c => c.currentHP > 0);
    
    // Max amount is 4/5/7/8 for 1/2/3/4 characters
    const maxCapacityMap = [0, 4, 5, 7, 8];
    const maxCapacity = maxCapacityMap[playerTeam.length] || 8;
    const currentSpaces = maxCapacity - deck.length;

    if (currentSpaces <= 0) return;

    let pool: { charId: string, skill: any }[] = [];
    let guaranteedUlts: { charId: string, skill: any }[] = [];

    livingChars.forEach(c => {
      if (c.ultGauge >= 5 && c.ultimate) {
        const hasUltInHand = [...deck, ...actionQueue].some(card => card.sourceInstanceId === c.instanceId && card.skill.type === "ultimate");
        if (!hasUltInHand) {
            guaranteedUlts.push({ charId: c.instanceId, skill: c.ultimate });
        }
      }
      c.skills.forEach(s => {
        pool.push({ charId: c.instanceId, skill: s });
      });
    });

    const newCards: ActionCard[] = [];
    while(guaranteedUlts.length > 0 && newCards.length < currentSpaces) {
      const u = guaranteedUlts.shift()!;
      newCards.push({ id: Math.random().toString(36).substring(2, 9), sourceInstanceId: u.charId, skill: u.skill });
    }

    while(newCards.length < currentSpaces && pool.length > 0) {
      const randIdx = Math.floor(Math.random() * pool.length);
      const picked = pool[randIdx];
      newCards.push({ id: Math.random().toString(36).substring(2, 9), sourceInstanceId: picked.charId, skill: picked.skill });
    }

    set({ deck: [...deck, ...newCards] });
  },

  selectCard: (cardId: string) => {
    const { deck, actionQueue, enemyTeam, selectedEnemyMarker } = get();
    if (actionQueue.length >= 3) return;

    const cardIndex = deck.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = deck[cardIndex];
    const aliveEnemies = enemyTeam.filter(e => e.currentHP > 0);
    
    let targetId = selectedEnemyMarker;
    if (!targetId || !aliveEnemies.find(e => e.instanceId === targetId)) {
       if (aliveEnemies.length > 0) {
          targetId = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)].instanceId;
       }
    }

    const newDeck = [...deck];
    newDeck.splice(cardIndex, 1);

    set({
      deck: newDeck,
      actionQueue: [...actionQueue, { ...card, targetInstanceId: targetId }]
    });
  },

  deselectCard: (cardId: string) => {
    const { deck, actionQueue } = get();
    const cardIndex = actionQueue.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = actionQueue[cardIndex];
    const newQueue = [...actionQueue];
    newQueue.splice(cardIndex, 1);

    // Put it back at the end of the deck
    set({
      actionQueue: newQueue,
      deck: [...deck, card]
    });
  },

  removeDeadCharacterCards: (instanceId: string) => {
    const { deck, actionQueue } = get();
    set({
      deck: deck.filter(c => c.sourceInstanceId !== instanceId),
      actionQueue: actionQueue.filter(c => c.sourceInstanceId !== instanceId)
    });
  },

  clearActionQueue: () => set({ actionQueue: [] })
}));
