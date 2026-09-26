"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Coins, ScrollText } from "lucide-react";
import type { ResolvedPullOutcome } from "@/store/playerStore";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import ItemIcon from "@/components/game/ItemIcon";
import { materialLabel } from "@/lib/game/materials";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFocusBackToOpener } from "@/hooks/useReturnFocus";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * Pull results.
 *
 * This screen used to dismiss itself: the GSAP timeline's `onComplete` was
 * wired straight to the caller's close handler, so an 11-pull flipped past and
 * vanished with no skip and no way back (Tanveer, 2026-08-11). It now flips in
 * and **stays** — the timeline only clears the "still animating" flag.
 *
 * It also says what you got. Materials were rendering their raw ids (literally
 * `training_manual`), and characters gave no sign whether a pull was a first
 * copy or a fourth even though the store had already resolved exactly that.
 *
 * **The shadcn `Dialog` since 2026-09-26** (ruling #154), in place of a
 * hand-built portal. Two rules carry over deliberately: it cannot be closed
 * while the cards are still flipping (Escape and the backdrop both wait), and
 * the backdrop never closes it at all, because a stray tap on the scrim of a
 * reveal is not a player meaning to leave it.
 */

const EL_HUE: Record<string, string> = {
  light: "var(--color-el-light)",
  red: "var(--color-el-red)",
  blue: "var(--color-el-blue)",
  green: "var(--color-el-green)",
  dark: "var(--color-el-dark)",
};

function isCharacterHit(
  outcome: ResolvedPullOutcome,
): outcome is Extract<ResolvedPullOutcome, { kind: "character" }> {
  return outcome.kind === "character";
}

/** What the summary row reports. */
function summarise(results: ResolvedPullOutcome[]) {
  let newUnits = 0;
  let ultRanks = 0;
  let coin = 0;
  let materials = 0;
  for (const outcome of results) {
    if (isCharacterHit(outcome)) {
      if (outcome.isNew) newUnits += 1;
      else ultRanks += 1;
    } else if (outcome.kind === "coin") {
      coin += outcome.amount;
    } else {
      materials += outcome.amount;
    }
  }
  return { newUnits, ultRanks, coin, materials };
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "reward";
}): React.JSX.Element {
  return (
    <span className="flex items-baseline gap-1.5">
      <b
        className={cn(
          "font-heading text-xl leading-none tabular-nums",
          tone === "reward" && "bg-el-light/55 px-1",
        )}
      >
        {value}
      </b>
      <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

export default function PullReveal({
  results,
  drawLabel,
  canDrawAgain,
  onDrawAgain,
  onClose,
}: {
  results: ResolvedPullOutcome[];
  /** e.g. "Draw ×11 · ◆ 50" — the loop this screen exists to serve. */
  drawLabel: string;
  canDrawAgain: boolean;
  onDrawAgain: () => void;
  onClose: () => void;
}): React.JSX.Element | null {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [revealing, setRevealing] = React.useState(true);
  const onCloseAutoFocus = useFocusBackToOpener();

  const summary = summarise(results);

  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete: () => setRevealing(false) });
      results.forEach((outcome, index) => {
        const card = cardRefs.current[index];
        if (!card) return;
        tl.fromTo(
          card,
          { rotateY: 180, opacity: 0 },
          {
            rotateY: 0,
            opacity: 1,
            duration: isCharacterHit(outcome) ? 0.45 : 0.18,
            ease: "power2.out",
          },
          "+=0.05",
        );
      });
      return () => {
        tl.kill();
      };
    },
    { dependencies: [results], scope: containerRef },
  );

  /** Skip is a button now, not a hope. */
  const skip = () => {
    gsap.killTweensOf(cardRefs.current.filter(Boolean));
    cardRefs.current.forEach((card) => {
      if (card) gsap.set(card, { rotateY: 0, opacity: 1 });
    });
    setRevealing(false);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !revealing) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (revealing) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-border bg-muted px-4 py-2.5">
          <DialogTitle className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
            Result · {results.length} pull{results.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            What this summon gave you.
          </DialogDescription>
          {revealing ? (
            <Button variant="ghost" size="xs" onClick={skip}>
              Skip ▸▸
            </Button>
          ) : null}
        </div>

        <div className="hud-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
            style={{ perspective: 900 }}
          >
            {results.map((outcome, index) => {
              const character = isCharacterHit(outcome)
                ? getCharacterById(outcome.characterId)
                : null;
              const art = isCharacterHit(outcome)
                ? getCharacterArt(outcome.characterId)
                : null;
              const hue = character ? EL_HUE[character.color] : undefined;
              return (
                <div
                  key={index}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  style={{
                    backfaceVisibility: "hidden",
                    ...(hue ? { borderTopColor: hue } : {}),
                  }}
                  // A new unit is lifted on the reward gold; a repeat is not.
                  className={cn(
                    "flex flex-col overflow-hidden border-2 border-rule bg-muted",
                    isCharacterHit(outcome) && "border-t-4",
                    isCharacterHit(outcome) && outcome.isNew && "border-border ink-slab-reward",
                  )}
                >
                  {isCharacterHit(outcome) ? (
                    <>
                      <div className="relative aspect-square overflow-hidden bg-card-foreground">
                        {art ? (
                          <Image
                            src={art}
                            alt={character?.name ?? outcome.characterId}
                            fill
                            sizes="160px"
                            priority
                            className="object-cover object-top"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-heading text-3xl text-ground-dim">
                            {(character?.name ?? "?").charAt(0)}
                          </span>
                        )}
                        {character ? (
                          <span
                            className={`absolute left-0 top-0 h-2 w-2 ${ELEMENT_SWATCH[character.color]}`}
                          />
                        ) : null}
                      </div>
                      <div className="px-1.5 py-1">
                        {/* Heading above the name (#141). Tight here - this is
                            a ten-pull grid and the tile already carries a
                            status line below - so it truncates rather than
                            wraps. */}
                        {character?.heading ? (
                          <p className="truncate font-body text-micro font-bold uppercase tracking-label text-muted-foreground">
                            {character.heading}
                          </p>
                        ) : null}
                        <p className="truncate font-heading text-sm leading-tight tracking-title">
                          {character?.name ?? outcome.characterId}
                        </p>
                        {/* The thing the old reveal threw away. */}
                        <p
                          className={cn(
                            "inline-block font-body text-micro font-bold uppercase tracking-label",
                            outcome.isNew ? "bg-el-light/55 px-1" : "text-muted-foreground",
                          )}
                        >
                          {outcome.isNew ? "New" : "+1 Coin"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex aspect-square items-center justify-center border-b border-rule bg-card text-muted-foreground">
                        <ItemIcon
                          id={
                            outcome.kind === "coin" ? "coin" : outcome.materialId
                          }
                          size={56}
                          alt=""
                          fallback={
                            outcome.kind === "coin" ? (
                              <Coins className="h-6 w-6" strokeWidth={1.8} />
                            ) : (
                              <ScrollText className="h-6 w-6" strokeWidth={1.8} />
                            )
                          }
                        />
                      </div>
                      <div className="px-1.5 py-1">
                        <p className="truncate font-body text-label font-bold leading-tight">
                          {outcome.kind === "coin"
                            ? "Coin"
                            : materialLabel(outcome.materialId)}
                        </p>
                        <p className="font-body text-micro font-bold uppercase tracking-label tabular-nums text-muted-foreground">
                          ×{outcome.amount.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* "What did that actually get me", without counting cards. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3">
            <Stat
              value={`${summary.newUnits}`}
              label={summary.newUnits === 1 ? "new unit" : "new units"}
              tone={summary.newUnits > 0 ? "reward" : undefined}
            />
            <Stat
              value={`${summary.ultRanks}`}
              label={summary.ultRanks === 1 ? "ult rank" : "ult ranks"}
            />
            <Stat value={`+${summary.coin.toLocaleString()}`} label="coin" />
            <Stat value={`${summary.materials}`} label="materials" />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t-2 border-border bg-muted px-3 py-2.5">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Done
          </Button>
          {/* Draw again is the loop this screen exists to serve, so it is the
              primary action (ruling #154). */}
          <Button
            size="sm"
            onClick={onDrawAgain}
            disabled={!canDrawAgain || revealing}
            className="flex-1"
          >
            {drawLabel}
          </Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}
