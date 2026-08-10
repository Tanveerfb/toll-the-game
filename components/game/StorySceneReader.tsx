"use client";

import React from "react";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  autoAdvanceDelayMs,
  isNarration,
  portraitSlotsAt,
  activeSideAt,
  revealDurationMs,
  splitWords,
  wordDelayMs,
  WORD_FADE_MS,
} from "@/lib/game/storyScene";
import type { StoryScene } from "@/types/story";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/**
 * VN-style scene reader.
 *
 * Interaction contract (`lib/game/storyScene.ts` owns the logic):
 *  - tap while the line is revealing → finish it instantly
 *  - tap once it's finished → next scene
 * `prefers-reduced-motion` renders every line complete, so the first tap
 * always advances and the reveal never becomes an obstacle.
 */
export default function StorySceneReader({
  scenes,
  chapterTitle,
  /** Uncleared chapters confirm before skipping — one stray tap on a
   *  top-right control shouldn't destroy an intro you've never seen. Replays
   *  skip immediately (the brief's SKIP STORY already means that). */
  confirmSkip = false,
  onFinish,
}: {
  scenes: StoryScene[];
  chapterTitle: string;
  confirmSkip?: boolean;
  onFinish: () => void;
}): React.JSX.Element {
  const [index, setIndex] = React.useState(0);
  const [revealDone, setRevealDone] = React.useState(false);
  const [instant, setInstant] = React.useState(false);
  const [auto, setAuto] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [skipPrompt, setSkipPrompt] = React.useState(false);

  const scene = scenes[index];
  const text = scene?.text ?? "";

  // An external store, so useSyncExternalStore rather than effect+setState —
  // the server snapshot is always false, since there is no matchMedia there.
  const reducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const showAll = instant || reducedMotion;

  // Reset the reveal when the scene changes, or a completed line leaks into
  // the next panel. Adjusted during render (React's documented pattern for
  // resetting state on a changed input) instead of in an effect, which would
  // paint the previous line's progress for a frame first.
  const [renderedIndex, setRenderedIndex] = React.useState(index);
  if (renderedIndex !== index) {
    setRenderedIndex(index);
    setRevealDone(false);
    setInstant(false);
  }

  // One timer for the whole line, not a ticker: the stagger itself is CSS
  // (per-word animation-delay), so React doesn't re-render per word. This only
  // needs to know when the line counts as fully revealed, for the tap contract
  // and auto-advance.
  React.useEffect(() => {
    if (showAll || !text) return;
    const timer = window.setTimeout(() => setRevealDone(true), revealDurationMs(text));
    return () => window.clearTimeout(timer);
  }, [text, showAll]);

  // onFinish must fire outside the setIndex updater — parent setState inside
  // an updater is a setState-during-render violation.
  const advance = React.useCallback(() => {
    if (index + 1 >= scenes.length) {
      onFinish();
    } else {
      setIndex(index + 1);
    }
  }, [index, scenes.length, onFinish]);

  const complete = React.useCallback(() => setInstant(true), []);

  const isComplete = showAll || revealDone;

  const handleTap = React.useCallback(() => {
    if (historyOpen || skipPrompt) return;
    if (isComplete) advance();
    else complete();
  }, [advance, complete, historyOpen, isComplete, skipPrompt]);

  // Auto-advance: dwell after the line finishes, cancelled by any manual tap
  // (which flips `auto` off through the toggle, or lands us on a new index).
  React.useEffect(() => {
    if (!auto || !isComplete || historyOpen || skipPrompt) return;
    const timer = window.setTimeout(advance, autoAdvanceDelayMs(text));
    return () => window.clearTimeout(timer);
  }, [auto, isComplete, advance, text, historyOpen, skipPrompt]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleTap();
      }
      if (event.key === "Escape") {
        setHistoryOpen(false);
        setSkipPrompt(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTap]);

  // Empty scene lists (an outro-less chapter) finish immediately
  React.useEffect(() => {
    if (scenes.length === 0) onFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.length]);

  if (!scene) {
    return <div className="flex-1" />;
  }

  const narration = isNarration(scene);
  const slots = portraitSlotsAt(scenes, index);
  const activeSide = activeSideAt(scenes, index);

  const requestSkip = () => {
    if (confirmSkip) setSkipPrompt(true);
    else onFinish();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleTap}
      className="relative flex h-full w-full flex-1 cursor-pointer flex-col justify-center overflow-hidden text-left"
      aria-label="Advance story"
    >
      {/* Letterbox bars. Present for narration only — the cinematic framing is
          what separates narration from a character speaking now that they no
          longer share one identical box. */}
      <AnimatePresence>
        {narration ? (
          <>
            <m.div
              initial={{ height: 0 }}
              animate={{ height: 44 }}
              exit={{ height: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-black"
            />
            <m.div
              initial={{ height: 0 }}
              animate={{ height: 44 }}
              exit={{ height: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black"
            />
          </>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
        <p className="font-heading text-sm tracking-[0.18em] text-readout-muted">
          {chapterTitle.toUpperCase()}
        </p>
        <span className="pointer-events-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setAuto((v) => !v);
            }}
            className={`rounded-none border font-body text-[10px] uppercase tracking-[0.16em] ${
              auto
                ? "chamfer border-signal bg-signal text-void"
                : "chamfer border-edge text-readout-dim hover:text-readout"
            }`}
          >
            Auto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setHistoryOpen(true);
            }}
            className="chamfer rounded-none border border-edge font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-dim hover:text-signal"
          >
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              requestSkip();
            }}
            className="chamfer rounded-none border border-edge font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-dim hover:text-signal"
          >
            Skip ▸▸
          </Button>
        </span>
      </div>

      {/* Two independent, permanently-positioned slots (not one div whose side
          flips via className) — a speaker's portrait only ever animates within
          its own slot. Previously both sides shared one container, so
          switching speakers teleported the container to the new side WHILE the
          old portrait was still mid-exit, flashing the wrong character in the
          new speaker's spot for a frame (Tanveer 2026-07-20). */}
      <PortraitSlot
        side="left"
        portraitId={slots.left}
        dimmed={activeSide !== "left"}
      />
      <PortraitSlot
        side="right"
        portraitId={slots.right}
        dimmed={activeSide !== "right"}
      />

      <m.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`relative z-10 mx-auto w-full px-4 ${
          narration ? "max-w-2xl" : "max-w-3xl"
        }`}
      >
        {narration ? (
          // No box, no name plate, no "· · ·" filler — narration reads as the
          // camera talking, not as a character with no name.
          <p className="text-center font-body text-base italic leading-loose tracking-wide text-readout-dim md:text-lg">
            <RevealedText text={text} settled={showAll} />
          </p>
        ) : (
          <div className="chamfer-lg border border-edge bg-panel/95 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-2">
              <p className="font-heading text-lg tracking-[0.14em] text-signal">
                {scene.speaker?.toUpperCase()}
              </p>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
                {index + 1} / {scenes.length}
              </p>
            </div>
            <p className="min-h-20 px-5 py-4 font-body text-sm leading-relaxed text-readout md:text-base">
              <RevealedText text={text} settled={showAll} />
            </p>
            <p className="border-t border-hairline px-5 py-1.5 text-right font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
              {isComplete ? "Tap to continue ▸" : "Tap to reveal"}
            </p>
          </div>
        )}
        {narration ? (
          <p className="mt-4 text-center font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            {index + 1} / {scenes.length} ·{" "}
            {isComplete ? "Tap to continue ▸" : "Tap to reveal"}
          </p>
        ) : null}
      </m.div>

      {historyOpen ? (
        <HistoryOverlay
          scenes={scenes}
          upTo={index}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}

      {skipPrompt ? (
        <SkipPrompt
          onCancel={() => setSkipPrompt(false)}
          onConfirm={onFinish}
        />
      ) : null}
    </div>
  );
}

