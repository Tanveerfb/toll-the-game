"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase, Mechanic } from "@/types/mechanic";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";

interface BattleState {
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  currentTurn: number;
  playerTurns: number;
  enemyTurns: number;
  battleLog: string[];
  addToBattleLog: (entry: string) => void;
  resetBattle: () => void;
  battlePhase: BattlePhase;
  advancePhase: () => void;
  startDukeTest: () => void;
}

interface TurnActions {
  action1: SkillCard | UltimateCard | null;
  action2: SkillCard | UltimateCard | null;
  action3: SkillCard | UltimateCard | null;
}

const BattleContext = React.createContext<BattleState | undefined>(undefined);

export function useBattleContext() {
  const context = React.useContext(BattleContext);
  if (!context) {
    throw new Error("useBattleContext must be used within a BattleProvider");
  }
  return context;
}

export default function BattleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { processQueue, registerToQueue } = useMechanicContext();
  const [playerTeam, setPlayerTeam] = React.useState<BattleCharacter[]>([]);
  const [enemyTeam, setEnemyTeam] = React.useState<BattleCharacter[]>([]);
  const [currentTurn, setCurrentTurn] = React.useState(0);
  const [playerTurns, setPlayerTurns] = React.useState(0);
  const [enemyTurns, setEnemyTurns] = React.useState(0);
  const [battleLog, setBattleLog] = React.useState<string[]>([]);
  const [battlePhase, setBattlePhase] = React.useState<BattlePhase>("initializing");

  // Track if we are currently looping automated phases so we don't double trigger
  const phaseRef = React.useRef(battlePhase);
  phaseRef.current = battlePhase;

  function addToBattleLog(entry: string) {
    console.log("[BattleLog]", entry);
    setBattleLog((prevLog) => [...prevLog, entry]);
  }

  function resetBattle() {
    setPlayerTeam([]);
    setEnemyTeam([]);
    setCurrentTurn(0);
    setPlayerTurns(0);
    setEnemyTurns(0);
    setBattleLog([]);
    setBattlePhase("initializing");
  }

  const advancePhase = () => {
    switch (phaseRef.current) {
      case "initializing":
        setBattlePhase("OnBattleStart");
        break;
      case "OnBattleStart":
        setBattlePhase("OnPlayerTurnStart");
        break;
      case "OnPlayerTurnStart":
        setBattlePhase("PlayerAction"); // Stops processing queues, waits for players
        break;
      case "PlayerAction":
        setBattlePhase("OnPlayerTurnEnd");
        break;
      case "OnPlayerTurnEnd":
        setBattlePhase("OnEnemyTurnStart");
        break;
      case "OnEnemyTurnStart":
        setBattlePhase("EnemyAction"); // Stops processing queues, waits for AI
        break;
      case "EnemyAction":
        setBattlePhase("OnEnemyTurnEnd");
        break;
      case "OnEnemyTurnEnd":
        setCurrentTurn((prev) => prev + 1);
        setBattlePhase("OnPlayerTurnStart"); // Loops endlessly until battle stops
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    async function handlePhase() {
      // Auto-running phases: queues activate, and we skip straight to the next phase after queue is clear.
      const automatedPhases: BattlePhase[] = [
        "OnBattleStart",
        "OnPlayerTurnStart",
        "OnPlayerTurnEnd",
        "OnEnemyTurnStart",
        "OnEnemyTurnEnd"
      ];

      if (automatedPhases.includes(battlePhase)) {
        // Run any registered events for this phase
        const updatedTeams = await processQueue(
          battlePhase,
          { playerTeam, enemyTeam },
          addToBattleLog
        );
        
        // Sync modified states
        setPlayerTeam(updatedTeams.playerTeam);
        setEnemyTeam(updatedTeams.enemyTeam);
        
        // We add artificial UI delay so state update renders before next phase starts processing
        setTimeout(() => advancePhase(), 500);
      }
    }

    handlePhase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePhase]);

  function resolveplayerTurnWrapper(playerActions: TurnActions) {
    if (battlePhase !== "PlayerAction") return;
    Object.values(playerActions).forEach((action) => {
      if (action) {
        addToBattleLog(`Player used ${action.skillName}`);
      }
    });
    setPlayerTurns((prev) => prev + 1);
    advancePhase(); // Action complete, let mechanics resume (OnPlayerTurnEnd)
  }

  function resolveEnemyTurnWrapper(actionName: string) {
    if (battlePhase !== "EnemyAction") return;
    addToBattleLog(`Enemy used ${actionName}`);
    setEnemyTurns((prev) => prev + 1);
    advancePhase();
  }

  const registerDukePassive = (character: BattleCharacter, phase: BattlePhase) => {
    registerToQueue({
      id: `${character.instanceId}_passive`,
      phase: phase,
      sourceInstanceId: character.instanceId,
      mechanicId: "duke_all_stats_up",
      action: async (source, teams, log) => {
        const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
        const mutateTeam = [...teams[teamKey]];
        const targetIdx = mutateTeam.findIndex(c => c.instanceId === source.instanceId);
        
        if (targetIdx !== -1) {
          const t = { ...mutateTeam[targetIdx] };
          t.currentAttack = Math.floor(t.currentAttack * 1.1);
          t.currentDefense = Math.floor(t.currentDefense * 1.1);
          t.currentHP = Math.floor(t.currentHP * 1.1);
          mutateTeam[targetIdx] = t;
          log(`Duke (${source.team}) passive triggered! Stats grew by 10%. (ATK: ${t.currentAttack}, DEF: ${t.currentDefense}, HP: ${t.currentHP})`);
        }

        return { ...teams, [teamKey]: mutateTeam };
      }
    });
  }

  const startDukeTest = () => {
    resetBattle();
    const createDuke = (team: "player" | "enemy", id: string): BattleCharacter => ({
      id: "duke_base",
      instanceId: id,
      name: "Duke",
      color: "light",
      atk: 100,
      def: 50,
      hp: 1000,
      currentAttack: 100,
      currentDefense: 50,
      currentHP: 1000,
      skills: [
        { skillName: "Strike", statMultiplier: "atk", damageRanked: [10, 20, 30], characterId: "duke", type: "attack" },
        { skillName: "Guard", statMultiplier: "def", damageRanked: [5, 10, 15], characterId: "duke", type: "buff" }
      ],
      buffs: [],
      debuffs: [],
      passiveState: {},
      team
    });

    const playerDuke = createDuke("player", "p1_duke");
    const enemyDuke = createDuke("enemy", "e1_duke");

    setPlayerTeam([playerDuke]);
    setEnemyTeam([enemyDuke]);
    
    // As per instruction, Duke passive triggers at the END of his respective turn
    registerDukePassive(playerDuke, "OnPlayerTurnEnd");
    registerDukePassive(enemyDuke, "OnEnemyTurnEnd");

    addToBattleLog("--- DUKE 1v1 EVENT LOOP TEST STARTED ---");
    setTimeout(() => {
        setBattlePhase("OnBattleStart");
    }, 500);
  };

  return (
    <BattleContext.Provider
      value={{
        playerTeam,
        enemyTeam,
        currentTurn,
        playerTurns,
        enemyTurns,
        battleLog,
        addToBattleLog,
        resetBattle,
        battlePhase,
        advancePhase,
        startDukeTest,
      }}
    >
      {/* Test Buttons - can be removed later */}
      <div style={{ position: 'fixed', bottom: 10, right: 10, background: '#111', color: 'white', padding: 10, zIndex: 999 }}>
        <p>Phase: {battlePhase}</p>
        <button onClick={startDukeTest} style={{marginRight: '5px'}}>Start Duke Test</button>
        <button onClick={() => resolveplayerTurnWrapper({action1: {skillName: 'Test', statMultiplier: "atk", damageRanked: [0,0,0], characterId: "none", type: "attack"}, action2: null, action3: null})} disabled={battlePhase !== "PlayerAction"}>End Player Action</button>
        <button onClick={() => resolveEnemyTurnWrapper('Test')} disabled={battlePhase !== "EnemyAction"}>End Enemy Action</button>
      </div>

      {children}
    </BattleContext.Provider>
  );
}
