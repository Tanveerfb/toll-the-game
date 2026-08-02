"use client";

import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import MilestonePicker from "@/components/gacha/MilestonePicker";

gsap.registerPlugin(useGSAP);

interface ClaimSectionProps {
  claimable300: boolean;
  claimable600: boolean;
  isLimited: boolean;
  featured: string[];
  claimLimited300: () => void;
  claimLimited600: (characterId: string) => void;
  claimPermanent600: (characterId: string) => void;
}

export default function ClaimSection({
  claimable300,
  claimable600,
  isLimited,
  featured,
  claimLimited300,
  claimLimited600,
  claimPermanent600,
}: ClaimSectionProps) {
  const [showPicker600, setShowPicker600] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const claim300Ref = React.useRef<HTMLButtonElement>(null);
  const claim600Ref = React.useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      [
        { ref: claim300Ref, active: claimable300 },
        { ref: claim600Ref, active: claimable600 },
      ].forEach(({ ref, active }) => {
        if (!ref.current) return;
        gsap.killTweensOf(ref.current);
        if (active) {
          gsap.to(ref.current, {
            boxShadow: "0 0 16px rgba(251,191,36,0.75)",
            repeat: -1,
            yoyo: true,
            duration: 0.8,
          });
        } else {
          gsap.set(ref.current, { boxShadow: "none" });
        }
      });
    },
    { dependencies: [claimable300, claimable600], scope: containerRef },
  );

  return (
    <>
      <div
        ref={containerRef}
        className={`mt-3 flex gap-2 border-t border-zinc-800 pt-3 ${claimable300 || claimable600 ? "" : "hidden"}`}
      >
        <button
          ref={claim300Ref}
          disabled={!claimable300}
          onClick={() => claimLimited300()}
          className={`flex-1 rounded border border-amber-400 py-2 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-amber-200 ${claimable300 ? "" : "hidden"}`}
        >
          Claim 300
        </button>
        <button
          ref={claim600Ref}
          disabled={!claimable600}
          onClick={() => setShowPicker600(true)}
          className={`flex-1 rounded border border-amber-400 bg-amber-400/10 py-2 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-amber-200 ${claimable600 ? "" : "hidden"}`}
        >
          Claim 600
        </button>
      </div>

      {showPicker600 ? (
        <MilestonePicker
          characterIds={featured}
          onPick={(characterId) => {
            if (isLimited) claimLimited600(characterId);
            else claimPermanent600(characterId);
            setShowPicker600(false);
          }}
          onClose={() => setShowPicker600(false)}
        />
      ) : null}
    </>
  );
}
