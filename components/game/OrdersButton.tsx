"use client";

import React from "react";
import { ClipboardList } from "lucide-react";
import OrdersBoard, { useOrdersState } from "@/components/game/OrdersBoard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { NAV_CHIP } from "@/components/ui/navChip";
import NavTile from "@/components/ui/NavTile";
import { ORDERS_OPEN } from "@/lib/game/orders";

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
 * copy of the open/close state and one modal.
 *
 * **Shōnen Ink (ruling #154, 2026-09-26):** the modal is the shadcn `Dialog`,
 * which brings the focus trap and focus return the hand-built
 * `DetailOverlay` never had. Something to claim is a gold FILL with ink on
 * it, never gold text: an element hue is never text on paper.
 */
export default function OrdersButton({
  variant = "nav",
}: {
  variant?: "nav" | "tile";
} = {}): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const state = useOrdersState();

  // Closed for the overhaul (ruling #159): both shapes render nothing.
  if (!ORDERS_OPEN) return null;

  if (state.hidden) return null;

  const badge = state.locked
    ? "!"
    : state.ready > 0
      ? String(state.ready)
      : null;
  const label = state.locked
    ? "Bureau Orders — sign in to claim"
    : state.ready > 0
      ? `Bureau Orders — ${state.ready} ready to claim`
      : "Bureau Orders";

  // The button is the dialog's own trigger, not a bare `onClick`: that is
  // how radix knows where to put focus back on close. Opened with a plain
  // `setOpen`, closing dropped focus onto <body> (measured in the browser,
  // 2026-09-26).
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "tile" ? (
          // The same tile as the hub's modes (`HomeMenu`), lifted on the yellow
          // slab when there is something to claim: yellow is the action
          // colour, and claiming is the action.
          <NavTile
            aria-label={label}
            icon={ClipboardList}
            title="Bureau Orders"
            subtitle={
              state.locked
                ? "Sign in to claim"
                : state.ready > 0
                  ? `${state.ready} ready to claim`
                  : `${state.claimed} of ${state.total} on this step`
            }
            lift={badge ? "primary" : "none"}
            trailing={
              badge ? (
                <Badge variant="reward" className="tabular-nums">
                  {badge}
                </Badge>
              ) : null
            }
          />
        ) : (
          <button
            type="button"
            aria-label={label}
            // The nav chip (ruling #154).
            className={NAV_CHIP}
          >
            <ClipboardList className="h-3 w-3 shrink-0" strokeWidth={2.4} />
            <span>Orders</span>
            {badge ? (
              <Badge variant="reward" size="tight" className="tabular-nums">
                {badge}
              </Badge>
            ) : null}
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bureau Orders</DialogTitle>
          <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
            {state.locked
              ? "Account required to claim"
              : `${state.claimed} / ${state.total} on this step${
                  state.ready > 0 ? ` · ${state.ready} to claim` : ""
                }`}
          </DialogDescription>
        </DialogHeader>
        <OrdersBoard state={state} />
      </DialogContent>
    </Dialog>
  );
}
