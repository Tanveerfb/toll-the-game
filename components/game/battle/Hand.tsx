"use client";

import React from "react";
import Image from "next/image";
import { ArrowBigDown, ArrowBigUp, Heart, Sword, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCharacterArt, getSkillArt } from "@/lib/game/characterArt";
import { getCardFrameStyle } from "@/lib/game/cardFrameStyle";
import { moveCardById } from "@/lib/game/deck";
import {
  classifyExit,
  mergePartnerIds,
  removedCardIds,
} from "@/lib/game/handTransition";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";

/**
 * The hand, and every animation in it.
 *
 * Split out of `Deck.tsx` on 2026-08-12. Cards used to teleport: HTML5
 * drag-and-drop gave no positional feedback, a merge simply deleted one card
 * and incremented another, and a fresh turn's cards appeared already dealt and
 * already merged. Tanveer's ask was that any time cards interact, the
 * interaction is animated.
 *
 * Three mechanisms, deliberately hand-rolled rather than reached for from
 * framer-motion: `MotionProvider` loads `domAnimation`, which excludes both
 * `layout` and `drag`, and pulling in `domMax` would grow the bundle on every
 * screen for a feature used on one.
 *
 *   1. **FLIP** — measure before, let React render, measure after, then play
 *      each card from its old box to its new one. One flex row, so this is
 *      about twenty lines and stays predictable next to the arena's shake
 *      transform (which has already trapped one `position: fixed` overlay).
 *   2. **Ghosts** — React unmounts a card the instant it merges, so its exit
 *      is played by a body-appended clone positioned at its last box. Body,
 *      not in place: the deck wrapper carries a `scale` during big-hit focus,
 *      and a transform would make `fixed` coordinates lie.
 *   3. **Pointer drag** — the dragged node is transformed directly rather than
 *      through React state, and the drop target is only pushed to state when it
 *      actually changes, so a pointermove costs a render only when the preview
 *      genuinely differs. Hit-testing runs against boxes frozen at drag start
 *      (`dragRects`); against the live DOM the preview reorder fed back into
 *      its own input and the row oscillated (issue #27).
 *
 * The drag preview and the committed move both run through `moveCardById`, so
 * where a card appears to land is where it lands.
 */

/* ── profiling ──────────────────────────────────────────────────────────── */

/**
 * Cheap counters for the animation cost pass (Open Issue #27).
 *
 * The issue asks to "start with a profile, not the list", and a profile needs a
 * browser and a real hand. Read these from the console after a fight:
 *
 *   window.__handProfile          // { layoutPasses, rectsMeasured, ghostsFlown }
 *   window.__handProfile.reset()
 *
 * A layout pass measures every card, so `rectsMeasured / layoutPasses` is the
 * hand size and `layoutPasses` is the number that matters: it should be about
 * one per real hand change, NOT one per pointermove.
 */
const handProfile = {
  layoutPasses: 0,
  rectsMeasured: 0,
  ghostsFlown: 0,
  reset() {
    this.layoutPasses = 0;
    this.rectsMeasured = 0;
    this.ghostsFlown = 0;
  },
};

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__handProfile = handProfile;
}

/* ── card face ──────────────────────────────────────────────────────────── */

type SkillTypeCategory = "attack" | "attackDebuff" | "buff" | "debuff" | "heal";

const DEBUFF_MECHANICS = new Set([
  "debuff",
  "seal",
  "stun",
  "shock",
  "bleed",
  "corrosion",
  "decay",
  "weaken",
  "extort",
  "rupture",
  "disable",
  "ignite",
]);

function skillTypeCategory(skill: ActionCard["skill"]): SkillTypeCategory {
  switch (skill.type) {
    case "heal":
    case "cleanse":
      return "heal";
    case "buff":
    case "stance":
      return "buff";
    case "debuff":
    case "disable":
      return "debuff";
    default: {
      const hasDebuff = (skill.mechanics ?? []).some((m) =>
        DEBUFF_MECHANICS.has(m.type),
      );
      return hasDebuff ? "attackDebuff" : "attack";
    }
  }
}

