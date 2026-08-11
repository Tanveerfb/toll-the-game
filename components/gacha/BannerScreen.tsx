"use client";

import Image from "next/image";
import React from "react";
import { usePlayerStore, type ResolvedPullOutcome } from "@/store/playerStore";
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import RatesModal from "@/components/gacha/RatesModal";
import ClaimSection from "@/components/gacha/ClaimSection";
import PullReveal from "@/components/gacha/PullReveal";
import {
  canClaimLimitedFinal,
  canClaimLimitedFirst,
  canClaimPermanentFinal,
  LIMITED_MILESTONE_FINAL,
  LIMITED_MILESTONE_FIRST,
  PERMANENT_MILESTONE_FINAL,
} from "@/lib/gacha/milestone";
import {
  LIMITED_GEM_COST,
  MULTI_PULL_COUNT,
  PERMANENT_TICKET_COST,
} from "@/lib/gacha/cost";

type Tab = "limited" | "permanent";

/** Where a milestone marker sits on the track, as a percentage. */
function markerAt(threshold: number, final: number): number {
  return Math.min(100, (threshold / final) * 100);
}

export default function BannerScreen(): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>("limited");
  const [showRates, setShowRates] = React.useState(false);
  const [reveal, setReveal] = React.useState<{
    results: ResolvedPullOutcome[];
    count: 1 | 11;
  } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const currencies = usePlayerStore((s) => s.currencies);
  const roster = usePlayerStore((s) => s.roster);
  const characters = usePlayerStore((s) => s.characters);
  const pity = usePlayerStore((s) => s.pity);
  const pullLimited = usePlayerStore((s) => s.pullLimited);
  const pullPermanent = usePlayerStore((s) => s.pullPermanent);
  const claimLimitedFirst = usePlayerStore((s) => s.claimLimitedFirst);
  const claimLimitedFinal = usePlayerStore((s) => s.claimLimitedFinal);
  const claimPermanentFinal = usePlayerStore((s) => s.claimPermanentFinal);

  const limitedBanner = getActiveLimitedBanner();
  const permanentBanner = getPermanentBanner();

  const isLimited = tab === "limited";
  const featured = isLimited ? limitedBanner.featured : permanentBanner.featured;
  const bar = isLimited ? pity.limited.bar : pity.permanent.bar;
  const finalThreshold = isLimited
    ? LIMITED_MILESTONE_FINAL
    : PERMANENT_MILESTONE_FINAL;
  // Permanent has one milestone; Limited has two.
  const firstThreshold = isLimited ? LIMITED_MILESTONE_FIRST : null;
  const barPercent = Math.min(100, (bar / finalThreshold) * 100);

  const singleCost = isLimited
    ? LIMITED_GEM_COST.single
    : PERMANENT_TICKET_COST.single;
  const multiCost = isLimited
    ? LIMITED_GEM_COST.multi
    : PERMANENT_TICKET_COST.multi;
  const balance = isLimited ? currencies.gems : currencies.permanentTicket;
  const unit = isLimited ? "gems" : "tickets";

  // The permanent pool is every character flagged `permanentPool`, which is
  // currently none — the tab used to render a live Draw button over an empty
  // pool, so pressing it did nothing at all.
  const poolEmpty = !isLimited && permanentBanner.featured.length === 0;
  const canAfford = (cost: number) => hasHydrated && balance >= cost && !poolEmpty;

  const claimableFirst =
    isLimited && canClaimLimitedFirst(pity.limited.bar, pity.limited.claimedFirst);
  const claimableFinal = isLimited
    ? canClaimLimitedFinal(pity.limited.bar, pity.limited.claimedFinal)
    : canClaimPermanentFinal(pity.permanent.bar, pity.permanent.claimedFinal);

  const draw = (count: 1 | 11) => {
    const results = isLimited ? pullLimited(count) : pullPermanent(count);
    if (!results) {
      setNotice(
        poolEmpty
          ? "The permanent pool is empty — nothing to draw from yet."
          : `Not enough ${unit}.`,
      );
      return;
    }
    setNotice(null);
    setReveal({ results, count });
  };

  const drawLabel = (count: 1 | 11) =>
    `Draw ×${count} · ${count === 1 ? singleCost : multiCost} ${unit}`;

  return (
    <main className="terminal-grid min-h-screen bg-void">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 md:px-8">
        <div className="flex gap-1.5 border-b border-edge pb-2">
          {(["limited", "permanent"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setNotice(null);
              }}
              className={`border px-3.5 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${
                tab === t
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-edge text-readout-dim hover:border-edge-strong hover:text-readout"
              }`}
            >
              {t === "limited" ? "Limited" : "Permanent"}
            </button>
          ))}
        </div>

        {/* BANNER */}
        <div className="relative h-40 overflow-hidden border border-edge-strong bg-panel md:h-48">
          <Image
            src={
              isLimited
                ? "/banners/debut-2026-08.png"
                : "/banners/debut-2026-08-placeholder.svg"
            }
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover opacity-55"
          />
          <span className="absolute inset-0 bg-linear-to-r from-void via-void/70 to-transparent" />
          <div className="relative flex h-full max-w-[70%] flex-col justify-center gap-1 px-5">
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
              {isLimited
                ? `Limited · ends ${new Date(limitedBanner.endsAt).toLocaleDateString()}`
                : "Permanent"}
            </span>
            <span className="font-heading text-2xl leading-tight tracking-[0.04em] text-readout-strong md:text-3xl">
              {isLimited ? limitedBanner.name : "Permanent Banner"}
            </span>
            <span className="font-body text-xs text-readout-dim">
              {isLimited
                ? `${(limitedBanner.rate * 100).toFixed(0)}% featured · ${featured.length} units`
                : poolEmpty
                  ? "No units in the pool yet"
                  : `${featured.length} units · every pull is a character`}
            </span>
          </div>
        </div>

        {/* FEATURED — which of these you already have is the whole reason a
            pull is exciting or a shrug. */}
        {featured.length > 0 ? (
          <div className="border border-hairline bg-panel px-3 py-2.5">
            <p className="mb-2 font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
              Featured
            </p>
            <div className="flex flex-wrap gap-1.5">
              {featured.map((id) => {
                const art = getCharacterArt(id);
                const character = getCharacterById(id);
                const owned = hasHydrated && roster.includes(id);
                const ultLevel = characters[id]?.ultLevel ?? 1;
                return (
                  <span
                    key={id}
                    title={
                      owned
                        ? `${character?.name ?? id} — owned, ult ${ultLevel}`
                        : `${character?.name ?? id} — not owned`
                    }
                    className={`relative h-11 w-11 overflow-hidden border ${
                      owned ? "border-edge-strong" : "border-hairline opacity-45"
                    }`}
                  >
                    {art ? (
                      <Image
                        src={art}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover object-top"
                      />
                    ) : null}
                    {owned && ultLevel > 1 ? (
                      <span className="absolute bottom-0 right-0 bg-signal px-1 font-body text-[8px] font-bold text-void">
                        U{ultLevel}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* MILESTONE TRACK */}
        <div className="border border-hairline bg-panel px-3 py-3">
          <div className="flex items-baseline justify-between">
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
              Milestone
            </span>
            <span className="font-heading text-lg leading-none tracking-[0.04em] text-readout-strong tabular-nums">
              {hasHydrated ? bar.toLocaleString() : "—"}
              <span className="ml-1 font-body text-[10px] font-semibold text-readout-muted">
                / {finalThreshold.toLocaleString()} {unit} spent
              </span>
            </span>
          </div>
          <div className="relative mt-2 mb-5 h-2.5 border border-hairline bg-void">
            <span
              className="block h-full bg-signal transition-[width] duration-500"
              style={{ width: hasHydrated ? `${barPercent}%` : "0%" }}
            />
            {firstThreshold !== null ? (
              <span
                className="absolute -top-1 h-4.5 w-0.5 bg-edge-strong"
                style={{ left: `${markerAt(firstThreshold, finalThreshold)}%` }}
              >
                <span className="absolute left-1/2 top-5 -translate-x-1/2 font-body text-[9px] font-bold tabular-nums text-readout-muted">
                  {firstThreshold}
                </span>
              </span>
            ) : null}
            <span className="absolute -top-1 right-0 h-4.5 w-0.5 bg-el-light">
              <span className="absolute left-1/2 top-5 -translate-x-1/2 font-body text-[9px] font-bold tabular-nums text-readout-muted">
                {finalThreshold}
              </span>
            </span>
          </div>

          <ClaimSection
            bar={bar}
            firstThreshold={firstThreshold}
            finalThreshold={finalThreshold}
            firstTitle="Random featured unit"
            firstDetail="Rolled for you from this banner"
            claimableFirst={claimableFirst}
            claimedFirst={pity.limited.claimedFirst}
            claimableFinal={claimableFinal}
            claimedFinal={
              isLimited ? pity.limited.claimedFinal : pity.permanent.claimedFinal
            }
            featured={featured}
            onClaimFirst={() => {
              const result = claimLimitedFirst();
              if (result) setReveal({ results: [result], count: 1 });
            }}
            onClaimFinal={(characterId) => {
              const result = isLimited
                ? claimLimitedFinal(characterId)
                : claimPermanentFinal(characterId);
              if (result) setReveal({ results: [result], count: 1 });
            }}
          />
        </div>

        {notice ? (
          <p className="border-l-2 border-el-red bg-el-red/5 px-3 py-2 font-body text-xs text-el-red">
            {notice}
          </p>
        ) : null}

        {/* DRAW — the cost is on the button. It used to be discovered by
            watching the balance tick down afterwards. */}
        <div className="flex gap-2">
          {([1, MULTI_PULL_COUNT] as const).map((count) => {
            const cost = count === 1 ? singleCost : multiCost;
            const main = count !== 1;
            return (
              <button
                key={count}
                type="button"
                disabled={!canAfford(cost)}
                onClick={() => draw(count === 1 ? 1 : 11)}
                className={`flex-1 border px-3 py-3 text-center transition-colors disabled:border-hairline disabled:bg-transparent disabled:opacity-50 ${
                  main
                    ? "border-signal bg-signal/12 hover:bg-signal/20"
                    : "border-edge bg-inset hover:border-edge-strong"
                }`}
              >
                <span
                  className={`block font-heading text-lg tracking-[0.05em] ${main ? "text-signal" : "text-readout-strong"}`}
                >
                  Draw ×{count}
                </span>
                <span
                  className={`block font-body text-[10px] font-bold uppercase tracking-[0.1em] ${main ? "text-signal" : "text-readout-muted"}`}
                >
                  {cost} {unit}
                  {main ? " · one free pull" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-sm font-bold tabular-nums text-readout-strong">
            {hasHydrated ? balance.toLocaleString() : "—"}{" "}
            <span className="font-semibold uppercase tracking-[0.12em] text-readout-muted">
              {unit}
            </span>
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setShowRates(true)}
            className="border border-edge px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-dim transition-colors hover:border-edge-strong hover:text-readout"
          >
            Rates &amp; pool
          </button>
        </div>
      </section>

      {showRates ? (
        <RatesModal
          featured={featured}
          rate={isLimited ? limitedBanner.rate : 1}
          missNote={
            isLimited
              ? undefined
              : "Nothing else — every permanent pull is a character."
          }
          onClose={() => setShowRates(false)}
        />
      ) : null}

      {reveal ? (
        <PullReveal
          results={reveal.results}
          drawLabel={drawLabel(reveal.count)}
          canDrawAgain={canAfford(reveal.count === 1 ? singleCost : multiCost)}
          onDrawAgain={() => {
            setReveal(null);
            draw(reveal.count);
          }}
          onClose={() => setReveal(null)}
        />
      ) : null}
    </main>
  );
}