/**
 * The line, laid out in full from the first frame, with each word fading up on
 * a staggered delay.
 *
 * Slicing the string character by character (the first attempt) meant the
 * paragraph reflowed on every wrap and the eye kept landing on half-words, so
 * the only way to read was to wait for the animation to finish — exactly what
 * Tanveer reported. Animating opacity over final layout inverts that: the text
 * never moves, so it can be read ahead of the animation.
 *
 * `settled` renders everything at full opacity with no animation at all — used
 * for reduced motion and for tap-to-complete.
 *
 * The stagger is CSS, so revealing a 60-word paragraph costs one React render
 * rather than sixty.
 */
function RevealedText({
  text,
  settled,
}: {
  text: string;
  settled: boolean;
}): React.JSX.Element {
  const words = React.useMemo(() => splitWords(text), [text]);

  if (settled) return <>{text}</>;

  return (
    <>
      {words.map((word, i) => (
        <span
          key={`${i}-${word}`}
          className="story-word"
          style={{
            animationDelay: `${wordDelayMs(i, text)}ms`,
            animationDuration: `${WORD_FADE_MS}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </>
  );
}

/**
 * One side's portrait. The non-speaking side stays on screen, dimmed and
 * desaturated, rather than unmounting — that retention is what makes a
 * two-hander look like a conversation instead of one portrait popping between
 * two empty slots.
 */
function PortraitSlot({
  side,
  portraitId,
  dimmed,
}: {
  side: "left" | "right";
  portraitId: string | null;
  dimmed: boolean;
}): React.JSX.Element {
  const art = portraitId ? getCharacterArt(portraitId) : null;
  return (
    <div
      className={`pointer-events-none absolute bottom-0 z-0 ${
        side === "left" ? "left-0 md:left-6" : "right-0 md:right-6"
      }`}
    >
      <AnimatePresence mode="wait">
        {art ? (
          <m.div
            key={portraitId}
            initial={{ opacity: 0, x: side === "left" ? -24 : 24 }}
            animate={{
              opacity: dimmed ? 0.35 : 1,
              x: 0,
              filter: dimmed ? "grayscale(0.7) brightness(0.6)" : "none",
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative"
          >
            <Image
              src={art}
              alt={portraitId ?? "Portrait"}
              width={512}
              height={512}
              priority
              // 3:4 rather than square, larger, and no hard border — a bordered
              // square crop reads as a UI thumbnail, not a character present in
              // the scene.
              className="h-72 w-[13.5rem] object-cover object-top md:h-[26rem] md:w-[19.5rem]"
            />
            {/* Bottom fade seats the figure instead of letting it end on a cut */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,#09090b_10%,transparent)]" />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HistoryOverlay({
  scenes,
  upTo,
  onClose,
}: {
  scenes: StoryScene[];
  upTo: number;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-hairline bg-inset px-5 py-3">
        <p className="font-heading text-lg tracking-[0.14em] text-readout-strong">
          HISTORY
        </p>
        <Button
          onClick={onClose}
          className="chamfer h-11 rounded-none border border-signal bg-signal px-5 font-heading text-sm tracking-[0.12em] text-void"
        >
          CLOSE
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {scenes.slice(0, upTo + 1).map((scene, i) => (
          <div key={i} className="border-l border-edge pl-3">
            <p className="font-heading text-xs tracking-[0.14em] text-signal">
              {scene.speaker?.toUpperCase() ?? "NARRATION"}
            </p>
            <p className="mt-1 font-body text-sm leading-relaxed text-readout-dim">
              {scene.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkipPrompt({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="chamfer-lg w-full max-w-sm border border-signal bg-panel p-5">
        <p className="font-heading text-xl tracking-[0.12em] text-signal">
          SKIP THESE SCENES?
        </p>
        <p className="mt-2 font-body text-sm text-readout-dim">
          You haven&apos;t seen this chapter yet. You can replay it later from
          the chapter list.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={onCancel}
            variant="ghost"
            className="chamfer h-11 flex-1 rounded-none border border-edge font-heading text-sm tracking-[0.12em] text-readout-dim hover:text-signal"
          >
            KEEP READING
          </Button>
          <Button
            onClick={onConfirm}
            className="chamfer h-11 flex-1 rounded-none border border-signal bg-signal font-heading text-sm tracking-[0.12em] text-void"
          >
            SKIP
          </Button>
        </div>
      </div>
    </div>
  );
}