/** Skill type is a glyph, not a colour — the screen already carries five
 *  element hues. */
const SKILL_TYPE_ICON: Record<SkillTypeCategory, React.ElementType> = {
  attack: Sword,
  attackDebuff: Swords,
  buff: ArrowBigUp,
  debuff: ArrowBigDown,
  heal: Heart,
};

/** Merge tier. Deliberately not stars — a star row reads as rarity, which is
 *  a different axis and one this game also has. */
function getRankPips(rank: 1 | 2 | 3): string {
  return `${"◆".repeat(rank)}${"◇".repeat(3 - rank)}`;
}

function getSkillPowerText(card: ActionCard): string {
  if (card.skill.type === "ultimate") return `Power ${card.skill.damage}`;
  return `Power ${card.skill.damageRanked[card.rank - 1]}`;
}

function getCharacterInitial(name?: string): string {
  if (!name || name.trim().length === 0) return "?";
  return name.trim().charAt(0).toUpperCase();
}

/** Radius and circumference of the hold ring. The circumference is handed to
 *  CSS because `stroke-dashoffset` animates from it to zero, and CSS has no
 *  way to compute 2πr. */
const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

/**
 * The hold-to-open ring.
 *
 * Mounted once a press outlasts a tap, unmounted the instant it ends — so its
 * animation starts and stops with the gesture and needs no progress state.
 * It fills over the remainder of the hold, not the whole of it, because the
 * first `TAP_MAX_MS` is already spent by the time it appears.
 */
function HoldRing({ durationMs }: { durationMs: number }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-void/55"
    >
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={RING_R}
          fill="none"
          strokeWidth="3"
          className="stroke-edge-strong"
        />
        <circle
          cx="22"
          cy="22"
          r={RING_R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="butt"
          strokeDasharray={RING_C}
          className="hold-ring-sweep stroke-signal"
          style={
            {
              "--hold-circumference": RING_C,
              "--hold-duration": `${durationMs}ms`,
            } as React.CSSProperties
          }
        />
      </svg>
    </span>
  );
}

/* ── animation constants ────────────────────────────────────────────────── */

const EASE_OUT = "cubic-bezier(0.16, 0.9, 0.28, 1)";
const EASE_IN = "cubic-bezier(0.5, 0, 0.9, 0.4)";

const REFLOW_MS = 180;
const ENTER_MS = 220;
const MERGE_FLY_MS = 220;
const MERGE_PUNCH_MS = 260;
const EXIT_MS = 200;
/** Pointer travel that turns a press into a drag. Below this it's still a tap
 *  (or a hold), which is what makes the hold gesture possible at all. */
const DRAG_THRESHOLD_PX = 6;
/**
 * A release faster than this is a **tap** — it plays the card.
 *
 * It is also when the hold ring appears. Below it nothing is drawn, so an
 * ordinary tap never flashes a ring on its way out.
 */
const TAP_MAX_MS = 180;
/**
 * A press this long opens the card's details — the full sweep of the ring
 * (Tanveer, 2026-08-21: *"they have to hold that until the animation plays
 * before the modal opens"*).
 *
 * **Change here and the ring follows**, because the ring's duration is derived
 * from this constant rather than written into the CSS.
 *
 * Was 3000 for about an hour. Three seconds is *confirmation* length — the
 * pacing of "delete this permanently", not of "what does this card do", and
 * reading a card is something you want mid-fight with a turn to finish.
 * 1500 still reads as a deliberate press rather than a slow tap, which is all
 * the ring has to prove (Tanveer, 2026-08-21: *"3s sure is long. maybe try
 * 1.5sec?"*).
 */
const HOLD_DETAIL_MS = 1500;

/* ── the hand ───────────────────────────────────────────────────────────── */

