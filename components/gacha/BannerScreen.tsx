"use client";

import Image from "next/image";
import ItemIcon from "@/components/game/ItemIcon";
import React from "react";
import { usePlayerStore, type ResolvedPullOutcome } from "@/store/playerStore";
import { getGemBanner, getTicketBanner } from "@/lib/gacha/banners";
import { ticketNoun } from "@/lib/game/rewardParts";
import { getCharacterArt } from "@/lib/game/characterArt";
import ConfirmPullModal from "@/components/gacha/ConfirmPullModal";
import RatesModal from "@/components/gacha/RatesModal";
import FeaturedSheet from "@/components/gacha/FeaturedSheet";
import MilestoneSheet from "@/components/gacha/MilestoneSheet";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { panelVariants } from "@/components/ui/Panel";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Tab = "limited" | "permanent";

/** How many portraits the featured panel shows as a glance. */
const FEATURED_FACES = 6;

/**
 * The summon screen is a manga page (Tanveer's pick, 2026-10-03: Option C of
 * docs/design/mockups/gacha-overhaul.html): slanted panels with ink gutters, the
 * banner as the splash, featured and milestone as two small panels, and the
 * draw as the action panel at the foot.
 *
 * **One screen, no page scroll, the draw buttons in the thumb zone.** The page
 * is a column at least as tall as the space between the bars; the splash is the
 * one flexible part, so it absorbs whatever height is left and the draw panel
 * lands at the bottom, directly above the tab bar. The draw panel is `sticky`
 * to `--tabbar-h`, so on a phone too short for the splash's minimum height the
 * page scrolls and the buttons stay pinned where the thumb is rather than
 * clipping. On a tall desktop the splash stops growing (it is a 2:1 plate) and
 * the page sits at the top of the same centred column.
 */
