"use client";

import { Tooltip } from '@heroui/react';

const MECHANIC_DESCRIPTIONS: Record<string, string> = {
  amplify: "Increases damage by +10% for each buff on self.",
  concentrate: "Increases damage by +10% for each empty slot in the enemy team.",
  ignite: "Attacks against Ignited targets deal +10% extra damage per stack.",
  spite: "Increases damage based on missing HP.",
  taunt: "Forces the afflicted character to attack the Taunter.",
  stun: "The afflicted character cannot perform actions.",
  stuns: "The afflicted character cannot perform actions.",
  pierce: "Ignores a percentage of the target's Defense.",
  cleanse: "Removes debuffs from allies.",
  lifesteal: "Restores HP equal to a percentage of damage dealt.",
  detonate: "Deals bonus damage based on the target's Ultimate Gauge.",
  weakpoint: "Deals x3 damage if target has any debuffs."
};

export default function KeywordHighlighter({ text }: { text: string }) {
  if (!text) return null;

  const keywords = Object.keys(MECHANIC_DESCRIPTIONS).join('|');
  const regex = new RegExp(`(${keywords})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const lowerPart = part.toLowerCase();
        if (MECHANIC_DESCRIPTIONS[lowerPart]) {
          return (
            <Tooltip key={i} delay={0}>
              <Tooltip.Trigger>
                <span className="text-blue-400 font-bold cursor-help underline decoration-blue-400/30 underline-offset-4 decoration-dotted hover:decoration-solid transition-all">
                  {part}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-zinc-900 border border-blue-500/50 p-3 rounded-xl shadow-2xl max-w-xs">
                <div className="font-bold text-blue-300 mb-1 capitalize text-sm">{lowerPart}</div>
                <div className="text-xs text-zinc-300 leading-relaxed">
                  {MECHANIC_DESCRIPTIONS[lowerPart]}
                </div>
              </Tooltip.Content>
            </Tooltip>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
