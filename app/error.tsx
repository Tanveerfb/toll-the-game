"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/Screen";

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
    // `Screen` paints the Shonen Ink ground (ruling #154); red is
    // `destructive`, the system's "something is wrong", not the red element
    // hue.
    <Screen variant="center" width="none">
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      <p className="font-heading text-2xl tracking-label text-destructive">
        SOMETHING WENT WRONG
      </p>
      <p className="max-w-md font-body text-sm text-ground-dim">
        The battle hit an unexpected error. Your progress up to this point is
        saved — you can try again or head back to the menu.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          TRY AGAIN
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          RETURN TO MENU
        </Button>
      </div>
    </div>
    </Screen>
  );
}
