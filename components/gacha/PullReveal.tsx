"use client";

import Image from "next/image";
import React from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Coins, ScrollText } from "lucide-react";
import type { ResolvedPullOutcome } from "@/store/playerStore";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import ItemIcon from "@/components/game/ItemIcon";
import { materialLabel } from "@/lib/game/materials";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";

gsap.registerPlugin(useGSAP);

// Never resubscribes — it exists only so the server snapshot and the client
// snapshot differ, which is what makes the portal hydration-safe.
const NO_SUBSCRIBE = () => () => {};

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
  tone?: "signal";
}): React.JSX.Element {
  return (
    <span className="flex items-baseline gap-1.5">
      <b
        className={`font-heading text-xl leading-none tabular-nums ${tone === "signal" ? "text-signal" : "text-readout-strong"}`}
      >
        {value}
      </b>
      <span className="font-body text-[10px] font-bold uppercase tracking-[0.12em] text-readout-muted">
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
  const mounted = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

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

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !revealing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, revealing]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pull results"
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 px-3 py-4 backdrop-blur-sm"
    >
      <div className="chamfer-lg flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden border border-edge-strong bg-panel">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline bg-inset px-4 py-2.5">
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
            Result · {results.length} pull{results.length === 1 ? "" : "s"}
          </span>
          {revealing ? (
            <button
              type="button"
              onClick={skip}
              className="flex min-h-11 items-center border border-edge px-3 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-dim transition-colors hover:border-signal hover:text-signal"
            >
              Skip ▸▸
            </button>
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
                  className={`flex flex-col overflow-hidden border border-hairline bg-inset ${
                    isCharacterHit(outcome) ? "border-t-2" : ""
                  } ${isCharacterHit(outcome) && outcome.isNew ? "shadow-[inset_0_0_0_1px_var(--color-el-light)]" : ""}`}
                >
                  {isCharacterHit(outcome) ? (
                    <>
                      <div className="relative aspect-square overflow-hidden bg-void">
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
                          <span className="flex h-full w-full items-center justify-center font-heading text-3xl text-readout-dim">
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
                        <p className="truncate font-heading text-sm leading-tight tracking-[0.04em] text-readout-strong">
                          {character?.name ?? outcome.characterId}
                        </p>
                        {/* The thing the old reveal threw away. */}
                        <p
                          className={`font-body text-[9px] font-bold uppercase tracking-[0.12em] ${outcome.isNew ? "text-el-light" : "text-signal"}`}
                        >
                          {outcome.isNew ? "New" : "+1 Coin"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex aspect-square items-center justify-center bg-void text-readout-muted">
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
                        <p className="truncate font-body text-[10px] font-semibold leading-tight text-readout">
                          {outcome.kind === "coin"
                            ? "Coin"
                            : materialLabel(outcome.materialId)}
                        </p>
                        <p className="font-body text-[9px] font-bold uppercase tracking-[0.12em] tabular-nums text-readout-muted">
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
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-3">
            <Stat
              value={`${summary.newUnits}`}
              label={summary.newUnits === 1 ? "new unit" : "new units"}
              tone={summary.newUnits > 0 ? "signal" : undefined}
            />
            <Stat
              value={`${summary.ultRanks}`}
              label={summary.ultRanks === 1 ? "ult rank" : "ult ranks"}
            />
            <Stat value={`+${summary.coin.toLocaleString()}`} label="coin" />
            <Stat value={`${summary.materials}`} label="materials" />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-hairline bg-inset px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 border border-edge px-4 py-2.5 text-center font-body text-[11px] font-bold uppercase tracking-[0.16em] text-readout-dim transition-colors hover:border-edge-strong hover:text-readout"
          >
            Done
          </button>
          <button
            type="button"
            onClick={onDrawAgain}
            disabled={!canDrawAgain || revealing}
            className="min-h-11 flex-1 border border-signal bg-signal/12 px-4 py-2.5 text-center font-body text-[11px] font-bold uppercase tracking-[0.16em] text-signal transition-colors hover:bg-signal/20 disabled:border-hairline disabled:bg-transparent disabled:text-readout-muted"
          >
            {drawLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
