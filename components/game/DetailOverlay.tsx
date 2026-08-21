"use client";

import React from "react";
import { createPortal } from "react-dom";
import { scrimProps } from "@/hooks/useEscapeKey";
import { X } from "lucide-react";

/**
 * Shared Detail Overlay (spec §5) — one reusable modal, parameterized by
 * content, used for Super Attack Details, Passive Details, the Character List
 * overlay (tag chips), and Growth on the archive detail page. Same title-bar +
 * close chrome everywhere instead of ad-hoc modals per screen.
 *
 * Rendered through a portal into `document.body` rather than in place.
 * `position: fixed` is only viewport-relative while no ancestor establishes a
 * containing block, and `position: sticky` always creates a stacking context —
 * so when the archive detail page put its identity rail on `lg:sticky`, this
 * modal was trapped inside the rail and the kit document painted over it
 * (Tanveer, 2026-08-11). The portal makes placement irrelevant: no future
 * caller can re-break it by mounting the overlay inside a sticky, transformed,
 * filtered or `will-change`-ed subtree.
 */
// Never resubscribes — the store has no updates, it exists only so the server
// snapshot and the client snapshot differ.
const NO_SUBSCRIBE = () => () => {};

export default function DetailOverlay({
  title,
  subtitle,
  onClose,
  size = "default",
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** `wide` is for content with its own controls — the chapter select carries
   *  a search field, part chips and a pager, which cramp at `max-w-lg`. */
  size?: "default" | "wide";
  children: React.ReactNode;
}): React.JSX.Element | null {
  // `document` doesn't exist during the server render, and the first client
  // render has to match it — so the portal only opens once hydrated.
  // `useSyncExternalStore` rather than set-state-in-an-effect: same result,
  // one render fewer, and it's the pattern the hooks lint actually allows.
  const mounted = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

  // Escape closes. A modal you can only dismiss by clicking the scrim or
  // hitting a 44px button is a keyboard trap.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // Escape (above) and the 44px close button are the accessible paths out;
      // the scrim's click is a pointer convenience on top of them.
      className="fixed inset-0 z-[60] flex items-center justify-center bg-void/85 px-4 py-6 backdrop-blur-sm"
      {...scrimProps(onClose)}
    >
      <div
        className={`chamfer-lg flex max-h-[85dvh] w-full flex-col border border-edge-strong bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${
          size === "wide" ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-inset px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-lg tracking-[0.08em] text-readout-strong">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate font-body text-[10px] font-bold uppercase tracking-[0.2em] text-readout-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="chamfer flex h-11 w-11 shrink-0 items-center justify-center border border-edge text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