export interface HandProps {
  /** What to draw — the *presented* hand, which during a deal lags the store. */
  cards: ActionCard[];
  playerTeam: BattleCharacter[];
  interactive: boolean;
  /** No action slots left: cards still read, but dim. */
  queueFull: boolean;
  reducedMotion: boolean;
  onSelect: (cardId: string) => void;
  onMerge: (cardId: string) => void;
  onReorder: (draggedCardId: string, targetCardId: string) => void;
  onPreviewStart: (card: ActionCard) => void;
  onPreviewEnd: () => void;
  /**
   * Press-and-hold a card. On a desktop the floating preview above the hand
   * answers "what does this do"; a phone has no hover, so before 2026-08-21
   * there was **no way at all** to read a card's skill in battle. Hold is that
   * way (Tanveer: *"tap and hold will open the details of that card in an
   * overlay modal"*).
   */
  onDetail: (card: ActionCard) => void;
  /** True while a card can merge by the *button's* looser rule. Kept as a
   *  prop so the hand doesn't re-derive a mechanic it doesn't own. */
  canUseMergeButton: (card: ActionCard) => boolean;
}

export default function Hand({
  cards,
  playerTeam,
  interactive,
  queueFull,
  reducedMotion,
  onSelect,
  onMerge,
  onReorder,
  onPreviewStart,
  onPreviewEnd,
  onDetail,
  canUseMergeButton,
}: HandProps): React.JSX.Element {
  const nodes = React.useRef(new Map<string, HTMLDivElement>());

  const [holdId, setHoldId] = React.useState<string | null>(null);
  /**
   * The card currently showing a hold ring.
   *
   * Set once a press outlasts a tap, cleared the moment it ends — so mounting
   * the ring is what starts its animation, and there is no progress value to
   * drive from React. A 3s fill re-rendering the hand every frame would be a
   * lot of work for a gesture whose only output is one modal.
   */
  const [ringId, setRingId] = React.useState<string | null>(null);
  /**
   * A card whose Merge button has been pressed, waiting for you to pick which
   * partner it eats.
   *
   * Merging used to be a drag, and a drag is the one gesture a phone can't
   * spare here — it fights the horizontal scroll of the row it happens in, on
   * a card 56px wide. So on touch the card's own Merge button arms instead:
   * partners light up, everything else recedes, and a tap commits (Tanveer,
   * 2026-08-21). Drag still works and is still the faster desktop path.
   */
  const [armedId, setArmedId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = React.useState<string | null>(null);

  /**
   * The live press, written only from pointer handlers.
   *
   * The React state above exists to *render* the highlight; this exists so the
   * handlers can read what they themselves just wrote. Mirroring state into a
   * ref during render is what `react-hooks/refs` (rightly) forbids, and the
   * handlers installed on pointerdown would otherwise close over the values as
   * they were at press time — always one interaction stale.
   */
  const press = React.useRef<{
    id: string;
    node: HTMLDivElement;
    originX: number;
    originY: number;
    /** Past the drag threshold — a drag, not a tap or a hold. */
    active: boolean;
    /** The hold ran its full course: this press opened the details, so the
     *  release must not also play the card. */
    held: boolean;
    /** When the press started, so the release can tell a tap from an abandoned
     *  hold — the two mean opposite things and must not share an outcome. */
    startedAt: number;
    dropTargetId: string | null;
    mergeTargetId: string | null;
    /** Shows the ring once the press outlasts a tap. */
    ringTimer: ReturnType<typeof setTimeout> | null;
    /** Opens the details when the ring completes. */
    detailTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  /**
   * Card boxes frozen at the moment the drag began.
   *
   * Hit-testing used `document.elementFromPoint` against the LIVE DOM, which
   * fed the preview reorder back into its own input: hovering a neighbour
   * reflowed the row, a different card landed under a stationary pointer, that
   * reordered again, and the hand oscillated. That is the "unstable when
   * hovering a held card over another" report, artifacts included — each flip
   * also restarted every card's FLIP animation (Tanveer, 2026-08-13).
   *
   * Frozen boxes make the hit-test a pure function of pointer position, so the
   * preview can never change what the pointer is considered to be over. The
   * hand cannot legitimately reflow mid-drag — nothing enters or leaves it —
   * so there is nothing for them to go stale against.
   */
  const dragRects = React.useRef<Array<{ id: string; rect: DOMRect }>>([]);

  // A drag previews its own outcome: the row reflows through the same function
  // that will commit the move. Over a merge target the order is left alone —
  // it's a target now, not a gap.
  const displayed = React.useMemo(() => {
    if (!dragId || !dropTargetId || mergeTargetId) return cards;
    return moveCardById(cards, dragId, dropTargetId);
  }, [cards, dragId, dropTargetId, mergeTargetId]);

  // Partners light for two different reasons — a drag in progress, and an
  // armed Merge button — and they light identically, because to the player
  // they mean the same thing: these are the cards this one can eat.
  const focusId = armedId ?? holdId;
  const partnerIds = React.useMemo(() => {
    if (!focusId) return new Set<string>();
    const held = cards.find((c) => c.id === focusId);
    return held ? new Set(mergePartnerIds(held, cards)) : new Set<string>();
  }, [focusId, cards]);

  // Derived, not cleaned up in an effect: an arm whose partners have left the
  // hand — a fresh deal, a merge committed elsewhere — simply stops counting
  // as armed. Reconciling it with a `setArmedId(null)` would be a second
  // render to reach a state this expression already describes.
  const armed = armedId !== null && partnerIds.size > 0 ? armedId : null;

  /* ── FLIP + ghosts ────────────────────────────────────────────────────── */

  const previous = React.useRef<{
    rects: Map<string, DOMRect>;
    cards: ActionCard[];
    /** Detached clones, not `outerHTML` strings. Serialising to markup and
     *  reparsing it to fly one ghost was work done twice for no benefit. */
    faces: Map<string, HTMLElement>;
  } | null>(null);

  React.useLayoutEffect(() => {
    const rects = new Map<string, DOMRect>();
    nodes.current.forEach((node, id) => {
      if (node.isConnected) rects.set(id, node.getBoundingClientRect());
    });
    handProfile.layoutPasses += 1;
    handProfile.rectsMeasured += rects.size;

    const before = previous.current;
    // The dragged node is positioned by hand, so FLIP must leave it alone.
    // Read off the interaction ref rather than the rendered state, so this
    // effect doesn't need `dragId` in its dependency list.
    const live = press.current;
    const dragging = live?.active ? live.id : null;

    if (before && !reducedMotion) {
      for (const id of removedCardIds(before.cards, displayed)) {
        const removed = before.cards.find((c) => c.id === id);
        const from = before.rects.get(id);
        const face = before.faces.get(id);
        if (!removed || !from || !face) continue;

        const exit = classifyExit(removed, before.cards, displayed);
        const into =
          exit.kind === "merged" ? (rects.get(exit.intoCardId) ?? null) : null;
        flyGhost(face, from, into);
        if (exit.kind === "merged") {
          punch(nodes.current.get(exit.intoCardId));
        }
      }

      rects.forEach((after, id) => {
        if (id === dragging) return;
        const node = nodes.current.get(id);
        if (!node) return;
        const from = before.rects.get(id);
        if (!from) {
          dealIn(node);
          return;
        }
        const dx = from.left - after.left;
        const dy = from.top - after.top;
        if (dx === 0 && dy === 0) return;
        node.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "none" },
          ],
          { duration: REFLOW_MS, easing: EASE_OUT },
        );
      });
    }

    // Snapshot the faces so a card that unmounts next render still has
    // something to fly. Skipped mid-drag: nothing leaves the hand during a
    // drag, and a pointermove-driven render shouldn't pay for eight clones.
    const faces = new Map<string, HTMLElement>();
    if (!dragging) {
      nodes.current.forEach((node, id) => {
        if (node.isConnected) faces.set(id, node.cloneNode(true) as HTMLElement);
      });
    } else if (before) {
      before.faces.forEach((value, key) => faces.set(key, value));
    }

    previous.current = { rects, cards: displayed, faces };
  }, [displayed, reducedMotion]);

  /* ── pointer interaction ──────────────────────────────────────────────── */

  const endInteraction = React.useCallback(() => {
    const live = press.current;
    if (live?.ringTimer) clearTimeout(live.ringTimer);
    if (live?.detailTimer) clearTimeout(live.detailTimer);
    press.current = null;
    setHoldId(null);
    setRingId(null);
    setDragId(null);
    setDropTargetId(null);
    setMergeTargetId(null);
  }, []);

  React.useEffect(() => endInteraction, [endInteraction]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, card: ActionCard) => {
      if (!interactive || event.button !== 0) return;
      const node = nodes.current.get(card.id);
      if (!node) return;

      node.setPointerCapture?.(event.pointerId);

      // Two stages, because a press means three different things depending on
      // how long it lasts: a tap plays the card, an abandoned hold does
      // nothing, and a completed hold opens the details. The ring exists to
      // make the difference between the last two visible while it's happening.
      const ringTimer = setTimeout(() => {
        const live = press.current;
        if (!live || live.active) return;
        setRingId(card.id);
      }, TAP_MAX_MS);

      const detailTimer = setTimeout(() => {
        const live = press.current;
        if (!live || live.active) return;
        // `held` is what stops the release from also playing the card.
        live.held = true;
        setRingId(null);
        onDetail(card);
      }, HOLD_DETAIL_MS);

      press.current = {
        id: card.id,
        node,
        originX: event.clientX,
        originY: event.clientY,
        active: false,
        held: false,
        startedAt: Date.now(),
        dropTargetId: null,
        mergeTargetId: null,
        ringTimer,
        detailTimer,
      };

      const onMove = (moveEvent: PointerEvent) => {
        const live = press.current;
        if (!live) return;
        const dx = moveEvent.clientX - live.originX;
        const dy = moveEvent.clientY - live.originY;

        if (!live.active) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          live.active = true;
          // A drag is not a hold. Both timers die here, ring included.
          if (live.ringTimer) clearTimeout(live.ringTimer);
          if (live.detailTimer) clearTimeout(live.detailTimer);
          setRingId(null);
          // Freeze the layout BEFORE the first preview reorder can move it.
          dragRects.current = [];
          nodes.current.forEach((node, id) => {
            if (node.isConnected) {
              dragRects.current.push({ id, rect: node.getBoundingClientRect() });
            }
          });
          // Partners stay lit through the drag — they are the drop targets.
          setHoldId(card.id);
          setDragId(card.id);
          live.node.style.zIndex = "40";
          live.node.style.cursor = "grabbing";
        }

        live.node.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;

        // Against the frozen boxes, not the live DOM — see `dragRects`. The
        // dragged card's own box is skipped rather than hidden behind a
        // pointer-events toggle, which used to force a style recalc per move.
        const { clientX, clientY } = moveEvent;
        const overId = dragRects.current.find(
          ({ id, rect }) =>
            id !== card.id &&
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom,
        )?.id;

        if (!overId) {
          // Only touch state when it actually changes: a pointermove that
          // resolves to the same target should cost nothing.
          if (live.dropTargetId !== null || live.mergeTargetId !== null) {
            live.dropTargetId = null;
            live.mergeTargetId = null;
            setDropTargetId(null);
            setMergeTargetId(null);
          }
          return;
        }

        if (overId === live.dropTargetId) return;

        const held = cards.find((c) => c.id === card.id);
        const isPartner =
          !!held && mergePartnerIds(held, cards).includes(overId);

        live.dropTargetId = overId;
        live.mergeTargetId = isPartner ? overId : null;
        setDropTargetId(overId);
        setMergeTargetId(live.mergeTargetId);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);

        const live = press.current;
        if (!live) return;

        const wasActive = live.active;
        const wasHeld = live.held;
        const target = live.mergeTargetId ?? live.dropTargetId;
        dragRects.current = [];

        live.node.style.transform = "";
        live.node.style.zIndex = "";
        live.node.style.cursor = "";

        endInteraction();

        if (!wasActive) {
          // A completed hold opened the details; it does not also play a card.
          if (wasHeld) return;
          // An *abandoned* hold does nothing at all. Falling through to "play
          // the card" would mean letting go of a ring you decided against
          // costs you an action — the worst possible reading of a release, and
          // the one a player would hit precisely when they weren't sure.
          if (Date.now() - live.startedAt >= TAP_MAX_MS) return;
          // While a Merge is armed, a tap answers *that* question instead of
          // playing a card — tapping a partner commits the merge, tapping
          // anything else (the armed card included) backs out. Playing a card
          // by accident here would cost an action, so the safe reading wins.
          if (armed) {
            setArmedId(null);
            if (card.id !== armed && partnerIds.has(card.id)) {
              onReorder(armed, card.id);
            }
            return;
          }
          onSelect(card.id);
          return;
        }

        // Dropping ON a partner and dropping NEXT TO one are the same commit:
        // the reorder seats the two together and the engine's adjacent-merge
        // rule does the rest, ult gauge included.
        if (target && target !== card.id) onReorder(card.id, target);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      cards,
      interactive,
      endInteraction,
      onReorder,
      onSelect,
      onDetail,
      armed,
      partnerIds,
    ],
  );

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div
      data-tutorial="hand"
      // Centred while the hand fits, scrolled from the left once it doesn't.
      // `justify-center` alone clips the first card unreachably when the
      // content overflows — auto margins on the end children centre without
      // that failure mode, which matters now that a full hand *does* overflow.
      // `touch-pan-x`, not `touch-none`. It was `touch-none` — harmless while
      // cards squeezed and the row never overflowed, and a trap the moment
      // they stopped: eight cards at a 56px floor DO overflow, and
      // `touch-none` would have left the player unable to swipe to the ones
      // off-screen. Vertical panning stays suppressed so a press on a card
      // can't be stolen by the page scrolling under it.
      //
      // Cost, accepted: drag-to-reorder no longer works by touch, because the
      // same horizontal swipe now scrolls the row. Mouse drag is unaffected,
      // and merging by touch goes through the card's Merge button (#118).
      className="hud-scroll flex w-full touch-pan-x justify-start gap-1 overflow-x-auto border border-hairline bg-void/70 p-2 [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
    >
      {displayed.map((card) => {
        const char = playerTeam.find(
          (c) => c.instanceId === card.sourceInstanceId,
        );
        const isUlt = card.skill.type === "ultimate";
        const isStunned = char?.debuffs.some((d) => d.type === "stun");
        const isSealed =
          card.skill.type === "attack" &&
          char?.debuffs.some(
            (d) => d.type === "seal" && d.sealType === "attack",
          );
        const frame = getCardFrameStyle(card.rank, isUlt);
        const isDragged = dragId === card.id;
        const isPartner = partnerIds.has(card.id);
        const isMergeTarget = mergeTargetId === card.id;
        // Everything that isn't a partner recedes while a card is dragged or
        // a merge is armed, so the ones that matter are the ones you can see.
        const dimmed =
          focusId !== null && focusId !== card.id && !isPartner && !isMergeTarget;

        return (
          <div
            key={card.id}
            data-card-id={card.id}
            ref={(node) => {
              if (node) nodes.current.set(card.id, node);
              else nodes.current.delete(card.id);
            }}
            onPointerDown={(e) => handlePointerDown(e, card)}
            onMouseEnter={() => onPreviewStart(card)}
            onMouseLeave={onPreviewEnd}
            onFocus={() => onPreviewStart(card)}
            onBlur={onPreviewEnd}
            // A long press is the details gesture now, and on touch the OS
            // reads the same press as "select this text / open a menu".
            onContextMenu={(e) => e.preventDefault()}
            // `min-w-14` is the floor, and it is the whole fix: these were
            // `flex-1 min-w-0`, so a full hand of eight divided 390px into
            // 43px slivers and the row it sits in — which has always been
            // `overflow-x-auto` — never scrolled, because nothing ever
            // overflowed. With a floor the cards keep their shape and the
            // container finally does its job.
            className={`
              no-callout relative flex h-32 min-w-14 max-w-24 flex-1 select-none flex-col overflow-hidden rounded-xl border bg-panel
              ${frame.borderClass}
              ${interactive ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
              ${interactive && !isDragged ? "transition-transform duration-150 hover:-translate-y-2" : ""}
              ${isStunned || isSealed ? "grayscale brightness-50" : ""}
              ${queueFull ? "opacity-70" : ""}
              ${dimmed ? "opacity-35 saturate-50" : ""}
              ${isPartner && !isMergeTarget ? "border-signal shadow-[0_0_0_1px_var(--color-signal),0_0_14px_rgba(79,211,232,0.35)]" : ""}
              ${isMergeTarget ? "border-el-light shadow-[0_0_0_1px_var(--color-el-light),0_0_20px_rgba(232,209,116,0.5)]" : ""}
              ${isDragged ? "shadow-[0_14px_34px_rgba(0,0,0,0.65)]" : ""}
            `}
          >
            {frame.accentBarClass ? (
              <span
                className={`absolute inset-x-0 top-0 z-10 h-1 ${frame.accentBarClass}`}
              />
            ) : null}

            <div className="relative min-h-0 flex-1 overflow-hidden bg-inset">
              {(() => {
                const art = char
                  ? (getSkillArt(char.id, card.skill.skillName) ??
                    getCharacterArt(char.id))
                  : null;
                return art ? (
                  <Image
                    src={art}
                    alt={char?.name ?? card.skill.skillName}
                    width={160}
                    height={160}
                    draggable={false}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-heading text-3xl leading-none text-readout-strong">
                    {getCharacterInitial(char?.name)}
                  </span>
                );
              })()}

              <span className="absolute left-0 top-0 bg-void/80 px-1 py-px font-body text-[9px] font-bold leading-none tracking-[0.08em]">
                {isUlt ? (
                  <span className="uppercase tracking-[0.12em] text-el-light">
                    Ult
                  </span>
                ) : (
                  <span className="text-readout">{getRankPips(card.rank)}</span>
                )}
              </span>

              {(() => {
                const BadgeIcon = SKILL_TYPE_ICON[skillTypeCategory(card.skill)];
                return (
                  <span
                    title={skillTypeCategory(card.skill)}
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-void/80 text-readout-dim"
                  >
                    <BadgeIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
                  </span>
                );
              })()}

              {isMergeTarget ? (
                <span className="absolute inset-x-0 bottom-0 bg-el-light py-px text-center font-body text-[8px] font-bold uppercase tracking-[0.16em] text-void">
                  Merge
                </span>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-hairline bg-inset px-1 py-0.5">
              <p className="truncate font-body text-[9px] font-semibold leading-tight text-readout-strong">
                {card.skill.skillName}
              </p>
              <p className="truncate font-body text-[8px] font-bold leading-tight tabular-nums text-readout-muted">
                {getSkillPowerText(card)}
              </p>
            </div>

            {canUseMergeButton(card) && interactive ? (
              <Button
                variant="secondary"
                size="xs"
                aria-pressed={armed === card.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const partners = mergePartnerIds(card, cards);
                  // One partner is not a choice, so don't stage one — the
                  // store picks the same card either way. Arming only earns
                  // its extra tap when there is something to decide, and with
                  // two partners there genuinely is: a merge grants +1 ult
                  // gauge to the *eaten* card's owner.
                  if (partners.length <= 1) {
                    setArmedId(null);
                    onMerge(card.id);
                    return;
                  }
                  setArmedId((current) =>
                    current === card.id ? null : card.id,
                  );
                }}
                // Opted out of the 44px floor the button scale enforces: it
                // sits *on* a 56px card and a 44px control would cover the
                // name and cost underneath it. Ruling #119 allows the opt-out
                // with a reason; this is the reason. The card is what would
                // have to grow, and it can't without the hand scrolling
                // further than one swipe.
                className={`absolute bottom-6 right-0.5 h-5 min-h-0 px-1 py-0 text-[9px] tracking-[0.08em] ${
                  armed === card.id
                    ? "border-el-light bg-el-light text-void"
                    : "bg-void/85"
                }`}
              >
                {armed === card.id ? "Pick" : "Merge"}
              </Button>
            ) : null}

            {/* The commit target, once a merge is armed. Covers the card so
                the tap that lands here can't be mistaken for playing it. */}
            {armed !== null && armed !== card.id && isPartner ? (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-el-light py-px text-center font-body text-[8px] font-bold uppercase tracking-[0.16em] text-void">
                Tap
              </span>
            ) : null}

            {isStunned ? (
              <div className="absolute inset-0 flex items-center justify-center bg-void/40 font-body text-[10px] font-bold uppercase tracking-widest text-readout-strong">
                Stunned
              </div>
            ) : null}

            {ringId === card.id ? (
              <HoldRing durationMs={HOLD_DETAIL_MS - TAP_MAX_MS} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── raw animation helpers ──────────────────────────────────────────────── */

function dealIn(node: HTMLElement): void {
  node.animate(
    [
      { transform: "translateY(24px) scale(0.9)", opacity: 0 },
      { transform: "translateY(-3px) scale(1.02)", opacity: 1, offset: 0.75 },
      { transform: "none", opacity: 1 },
    ],
    { duration: ENTER_MS, easing: EASE_OUT },
  );
}

function punch(node: HTMLElement | undefined): void {
  if (!node) return;
  node.animate(
    [
      { transform: "none" },
      { transform: "scale(1.18)", offset: 0.35 },
      { transform: "scale(0.97)", offset: 0.7 },
      { transform: "none" },
    ],
    { duration: MERGE_PUNCH_MS, easing: EASE_OUT },
  );
  node.animate(
    [
      {
        boxShadow:
          "0 0 0 1px var(--color-el-light), 0 0 26px rgba(232,209,116,0.7)",
      },
      { boxShadow: "0 0 0 0 rgba(232,209,116,0)" },
    ],
    { duration: 420, easing: EASE_OUT },
  );
}

/**
 * Play a departed card's exit with a clone.
 *
 * Appended to `document.body` rather than the hand: the deck wrapper takes a
 * `scale` during big-hit focus, and an ancestor transform silently reinterprets
 * `position: fixed` against it — the same trap that once put a modal behind
 * the page it was launched from.
 */
function flyGhost(
  snapshot: HTMLElement,
  from: DOMRect,
  into: DOMRect | null,
): void {
  if (typeof document === "undefined") return;

  // The snapshot is already a detached clone, but a cascade merge can fly the
  // same one more than once — clone again so each ghost owns its element.
  const ghost = snapshot.cloneNode(true) as HTMLElement;
  handProfile.ghostsFlown += 1;

  ghost.removeAttribute("data-card-id");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.appendChild(ghost);

  const frames: Keyframe[] = into
    ? [
        { transform: "none", opacity: 1 },
        {
          transform: `translate(${into.left - from.left}px, ${into.top - from.top}px) scale(0.25)`,
          opacity: 0,
        },
      ]
    : [
        { transform: "none", opacity: 1 },
        { transform: "translateY(-40px) scale(0.86)", opacity: 0 },
      ];

  const animation = ghost.animate(frames, {
    duration: into ? MERGE_FLY_MS : EXIT_MS,
    easing: into ? EASE_IN : EASE_OUT,
    fill: "forwards",
  });
  animation.onfinish = () => ghost.remove();
  animation.oncancel = () => ghost.remove();
}
