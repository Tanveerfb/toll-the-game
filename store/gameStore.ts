import { create } from 'zustand';
import { BattleCharacter } from '@/types/character';
import { BattlePhase } from '@/types/mechanic';

interface BattleState {
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  currentTurn: number;
  playerTurns: number;
  enemyTurns: number;
  battleLog: string[];
  battlePhase: BattlePhase;
  
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
}

export const useGameStore = create<BattleState>((set) => ({
  playerTeam: [],
  enemyTeam: [],
  currentTurn: 0,
  playerTurns: 0,
  enemyTurns: 0,
  battleLog: [],
  battlePhase: "initializing",
  
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
    battlePhase: "initializing"
  }),
}));
