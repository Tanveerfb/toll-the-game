"use client";

import React from "react";
import { ClipboardList } from "lucide-react";
import DetailOverlay from "@/components/game/DetailOverlay";
import OrdersBoard, { useOrdersState } from "@/components/game/OrdersBoard";

/**
 * Bureau Orders, reachable from anywhere (Tanveer, 2026-08-13).
 *
 * The board used to be a section pinned to the home screen, which meant the
 * game's "what do I do next" surface was invisible from every screen a player
 * was actually on when they finished something. It lives in the navbar now,
 * badged with the number of orders ready to claim, and opens as a modal.
 *
 * Renders nothing at all when the board is hidden — before the stores
 * rehydrate, and permanently once every order is claimed. A button that opens
 * an empty modal is worse than no button.
 *
 * Two shapes, one modal. `nav` is the chip in the top bar's resource row,
 * which is desktop-only — below `sm` that row folds away and Orders had no
 * surface at all except a bare count on the wordmark. `tile` is the home
 * screen's full-width row (Tanveer, 2026-09-01), which is where a phone player
 * meets it. Sharing the component rather than rebuilding the row keeps one
 * copy of the open/close state and one `DetailOverlay`.
 */
export default function OrdersButton({
  variant = "nav",
}: {
  variant?: "nav" | "tile";
} = {}): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const state = useOrdersState();

  if (state.hidden) return null;

  const badge = state.locked ? "!" : state.ready > 0 ? String(state.ready) : null;
  const label = state.locked
    ? "Bureau Orders — sign in to claim"
    : state.ready > 0
      ? `Bureau Orders — ${state.ready} ready to claim`
      : "Bureau Orders";

  return (
    <>
      {variant === "tile" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={`flex w-full items-center gap-3 border bg-inset px-3 py-2.5 text-left transition-colors ${
            badge
              ? "border-el-light/60 hover:border-el-light"
              : "border-hairline hover:border-edge-strong"
          }`}
        >
          <ClipboardList
            className={`h-5 w-5 shrink-0 ${badge ? "text-el-light" : "text-readout-muted"}`}
            strokeWidth={2}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading text-lg tracking-title text-readout-strong">
              Bureau Orders
            </span>
            <span className="font-body text-[11px] font-bold uppercase tracking-label text-readout-muted">
              {state.locked
                ? "Sign in to claim"
                : state.ready > 0
                  ? `${state.ready} ready to claim`
                  : `${state.claimed} of ${state.total} on this step`}
            </span>
          </span>
          {badge ? (
            <span className="ml-auto shrink-0 border border-el-light px-1.5 py-0.5 font-body text-[11px] font-bold leading-tight tabular-nums text-el-light">
              {badge}
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={`flex min-h-11 shrink-0 items-center gap-1.5 border bg-void px-2 transition-colors ${
            badge
              ? "border-el-light/60 text-el-light hover:border-el-light"
              : "border-hairline text-readout-dim hover:border-edge-strong hover:text-readout"
          }`}
        >
          <ClipboardList className="h-3 w-3 shrink-0" strokeWidth={2.4} />
          <span className="font-body text-[10px] font-bold uppercase tracking-label">
            Orders
          </span>
          {badge ? (
            <span className="border border-el-light px-1 font-body text-[10px] font-bold leading-tight tabular-nums text-el-light">
              {badge}
            </span>
          ) : null}
        </button>
      )}

      {open ? (
        <DetailOverlay
          title="Bureau Orders"
          subtitle={
            state.locked
              ? "Account required to claim"
              : `${state.claimed} / ${state.total} on this step${
                  state.ready > 0 ? ` · ${state.ready} to claim` : ""
                }`
          }
          onClose={() => setOpen(false)}
        >
          <OrdersBoard state={state} />
        </DetailOverlay>
      ) : null}
    </>
  );
}
