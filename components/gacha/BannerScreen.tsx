"use client";

import Image from "next/image";
import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { usePlayerStore } from "@/store/playerStore";
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";
import RatesModal from "@/components/gacha/RatesModal";
import ClaimSection from "@/components/gacha/ClaimSection";
import PullReveal from "@/components/gacha/PullReveal";
import {
  canClaimLimited300,
  canClaimLimited600,
  canClaimPermanent600,
  LIMITED_MILESTONE_600,
  PERMANENT_MILESTONE_600,
} from "@/lib/gacha/milestone";

gsap.registerPlugin(useGSAP);

type Tab = "limited" | "permanent";

export default function BannerScreen() {
  const [tab, setTab] = React.useState<Tab>("limited");
  const [showRates, setShowRates] = React.useState(false);
  const [revealResults, setRevealResults] = React.useState<import("@/lib/gacha/pull").PullOutcome[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const barFillRef = React.useRef<HTMLDivElement>(null);
  const currencyRef = React.useRef<HTMLSpanElement>(null);
  const currencyProxy = React.useRef({ value: 0 });
  const currencies = usePlayerStore((s) => s.currencies);
  const pity = usePlayerStore((s) => s.pity);
  const pullLimited = usePlayerStore((s) => s.pullLimited);
  const pullPermanent = usePlayerStore((s) => s.pullPermanent);
  const claimLimited300 = usePlayerStore((s) => s.claimLimited300);
  const claimLimited600 = usePlayerStore((s) => s.claimLimited600);
  const claimPermanent600 = usePlayerStore((s) => s.claimPermanent600);

  const limitedBanner = getActiveLimitedBanner();
  const permanentBanner = getPermanentBanner();

  const isLimited = tab === "limited";
  const bar = isLimited ? pity.limited.bar : pity.permanent.bar;
  const milestone600 = isLimited ? LIMITED_MILESTONE_600 : PERMANENT_MILESTONE_600;
  const barPercent = Math.min((bar / milestone600) * 100, 100);
  const currentCurrencyValue = isLimited ? currencies.gems : currencies.permanentTicket;

  const claimable300 = isLimited && canClaimLimited300(pity.limited.bar, pity.limited.claimed300);
  const claimable600 = isLimited ? canClaimLimited600(pity.limited.bar) : canClaimPermanent600(pity.permanent.bar);

  useGSAP(
    () => {
      if (barFillRef.current) {
        gsap.to(barFillRef.current, { width: `${barPercent}%`, duration: 0.6, ease: "power2.out" });
      }
      if (currencyRef.current) {
        gsap.to(currencyProxy.current, {
          value: currentCurrencyValue,
          duration: 0.5,
          ease: "power1.out",
          onUpdate: () => {
            if (currencyRef.current) {
              currencyRef.current.textContent = Math.round(currencyProxy.current.value).toLocaleString();
            }
          },
        });
      }
    },
    { dependencies: [barPercent, currentCurrencyValue], scope: containerRef },
  );

  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div ref={containerRef} className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-4 flex border-b-2 border-zinc-800">
          {(["limited", "permanent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-0.5 border-b-2 px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                tab === t ? "border-amber-400 text-amber-200" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "limited" ? "Limited" : "Permanent"}
            </button>
          ))}
        </div>

        <div className="relative aspect-[2/1] w-full overflow-hidden border border-zinc-800 bg-zinc-900">
          <Image
            src="/banners/debut-2026-08-placeholder.svg"
            alt={isLimited ? limitedBanner.name : "Permanent Banner"}
            fill
            className="object-cover"
          />
        </div>

        <h1 className="mt-3 font-heading text-3xl tracking-[0.08em] text-zinc-100">
          {isLimited ? limitedBanner.name : "Permanent Banner"}
        </h1>
        {isLimited ? (
          <p className="font-body text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Ends {new Date(limitedBanner.endsAt).toLocaleDateString()}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end font-body text-sm text-amber-200">
          ◆ <span ref={currencyRef}>0</span> {isLimited ? "gems" : "tickets"}
        </div>

        <div className="mt-2">
          <div className="flex justify-between font-body text-[9px] uppercase tracking-[0.08em] text-zinc-500">
            <span>Milestone</span>
            <span>{bar} / {milestone600}</span>
          </div>
          <div className="relative mt-1 h-2 rounded bg-zinc-800">
            <div ref={barFillRef} className="h-full w-0 rounded bg-amber-400" />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            disabled={revealResults !== null}
            onClick={() => {
              const results = isLimited ? pullLimited(1) : pullPermanent(1);
              if (results) setRevealResults(results);
            }}
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 py-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-100 disabled:opacity-50"
          >
            Draw ×1
          </button>
          <button
            disabled={revealResults !== null}
            onClick={() => {
              const results = isLimited ? pullLimited(11) : pullPermanent(11);
              if (results) setRevealResults(results);
            }}
            className="flex-1 rounded bg-amber-400 py-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-950 disabled:opacity-50"
          >
            Draw ×11
          </button>
        </div>

        <button
          onClick={() => setShowRates(true)}
          className="mt-2 w-full text-center font-body text-[10px] uppercase tracking-[0.1em] text-zinc-500 underline underline-offset-2"
        >
          Rates
        </button>

        <ClaimSection
          claimable300={claimable300}
          claimable600={claimable600}
          isLimited={isLimited}
          featured={isLimited ? limitedBanner.featured : permanentBanner.featured}
          claimLimited300={claimLimited300}
          claimLimited600={claimLimited600}
          claimPermanent600={claimPermanent600}
        />

        {showRates ? (
          <RatesModal
            featured={isLimited ? limitedBanner.featured : permanentBanner.featured}
            rate={isLimited ? limitedBanner.rate : 1 / Math.max(permanentBanner.featured.length, 1)}
            onClose={() => setShowRates(false)}
          />
        ) : null}

        {revealResults ? (
          <PullReveal results={revealResults} onComplete={() => setRevealResults(null)} />
        ) : null}
      </div>
    </main>
  );
}
