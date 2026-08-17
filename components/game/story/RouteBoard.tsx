"use client";

import React from "react";
import {
  isStop,
  landingsFrom,
  nodeById,
  rollLoot,
  spendOrb,
  walkPath,
  type RouteNode,
  type StoryRoute,
} from "@/lib/game/route";
import { usePrefersReducedMotion } from "@/hooks/useDealSequence";

/**
 * The board a chapter is walked on.
 *
 * Laid out from each tile's `col`/`row` in grid units: three columns walked back
 * and forth as the row climbs, which keeps a twenty-tile route legible on a phone
 * without a second layout. Connectors are one SVG behind the tiles using the same
 * coordinate maths, so a tile and the line into it can't disagree.
 *
 * **Movement is animated tile by tile**, not a jump to the destination. `walkPath`
 * gives the tiles a roll actually crosses, and the token visits each in turn —
 * which is the only thing that makes "only the tile you land on resolves" legible:
 * you watch it pass over the ones that don't count. Reduced motion collapses the
 * walk to its destination rather than removing the move.
 *
 * The board owns movement and nothing else. Landing a tile that *means* something
 * — scenes, the fight, the finish — is handed up to `app/story/page.tsx`, which
 * owns those screens. Loot is the exception: it resolves here, having no screen.
 */

const ROW_H = 62;
const CELL = 100; // svg units per column
/** Per tile crossed. Fast enough that a six doesn't feel like a cutscene. */
const STEP_MS = 155;
/** Beat between arriving and the tile resolving, so the landing registers. */
const ARRIVE_MS = 260;

function centre(node: RouteNode): { x: number; y: number } {
  return { x: 50 + node.col * CELL, y: 31 + node.row * ROW_H };
}

function TileGlyph({
  type,
  state,
  landed,
}: {
  type: RouteNode["type"];
  state: "done" | "here" | "ahead";
  landed: boolean;
}): React.JSX.Element {
  const tone =
    state === "here"
      ? "border-signal text-signal"
      : state === "done"
        ? "border-signal-dim text-signal-dim"
        : type === "boss"
          ? "border-el-light text-el-light"
          : type === "loot"
            ? "border-el-green text-el-green"
            : "border-edge-strong text-readout-muted";

  const glyph =
    type === "boss"
      ? "★"
      : type === "loot"
        ? "◈"
        : type === "scene"
          ? "❝"
          : type === "finish"
            ? "⚑"
            : type === "start"
              ? "▲"
              : "·";

  // Shape carries the tile type so the board parses without colour.
  const shape =
    type === "boss" ? "rounded-none" : type === "loot" ? "rounded-md" : "rounded-full";
  const size = type === "boss" ? "h-12 w-12" : "h-9 w-9";

  return (
    <span
      className={`flex ${size} ${shape} items-center justify-center border-2 bg-inset font-heading text-base transition-transform duration-200 ${tone} ${landed ? "scale-125" : "scale-100"}`}
    >
      {glyph}
    </span>
  );
}