export default function BannerScreen(): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>("limited");
  const [showRates, setShowRates] = React.useState(false);
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
  // Ownership of the featured pool, resolved once for both the panel and the
  // sheet it opens.
  const featuredRows = featured.map((id) => ({
    id,
    owned: hasHydrated && roster.includes(id),
    level: characters[id]?.level ?? 1,
    ultLevel: characters[id]?.ultLevel ?? 1,
  }));
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
  const bannerName = isLimited ? gemBanner.name : "Permanent Banner";

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
  // The panel says so itself: a reward behind a tap that nothing points at is
  // a reward the player does not collect.
  const claimable = hasHydrated && (claimableFirst || claimableFinal);

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

  /** "1 ticket", "10 tickets", "150 gems": the noun agrees with the count. */
  const costText = (cost: number) =>
    `${cost} ${isLimited ? "gems" : ticketNoun(cost)}`;
  const drawLabel = (count: 1 | 11) =>
    `Draw ×${count} · ${costText(count === 1 ? singleCost : multiCost)}`;

  return (
    // A flex column so the section can fill the height between the bars and
    // the splash inside it can take whatever is left (`min-` height, so a short
    // phone grows the page instead of clipping it).
    <Screen
      width="app"
      className="flex flex-col"
      contentClassName="flex-1 gap-2 py-3 md:py-6"
    >
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

      {/* SPLASH — the banner, and the one panel that flexes. */}
      {/* 28rem: local cap, so the splash does not stretch on a tall desktop. */}
      <div className="relative min-h-40 flex-1 md:max-h-[28rem]">
        <div className="panel-cut-hero absolute inset-0 overflow-hidden border-2 border-ground-line bg-card-foreground">
          {/* The art is laid out TALLER than the panel and anchored to its top,
              so the bottom of the plate falls outside the panel and is cut by
              `overflow-hidden`. The plate has its own title painted into the
              bottom of the artwork — "V1. BETA ROSTER BANNER" in gold, source y
              672-724 of 768, which is 87.5% of the image's height — and the
              caption box below already names the banner, so the screen showed
              it twice, the second time as a half-cut band of art (found in a
              browser 2026-09-01). At 120% of the panel's height that band
              starts at 105% of it, below the edge, however tall the panel
              grows. This replaces the old crop-plus-scrim pair, which only
              worked at one container width. A textless re-render is queued as
              D2 in docs/ART_REQUESTS.md; this goes when it lands. */}
          <div className="absolute inset-x-0 top-0 h-[120%]">
            <Image
              src={
                isLimited
                  ? "/banners/debut-2026-08.png"
                  : "/banners/debut-2026-08-placeholder.svg"
              }
              alt=""
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover object-top"
            />
          </div>
          <div className="absolute left-2.5 top-2.5 flex max-w-[70%] flex-col gap-0.5 border-2 border-border bg-card px-2.5 py-1.5 text-card-foreground ink-slab-sm">
            <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
              {/* No end date and no "Limited" — the beta roster was always
                  meant to be permanent (Tanveer, 2026-08-13). */}
              Permanent · {unit}
            </span>
            <span className="font-heading text-2xl leading-none tracking-title">
              {bannerName}
            </span>
            {poolEmpty ? (
              <span className="font-body text-caption text-muted-foreground">
                No units in the pool yet
              </span>
            ) : null}
          </div>
        </div>
        {/* A sibling of the clipped panel, not a child: the burst overhangs
            its cut edge. */}
        {!poolEmpty ? (
          <span className="ink-burst pointer-events-none absolute bottom-9 right-3 z-10 bg-primary px-3.5 py-2.5 font-heading text-base leading-none tracking-title text-primary-foreground">
            {isLimited
              ? `${(gemBanner.rate * 100).toFixed(0)}% featured!`
              : "Every pull a unit!"}
          </span>
        ) : null}
      </div>

      {/* FEATURED and MILESTONE — two panels, each one tap target, tucked
          under the splash's cut. Which featured units you already have is the
          whole reason a pull is exciting or a shrug, so a row of
          faces answers it without opening anything; the sheet answers the rest
          (Tanveer, 2026-09-01: not twelve taps to read one banner). */}
      <div className="relative -mt-6 grid grid-cols-2 gap-2">
        {featured.length > 0 ? (
          <FeaturedSheet
            rows={featuredRows}
            hasHydrated={hasHydrated}
            trigger={
              <button
                type="button"
                className={cn(
                  panelVariants({ surface: "paper", density: "none", press: true }),
                  "panel-cut-rise flex min-w-0 flex-col gap-1.5 px-2.5 pb-2.5 pt-8 outline-none focus-visible:inset-ring-4 focus-visible:inset-ring-ring",
                )}
              >
                <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
                  Featured
                </span>
                {/* Owned in full colour, the rest greyed: the glance. */}
                <span className="flex -space-x-2">
                  {featured.slice(0, FEATURED_FACES).map((id) => {
                    const art = getCharacterArt(id);
                    const owned = hasHydrated && roster.includes(id);
                    return (
                      <span
                        key={id}
                        className={cn(
                          "relative size-7 overflow-hidden border-2 border-border bg-muted",
                          !owned && "grayscale opacity-50",
                        )}
                      >
                        {art ? (
                          <Image
                            src={art}
                            alt=""
                            fill
                            sizes="28px"
                            className="object-cover object-top"
                          />
                        ) : null}
                      </span>
                    );
                  })}
                </span>
              </button>
            }
          />
        ) : null}

        <MilestoneSheet
          trigger={
            <button
              type="button"
              className={cn(
                panelVariants({ surface: "paper", density: "none", press: true }),
                "panel-cut-fall flex min-w-0 flex-col gap-1.5 bg-muted px-2.5 pb-2.5 pt-8 outline-none hover:bg-card focus-visible:inset-ring-4 focus-visible:inset-ring-ring",
                featured.length === 0 && "col-span-2",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
                  Milestone
                </span>
                {claimable ? <Badge>Claim</Badge> : null}
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-heading text-3xl leading-none tabular-nums">
                  {hasHydrated ? bar.toLocaleString() : <Skeleton className="h-[1em] w-10" />}
                </span>
                <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                  / {finalThreshold.toLocaleString()} spent
                </span>
              </span>
              <Progress value={hasHydrated ? barPercent : 0} />
            </button>
          }
          hasHydrated={hasHydrated}
          unit={unit}
          bar={bar}
          firstThreshold={firstThreshold}
          finalThreshold={finalThreshold}
          firstTitle="Random featured unit"
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

      {notice ? <Alert variant="destructive">{notice}</Alert> : null}

      {/* DRAW — the action panel, on speed rays, pinned directly above the tab
          bar. The cost is on the button: it used to be discovered by watching
          the balance tick down afterwards. The balance lives here, once. */}
      <div className="panel-cut-action speed-rays sticky bottom-[var(--tabbar-h)] z-20 grid grid-cols-[1fr_1.5fr] gap-2.5 px-3 pb-3 pt-7 text-foreground">
        <div className="col-span-2 flex items-center gap-2">
          {/* Gems are in the top bar already; tickets are not, so theirs stays. */}
          {!isLimited ? (
            <span className="flex items-center gap-1.5 bg-card-foreground px-2 py-1 font-body text-sm font-bold tabular-nums">
              <ItemIcon id={currencyIcon} size={20} alt="" />
              {hasHydrated ? balance.toLocaleString() : <Skeleton tone="ground" className="h-3.5 w-8" />}{" "}
              <span className="font-bold uppercase tracking-label text-ground-dim">
                {unit}
              </span>
            </span>
          ) : null}
          <Button
            variant="link"
            size="xs"
            onClick={() => setShowRates(true)}
            className="ml-auto bg-card-foreground text-foreground underline"
          >
            Rates &amp; pool
          </Button>
        </div>
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
              className="h-auto flex-col gap-0 py-2.5"
            >
              <span className="block">Draw ×{count}</span>
              <span className="block font-body text-label font-bold uppercase tracking-label">
                {costText(cost)}
                {main ? " · one free pull" : ""}
              </span>
            </Button>
          );
        })}
      </div>

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
          bannerName={bannerName}
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
          bannerName={bannerName}
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
