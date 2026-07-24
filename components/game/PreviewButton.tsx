"use client";

import { useRouter } from "next/navigation";
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
    <button
      type="button"
      onClick={launch}
      className="flex w-full min-h-11 items-center justify-center border border-amber-300/70 bg-amber-400/10 font-body text-xs uppercase tracking-widest text-amber-200 transition-colors hover:bg-amber-400/20"
    >
      Preview — full rank/ultimate set vs. a training dummy
    </button>
  );
}