export default function RouteBoard({
  route,
  chapterTitle,
  at,
  orbs,
  bankedCoin,
  bankedCount,
  skipScenes,
  onMove,
  onScene,
  onFight,
  onFinish,
  onQuit,
}: {
  route: StoryRoute;
  chapterTitle: string;
  at: string;
  orbs: number[];
  bankedCoin: number;
  bankedCount: number;
  skipScenes: boolean;
  onMove: (
    to: string,
    orbs: number[],
    loot?: { coin: number; materials: Record<string, number> },
  ) => void;
  onScene: (which: "intro" | "outro") => void;
  onFight: (node: RouteNode) => void;
  onFinish: () => void;
  onQuit: () => void;
}): React.JSX.Element {
  const reduced = usePrefersReducedMotion();

  /**
   * Where the token is *drawn*, which leads the store during a walk.
   *
   * `walkTo` is set only while stepping and cleared on arrival, so the position
   * is derived rather than mirrored — the store stays the single source of truth
   * for where the party actually stands, and a route restart after a defeat moves
   * the token with no animation to unwind.
   */
  const [walkTo, setWalkTo] = React.useState<string | null>(null);
  const tokenAt = walkTo ?? at;
  const [moving, setMoving] = React.useState(false);
  const [pressed, setPressed] = React.useState<number | null>(null);
  const [landed, setLanded] = React.useState<string | null>(null);
  const timers = React.useRef<number[]>([]);
  const hereRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) clearTimeout(id);
    };
  }, []);

  // Keep the party in view as it climbs a long board.
  React.useEffect(() => {
    hereRef.current?.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [tokenAt, reduced]);

  const current = nodeById(route, tokenAt);
  const rows = Math.max(...route.nodes.map((node) => node.row)) + 1;
  const height = rows * ROW_H;

  /** Where each orb would put you — shown before it's spent. */
  const previews = orbs.map((value) =>
    moving ? [] : landingsFrom(route, at, value),
  );

  const take = (index: number) => {
    if (moving) return;
    const path = walkPath(route, at, orbs[index]);
    if (path.length === 0) return;

    const landing = path[path.length - 1];
    const node = nodeById(route, landing);
    const nextOrbs = spendOrb(orbs, index);
    // Rolled once, here, because loot has no screen of its own. The store's
    // `resolved` list stops a re-landing paying twice.
    const loot = node?.type === "loot" && node.loot ? rollLoot(node.loot) : undefined;

    setPressed(index);
    setMoving(true);

    const step = reduced ? 0 : STEP_MS;
    const hold = reduced ? 0 : ARRIVE_MS;
    const push = (fn: () => void, delay: number) => {
      timers.current.push(window.setTimeout(fn, delay));
    };

    // One hop per tile crossed. Under reduced motion every delay is zero, so the
    // token arrives immediately — the move still happens, it just isn't animated.
    path.forEach((id, i) => push(() => setWalkTo(id), step * (i + 1)));

    const arrival = step * path.length;
    push(() => {
      setLanded(landing);
      setPressed(null);
      onMove(landing, nextOrbs, loot);
    }, arrival);

    push(() => {
      setMoving(false);
      setLanded(null);
      // The store now holds the landing, so the derived position takes over.
      setWalkTo(null);
      if (!node) return;
      if (node.type === "scene" && node.scenes && !skipScenes) onScene(node.scenes);
      else if (node.type === "boss") {
        // A scene-only chapter's terminal tile has no opposition, so there is
        // nothing to launch — landing it simply ends the route.
        if (node.enemies && node.enemies.length > 0) onFight(node);
        else onFinish();
      } else if (node.type === "finish") onFinish();
    }, arrival + hold);
  };

  const stateOf = (node: RouteNode): "done" | "here" | "ahead" => {
    if (node.id === tokenAt) return "here";
    return node.row < (current?.row ?? 0) ? "done" : "ahead";
  };

  const tokenNode = current ?? route.nodes[0];
  const tokenPos = centre(tokenNode);

  return (
    <>
      <div className="flex flex-none items-center justify-between gap-2 border-b border-hairline bg-inset px-3 py-2">
        <p className="min-w-0 truncate border-l-2 border-signal pl-2 font-heading text-lg leading-tight tracking-[0.06em] text-readout-strong">
          {chapterTitle}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="border border-edge bg-void/80 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] tabular-nums text-el-green">
            ◈ {bankedCount}
            {bankedCoin > 0 ? ` · ${bankedCoin}` : ""}
          </span>
          <button
            type="button"
            onClick={onQuit}
            className="chamfer min-h-11 border border-edge px-3 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-dim transition-colors hover:border-role-attack hover:text-role-attack"
          >
            Quit
          </button>
        </div>
      </div>

      <div className="hud-scroll relative min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(120%_60%_at_50%_0%,#14202b_0%,#0b1218_45%,#06090c_100%)]">
        <div className="relative mx-auto w-full max-w-sm" style={{ height }}>
          <svg
            viewBox={`0 0 300 ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {route.nodes.map((node) =>
              (route.edges[node.id] ?? []).map((toId) => {
                const to = nodeById(route, toId);
                if (!to) return null;
                const a = centre(node);
                const b = centre(to);
                // Lit behind the token, dim ahead of it — the path fills in as
                // the walk happens rather than all at once on arrival.
                const walked = to.row <= (current?.row ?? 0);
                return (
                  <line
                    key={`${node.id}-${toId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={walked ? "var(--color-signal-dim)" : "var(--color-edge)"}
                    strokeWidth={walked ? 4 : 6}
                    style={{ transition: "stroke 200ms ease-out" }}
                  />
                );
              }),
            )}
          </svg>

          {route.nodes.map((node) => {
            const { x, y } = centre(node);
            const reachable = previews.findIndex((landings) =>
              landings.includes(node.id),
            );
            return (
              <div
                key={node.id}
                ref={node.id === tokenAt ? hereRef : undefined}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(x / 300) * 100}%`, top: y }}
              >
                <div className="relative">
                  <TileGlyph
                    type={node.type}
                    state={stateOf(node)}
                    landed={landed === node.id}
                  />
                  {/* Where an orb would land you, before you spend it. Hidden
                      mid-walk, when the numbers no longer describe the future. */}
                  {reachable !== -1 && node.id !== tokenAt ? (
                    <span className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full border border-signal bg-void font-heading text-sm text-signal">
                      {orbs[reachable]}
                    </span>
                  ) : null}
                  {node.type === "boss" ? (
                    <span className="absolute -left-1 top-full mt-0.5 whitespace-nowrap border border-role-attack bg-void/90 px-1 font-body text-[8px] font-bold uppercase tracking-[0.12em] text-role-attack">
                      Stop
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* The party. One element that slides between tiles, so the movement
              reads as travel rather than as a ring appearing somewhere new. */}
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(tokenPos.x / 300) * 100}%`,
              top: tokenPos.y,
              transition: reduced
                ? "none"
                : `left ${STEP_MS}ms cubic-bezier(.16,1,.3,1), top ${STEP_MS}ms cubic-bezier(.16,1,.3,1)`,
            }}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-signal bg-void font-heading text-sm text-signal shadow-[0_0_14px_rgba(79,211,232,0.55)] ${moving ? "" : "animate-pulse"}`}
            >
              ▲
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex flex-none items-center justify-center gap-4 border-t border-hairline bg-inset px-3 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {current && isStop(current) && current.type === "finish" ? (
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-role-heal">
            Route complete
          </p>
        ) : (
          orbs.map((value, index) => (
            <button
              key={index}
              type="button"
              onClick={() => take(index)}
              disabled={moving || previews[index].length === 0}
              aria-label={`Move ${value} tiles`}
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 bg-[radial-gradient(circle_at_34%_28%,#3a3320,#171a12_72%)] font-heading text-3xl transition-all duration-150 disabled:opacity-30 ${
                pressed === index
                  ? "scale-90 border-signal text-signal shadow-[0_0_20px_rgba(79,211,232,0.6)]"
                  : "border-el-light text-el-light active:scale-95"
              }`}
            >
              {value}
            </button>
          ))
        )}
      </div>
    </>
  );
}
