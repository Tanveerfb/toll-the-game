"use client";

import Image from "next/image";
import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { PullOutcome } from "@/lib/gacha/pull";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";

gsap.registerPlugin(useGSAP);

interface PullRevealProps {
  results: PullOutcome[];
  onComplete: () => void;
}

function isCharacterHit(outcome: PullOutcome): outcome is Extract<PullOutcome, { kind: "character" }> {
  return outcome.kind === "character";
}

function bestResultIndex(results: PullOutcome[]): number {
  let best = 0;
  for (let i = 1; i < results.length; i++) {
    if (isCharacterHit(results[i]) && !isCharacterHit(results[best])) best = i;
  }
  return best;
}

export default function PullReveal({ results, onComplete }: PullRevealProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const spotlightRef = React.useRef<HTMLDivElement>(null);

  const bestIndex = bestResultIndex(results);
  const bestOutcome = results[bestIndex];
  const bestCharacter = isCharacterHit(bestOutcome) ? getCharacterById(bestOutcome.characterId) : null;

  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete });

      results.forEach((outcome, index) => {
        const card = cardRefs.current[index];
        if (!card) return;
        const hit = isCharacterHit(outcome);
        tl.fromTo(
          card,
          { rotateY: 180, opacity: 0 },
          { rotateY: 0, opacity: 1, duration: hit ? 0.5 : 0.2, ease: "power2.out" },
          "+=0.06",
        );
      });

      if (bestCharacter && spotlightRef.current) {
        tl.fromTo(
          spotlightRef.current,
          { opacity: 0, scale: 0.85 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" },
          "+=0.2",
        ).to(spotlightRef.current, { duration: 1.4 });
      }
    },
    { dependencies: [results], scope: containerRef },
  );

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <div className="flex flex-wrap justify-center gap-3 p-6" style={{ perspective: 800 }}>
        {results.map((outcome, index) => {
          const art = isCharacterHit(outcome) ? getCharacterArt(outcome.characterId) : null;
          return (
            <div
              key={index}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              style={{ backfaceVisibility: "hidden" }}
              className="flex h-32 w-24 items-center justify-center border-2 border-zinc-600 bg-zinc-900"
            >
              {isCharacterHit(outcome) ? (
                art ? (
                  <Image
                    src={art}
                    alt={outcome.characterId}
                    width={96}
                    height={128}
                    priority
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-body text-[10px] uppercase text-zinc-400">{outcome.characterId}</span>
                )
              ) : (
                <span className="font-body text-[10px] uppercase text-zinc-400">
                  {outcome.kind === "coin" ? `+${outcome.amount} coin` : outcome.materialId}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {bestCharacter ? (
        <div
          ref={spotlightRef}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 opacity-0"
        >
          <p className="font-body text-xs uppercase tracking-[0.3em] text-amber-200/80">Featured Unit</p>
          <p className="font-heading text-4xl tracking-[0.1em] text-amber-100">{bestCharacter.name}</p>
        </div>
      ) : null}
    </div>
  );
}
