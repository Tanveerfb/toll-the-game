"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { battleLockRoute } from "@/lib/game/battleLock";
import { useGameStore } from "@/store/gameStore";

/**
 * Keeps the player on the screen that owns the unresolved battle.
 *
 * Mounted once in the root layout, so it covers every way out at once: a nav
 * link, the browser's back button, a typed URL and a reload onto another
 * route. The rule is `battleLockRoute`; this only applies it. Renders nothing.
 *
 * `replace`, not `push`: the bounce should not leave a history entry the back
 * button can walk into again.
 */
export default function BattleLock(): null {
  const pathname = usePathname();
  const router = useRouter();
  const battlePhase = useGameStore((s) => s.battlePhase);
  const owner = useGameStore((s) => s.battleOwner);

  React.useEffect(() => {
    const target = battleLockRoute(battlePhase, owner, pathname);
    if (target) router.replace(target);
  }, [battlePhase, owner, pathname, router]);

  return null;
}
