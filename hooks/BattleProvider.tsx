"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase, Mechanic } from "@/types/mechanic";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";
import { useGameStore } from "@/store/gameStore";
import { TurnActions, Action } from "@/types/action";
import { executeSkill } from "@/lib/game/combat";
import { getAIMoves } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";

interface BattleContextType {
  advancePhase: () => void;
  startDukeTest: () => void;
  startFullTest: () => void;
  resolveplayerTurnWrapper: (actions: TurnActions) => void;
  resolveEnemyTurnWrapper: () => void;
}

const BattleContext = React.createContext<BattleContextType | undefined>(undefined);

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

  const store = useGameStore();
  const {
    playerTeam, enemyTeam, battlePhase,
    updateTeams, setBattlePhase, setCurrentTurn,
    setPlayerTurns, setEnemyTurns, resetBattle, addToBattleLog
  } = store;

  const phaseRef = React.useRef(battlePhase);
  phaseRef.current = battlePhase;

  const advancePhase = () => {
    switch (phaseRef.current) {
      case "initializing":
        setBattlePhase("OnBattleStart");
        break;
      case "OnBattleStart":
        setBattlePhase("OnPlayerTurnStart");
        break;
      case "OnPlayerTurnStart":
        setBattlePhase("PlayerAction");
        break;
      case "PlayerAction":
        setBattlePhase("OnPlayerTurnEnd");
        break;
      case "OnPlayerTurnEnd":
        setBattlePhase("OnEnemyTurnStart");
        break;
      case "OnEnemyTurnStart":
        setBattlePhase("EnemyAction");
        break;
      case "EnemyAction":
        setBattlePhase("OnEnemyTurnEnd");
        break;
      case "OnEnemyTurnEnd":
        setCurrentTurn((prev) => prev + 1);
        setBattlePhase("OnPlayerTurnStart");
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    async function handlePhase() {
      const automatedPhases: BattlePhase[] = [
        "OnBattleStart",
        "OnPlayerTurnStart",
        "OnPlayerTurnEnd",
        "OnEnemyTurnStart",
        "OnEnemyTurnEnd"
      ];

      if (automatedPhases.includes(battlePhase)) {
        let currentTeams = { playerTeam, enemyTeam };

        // System Ticks (Buff/Debuff durations, DoT/HoT)
        if (battlePhase === "OnPlayerTurnStart" || battlePhase === "OnEnemyTurnStart") {
          const teamKey = battlePhase === "OnPlayerTurnStart" ? "playerTeam" : "enemyTeam";
          const teamToTick = [...currentTeams[teamKey]];

          for (let i = 0; i < teamToTick.length; i++) {
            let char = { ...teamToTick[i] };
            if (char.currentHP <= 0) continue;

            // Reset action-specific passive flags
            char.passiveState.firstActionTriggeredThisTurn = false;

            // Apply DoT
            const dotEffects = char.debuffs.filter(d => d.type === "damageOverTime" || d.type === "decay");
            let totalDot = 0;
            dotEffects.forEach(dot => {
              if (dot.type === "decay" && dot.capturedDamage) {
                totalDot += dot.capturedDamage;
              } else if (dot.value) {
                totalDot += dot.value;
              }
            });
            if (totalDot > 0) {
              char.currentHP = Math.max(0, char.currentHP - totalDot);
              addToBattleLog(`[System] ${char.name} takes ${totalDot} damage from DoT.`);
            }

            // Apply HoT
            const hotEffects = char.buffs.filter(b => b.type === "healOverTime");
            let totalHot = 0;
            hotEffects.forEach(hot => {
              if (hot.value) totalHot += hot.value;
            });
            if (totalHot > 0) {
              char.currentHP = Math.min(char.hp, char.currentHP + totalHot);
              addToBattleLog(`[System] ${char.name} heals ${totalHot} HP from HoT.`);
            }

            // Tick down durations
            char.buffs = char.buffs.map(b => ({ ...b, buffDuration: b.buffDuration ? b.buffDuration - 1 : undefined })).filter(b => b.buffDuration === undefined || b.buffDuration > 0);
            char.debuffs = char.debuffs.map(d => ({ ...d, debuffDuration: d.debuffDuration ? d.debuffDuration - 1 : undefined })).filter(d => d.debuffDuration === undefined || d.debuffDuration > 0);

            teamToTick[i] = char;
          }
          currentTeams = { ...currentTeams, [teamKey]: teamToTick };
        }

        // Run any registered events for this phase
        const updatedTeams = await processQueue(
          battlePhase,
          currentTeams,
          addToBattleLog
        );

        // Sync modified states to Zustand
        updateTeams(updatedTeams.playerTeam, updatedTeams.enemyTeam);

        // Check for victory/defeat
        const allEnemiesDead = updatedTeams.enemyTeam.every(e => e.currentHP <= 0);
        const allPlayersDead = updatedTeams.playerTeam.every(p => p.currentHP <= 0);

        if (allEnemiesDead && updatedTeams.enemyTeam.length > 0) {
          setBattlePhase("victory");
          addToBattleLog("VICTORY!");
          return;
        } else if (allPlayersDead && updatedTeams.playerTeam.length > 0) {
          setBattlePhase("defeat");
          addToBattleLog("DEFEAT...");
          return;
        }

        setTimeout(() => advancePhase(), 500);
      }
    }

    handlePhase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePhase]);

  function resolveplayerTurnWrapper(playerActions: TurnActions) {
    if (battlePhase !== "PlayerAction") return;

    let currentTeams = { playerTeam, enemyTeam };

    playerActions.forEach((action, index) => {
      if (action) {
        currentTeams = executeSkill(action, currentTeams, addToBattleLog, index);
      }
    });

    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    setPlayerTurns((prev) => prev + 1);
    advancePhase();
  }

  function resolveEnemyTurnWrapper() {
    if (battlePhase !== "EnemyAction") return;

    const enemyActions = getAIMoves(enemyTeam, playerTeam);
    let currentTeams = { playerTeam, enemyTeam };

    enemyActions.forEach((action, index) => {
      if (action) {
        currentTeams = executeSkill(action, currentTeams, addToBattleLog, index);
      }
    });

    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    setEnemyTurns((prev) => prev + 1);
    advancePhase();
  }

  // Helper to load raw JSON
  const loadChar = (id: string) => require(`@/data/characters/${id}.json`);

  const startFullTest = () => {
    resetBattle();
    
    const dukeRaw = loadChar("duke");
    const lyraRaw = loadChar("lyra");
    const taoRaw = loadChar("master_tao");

    const buildBattleChar = (raw: any, team: "player" | "enemy", instanceId: string): BattleCharacter => ({
      ...raw,
      instanceId,
      currentAttack: raw.atk,
      currentDefense: raw.def,
      currentHP: raw.hp,
      ultGauge: 0,
      buffs: [],
      debuffs: [],
      passiveState: {},
      team
    });

    const pDuke = buildBattleChar(dukeRaw, "player", "p1_duke");
    const pLyra = buildBattleChar(lyraRaw, "player", "p2_lyra");
    const eTao = buildBattleChar(taoRaw, "enemy", "e1_tao");

    registerCharacterPassives(pDuke, registerToQueue);
    registerCharacterPassives(pLyra, registerToQueue);
    registerCharacterPassives(eTao, registerToQueue);

    updateTeams([pDuke, pLyra], [eTao]);

    addToBattleLog("--- 2v1 EVENT LOOP TEST STARTED ---");
    setTimeout(() => {
      setBattlePhase("OnBattleStart");
    }, 500);
  };

  const startDukeTest = () => {
     // Kept for fallback, but full test is preferred
     startFullTest();
  };

  // Safe fallback for UI actions to prevent crashing if empty
  const defaultPlayerAction: Action = {
    sourceInstanceId: playerTeam[0]?.instanceId || "",
    skill: playerTeam[0]?.skills[0] || { skillName: "Missing", statMultiplier: "atk", damageRanked: [0, 0, 0], characterId: "none", type: "attack" },
    targetInstanceId: enemyTeam[0]?.instanceId || ""
  };

  const renderCharStats = (c: BattleCharacter) => (
    <div key={c.instanceId} style={{ border: '1px solid #444', padding: '5px', marginBottom: '5px', fontSize: '11px', background: 'rgba(20,20,20,0.8)' }}>
      <strong>{c.name} ({c.team})</strong><br/>
      HP: {c.currentHP}/{c.hp} | ATK: {c.currentAttack} | DEF: {c.currentDefense}<br/>
      {c.passive && <span>Passive: {c.passive.name} <br/></span>}
      State: {JSON.stringify(c.passiveState)}<br/>
      Buffs: {c.buffs.map(b=>b.type).join(', ') || 'None'} <br/>
      Debuffs: {c.debuffs.map(d=>`${d.type}(${d.stacks || 1})`).join(', ') || 'None'}
    </div>
  );

  return (
    <BattleContext.Provider
      value={{
        advancePhase,
        startDukeTest,
        startFullTest,
        resolveplayerTurnWrapper,
        resolveEnemyTurnWrapper
      }}
    >
      <div style={{ position: 'fixed', bottom: 10, right: 10, background: '#111', color: 'white', padding: '10px', zIndex: 999, display: 'flex', gap: '10px', alignItems: 'flex-end', maxWidth: '100vw', overflowX: 'auto' }}>
        
        {/* Teams Status */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div>
            <div style={{fontWeight: 'bold', marginBottom: '5px'}}>Player Team</div>
            {playerTeam.map(renderCharStats)}
          </div>
          <div>
            <div style={{fontWeight: 'bold', marginBottom: '5px'}}>Enemy Team</div>
            {enemyTeam.map(renderCharStats)}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Phase: {store.battlePhase}</div>
          <button onClick={startFullTest} style={{ padding: '5px', background: '#333', color: 'white', border: '1px solid #555' }}>Start Test</button>
          <button
            onClick={() => resolveplayerTurnWrapper([defaultPlayerAction])}
            disabled={store.battlePhase !== "PlayerAction" || playerTeam.length === 0}
            style={{ padding: '5px', background: store.battlePhase === "PlayerAction" ? '#006600' : '#333', color: 'white', border: '1px solid #555' }}
          >
            End Player Action
          </button>
          <button
            onClick={resolveEnemyTurnWrapper}
            disabled={store.battlePhase !== "EnemyAction"}
            style={{ padding: '5px', background: store.battlePhase === "EnemyAction" ? '#660000' : '#333', color: 'white', border: '1px solid #555' }}
          >
            End Enemy Action
          </button>
        </div>

        {/* Logs */}
        <div style={{ background: 'rgba(0,0,0,0.8)', color: 'lime', padding: '10px', maxHeight: '200px', overflowY: 'auto', width: '300px', fontSize: '11px', border: '1px solid #444' }}>
          <div style={{fontWeight: 'bold', marginBottom: '5px'}}>Battle Log</div>
          {store.battleLog.slice(-20).map((l, i) => <div key={i}>{l}</div>)}
        </div>

      </div>

      {children}
    </BattleContext.Provider>
  );
}
