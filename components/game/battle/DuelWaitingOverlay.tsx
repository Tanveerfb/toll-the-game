"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useDuelStore } from "@/store/duelStore";

/**
 * Shown while a duelled enemy turn is parked waiting for Claude's move.
 *
 * The escape hatch on it is the single most important part of duel mode: if
 * the session ends mid-fight, this button is the only thing standing between
 * the player and a battle that hangs forever — including a story battle
 * carrying real rewards. It is always available, never disabled, and hands the
 * turn straight back to the scripted AI.
 */
export default function DuelWaitingOverlay(): React.JSX.Element | null {
  const waiting = useDuelStore((s) => s.waiting);
  const status = useDuelStore((s) => s.status);
  const abort = useDuelStore((s) => s.abort);

  if (!waiting) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center px-4">
      {/* Dev-only, and deliberately the one thing on the battle screen wearing
          a colour the palette doesn't otherwise use — it should never be
          mistakable for normal play. Surfaces are on tokens; the violet
          accent stays as the tell. */}
      <div className="pointer-events-auto flex items-center gap-3 border-2 border-violet-400 bg-card px-4 py-2.5 text-card-foreground ink-slab">
        <span className="h-2 w-2 animate-pulse bg-violet-400" />
        <div className="min-w-0">
          <p className="font-heading text-sm tracking-label">
            CLAUDE IS THINKING
          </p>
          <p className="truncate font-body text-label uppercase tracking-label text-muted-foreground">
            {status || "Waiting for a move…"}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => abort?.()}
          className="shrink-0"
        >
          Let AI play
        </Button>
      </div>
    </div>
  );
}
