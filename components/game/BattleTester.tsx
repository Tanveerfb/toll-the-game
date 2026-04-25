"use client";

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateDamage } from '@/lib/game/damage';
import { BattleCharacter } from '@/types/character';
import { MechanicType } from '@/types/mechanic';
import { Card, TextField, Label, Input } from '@heroui/react';

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
    <Card className="p-8 bg-zinc-900 text-white rounded-2xl w-full max-w-3xl mx-auto border border-zinc-800 shadow-2xl">
      <Card.Header className="border-b border-zinc-800 pb-4 mb-6">
        <Card.Title className="text-2xl font-heading tracking-wider">
          🧪 Mechanic Damage Visualizer
        </Card.Title>
      </Card.Header>
      
      <Card.Content>
        <div className="flex gap-8 mb-8">
          <TextField className="flex flex-col gap-2 flex-1">
            <Label className="text-sm text-zinc-500 font-semibold uppercase tracking-tighter">Base Skill Damage</Label>
            <Input 
              type="number" 
              value={baseDamage.toString()} 
              onChange={(e: any) => setBaseDamage(Number(e.target.value))}
              className="bg-zinc-800 border-zinc-700 p-2 rounded-lg"
            />
          </TextField>
          <TextField className="flex flex-col gap-2 flex-1">
            <Label className="text-sm text-zinc-500 font-semibold uppercase tracking-tighter">Target Defense</Label>
            <Input 
              type="number" 
              value={enemyDefense.toString()} 
              onChange={(e: any) => setEnemyDefense(Number(e.target.value))}
              className="bg-zinc-800 border-zinc-700 p-2 rounded-lg"
            />
          </TextField>
        </div>

        <div className="w-full h-[400px] mt-8 bg-black/20 rounded-xl p-4">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 10 }} 
                angle={-15} 
                textAnchor="end"
                height={60}
              />
              <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', color: '#fff', borderRadius: '8px', fontSize: '12px' }} 
                itemStyle={{ color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="damage" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card.Content>
    </Card>
  );
}
