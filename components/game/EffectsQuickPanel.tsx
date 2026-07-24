"use client";

import React from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Heart,
  Hourglass,
  Shield,
  Sparkles,
  Sword,
  X,
} from "lucide-react";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { getCharacterById, getCharacterKit } from "@/lib/game/characterCatalog";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";
import SubstatDrawer from "@/components/game/SubstatDrawer";
import DetailOverlay from "@/components/game/DetailOverlay";
import {
  PassiveDetailSections,
  SkillBlock,
  type KitPassiveView,
} from "@/components/game/KitDetails";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";

type Category = "buff" | "debuff" | "effect";

const CATEGORY_STYLE: Record<
  Category,
  { row: string; chip: string; icon: React.ElementType }
> = {
  buff: {
    row: "border-sky-500/50 bg-sky-950/40",
    chip: "text-sky-300",
    icon: ArrowUp,
  },
  debuff: {
    row: "border-rose-500/50 bg-rose-950/40",
    chip: "text-rose-300",
    icon: ArrowDown,
  },
  effect: {
    row: "border-zinc-500/50 bg-zinc-900/60",
    chip: "text-zinc-400",
    icon: Sparkles,
  },
};

interface CategorizedEffect {
  effect: StatusEffect;
  category: Category;
}

/** Ruling #30: uncancellable entries are grey "effects" regardless of whether
 * they live in buffs or debuffs. Order: buffs, then debuffs, then effects. */
export function categorizeEffects(unit: BattleCharacter): CategorizedEffect[] {
  const buffs = unit.buffs
    .filter((b) => !b.uncancellable)
    .map((effect) => ({ effect, category: "buff" as const }));
  const debuffs = unit.debuffs
    .filter((d) => !d.uncancellable)
    .map((effect) => ({ effect, category: "debuff" as const }));
  const effects = [...unit.buffs, ...unit.debuffs]
    .filter((e) => e.uncancellable)
    .map((effect) => ({ effect, category: "effect" as const }));
  return [...buffs, ...debuffs, ...effects];
}

function prettyName(effect: StatusEffect): string {
  if (effect.name) return effect.name;
  return effect.type
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}

/** A compact, human description for the row — numbers are tinted by the caller. */
function effectDescription(effect: StatusEffect): string {
  const perTurn =
    effect.capturedDamage ??
    (effect.type === "damageOverTime" || effect.type === "decay"
      ? effect.value
      : undefined);
  if (effect.type === "corrosion") {
    return `${effect.valuePercent ?? 10}% max HP per turn`;
  }
  if (perTurn !== undefined) return `${perTurn} damage per turn`;
  if (effect.type === "stun") return "Cannot act";
  if (effect.type === "seal") {
    return `${effect.sealType ?? "skill"} skills sealed`;
  }
  if (effect.type === "taunt") return "Attacks redirect to the source";
  if (effect.flatValue !== undefined && effect.stat) {
    const sign = effect.flatValue >= 0 ? "+" : "";
    return `${sign}${effect.flatValue} ${effect.stat.toUpperCase()}`;
  }
  if (effect.valuePercent !== undefined && effect.stat) {
    const sign = effect.valuePercent >= 0 ? "+" : "";
    return `${sign}${effect.valuePercent}% ${effect.stat.toUpperCase()}`;
  }
  if (effect.valuePercent !== undefined) return `${effect.valuePercent}%`;
  return "";
}

