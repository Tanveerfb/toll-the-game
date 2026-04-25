import React from 'react';
import { getCharacterData, getAllCharacters } from '@/lib/game/dataUtils';
import KeywordHighlighter from '@/components/ui/KeywordHighlighter';
import NextLink from 'next/link';
import { Card, Chip, ProgressBar, Label, Button, Link } from '@heroui/react';

export async function generateStaticParams() {
  const characters = getAllCharacters();
  return characters.map((char) => ({
    id: char.id,
  }));
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const char = getCharacterData(resolvedParams.id);

  if (!char) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-heading">Character Not Found</h1>
        <NextLink href="/archive">
          <Button variant="outline">
            Back to Archive
          </Button>
        </NextLink>
      </div>
    );
  }

  const colorStyles: Record<string, { bg: string, text: string, accent: string, glow: string, mesh: string }> = {
    light: { 
      bg: 'from-amber-400/20 to-yellow-600/20', 
      text: 'text-amber-100', 
      accent: 'bg-amber-500',
      glow: 'shadow-[0_0_40px_rgba(245,158,11,0.5)]',
      mesh: 'bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.2),transparent_70%)]'
    },
    red: { 
      bg: 'from-red-600/20 to-rose-900/20', 
      text: 'text-red-100', 
      accent: 'bg-red-600',
      glow: 'shadow-[0_0_40px_rgba(220,38,38,0.5)]',
      mesh: 'bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.2),transparent_70%)]'
    },
    blue: { 
      bg: 'from-blue-600/20 to-indigo-900/20', 
      text: 'text-blue-100', 
      accent: 'bg-blue-600',
      glow: 'shadow-[0_0_40px_rgba(37,99,235,0.5)]',
      mesh: 'bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.2),transparent_70%)]'
    },
    green: { 
      bg: 'from-emerald-600/20 to-teal-900/20', 
      text: 'text-emerald-100', 
      accent: 'bg-emerald-600',
      glow: 'shadow-[0_0_40px_rgba(16,185,129,0.5)]',
      mesh: 'bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.2),transparent_70%)]'
    },
    dark: { 
      bg: 'from-purple-600/20 to-zinc-900/20', 
      text: 'text-purple-100', 
      accent: 'bg-purple-700',
      glow: 'shadow-[0_0_40px_rgba(126,34,206,0.5)]',
      mesh: 'bg-[radial-gradient(circle_at_50%_50%,rgba(126,34,206,0.2),transparent_70%)]'
    },
  };

  const theme = colorStyles[char.color] || colorStyles.light;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative overflow-x-hidden selection:bg-amber-500/30">
      {/* Premium Background Layers */}
      <div className={`fixed inset-0 bg-gradient-to-br ${theme.bg} opacity-40`} />
      <div className={`fixed inset-0 ${theme.mesh} opacity-50`} />
      <div className="fixed inset-0 bg-[url('/bg-images/grid-pattern.png')] opacity-10 bg-[length:50px_50px]" />
      <div className="fixed inset-0 bg-radial-gradient from-transparent via-black/60 to-black pointer-events-none" />
      <div className="fixed inset-0 bg-[url('/bg-images/vlcsnap-00001.png')] bg-cover bg-center opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:px-8">
        <div className="mb-16 flex justify-between items-center">
          <NextLink href="/archive" className="group">
            <Button 
              variant="ghost" 
              className="group text-zinc-500 hover:text-white transition-all flex items-center gap-4 px-0 bg-transparent border-none"
            >
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/40 transition-all">
                <span className="group-hover:-translate-x-1 transition-transform text-lg">←</span>
              </div>
              <span className="font-bold tracking-[0.3em] text-[10px] uppercase opacity-60 group-hover:opacity-100">The Archive / Collection</span>
            </Button>
          </NextLink>

          <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse delay-150" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse delay-300" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* Left Column: Character Profile */}
          <div className="lg:col-span-5 space-y-12">
            <div className="relative">
              <div className={`absolute -inset-4 rounded-[3rem] ${theme.mesh} blur-3xl opacity-40`} />
              <Card className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative z-10">
                <div className={`aspect-[4/5] w-full bg-gradient-to-br ${theme.bg} flex items-center justify-center relative group`}>
                  <div className={`absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-90`} />
                  
                  {/* Character Visual */}
                  <div className="relative">
                    <span className={`text-[14rem] font-heading select-none group-hover:scale-105 transition-transform duration-700 leading-none ${theme.glow.includes('amber') ? 'text-amber-400' : theme.glow.includes('red') ? 'text-red-400' : theme.glow.includes('blue') ? 'text-blue-400' : theme.glow.includes('emerald') ? 'text-emerald-400' : 'text-purple-400'}`}>
                      {char.name.charAt(0)}
                    </span>
                    <div className={`absolute inset-0 blur-2xl opacity-40 ${theme.accent}`} />
                  </div>
                  
                  {/* Floating Tags */}
                  <div className="absolute bottom-12 left-10 right-10">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap gap-2">
                        <Chip 
                          variant="primary" 
                          className={`${theme.accent} shadow-2xl border-none font-black text-[9px] tracking-[0.25em] uppercase px-4 py-1.5 rounded-full text-white`}
                        >
                          {char.color}
                        </Chip>
                        {char.tags?.map(tag => (
                          <Chip 
                            key={tag} 
                            variant="secondary" 
                            className="bg-white/10 backdrop-blur-xl border border-white/20 font-bold text-[9px] tracking-[0.25em] uppercase px-4 py-1.5 rounded-full text-zinc-300"
                          >
                            {tag}
                          </Chip>
                        ))}
                      </div>
                      <h1 className="text-7xl font-heading tracking-tight text-white drop-shadow-2xl">{char.name}</h1>
                    </div>
                  </div>
                </div>
                
                <Card.Content className="p-10 pt-4 bg-[#050505]/40">
                  <div className="space-y-8">
                    {/* Stats Header */}
                    <div className="flex justify-between items-end border-b border-white/5 pb-4">
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Combat Rating</p>
                        <h3 className="text-2xl font-heading text-white">Advanced Unit</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Status</p>
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          OPERATIONAL
                        </span>
                      </div>
                    </div>

                    {/* Enhanced Stats */}
                    <div className="grid grid-cols-1 gap-6">
                      <div className="group/stat">
                        <div className="flex justify-between items-end mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] group-hover/stat:text-white transition-colors">Vitality Output</Label>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500 text-[8px] font-bold mr-2 opacity-40">MAX 5000</span>
                            <ProgressBar.Output className="text-emerald-400 font-bold text-lg tabular-nums tracking-tighter">{char.hp}</ProgressBar.Output>
                          </div>
                        </div>
                        <ProgressBar value={char.hp} maxValue={5000} className="w-full">
                          <ProgressBar.Track className="bg-white/5 h-1 rounded-full overflow-hidden">
                            <ProgressBar.Fill className="bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.4)]" />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>

                      <div className="group/stat">
                        <div className="flex justify-between items-end mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] group-hover/stat:text-white transition-colors">Lethality Index</Label>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500 text-[8px] font-bold mr-2 opacity-40">MAX 1000</span>
                            <ProgressBar.Output className="text-red-400 font-bold text-lg tabular-nums tracking-tighter">{char.atk}</ProgressBar.Output>
                          </div>
                        </div>
                        <ProgressBar value={char.atk} maxValue={1000} className="w-full">
                          <ProgressBar.Track className="bg-white/5 h-1 rounded-full overflow-hidden">
                            <ProgressBar.Fill className="bg-gradient-to-r from-red-600 to-red-400 rounded-full shadow-[0_0_15px_rgba(248,113,113,0.4)]" />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>

                      <div className="group/stat">
                        <div className="flex justify-between items-end mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] group-hover/stat:text-white transition-colors">Fortification</Label>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500 text-[8px] font-bold mr-2 opacity-40">MAX 1000</span>
                            <ProgressBar.Output className="text-blue-400 font-bold text-lg tabular-nums tracking-tighter">{char.def}</ProgressBar.Output>
                          </div>
                        </div>
                        <ProgressBar value={char.def} maxValue={1000} className="w-full">
                          <ProgressBar.Track className="bg-white/5 h-1 rounded-full overflow-hidden">
                            <ProgressBar.Fill className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,0.4)]" />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            </div>

            {/* Passive Ability - Reimagined */}
            {char.passive && (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <Card className="bg-[#080808] backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative z-10 transition-all duration-500 group-hover:border-white/20">
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-black text-2xl font-black shadow-[0_0_30px_rgba(245,158,11,0.3)] shrink-0">
                      P
                    </div>
                    <div>
                      <Label className="text-amber-500/60 text-[10px] font-black uppercase tracking-[0.3em] block mb-2">Passive Augmentation</Label>
                      <Card.Title className="text-3xl font-heading text-white mb-4">{char.passive.name}</Card.Title>
                      <div className="text-zinc-400 leading-relaxed text-sm font-medium opacity-80 border-l-2 border-amber-500/20 pl-4 py-1">
                        <KeywordHighlighter text={char.passive.description || ""} />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Right Column: Combat Kit */}
          <div className="lg:col-span-7 space-y-12">
            <div className="relative">
              <h2 className="text-8xl font-heading tracking-tight mb-2 opacity-90">Combat Kit</h2>
              <div className="flex items-center gap-4">
                <div className="h-[1px] w-20 bg-gradient-to-r from-white/40 to-transparent" />
                <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.5em]">Tactical Ability Suite</p>
              </div>
              <div className="absolute -left-8 top-4 w-1 h-32 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {char.skills.map((skill, index) => (
                  <Card key={index} className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-[2.5rem] p-10 hover:bg-white/[0.05] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <p className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.3em] mb-2">Skill Module 0{index + 1}</p>
                          <Card.Title className="text-3xl font-heading text-white group-hover:text-amber-300 transition-colors">
                            {skill.skillName}
                          </Card.Title>
                        </div>
                        <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                          <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">{skill.type}</span>
                        </div>
                      </div>

                      <div className="text-zinc-400 font-medium leading-relaxed mb-10 text-base min-h-[5rem] opacity-70 group-hover:opacity-100 transition-opacity">
                        <KeywordHighlighter text={skill.description || ""} />
                      </div>

                      <div className="flex gap-8 border-t border-white/5 pt-8">
                        <div>
                          <span className="text-zinc-700 block text-[9px] font-black uppercase tracking-[0.2em] mb-2">Scaling Factor</span>
                          <span className="font-black text-sm uppercase text-white tracking-widest">{skill.statMultiplier}</span>
                        </div>
                        <div>
                          <span className="text-zinc-700 block text-[9px] font-black uppercase tracking-[0.2em] mb-2">Damage Profile</span>
                          <div className="flex items-center gap-2">
                            {skill.damageRanked?.map((d, i) => (
                              <React.Fragment key={i}>
                                <span className={`text-sm font-bold ${i === 2 ? 'text-amber-400' : 'text-zinc-400'}`}>{d}%</span>
                                {i < 2 && <span className="text-zinc-800">/</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Ultimate Ability - The Centerpiece */}
              {char.ultimate && (
                <Card className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 md:col-span-2 relative overflow-hidden group hover:border-amber-500/50 transition-all duration-700 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                    <span className="text-[15rem] font-heading rotate-12 inline-block select-none leading-none">ULTIMATE</span>
                  </div>
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-8 mb-10">
                      <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black text-4xl shadow-[0_0_50px_rgba(245,158,11,0.4)] group-hover:scale-110 transition-transform duration-500">
                        ✨
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-[2px] w-8 bg-amber-500" />
                          <span className="text-amber-500 font-black text-[10px] tracking-[0.4em] uppercase">Tactical Overdrive</span>
                        </div>
                        <Card.Title className="text-6xl font-heading text-white group-hover:text-amber-400 transition-colors">
                          {char.ultimate.skillName}
                        </Card.Title>
                      </div>
                    </div>

                    <div className="text-zinc-300 font-medium leading-relaxed mb-12 text-xl max-w-3xl opacity-80 group-hover:opacity-100 transition-opacity">
                      <KeywordHighlighter text={char.ultimate.description || ""} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 border-t border-white/5 pt-10">
                      <div>
                        <span className="text-zinc-600 block text-[10px] font-black uppercase tracking-[0.3em] mb-3">Core Scaling</span>
                        <span className="font-black text-xl uppercase text-amber-200 tracking-[0.1em]">{char.ultimate.statMultiplier}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block text-[10px] font-black uppercase tracking-[0.3em] mb-3">Impact Ratio</span>
                        <span className="font-black text-2xl text-white tracking-tighter">{char.ultimate.damage}%</span>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-end">
                        <div className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-500 text-[10px] font-black tracking-widest">
                          UNIQUE SKILL MODULE
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Decoration */}
      <div className="max-w-7xl mx-auto px-8 py-12 flex justify-between items-center border-t border-white/5 opacity-30">
        <div className="text-[10px] font-black tracking-[0.5em] text-zinc-500 uppercase">System Ready // 2026</div>
        <div className="flex gap-8">
          <div className="text-[10px] font-black tracking-[0.5em] text-zinc-500 uppercase">V-1.04</div>
          <div className="text-[10px] font-black tracking-[0.5em] text-zinc-500 uppercase">Unit: {char.id.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}
