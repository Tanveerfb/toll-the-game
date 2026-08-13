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
 */
export default function OrdersButton(): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const state = useOrdersState();

  if (state.hidden) return null;

  const badge = state.locked ? "!" : state.ready > 0 ? String(state.ready) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          state.locked
            ? "Bureau Orders — sign in to claim"
            : state.ready > 0
              ? `Bureau Orders — ${state.ready} ready to claim`
              : "Bureau Orders"
        }
        className={`flex shrink-0 items-center gap-1.5 border bg-void px-2 py-0.5 transition-colors ${
          badge
            ? "border-el-light/60 text-el-light hover:border-el-light"
            : "border-hairline text-readout-dim hover:border-edge-strong hover:text-readout"
        }`}
      >
        <ClipboardList className="h-3 w-3 shrink-0" strokeWidth={2.4} />
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.12em]">
          Orders
        </span>
        {badge ? (
          <span className="border border-el-light px-1 font-body text-[10px] font-bold leading-tight tabular-nums text-el-light">
            {badge}
          </span>
        ) : null}
      </button>

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
