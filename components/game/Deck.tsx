import React from 'react';
import { useGameStore } from '@/store/gameStore';

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
    <div style={{ position: 'fixed', bottom: '0', left: '0', width: '100%', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', zIndex: 100 }}>
      
      {/* Action Queue */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', minHeight: '120px' }}>
        {actionQueue.map((card, i) => {
          const char = playerTeam.find(c => c.instanceId === card.sourceInstanceId);
          return (
            <div 
              key={card.id} 
              onClick={() => isPlayerActionPhase && deselectCard(card.id)}
              style={{
                width: '100px', height: '140px', background: '#333', border: '2px solid #aaa', borderRadius: '8px',
                cursor: isPlayerActionPhase ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', padding: '5px',
                transform: 'translateY(-10px)', transition: 'transform 0.2s'
              }}
              title="Click to Undo"
            >
              <div style={{ fontSize: '10px', color: '#ccc' }}>Action {i + 1}</div>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '5px' }}>{char?.name}</div>
              <div style={{ fontSize: '11px', marginTop: 'auto', color: card.skill.type === 'ultimate' ? 'gold' : 'white' }}>{card.skill.skillName}</div>
            </div>
          );
        })}
        {/* Placeholder for remaining actions */}
        {Array.from({ length: Math.max(0, 3 - actionQueue.length) }).map((_, i) => (
          <div key={`empty-${i}`} style={{ width: '100px', height: '140px', border: '2px dashed #555', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            Action {actionQueue.length + i + 1}
          </div>
        ))}
      </div>

      {/* Main Deck Dock */}
      <div style={{ display: 'flex', gap: '10px', background: 'rgba(20,20,20,0.8)', padding: '15px', borderRadius: '12px', border: '1px solid #444', minWidth: '600px' }}>
        {deck.map((card) => {
          const char = playerTeam.find(c => c.instanceId === card.sourceInstanceId);
          const isUlt = card.skill.type === "ultimate";
          const isStunned = char?.debuffs.some(d => d.type === "stun");
          return (
            <div 
              key={card.id}
              onClick={() => isPlayerActionPhase && !isStunned && selectCard(card.id)}
              style={{
                width: '90px', height: '130px', background: isUlt ? '#4a3f00' : '#222', border: `1px solid ${isUlt ? 'gold' : '#666'}`, borderRadius: '6px',
                cursor: isPlayerActionPhase && !isStunned ? 'pointer' : 'not-allowed',
                display: 'flex', flexDirection: 'column', padding: '5px',
                opacity: isPlayerActionPhase && !isStunned ? 1 : 0.5,
                position: 'relative',
                filter: isStunned ? 'grayscale(100%) brightness(0.5)' : 'none'
              }}
              title={`${isStunned ? 'STUNNED\n' : ''}${card.skill.skillName}\nType: ${card.skill.type}\nMultiplier: ${card.skill.type === 'ultimate' ? card.skill.damage : card.skill.damageRanked?.[0] || 0}%\n\n${card.skill.description || ''}`}
            >
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#aaa' }}>{char?.name}</div>
              <div style={{ fontSize: '10px', marginTop: 'auto', color: isUlt ? 'gold' : 'white' }}>{card.skill.skillName}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
