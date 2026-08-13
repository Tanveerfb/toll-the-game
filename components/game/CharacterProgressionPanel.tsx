"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DetailOverlay from "@/components/game/DetailOverlay";
import { usePlayerStore, getCharacterProgress } from "@/store/playerStore";
import { xpToNext } from "@/lib/game/leveling";
import {
  ascensionBlocker,
  ascensionLevelRequirement,
  getAscensionCost,
  maxLevelForAscension,
} from "@/lib/game/ascension";

const MANUAL_TIERS = [
  { id: "training_manual", label: "Training Manual" },
  { id: "training_manual_advanced", label: "Advanced Manual" },
  { id: "training_manual_premium", label: "Premium Manual" },
] as const;

/** The level/ascension controls themselves — only ever rendered inside the
 *  modal, for a character the player actually owns. */
function GrowthControls({
  characterId,
}: {
  characterId: string;
}): React.JSX.Element {
  const state = usePlayerStore();
  const progress = getCharacterProgress(state, characterId);
  const maxLevel = maxLevelForAscension(progress.ascension);
  const nextCost = getAscensionCost(progress.ascension + 1);
  const atMaxLevel = progress.level >= maxLevel;
  // Same rule the store enforces, read from the same function — the button
  // being enabled is never allowed to mean something different from what
  // `ascendCharacter` will actually do.
  const blocker = ascensionBlocker(
    progress,
    state.inventory,
    state.currencies.coin,
  );
  const levelNeeded = ascensionLevelRequirement(progress.ascension + 1);
  const xpNeeded = atMaxLevel ? 0 : xpToNext(progress.level);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 chamfer border border-edge bg-panel px-3 py-2">
        <span className="font-heading text-lg tracking-[0.1em] text-readout-strong">
          Level {progress.level}
          <span className="font-body text-xs text-readout-muted"> / {maxLevel}</span>
        </span>
        <span className="font-body text-xs uppercase tracking-[0.14em] text-signal">
          Ascension {progress.ascension}
        </span>
      </div>

      {!atMaxLevel ? (
        <div>
          <div className="flex items-center justify-between font-body text-xs uppercase tracking-widest text-readout-muted">
            <span>XP</span>
            <span className="tabular-nums">
              {progress.xp} / {xpNeeded}
            </span>
          </div>
          <Progress value={(progress.xp / xpNeeded) * 100} className="mt-1" />
        </div>
      ) : (
        <p className="font-body text-xs uppercase tracking-widest text-signal">
          Max level for this ascension tier — ascend to continue leveling.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {MANUAL_TIERS.map((tier) => {
          const owned = state.inventory[tier.id] ?? 0;
          const disabled = atMaxLevel || owned < 1;
          // Why the button is dead is the whole point of the message, and a
          // native `title` never fires on a disabled control or on touch —
          // so the reason was invisible in exactly the two cases that needed
          // it. The wrapper span keeps a hoverable target while the button
          // itself stays disabled.
          const reason = atMaxLevel
            ? "At max level for this ascension tier"
            : owned < 1
              ? `No ${tier.label} owned`
              : null;
          const button = (
            <Button
              key={tier.id}
              variant="outline"
              disabled={disabled}
              onClick={() => state.feedManualToCharacter(characterId, tier.id)}
            >
              Feed {tier.label} ({owned})
            </Button>
          );
          if (!reason) return button;
          return (
            <Tooltip key={tier.id}>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help">{button}</span>
              </TooltipTrigger>
              <TooltipContent>{reason}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {nextCost ? (
        <div className="border-t border-hairline pt-3">
          <p className="font-body text-xs uppercase tracking-widest text-readout-muted">
            Ascend to tier {progress.ascension + 1} (unlocks Lv
            {maxLevelForAscension(progress.ascension + 1)})
          </p>
          <p className="mt-1 font-body text-sm text-readout">
            {nextCost.sea_monster_eye}x Sea Monster&apos;s Eye (
            {state.inventory.sea_monster_eye ?? 0} owned) •{" "}
            {nextCost.corroded_seaweed}x Corroded Sea Weed (
            {state.inventory.corroded_seaweed ?? 0} owned) • {nextCost.coin} coin
            ({state.currencies.coin} owned)
          </p>
          {blocker === "level" ? (
            <p className="mt-1 font-body text-sm text-el-light">
              Reach level {levelNeeded} first — this character is {progress.level}.
            </p>
          ) : null}
          <Button
            className="mt-2"
            disabled={blocker !== null}
            onClick={() => state.ascendCharacter(characterId)}
          >
            {blocker === "level"
              ? `Locked until Lv ${levelNeeded}`
              : blocker === "materials"
                ? "Not enough materials"
                : "Ascend"}
          </Button>
        </div>
      ) : (
        <p className="border-t border-hairline pt-3 font-body text-xs uppercase tracking-widest text-readout-muted">
          No further ascension costed yet (bands 4-6 come in a later update).
        </p>
      )}
    </div>
  );
}

/**
 * Growth entry point on the archive detail page.
 *
 * Was an always-expanded card that ate most of the sidebar and rendered for
 * EVERY character — unowned ones and story-only NPCs included, offering to
 * level things the player has no claim to. Now it's a single button that only
 * appears for a character the player owns, opening the controls in the shared
 * DetailOverlay modal.
 *
 * Ownership is read after `hasHydrated` so the server render and the first
 * client render agree (the roster lives in localStorage).
 */
export default function CharacterProgressionPanel({
  characterId,
  storyOnly = false,
}: {
  characterId: string;
  /** NPC/enemy/boss kits have no progression at all — render nothing. */
  storyOnly?: boolean;
}): React.JSX.Element | null {
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const roster = usePlayerStore((s) => s.roster);
  const [open, setOpen] = React.useState(false);

  if (storyOnly) return null;
  if (!hasHydrated) return null;

  if (!roster.includes(characterId)) {
    return (
      <p className="chamfer border border-edge bg-panel px-3 py-2 text-center font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
        Not owned — summon to level up
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chamfer flex w-full min-h-11 items-center justify-center border border-role-heal/60 bg-role-heal/8 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-role-heal transition-colors hover:bg-role-heal/16"
      >
        Growth — level & ascension
      </button>
      {open ? (
        <DetailOverlay
          title="Growth"
          subtitle="Level & ascension"
          onClose={() => setOpen(false)}
        >
          <GrowthControls characterId={characterId} />
        </DetailOverlay>
      ) : null}
    </>
  );
}
