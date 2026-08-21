"use client";

import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import Hint from "@/components/ui/Hint";
import DetailOverlay from "@/components/game/DetailOverlay";
import { usePlayerStore, getCharacterProgress } from "@/store/playerStore";
import { xpToNext } from "@/lib/game/leveling";
import { getCharacterById } from "@/lib/game/characterCatalog";
import ItemIcon from "@/components/game/ItemIcon";
import { characterCoinId, materialLabel } from "@/lib/game/materials";
import { MAX_ULT_LEVEL, ultLevelCoinCost } from "@/lib/gacha/dupes";
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
          // native `title` never fires on a disabled control or on touch — so
          // the reason was invisible in exactly the two cases that needed it.
          // A hoverable wrapper span didn't fix that either: a span takes no
          // tap. So when there is a reason, the *trigger* takes the button's
          // place — same disabled look, but real and pressable, which is the
          // only way the explanation reaches a phone (ruling #107).
          const reason = atMaxLevel
            ? "At max level for this ascension tier"
            : owned < 1
              ? `No ${tier.label} owned`
              : null;
          const label = (
            <>
              <ItemIcon id={tier.id} size={18} alt="" />
              Feed {tier.label} ({owned})
            </>
          );
          if (!reason) {
            return (
              <Button
                key={tier.id}
                variant="outline"
                disabled={disabled}
                onClick={() => state.feedManualToCharacter(characterId, tier.id)}
              >
                {label}
              </Button>
            );
          }
          return (
            <Hint
              key={tier.id}
              content={reason}
              // Wears the disabled look but is not a disabled control: it does
              // nothing except explain itself, and it has to stay reachable to
              // do that.
              className={`${buttonVariants({ variant: "outline" })} cursor-help border-hairline bg-transparent text-readout-muted hover:border-hairline hover:text-readout-muted`}
            >
              {label}
            </Hint>
          );
        })}
      </div>

      {nextCost ? (
        <div className="border-t border-hairline pt-3">
          <p className="font-body text-xs uppercase tracking-widest text-readout-muted">
            Ascend to tier {progress.ascension + 1} (unlocks Lv
            {maxLevelForAscension(progress.ascension + 1)})
          </p>
          {/* Three chips rather than one run-on sentence: the question a player
              asks here is "which of these am I short of", and a bulleted
              paragraph made them parse three parenthesised counts to answer it.
              Short lands in `el-red`, so the blocker reads at a glance. */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <AscensionCost
              id="sea_monster_eye"
              label={materialLabel("sea_monster_eye")}
              cost={nextCost.sea_monster_eye}
              owned={state.inventory.sea_monster_eye ?? 0}
            />
            <AscensionCost
              id="corroded_seaweed"
              label={materialLabel("corroded_seaweed")}
              cost={nextCost.corroded_seaweed}
              owned={state.inventory.corroded_seaweed ?? 0}
            />
            <AscensionCost
              id="coin"
              label="Coin"
              cost={nextCost.coin}
              owned={state.currencies.coin}
            />
          </div>
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

      <UltimateLevelControls characterId={characterId} />
    </div>
  );
}

/** One line of an ascension bill: icon, cost, and what the account holds. */
function AscensionCost({
  id,
  label,
  cost,
  owned,
}: {
  id: string;
  label: string;
  cost: number;
  owned: number;
}): React.JSX.Element {
  const short = owned < cost;
  return (
    <span
      className={`flex items-center gap-1.5 border px-2 py-1 font-body text-xs tabular-nums ${
        short ? "border-el-red/60 text-el-red" : "border-hairline text-readout"
      }`}
    >
      <ItemIcon id={id} size={20} alt="" />
      <span className="font-bold">{cost.toLocaleString()}</span>
      <span className="text-readout-muted">{label}</span>
      <span className={short ? "" : "text-readout-muted"}>
        ({owned.toLocaleString()})
      </span>
    </span>
  );
}

/**
 * Ult levels, bought with that character's own coins.
 *
 * A slider rather than a row of +1 buttons because the whole climb is five
 * coins: the player picks a destination and pays once, instead of tapping
 * through five confirmations. The target is clamped to what they can afford,
 * so the slider can never propose a purchase the store will refuse.
 */
function UltimateLevelControls({
  characterId,
}: {
  characterId: string;
}): React.JSX.Element | null {
  const state = usePlayerStore();
  const progress = getCharacterProgress(state, characterId);
  const character = getCharacterById(characterId);

  const current = progress.ultLevel;
  const coinId = character ? characterCoinId(character) : null;
  const held = coinId ? (state.inventory[coinId] ?? 0) : 0;
  const affordableCeiling = Math.min(MAX_ULT_LEVEL, current + held);

  const [target, setTarget] = React.useState(current);
  // Derived rather than stored: the reachable ceiling moves as coins are spent
  // or pulled, and a stale target would offer a purchase that no longer works.
  const clampedTarget = Math.min(Math.max(target, current), affordableCeiling);
  const cost = ultLevelCoinCost(current, clampedTarget);
  const maxed = current >= MAX_ULT_LEVEL;
  const ladder = character?.ultimate?.damageByUltLevel;

  if (!character?.ultimate) return null;

  return (
    <div className="border-t border-hairline pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-body text-xs uppercase tracking-widest text-readout-muted">
          Ultimate level
        </p>
        <p className="font-heading text-lg leading-none tracking-[0.1em] text-readout-strong">
          {current}
          <span className="font-body text-xs text-readout-muted">
            {" "}
            / {MAX_ULT_LEVEL}
          </span>
        </p>
      </div>

      <p className="mt-1 flex items-center gap-2 font-body text-sm text-readout">
        {coinId ? <ItemIcon id={coinId} size={26} alt="" /> : null}
        <span className="min-w-0">
          {materialLabel(coinId ?? "")} — {held} owned
        </span>
      </p>

      {/* The ladder, with the level the player is on marked. Seeing the whole
          curve is the point: the coin cost only reads as worth it next to what
          the next step actually buys. */}
      {ladder ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {ladder.map((value, index) => {
            const level = index + 1;
            const isCurrent = level === current;
            const isTarget = level > current && level <= clampedTarget;
            return (
              <span
                key={level}
                className={`chamfer border px-1.5 py-0.5 font-body text-[10px] font-bold tracking-[0.08em] ${
                  isCurrent
                    ? "border-signal bg-signal/15 text-signal"
                    : isTarget
                      ? "border-role-heal/60 text-role-heal"
                      : "border-edge text-readout-muted"
                }`}
              >
                UL{level} · {value}%
              </span>
            );
          })}
        </div>
      ) : null}

      {maxed ? (
        <p className="mt-2 font-body text-xs uppercase tracking-widest text-role-heal">
          Maxed — further copies bank as coins
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <Slider
              value={[clampedTarget]}
              min={current}
              max={Math.max(affordableCeiling, current)}
              step={1}
              disabled={affordableCeiling <= current}
              onValueChange={([next]) => setTarget(next)}
              aria-label="Target ultimate level"
            />
            <span className="w-16 shrink-0 text-right font-body text-xs uppercase tracking-[0.14em] text-readout">
              UL {clampedTarget}
            </span>
          </div>
          <Button
            className="mt-2"
            disabled={cost === 0 || held < cost}
            onClick={() => {
              if (state.levelUpUltimate(characterId, clampedTarget)) {
                setTarget(clampedTarget);
              }
            }}
          >
            {affordableCeiling <= current
              ? "No coins — summon a duplicate"
              : `Raise to UL ${clampedTarget} — ${cost} coin${cost === 1 ? "" : "s"}`}
          </Button>
        </>
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
        Growth — level, ascension & ultimate
      </button>
      {open ? (
        <DetailOverlay
          title="Growth"
          subtitle="Level, ascension & ultimate"
          onClose={() => setOpen(false)}
        >
          <GrowthControls characterId={characterId} />
        </DetailOverlay>
      ) : null}
    </>
  );
}
