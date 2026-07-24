"use client";

import React from "react";
import { X } from "lucide-react";

/**
 * Shared Detail Overlay (spec §5) — one reusable modal, parameterized by
 * content, used for Super Attack Details, Passive Details, and the Character
 * List overlay (tag chips). Same title-bar + close chrome everywhere instead
 * of ad-hoc modals per screen.
 */
export default function DetailOverlay({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col border-2 border-zinc-600 bg-zinc-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-black/40 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-lg tracking-[0.08em] text-zinc-100">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-zinc-600 text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
