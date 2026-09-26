"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import React from "react";
import { usePlayerStore, type ResolvedPullOutcome } from "@/store/playerStore";
import { getGemBanner, getTicketBanner } from "@/lib/gacha/banners";
import { getCharacterArt } from "@/lib/game/characterArt";
import ConfirmPullModal from "@/components/gacha/ConfirmPullModal";
import RatesModal from "@/components/gacha/RatesModal";
import FeaturedModal from "@/components/gacha/FeaturedModal";
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
  limitedBarGain,
  MULTI_PULL_COUNT,
  permanentTicketCost,
  PERMANENT_TICKET_COST,
} from "@/lib/gacha/cost";
import { Screen } from "@/components/ui/Screen";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { panelVariants } from "@/components/ui/Panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Tab = "limited" | "permanent";

/** Where a milestone marker sits on the track, as a percentage. */
function markerAt(threshold: number, final: number): number {
  return Math.min(100, (threshold / final) * 100);
}

export default function BannerScreen(): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>("limited");
  const [showRates, setShowRates] = React.useState(false);
  const [showFeatured, setShowFeatured] = React.useState(false);
  // A draw is confirmed before it rolls: 50 gems is ten Molvarr first clears,
  // and it used to fire on one tap of a button whose only warning was its own
  // label (Tanveer, 2026-08-13).
  const [pendingDraw, setPendingDraw] = React.useState<1 | 11 | null>(null);
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

  const gemBanner = getGemBanner();
  const ticketBanner = getTicketBanner();

  // The ticket banner's pool is every character flagged `permanentPool`, which
  // is currently none. An empty banner is not a tab the player should be able
  // to land on, so the strip only renders once there is a real second banner
  // to switch to.
  const ticketBannerAvailable = ticketBanner.featured.length > 0;

  const isLimited = tab === "limited";
  const featured = isLimited ? gemBanner.featured : ticketBanner.featured;
  // Ownership of the featured pool, resolved once for both the summary row and
  // the modal's table.
  const featuredRows = featured.map((id) => ({
    id,
    owned: hasHydrated && roster.includes(id),
    ultLevel: characters[id]?.ultLevel ?? 1,
  }));
  const ownedFeatured = featuredRows.filter((row) => row.owned).length;
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
  /** The banner's currency, as a material id - what its icon resolves from. */
  const currencyIcon = isLimited ? "gems" : "permanent_ticket";
  const unit = isLimited ? "gems" : "tickets";

  // The permanent pool is every character flagged `permanentPool`, which is
  // currently none — the tab used to render a live Draw button over an empty
  // pool, so pressing it did nothing at all.
  const poolEmpty = !isLimited && ticketBanner.featured.length === 0;
  const canAfford = (cost: number) => hasHydrated && balance >= cost && !poolEmpty;

  // The next milestone this banner has still to pay out — what the confirm
  // modal measures a draw against. `null` once they are all behind you.
  const nextThreshold: number | null = isLimited
    ? !pity.limited.claimedFirst
      ? LIMITED_MILESTONE_FIRST
      : !pity.limited.claimedFinal
        ? LIMITED_MILESTONE_FINAL
        : null
    : !pity.permanent.claimedFinal
      ? PERMANENT_MILESTONE_FINAL
      : null;

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
    <Screen width="app">
        {ticketBannerAvailable ? (
          // The shadcn tabs (ruling #154), on the ground.
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as Tab);
              setNotice(null);
            }}
          >
            <TabsList>
              {(["limited", "permanent"] as const).map((t) => (
                <TabsTrigger key={t} value={t} className="uppercase tracking-label">
                  <ItemIcon
                    id={t === "limited" ? "gems" : "permanent_ticket"}
                    size={18}
                    alt=""
                  />
                  {t === "limited" ? "Gems" : "Tickets"}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        {/* BANNER */}
        {/* The banner is a hero image, so it gets the motif's speed lines
            (docs/design-system.md: behind a hero, never behind text). */}
        <div className="relative h-40 overflow-hidden border-2 border-ground-line bg-ground-raised ink-slab md:h-48">
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
            // `object-top`, not the default centre. The plate has its own title
            // painted into the bottom of the artwork — "V1. BETA ROSTER BANNER"
            // in gold, source y 672-724 of 768 — and `BannerScreen` renders
            // that same string as the heading laid over it, so the screen
            // showed the banner's name twice, the second time as a half-cut
            // band of art. Found in a browser 2026-09-01. A textless
            // re-render is queued as D2 in docs/ART_REQUESTS.md; this pair of
            // workarounds holds until it lands, and both go when it does.
            //
            // `object-top` alone does not do it, which is worth writing down
            // because the arithmetic is not obvious: the image box is 349 wide
            // inside the section's padding, not the 393 of the viewport, so a
            // 2:1 source covering a 159-tall box shows source y 0..700 — still
            // 28px into the band. Hence the scrim below as well.
            className="object-cover object-top opacity-55"
          />
          <span className="absolute inset-0 speed-lines" />
          <span className="absolute inset-0 bg-linear-to-r from-background via-background/70 to-transparent" />
          {/* Buries whatever of the wordmark the crop leaves. Deliberately
              generous: the exact overlap moves with the container's width, and
              a scrim that is too tall costs nothing here — the plate's own
              composition puts its characters in the upper two thirds, and the
              screen already reads this art through two other gradients. */}
          <span className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background via-background/85 to-transparent" />
          <div className="relative flex h-full max-w-[70%] flex-col justify-center gap-1 px-5">
            <span className="font-body text-label font-bold uppercase tracking-eyebrow text-primary">
              {/* No end date and no "Limited" — the beta roster was always
                  meant to be permanent (Tanveer, 2026-08-13). */}
              Permanent · {isLimited ? "gems" : "tickets"}
            </span>
            <span className="font-heading text-2xl leading-tight tracking-title md:text-3xl">
              {isLimited ? gemBanner.name : "Permanent Banner"}
            </span>
            <span className="font-body text-xs text-ground-dim">
              {isLimited
                ? `${(gemBanner.rate * 100).toFixed(0)}% featured · ${featured.length} units`
                : poolEmpty
                  ? "No units in the pool yet"
                  : `${featured.length} units · every pull is a character`}
            </span>
          </div>
        </div>

        {/* FEATURED — which of these you already have is the whole reason a
            pull is exciting or a shrug.

            A row that opens a table, not a grid of portraits (Tanveer,
            2026-09-01). The grid was twelve 44px tiles whose name and ownership
            each sat behind a `Hint`: correct under ruling #125 — a tap opens
            it, unlike the `title=` it replaced — but twelve taps to read one
            banner. The count answers the usual question without opening
            anything, and `FeaturedModal` answers the rest in one place. */}
        {featured.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowFeatured(true)}
            className={cn(
              panelVariants({ surface: "paper", density: "tight", press: true }),
              "flex w-full items-center gap-3",
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
                Featured
              </span>
              <span className="font-body text-sm">
                {hasHydrated
                  ? `${ownedFeatured} of ${featured.length} owned`
                  : `${featured.length} units`}
              </span>
            </span>
            {/* The portraits still carry the glance — five of them, as a
                sample, so the row says what kind of units these are without
                pretending to be the full list. */}
            <span className="ml-auto flex shrink-0 -space-x-2">
              {featured.slice(0, 5).map((id) => {
                const art = getCharacterArt(id);
                const owned = hasHydrated && roster.includes(id);
                return (
                  <span
                    key={id}
                    className={`relative h-9 w-9 overflow-hidden border-2 bg-muted ${
                      owned ? "border-border" : "border-rule opacity-45"
                    }`}
                  >
                    {art ? (
                      <Image
                        src={art}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover object-top"
                      />
                    ) : null}
                  </span>
                );
              })}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
          </button>
        ) : null}

        {/* MILESTONE TRACK */}
        <div className={panelVariants({ surface: "paper", density: "default" })}>
          <div className="flex items-baseline justify-between">
            <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
              Milestone
            </span>
            <span className="font-heading text-lg leading-none tracking-title tabular-nums">
              {hasHydrated ? bar.toLocaleString() : "—"}
              <span className="ml-1 font-body text-label font-bold text-muted-foreground">
                / {finalThreshold.toLocaleString()} {unit} spent
              </span>
            </span>
          </div>
          <div className="relative mt-2 mb-5 h-2.5 border border-border bg-muted">
            <span
              className="block h-full bg-primary transition-[width] duration-500"
              style={{ width: hasHydrated ? `${barPercent}%` : "0%" }}
            />
            {firstThreshold !== null ? (
              <span
                className="absolute -top-1 h-4.5 w-0.5 bg-border"
                style={{ left: `${markerAt(firstThreshold, finalThreshold)}%` }}
              >
                <span className="absolute left-1/2 top-5 -translate-x-1/2 font-body text-label font-bold tabular-nums text-muted-foreground">
                  {firstThreshold}
                </span>
              </span>
            ) : null}
            <span className="absolute -top-1 right-0 h-4.5 w-1 border border-border bg-el-light">
              <span className="absolute left-1/2 top-5 -translate-x-1/2 font-body text-label font-bold tabular-nums text-muted-foreground">
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
          <Alert variant="destructive">{notice}</Alert>
        ) : null}

        {/* DRAW — the cost is on the button. It used to be discovered by
            watching the balance tick down afterwards. */}
        <div className="flex gap-2">
          {([1, MULTI_PULL_COUNT] as const).map((count) => {
            const cost = count === 1 ? singleCost : multiCost;
            const main = count !== 1;
            // The multi-draw is the screen's primary action (the slanted
            // yellow button); the single draw is the paper one beside it.
            return (
              <Button
                key={count}
                variant={main ? "default" : "secondary"}
                size="xl"
                disabled={!canAfford(cost)}
                onClick={() => setPendingDraw(count === 1 ? 1 : 11)}
                className="h-auto flex-1 flex-col gap-0 py-2.5"
              >
                <span className="block">Draw ×{count}</span>
                <span className="block font-body text-label font-bold uppercase tracking-label">
                  {cost} {unit}
                  {main ? " · one free pull" : ""}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-body text-sm font-bold tabular-nums">
            <ItemIcon id={currencyIcon} size={22} alt="" />
            {hasHydrated ? balance.toLocaleString() : "—"}{" "}
            <span className="font-bold uppercase tracking-label text-ground-dim">
              {unit}
            </span>
          </span>
          <span className="flex-1" />
          <Button variant="outline" size="xs" onClick={() => setShowRates(true)}>
            Rates &amp; pool
          </Button>
        </div>

      {showFeatured ? (
        <FeaturedModal
          rows={featuredRows}
          hasHydrated={hasHydrated}
          onClose={() => setShowFeatured(false)}
        />
      ) : null}

      {showRates ? (
        <RatesModal
          featured={featured}
          rate={isLimited ? gemBanner.rate : 1}
          missNote={
            isLimited
              ? undefined
              : "Nothing else — every permanent pull is a character."
          }
          onClose={() => setShowRates(false)}
        />
      ) : null}

      {pendingDraw !== null ? (
        <ConfirmPullModal
          bannerName={isLimited ? gemBanner.name : "Permanent Banner"}
          count={pendingDraw}
          cost={pendingDraw === 1 ? singleCost : multiCost}
          unit={unit}
          iconId={currencyIcon}
          balance={balance}
          bar={bar}
          barGain={
            isLimited
              ? limitedBarGain(pendingDraw)
              : permanentTicketCost(pendingDraw)
          }
          nextThreshold={nextThreshold}
          onCancel={() => setPendingDraw(null)}
          onConfirm={() => {
            const count = pendingDraw;
            setPendingDraw(null);
            draw(count);
          }}
        />
      ) : null}

      {reveal ? (
        <PullReveal
          results={reveal.results}
          drawLabel={drawLabel(reveal.count)}
          canDrawAgain={canAfford(reveal.count === 1 ? singleCost : multiCost)}
          onDrawAgain={() => {
            const count = reveal.count;
            setReveal(null);
            setPendingDraw(count);
          }}
          onClose={() => setReveal(null)}
        />
      ) : null}
    </Screen>
  );
}
