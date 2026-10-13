"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import { animate, stagger, useReducedMotion } from "framer-motion";
import type { AnimationPlaybackControlsWithThen, AnimationSequence } from "framer-motion";
import { Coins, ScrollText } from "lucide-react";
import type { ResolvedPullOutcome } from "@/store/playerStore";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { elementCode, elementHue } from "@/lib/game/elementStyle";
import ItemIcon from "@/components/game/ItemIcon";
import UnitTileFace from "@/components/game/UnitTileFace";
import { materialLabel } from "@/lib/game/materials";
import { COIN_ITEM_ID, summarisePull } from "@/lib/gacha/resultSummary";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFocusBackToOpener } from "@/hooks/useReturnFocus";

/**
 * Pull results.
 *
 * This screen used to dismiss itself: the reveal sequence's completion was
 * wired straight to the caller's close handler, so an 11-pull flipped past and
 * vanished with no skip and no way back (Tanveer, 2026-08-11). It now plays in
 * and **stays** — the sequence only clears the "still animating" flag. The
 * sequence is framer-motion's imperative `animate()`, the one animation
 * library the game uses (GSAP left on 2026-10-13).
 *
 * It also says what you got. Characters are the archive's tiles, a plate saying
 * "New!" or "+1 coin" and a line under each; everything else is ONE paper list
 * with the quantities summed, because an 11-pull used to print Coin ×6,000 as
 * three separate cards and a player counted cards to learn their totals
 * (Tanveer's pick, 2026-10-03, the gacha overhaul mockup, deleted 2026-10-13, ruling #188). The
 * grouping is `lib/gacha/resultSummary.ts`.
 *
 * **The shadcn `Dialog` since 2026-09-26** (ruling #154), in place of a
 * hand-built portal. Two rules carry over deliberately: it cannot be closed
 * while the results are still playing in (Escape and the backdrop both wait),
 * and the backdrop never closes it at all, because a stray tap on the scrim of a
 * reveal is not a player meaning to leave it.
 *
 * It fills a phone and is the usual panel on anything wider. The pop-in is
 * transform and opacity only and does not run under `prefers-reduced-motion`.
 */

