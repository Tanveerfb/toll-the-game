"use client";

import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { Card } from '@heroui/react';

export default function Deck() {
  const { 
    deck, 
    actionQueue, 
    selectCard, 
    deselectCard, 
    playerTeam,
    battlePhase
  } = useGameStore();

  const isPlayerActionPhase = battlePhase === "PlayerAction";

  return (
    <div className="fixed bottom-0 left-0 w-full p-5 flex flex-col items-center bg-gradient-to-t from-black/90 to-transparent z-[100]">
      
      {/* Action Queue */}
      <div className="flex gap-4 mb-8 min-h-[120px]">
        {actionQueue.map((card, i) => {
          const char = playerTeam.find(c => c.instanceId === card.sourceInstanceId);
          return (
            <Card 
              key={card.id} 
              onClick={() => isPlayerActionPhase && deselectCard(card.id)}
              className="w-[100px] h-[140px] bg-zinc-800 border-2 border-zinc-500 p-2 flex flex-col -translate-y-2 transition-transform cursor-pointer select-none"
            >
              <div className="text-[10px] text-zinc-400">Action {i + 1}</div>
              <div className="font-bold text-[12px] mt-1 text-white truncate">{char?.name}</div>
              <div className={`text-[11px] mt-auto font-semibold ${card.skill.type === 'ultimate' ? 'text-amber-400' : 'text-zinc-200'}`}>
                {card.skill.skillName}
              </div>
            </Card>
          );
        })}
        {/* Placeholder for remaining actions */}
        {Array.from({ length: Math.max(0, 3 - actionQueue.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="w-[100px] h-[140px] border-2 border-dashed border-zinc-700 rounded-xl flex items-center justify-center text-zinc-700 font-bold">
            {actionQueue.length + i + 1}
          </div>
        ))}
      </div>

      {/* Main Deck Dock */}
      <Card variant="secondary" className="flex flex-row gap-2 bg-black/80 p-4 border border-zinc-800 min-w-[600px] shadow-2xl backdrop-blur-md">
        {deck.map((card) => {
          const char = playerTeam.find(c => c.instanceId === card.sourceInstanceId);
          const isUlt = card.skill.type === "ultimate";
          const isStunned = char?.debuffs.some(d => d.type === "stun");
          
          return (
            <Card 
              key={card.id}
              onClick={() => isPlayerActionPhase && !isStunned && selectCard(card.id)}
              className={`
                w-[90px] h-[130px] p-2 flex flex-col transition-all relative select-none
                ${isUlt ? 'bg-amber-950/40 border-amber-500' : 'bg-zinc-900 border-zinc-700'}
                ${isPlayerActionPhase && !isStunned ? 'cursor-pointer hover:-translate-y-2 hover:shadow-lg' : 'cursor-not-allowed opacity-50'}
                ${isStunned ? 'grayscale brightness-50' : ''}
                border
              `}
            >
              <div className="font-bold text-[10px] text-zinc-500 truncate">{char?.name}</div>
              <div className={`text-[10px] mt-auto font-medium ${isUlt ? 'text-amber-400' : 'text-white'}`}>
                {card.skill.skillName}
              </div>
              {isStunned && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-[10px] font-bold text-white uppercase tracking-widest rounded-xl">
                  Stunned
                </div>
              )}
            </Card>
          );
        })}
      </Card>
    </div>
  );
}
