"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  const launch = (): void => {
    registerPracticeDummy();
    startCustomBattle([{ id: characterId }], [{ id: PRACTICE_DUMMY_ID }], {
      preview: true,
    });
    router.push("/practice");
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={launch}
      // Wraps rather than clipping: the label is long and this sits in a
      // 300px sidebar that becomes full-width on mobile.
      className="w-full whitespace-normal text-center leading-tight"
    >
      Preview — full rank &amp; ultimate set vs. a training dummy
    </Button>
  );
}
