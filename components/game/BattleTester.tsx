"use client";

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateDamage } from '@/lib/game/damage';
import { BattleCharacter } from '@/types/character';
import { MechanicType } from '@/types/mechanic';

export default function BattleTester() {
  const [baseDamage, setBaseDamage] = useState(100);
  const [enemyDefense, setEnemyDefense] = useState(50);
  
  const createMockEnemy = (ultGauge: number, igniteStacks: number, hasOtherDebuff: boolean): BattleCharacter => {
    const debuffs = [];
    if (igniteStacks > 0) {
      debuffs.push({ type: 'ignite' as MechanicType, stacks: igniteStacks });
    }
    if (hasOtherDebuff) {
      debuffs.push({ type: 'conditionalDebuff' as MechanicType });
    }
    
    return {
      id: "dummy",
      name: "Dummy Enemy",
      color: "light",
      atk: 0,
      def: 0,
      hp: 1000,
      skills: [] as any,
      instanceId: "dummy_1",
      currentHP: 1000,
      currentAttack: 0,
      currentDefense: enemyDefense,
      ultGauge: ultGauge,
      buffs: [],
      debuffs: debuffs as any,
      passiveState: {},
      team: "enemy"
    };
  };

  const chartData = useMemo(() => {
    // 1. Standard Attack
    const dmgStandard = calculateDamage({
      baseDamage,
      skillMechanics: [],
      target: createMockEnemy(0, 0, false)
    });

    // 2. Any Attack vs. 3 Ignite Stacks
    const dmgIgnite = calculateDamage({
      baseDamage,
      skillMechanics: [],
      target: createMockEnemy(0, 3, false)
    });

    // 3. Detonate Skill vs. 4 Ult Gauge
    const dmgDetonate = calculateDamage({
      baseDamage,
      skillMechanics: ["detonate"],
      target: createMockEnemy(4, 0, false)
    });

    // 4. Weakpoint Skill vs. 1 Debuff
    const dmgWeakpoint = calculateDamage({
      baseDamage,
      skillMechanics: ["weakpoint"],
      target: createMockEnemy(0, 0, true)
    });
    
    // 5. MAX STACKED: Weakpoint + Detonate vs 3 Ignite, 4 Ult Gauge, and Debuff
    const dmgStacked = calculateDamage({
      baseDamage,
      skillMechanics: ["weakpoint", "detonate"],
      target: createMockEnemy(4, 3, true)
    });

    return [
      { name: 'Standard (Base)', damage: dmgStandard, fill: '#8884d8' },
      { name: 'Vs 3 Ignite', damage: dmgIgnite, fill: '#ff7300' },
      { name: 'Detonate (4 Gauge)', damage: dmgDetonate, fill: '#82ca9d' },
      { name: 'Weakpoint (vs Debuff)', damage: dmgWeakpoint, fill: '#ff0000' },
      { name: 'Fully Stacked', damage: dmgStacked, fill: '#8a2be2' }
    ];
  }, [baseDamage, enemyDefense]);

  return (
    <div style={{ padding: '2rem', background: '#111', color: 'white', borderRadius: '1rem', width: '100%', maxWidth: '800px', margin: '0 auto', border: '1px solid #333' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
        🧪 Mechanic Damage Visualizer
      </h2>
      
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Base Skill Damage</label>
          <input 
            type="number" 
            value={baseDamage} 
            onChange={e => setBaseDamage(Number(e.target.value))}
            style={{ padding: '0.5rem', borderRadius: '6px', background: '#222', color: 'white', border: '1px solid #444', fontSize: '1.1rem' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Target Defense</label>
          <input 
            type="number" 
            value={enemyDefense} 
            onChange={e => setEnemyDefense(Number(e.target.value))}
            style={{ padding: '0.5rem', borderRadius: '6px', background: '#222', color: 'white', border: '1px solid #444', fontSize: '1.1rem' }}
          />
        </div>
      </div>

      <div style={{ width: '100%', height: 400, marginTop: '2rem' }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#888" 
              tick={{ fill: '#ccc', fontSize: 12 }} 
              angle={-15} 
              textAnchor="end"
              height={50}
            />
            <YAxis stroke="#888" tick={{ fill: '#ccc' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', color: '#fff', borderRadius: '8px' }} 
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="damage" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
