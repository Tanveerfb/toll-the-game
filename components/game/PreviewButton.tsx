"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import MountedDialog from "@/components/ui/MountedDialog";
import { useBattleContext } from "@/hooks/BattleProvider";
import {
  registerPracticeDummy,
  PRACTICE_DUMMY_ID,
} from "@/lib/game/damagePreview";

/**
 * Player-facing Preview launcher (spec §7, Task 10). Lives on the out-of-battle
 * character archive page — NOT inside a battle's info panels, since launching a
 * sandbox from within a live battle would abandon it. Starts an isolated 1v1
 * sandbox (this character, full rank/ultimate hand, vs a training dummy) and
 * navigates to the battle screen.
 */
export default function PreviewButton({
  characterId,
}: {
  characterId: string;
}): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const launch = (): void => {
    registerPracticeDummy();
    startCustomBattle([{ id: characterId }], [{ id: PRACTICE_DUMMY_ID }], {
      preview: true,
    });
    router.push("/practice");
  };

  return (
    <>
      {/* Ink, beside Growth's yellow (his pick, 2026-09-27: both "should be
          more attention heavy"). The long label became a title and a line
          under it; it wrapped to three lines in half a phone's width. */}
      <Button
        variant="ink"
        size="lg"
        onClick={() => setConfirming(true)}
        aria-label="Preview: full rank and ultimate set against a training dummy"
        className="h-auto w-full flex-col gap-0 py-1.5"
      >
        <span className="text-xl leading-none">Preview</span>
        {/* Wraps in the 290px desktop sidebar, where the button is 132px. */}
        <span className="whitespace-normal font-body text-label font-bold uppercase tracking-label">
          vs training dummy
        </span>
      </Button>
      {/* Confirm first (his pick, 2026-10-03, audit 1.4): this is a real
          practice battle, and the battle lock holds the player in it until
          they finish or forfeit. */}
      {confirming ? (
        <MountedDialog title="Start a test fight?" onClose={() => setConfirming(false)}>
          <p className="font-body text-caption leading-snug text-muted-foreground">
            You stay in it until it ends or you forfeit.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button size="lg" className="flex-1" onClick={launch}>
              Fight
            </Button>
          </div>
        </MountedDialog>
      ) : null}
    </>
  );
}