/** Highlight numeric tokens (e.g. "+30%", "10") in amber. */
function DescriptionText({ text }: { text: string }): React.JSX.Element {
  const parts = text.split(/([+-]?\d[\d,.]*%?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^[+-]?\d/.test(part) ? (
          <span key={i} className="font-semibold text-amber-300">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function StatPill({
  icon: Icon,
  value,
  tone,
}: {
  icon: React.ElementType;
  value: string;
  tone: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-4 w-4 ${tone}`} strokeWidth={2.2} />
      <span className="font-heading text-sm tracking-[0.04em] text-zinc-100">
        {value}
      </span>
    </div>
  );
}

/**
 * Compact in-battle effects popup (7DSGC "tap the status icons" panel). Team
 * switcher across the top, a quick ATK/DEF/HP strip, then the selected unit's
 * active buffs/debuffs/effects with durations, stacks, and the source portrait.
 */
export default function EffectsQuickPanel({
  unit,
  playerTeam,
  enemyTeam,
  onClose,
}: {
  unit: BattleCharacter;
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  onClose: () => void;
}): React.JSX.Element {
  const ownTeam = unit.team === "player" ? playerTeam : enemyTeam;
  const teamOnField = ownTeam.filter((u) => !u.isSub);
  const [selectedId, setSelectedId] = React.useState(unit.instanceId);
  const selected =
    teamOnField.find((u) => u.instanceId === selectedId) ?? unit;

  const allUnits = React.useMemo(
    () => [...playerTeam, ...enemyTeam],
    [playerTeam, enemyTeam],
  );
  const sourceArt = (sourceId?: string): string | null => {
    if (!sourceId) return null;
    const src = allUnits.find((u) => u.instanceId === sourceId);
    return src ? getCharacterArt(src.id) : null;
  };

  const rows = categorizeEffects(selected);

  // Super ATK / Passive rows with Details buttons (spec §6), reusing the
  // shared Detail Overlay from §5. Phase-aware, same as the fuller detail
  // screen — a boss in a later phase shows that phase's kit.
  const catalog = getCharacterById(selected.id);
  const kit = catalog
    ? getCharacterKit(catalog, selected.phaseIndex ?? 0)
    : null;
  const passiveList = (kit?.passives as KitPassiveView[] | undefined) ?? [];
  const [detailOverlay, setDetailOverlay] = React.useState<
    | { kind: "ultimate"; skill: CharacterSkillData }
    | { kind: "passive"; passive: KitPassiveView }
    | null
  >(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col border-2 border-zinc-600 bg-zinc-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Team switcher */}
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-black/40 px-3 py-2.5">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto">
            {teamOnField.map((member) => {
              const art = getCharacterArt(member.id);
              const active = member.instanceId === selected.instanceId;
              return (
                <button
                  key={member.instanceId}
                  type="button"
                  onClick={() => setSelectedId(member.instanceId)}
                  title={member.name}
                  className={`relative h-11 w-11 shrink-0 overflow-hidden border-2 transition-all ${
                    active
                      ? "border-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.45)]"
                      : "border-zinc-700 opacity-70 hover:opacity-100"
                  } ${member.currentHP <= 0 ? "grayscale" : ""}`}
                >
                  {art ? (
                    <Image
                      src={art}
                      alt={member.name}
                      fill
                      sizes="44px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-zinc-800 font-heading text-lg text-zinc-200">
                      {member.name.charAt(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-zinc-600 p-1 text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type/category icon row + portrait + name (spec §6) */}
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-black/30 px-4 py-2.5">
          <div className="h-10 w-10 shrink-0 overflow-hidden border border-zinc-700">
            {getCharacterArt(selected.id) ? (
              <Image
                src={getCharacterArt(selected.id)!}
                alt={selected.name}
                width={40}
                height={40}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-zinc-800 font-heading text-base text-zinc-200">
                {selected.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-base tracking-[0.05em] text-zinc-100">
              {selected.name}
            </p>
            <p className="flex flex-wrap items-center gap-x-1.5 font-body text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <span
                className={`h-2 w-2 shrink-0 rotate-45 border border-black/40 ${ELEMENT_SWATCH[selected.color]}`}
              />
              <span>{selected.color}</span>
              {(selected.tags ?? []).map((tag) => (
                <span key={tag}>· {tag}</span>
              ))}
            </p>
          </div>
        </div>

        {/* Quick stat strip */}
        <div className="flex items-center gap-5 border-b border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
          <StatPill
            icon={Sword}
            value={String(getEffectiveAttack(selected))}
            tone="text-rose-300"
          />
          <StatPill
            icon={Shield}
            value={String(getEffectiveDefense(selected))}
            tone="text-sky-300"
          />
          <StatPill
            icon={Heart}
            value={`${Math.max(0, selected.currentHP)}/${selected.hp}`}
            tone="text-emerald-300"
          />
        </div>

        <div className="border-b border-zinc-800 px-3 py-2">
          <SubstatDrawer unit={selected} />
        </div>

        {/* Super ATK / Passive rows with Details buttons (spec §6), reusing
            the shared Detail Overlay (§5). No live combat-stat tracker row
            in this pass — deferred per spec. */}
        {kit?.ultimate || passiveList.length > 0 ? (
          <div className="space-y-1.5 border-b border-zinc-800 bg-black/20 p-3">
            {kit?.ultimate ? (
              <button
                type="button"
                onClick={() =>
                  setDetailOverlay({ kind: "ultimate", skill: kit.ultimate! })
                }
                className="flex w-full items-center justify-between gap-2 border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left transition-colors hover:border-amber-300/60"
              >
                <div className="min-w-0">
                  <p className="font-body text-[9px] uppercase tracking-widest text-zinc-500">
                    Super ATK
                  </p>
                  <p className="truncate font-heading text-sm text-zinc-100">
                    {kit.ultimate.skillName}
                  </p>
                </div>
                <span className="shrink-0 font-body text-[10px] uppercase tracking-widest text-amber-200">
                  Details
                </span>
              </button>
            ) : null}
            {passiveList.map((p, index) => (
              <button
                key={`passive-${p.name ?? index}`}
                type="button"
                onClick={() => setDetailOverlay({ kind: "passive", passive: p })}
                className="flex w-full items-center justify-between gap-2 border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left transition-colors hover:border-amber-300/60"
              >
                <div className="min-w-0">
                  <p className="font-body text-[9px] uppercase tracking-widest text-zinc-500">
                    {passiveList.length > 1 ? "Passive" : "Passive Skill"}
                  </p>
                  <p className="truncate font-heading text-sm text-zinc-100">
                    {p.name ?? "Passive"}
                  </p>
                </div>
                <span className="shrink-0 font-body text-[10px] uppercase tracking-widest text-amber-200">
                  Details
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Effect list */}
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {rows.length === 0 ? (
            <p className="py-6 text-center font-body text-sm uppercase tracking-[0.14em] text-zinc-500">
              No active effects.
            </p>
          ) : (
            rows.map(({ effect, category }, idx) => {
              const style = CATEGORY_STYLE[category];
              const Icon = style.icon;
              const duration = effect.buffDuration ?? effect.debuffDuration;
              const stacks = effect.stacks ?? 1;
              const art = sourceArt(effect.sourceId);
              const desc = effectDescription(effect);
              return (
                <div
                  key={`${effect.type}-${idx}`}
                  className={`flex items-center gap-2.5 border px-2.5 py-2 ${style.row}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-black/30 ${style.chip}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-heading text-sm tracking-[0.04em] text-zinc-100">
                        {prettyName(effect)}
                      </span>
                      {duration ? (
                        <span className="flex items-center gap-0.5 font-body text-[10px] uppercase tracking-widest text-zinc-400">
                          <Hourglass className="h-3 w-3" />
                          {duration}
                        </span>
                      ) : null}
                      {stacks > 1 ? (
                        <span className="border border-zinc-600 bg-black/40 px-1 font-body text-[10px] font-bold text-zinc-200">
                          ×{stacks}
                        </span>
                      ) : null}
                    </div>
                    {desc ? (
                      <p className="font-body text-xs text-zinc-300">
                        <DescriptionText text={desc} />
                      </p>
                    ) : null}
                  </div>
                  {art ? (
                    <div className="h-9 w-9 shrink-0 overflow-hidden border border-zinc-700">
                      <Image
                        src={art}
                        alt=""
                        width={36}
                        height={36}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {detailOverlay ? (
        // stopPropagation: this overlay is nested inside the mini panel's own
        // backdrop-click-to-close div — without this, dismissing the Details
        // overlay would bubble up and close the whole mini panel too.
        <div onClick={(e) => e.stopPropagation()}>
          <DetailOverlay
            title={
              detailOverlay.kind === "ultimate"
                ? "Super Attack Details"
                : "Passive Details"
            }
            subtitle={
              detailOverlay.kind === "ultimate"
                ? detailOverlay.skill.skillName
                : detailOverlay.passive.name
            }
            onClose={() => setDetailOverlay(null)}
          >
            {detailOverlay.kind === "ultimate" ? (
              <SkillBlock skill={detailOverlay.skill} tag="ULT" />
            ) : (
              <PassiveDetailSections passive={detailOverlay.passive} />
            )}
          </DetailOverlay>
        </div>
      ) : null}
    </div>
  );
}
