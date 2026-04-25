"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { getAllCharacters } from '@/lib/game/dataUtils';
import { useAuth } from '@/hooks/AuthProvider';
import { usePlayerStore } from '@/store/playerStore';
import { Button, Card, Chip } from '@heroui/react';

export default function ArchivePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { roster } = usePlayerStore();
  const characters = getAllCharacters();

  const colorStyles: Record<string, string> = {
    light: 'from-yellow-100 to-amber-200 border-amber-300 text-amber-900',
    red: 'from-red-900 to-red-700 border-red-500 text-red-100',
    blue: 'from-blue-900 to-blue-700 border-blue-500 text-blue-100',
    green: 'from-emerald-900 to-emerald-700 border-emerald-500 text-emerald-100',
    dark: 'from-purple-950 to-purple-900 border-purple-500 text-purple-100',
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans relative">
      <div className="fixed inset-0" style={{ backgroundImage: `url('/bg-images/vlcsnap-00001.png')`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-0" />

      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-white/20 pb-6">
          <h1 className="text-5xl font-heading tracking-wider">Character Archive</h1>
          <Button 
            variant="ghost"
            onPress={() => router.push('/')}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors border border-white/30"
          >
            BACK TO MENU
          </Button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {characters.map(char => {
            const isOwned = !user || roster.includes(char.id);
            
            return (
              <Card
                key={char.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => e.key === 'Enter' && router.push(`/archive/${char.id}`)}
                onClick={() => router.push(`/archive/${char.id}`)}
                className={`
                  relative rounded-2xl p-0 overflow-hidden transition-all duration-300 cursor-pointer group border border-white/10
                  ${isOwned ? 'hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'opacity-70 grayscale hover:grayscale-0'}
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${colorStyles[char.color] || 'from-zinc-800 to-zinc-900'} opacity-20 group-hover:opacity-40 transition-opacity`} />
                <Card.Content className="relative bg-black/60 backdrop-blur-md rounded-xl p-6 h-full flex flex-col items-center">
                  
                  {!isOwned && (
                    <div className="absolute top-4 right-4 bg-red-500/80 p-2 rounded-full text-xs shadow-lg backdrop-blur-md" title="Not yet unlocked">
                      🔒
                    </div>
                  )}

                  <div className={`w-24 h-24 rounded-full mb-4 border-4 bg-gradient-to-br flex items-center justify-center text-4xl shadow-inner ${colorStyles[char.color] || 'from-zinc-400 to-zinc-600'}`}>
                    {char.name.charAt(0)}
                  </div>
                  
                  <Card.Title className="text-2xl font-heading tracking-wide mb-1 text-center text-white">{char.name}</Card.Title>
                  
                  <div className="flex gap-2 mb-4">
                    <Chip 
                      variant="primary" 
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase bg-gradient-to-r ${colorStyles[char.color]}`}
                    >
                      {char.color}
                    </Chip>
                  </div>

                  <div className="w-full grid grid-cols-3 gap-2 text-center text-xs mt-auto font-body bg-black/40 rounded-lg p-2">
                    <div><div className="text-zinc-500 uppercase tracking-tighter">HP</div><div className="font-bold text-green-300">{char.hp}</div></div>
                    <div><div className="text-zinc-500 uppercase tracking-tighter">ATK</div><div className="font-bold text-red-300">{char.atk}</div></div>
                    <div><div className="text-zinc-500 uppercase tracking-tighter">DEF</div><div className="font-bold text-blue-300">{char.def}</div></div>
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
