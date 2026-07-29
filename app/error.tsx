"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Route-level fallback (Next.js app/error.tsx convention) — catches any
 * uncaught render/effect exception in this route tree (e.g. a malformed
 * mechanic mid-battle) and offers a way back instead of leaving the player
 * on Next's generic "Application error" screen with no way out but a
 * full reload.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error.tsx] uncaught error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <p className="font-heading text-2xl tracking-[0.1em] text-amber-300">
        SOMETHING WENT WRONG
      </p>
      <p className="max-w-md font-body text-sm text-zinc-400">
        The battle hit an unexpected error. Your progress up to this point is
        saved — you can try again or head back to the menu.
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={reset}
          className="rounded-none border-2 border-zinc-500 bg-transparent font-heading tracking-[0.1em] text-zinc-100"
        >
          TRY AGAIN
        </Button>
        <Button
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-none border-2 border-amber-300 font-heading tracking-[0.1em]"
        >
          RETURN TO MENU
        </Button>
      </div>
    </div>
  );
}