export default function PullReveal({
  results,
  bannerName,
  drawLabel,
  canDrawAgain,
  onDrawAgain,
  onClose,
}: {
  results: ResolvedPullOutcome[];
  bannerName: string;
  /** e.g. "Draw ×11 · ◆ 50" — the loop this screen exists to serve. */
  drawLabel: string;
  canDrawAgain: boolean;
  onDrawAgain: () => void;
  onClose: () => void;
}): React.JSX.Element | null {
  // State, not a ref: the Dialog portals its content one commit after the
  // first render, so a ref is still null when the mount effect runs and the
  // sequence would never start. A callback ref re-runs the effect on mount.
  const [container, setContainer] = React.useState<HTMLDivElement | null>(
    null,
  );
  const sequenceRef = React.useRef<AnimationPlaybackControlsWithThen | null>(
    null,
  );
  // The batch whose play-in has finished (or been skipped). `revealing` is
  // derived from it rather than set, so a new batch closes the gate again by
  // identity alone, and nothing writes state from inside the effect.
  const [revealedBatch, setRevealedBatch] = React.useState<
    ResolvedPullOutcome[] | null
  >(null);
  // Nothing to wait for when the player asked for no motion: the results are
  // simply there, and Draw again is live at once.
  const reduceMotion = useReducedMotion() ?? false;
  const revealing =
    !reduceMotion && results.length > 0 && revealedBatch !== results;
  const onCloseAutoFocus = useFocusBackToOpener();

  const summary = summarisePull(results);

  React.useEffect(() => {
    if (reduceMotion || !container) return;

    // Each step is added only when its target exists: `animate()` throws on
    // an empty selection, and a single pull can be all coin or all tiles.
    const units = container.querySelectorAll<HTMLElement>("[data-reveal='unit']");
    const rest = container.querySelector<HTMLElement>("[data-reveal='rest']");
    const sequence: AnimationSequence = [];
    if (units.length > 0) {
      sequence.push([
        units,
        { opacity: [0, 1], y: [18, 0], scale: [0.9, 1] },
        { duration: 0.28, ease: "easeOut", delay: stagger(0.09) },
      ]);
    }
    if (rest) {
      sequence.push([rest, { opacity: [0, 1] }, { duration: 0.2, ease: "easeOut" }]);
    }
    if (sequence.length === 0) return;

    const controls = animate(sequence);
    sequenceRef.current = controls;
    // Settles when the sequence ends or Skip calls `complete()`. The `stop()`
    // below leaves it unsettled, so a batch replaced mid-reveal never marks
    // its successor as revealed.
    controls.then(() => setRevealedBatch(results));
    return () => {
      controls.stop();
      sequenceRef.current = null;
    };
  }, [container, results, reduceMotion]);

  /** Skip is a button now, not a hope. */
  const skip = () => {
    sequenceRef.current?.complete();
    setRevealedBatch(results);
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
        // The title names it; no description is read out.
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (revealing) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={onCloseAutoFocus}
        // Ground, not paper: the results are the page's one big moment. Full
        // screen on a phone; the usual centred panel from `sm`.
        className="ground-halftone flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 overflow-hidden border-ground-line bg-background p-0 text-foreground sm:h-auto sm:max-h-[92dvh] sm:max-w-panel"
      >
        <div ref={setContainer} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-baseline justify-between gap-3 border-b-2 border-ground-line px-3 pb-2 pt-3">
            <DialogTitle className="text-3xl">
              {results.length} pull{results.length === 1 ? "" : "s"}
            </DialogTitle>
            {revealing ? (
              <Button variant="ghost" size="xs" onClick={skip}>
                Skip ▸▸
              </Button>
            ) : (
              <span className="font-body text-label font-bold uppercase tracking-eyebrow text-ground-dim">
                {bannerName}
              </span>
            )}
          </div>

          <div className="hud-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
            {summary.characters.length > 0 ? (
              <section className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between border-b border-ground-line pb-1">
                  <h3 className="font-heading text-lg leading-none tracking-title">
                    Units
                  </h3>
                  <span className="font-body text-label font-bold uppercase tracking-label text-ground-dim">
                    {summary.characters.length} of {results.length}
                  </span>
                </div>
                {/* Room above each row for a head to break out of its frame and
                    below for the plate that overlaps the bottom edge. */}
                <ul className="grid grid-cols-3 gap-x-4 gap-y-6 px-1.5 pb-2 pt-8">
                  {summary.characters.map((hit, index) => {
                    const character = getCharacterById(hit.characterId);
                    const name = character?.name ?? hit.characterId;
                    return (
                      <li
                        key={index}
                        data-reveal="unit"
                        className="flex flex-col gap-3 text-center"
                      >
                        <UnitTileFace
                          id={hit.characterId}
                          name={name}
                          hue={elementHue(character?.color ?? "light")}
                          code={character ? elementCode(character.color) : ""}
                          plate={hit.isNew ? "New!" : "+1 coin"}
                          plateTone={hit.isNew ? "highlight" : "element"}
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-heading text-sm leading-tight tracking-title">
                            {name}
                          </span>
                          {/* The thing the old reveal threw away: a first copy
                              or a fourth. */}
                          <span
                            className={
                              hit.isNew
                                ? "font-body text-label font-bold uppercase tracking-label text-primary"
                                : "font-body text-label font-bold uppercase tracking-label text-ground-dim"
                            }
                          >
                            {hit.isNew ? "New character" : "Duplicate · ult coin"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {summary.items.length > 0 ? (
              <section data-reveal="rest" className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between border-b border-ground-line pb-1">
                  <h3 className="font-heading text-lg leading-none tracking-title">
                    Materials
                  </h3>
                </div>
                {/* One paper list, quantities summed. */}
                <ul className="border-2 border-border bg-card px-2.5 py-1 text-card-foreground">
                  {summary.items.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[2.125rem_1fr_auto] items-center gap-2.5 border-b border-rule py-1.5 last:border-b-0"
                    >
                      <ItemIcon
                        id={item.id}
                        size={34}
                        alt=""
                        fallback={
                          item.id === COIN_ITEM_ID ? (
                            <Coins className="size-6" strokeWidth={1.8} />
                          ) : (
                            <ScrollText className="size-6" strokeWidth={1.8} />
                          )
                        }
                      />
                      <span className="min-w-0 truncate font-body text-sm font-bold">
                        {item.id === COIN_ITEM_ID ? "Coin" : materialLabel(item.id)}
                      </span>
                      <span className="font-body text-sm font-bold tabular-nums">
                        ×{item.amount.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="grid shrink-0 grid-cols-[1fr_1.6fr] gap-2.5 border-t-2 border-ground-line px-3 pt-2.5 pb-safe">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Done
            </Button>
            {/* Draw again is the loop this screen exists to serve, so it is the
                primary action (ruling #154). */}
            <Button
              size="lg"
              onClick={onDrawAgain}
              disabled={!canDrawAgain || revealing}
            >
              {drawLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
