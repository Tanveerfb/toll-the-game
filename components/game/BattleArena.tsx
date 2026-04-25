"use client";

import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { BattleCharacter } from '@/types/character';
import { ProgressBar, Card, Chip } from '@heroui/react';

export default function BattleArena() {
  const { playerTeam, enemyTeam, selectedEnemyMarker, setEnemyMarker } = useGameStore();

  const renderCharacter = (char: BattleCharacter, isEnemy: boolean) => {
    const isMarked = isEnemy && selectedEnemyMarker === char.instanceId;
    const hpPercent = (char.currentHP / char.hp) * 100;
    const ultPercent = (char.ultGauge / 5) * 100;
    const isDead = char.currentHP <= 0;

    return (
      <Card 
        key={char.instanceId}
        onClick={() => isEnemy && !isDead && setEnemyMarker(char.instanceId)}
        className={`
          relative w-40 h-64 rounded-xl border-2 transition-all duration-300
          ${isDead ? 'opacity-30 grayscale' : 'opacity-100'}
          ${isMarked ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] scale-105' : 'border-white/20'}
          ${isEnemy && !isDead ? 'cursor-crosshair hover:border-red-400' : 'cursor-default'}
          bg-black/60 backdrop-blur-md flex flex-col p-0 overflow-hidden
        `}
      >
        <Card.Content className="p-3 h-full flex flex-col">
          {isMarked && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
              🎯
            </div>
          )}
          
          <Card.Title className="text-center font-heading text-lg text-white mb-2 tracking-wider truncate">
            {char.name}
          </Card.Title>

          <div className="flex gap-1 flex-wrap mb-2 min-h-[20px]">
            {char.buffs.map((b, i) => (
              <Chip key={`buff-${i}`} variant="soft" color="success" size="sm" className="h-4 min-w-[16px] p-0 text-[8px] font-bold">
                ↑
              </Chip>
            ))}
            {char.debuffs.map((d, i) => (
              <Chip key={`debuff-${i}`} variant="soft" color="danger" size="sm" className="h-4 min-w-[16px] p-0 text-[8px] font-bold">
                ↓
              </Chip>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <ProgressBar value={char.currentHP} maxValue={char.hp} className="w-full">
              <ProgressBar.Track className="bg-zinc-900 h-4 border border-zinc-700 rounded-full overflow-hidden relative">
                <ProgressBar.Fill className="bg-gradient-to-r from-red-600 to-red-400" />
                <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold drop-shadow-md">
                  {char.currentHP} / {char.hp}
                </div>
              </ProgressBar.Track>
            </ProgressBar>

            <ProgressBar value={char.ultGauge} maxValue={5} className="w-full">
              <ProgressBar.Track className="bg-zinc-900 h-2 border border-zinc-700 rounded-full overflow-hidden">
                <ProgressBar.Fill className="bg-gradient-to-r from-amber-600 to-yellow-400" />
              </ProgressBar.Track>
            </ProgressBar>
            
            <div className="flex justify-between text-[10px] text-zinc-400 font-body px-1">
              <span>ATK: {char.currentAttack}</span>
              <span>DEF: {char.currentDefense}</span>
            </div>
          </div>
        </Card.Content>
      </Card>
    );
  };

  return (
    <div 
      className="min-h-screen flex flex-col relative pb-48"
      style={{
        backgroundImage: `url('/bg-images/vlcsnap-00001.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]" />

      <div className="relative z-10 flex-1 flex flex-col justify-between p-8">
        
        {/* Enemy Team (Top) */}
        <div className="flex justify-center gap-6 mt-8">
          {enemyTeam.map(char => renderCharacter(char, true))}
        </div>

        {/* Player Team (Bottom) */}
        <div className="flex justify-center gap-6 mb-12">
          {playerTeam.map(char => renderCharacter(char, false))}
        </div>

      </div>
    </div>
  );
}
