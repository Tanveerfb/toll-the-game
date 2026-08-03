"use client";

import React from "react";
import Image from "next/image";
import {
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCharacterArt, getSkillArt } from "@/lib/game/characterArt";
import {
  getCharacterById,
  getCharacterKit,
  getPlayableCharacters,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { getCritChance } from "@/lib/game/combat";
import { getEvadeChance } from "@/lib/game/evade";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import { getPassiveReadout, type PassiveReadout } from "@/lib/game/passiveStacks";
import SubstatDrawer from "@/components/game/SubstatDrawer";
import DetailOverlay from "@/components/game/DetailOverlay";
import { EffectsList } from "@/components/game/battle/EffectsList";
import {
  PassiveDetailSections,
  PassiveProse,
  SkillBlock,
  type KitPassiveView,
} from "@/components/game/KitDetails";
import type { BattleCharacter } from "@/types/character";

/** Activation-mode tag — the exception, not the rule (most passives show
 *  none): "buildup" for a stack that grants a live, incrementally growing
 *  benefit (Seras/Diane/Ban/Yalina); "once" for a genuine once-per-battle
 *  trigger (Gon/Killua/Sara/Chiara's rank-up). */
function PassiveActivationTag({
  mode,
}: {
  mode: PassiveReadout["activationMode"];
}): React.JSX.Element | null {
  if (mode === "buildup") {
    return (
      <span className="inline-flex items-center gap-0.5 border border-zinc-600 bg-zinc-800/80 px-1 py-px text-zinc-300">
        <InfinityIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
      </span>
    );
  }
  if (mode === "once") {
    return (
      <span className="inline-flex items-center gap-0.5 border border-amber-400/70 bg-amber-400/15 px-1 py-px font-body text-[9px] font-bold text-amber-200">
        <CircleAlert className="h-2.5 w-2.5" strokeWidth={2.6} />
        1×
      </span>
    );
  }
  return null;
}

/** Live passive state, condensed to a single row — see
 *  lib/game/passiveStacks.ts for the per-character mapping. */
function PassiveReadoutRow({
  passive,
}: {
  passive: PassiveReadout;
}): React.JSX.Element {
  const highlight =
    passive.ready || (passive.progress !== undefined && passive.fired);

  const state: React.ReactNode[] = [];
  if (passive.stacks) {
    state.push(
      <span key="stacks" className="flex items-center gap-1">
        <ArrowUp
          className={`h-3.5 w-3.5 ${passive.ready ? "text-amber-200" : "text-sky-300"}`}
          strokeWidth={2.6}
        />
        <span
          className={`font-body text-xs font-semibold tabular-nums ${passive.ready ? "text-amber-200" : "text-zinc-300"}`}
        >
          {passive.stacks.current}/{passive.stacks.max}
        </span>
      </span>,
    );
  }
  if (passive.progress) {
    state.push(
      passive.fired ? (
        <span key="progress" className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.6} />
          <span className="font-body text-xs font-bold uppercase tracking-[0.1em] text-emerald-300">
            Active
          </span>
        </span>
      ) : (
        <span
          key="progress"
          className="font-body text-xs font-semibold text-zinc-300 tabular-nums"
        >
          {passive.progress.current}/{passive.progress.required}
        </span>
      ),
    );
  }
  if (passive.conditionMet !== undefined) {
    state.push(
      <span key="cond" className="flex items-center gap-1">
        {passive.conditionMet ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.6} />
        ) : (
          <Circle className="h-3.5 w-3.5 text-zinc-600" strokeWidth={2.6} />
        )}
        <span
          className={`font-body text-xs font-semibold uppercase tracking-[0.1em] ${passive.conditionMet ? "text-emerald-300" : "text-zinc-500"}`}
        >
          {passive.conditionMet ? "Active" : "Inactive"}
        </span>
      </span>,
    );
  }
  if (passive.oneShot) {
    state.push(
      <span key="oneshot" className="flex items-center gap-1">
        {passive.oneShot.available ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.6} />
        ) : (
          <Circle className="h-3.5 w-3.5 text-zinc-600" strokeWidth={2.6} />
        )}
        <span
          className={`font-body text-xs font-bold uppercase tracking-[0.1em] ${passive.oneShot.available ? "text-emerald-300" : "text-zinc-500"}`}
        >
          {passive.oneShot.available ? "Available" : "Used"}
        </span>
      </span>,
    );
  }
  if (passive.alwaysActive) {
    state.push(
      <span key="always" className="flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.6} />
        <span className="font-body text-xs font-bold uppercase tracking-[0.1em] text-emerald-300">
          Active
        </span>
      </span>,
    );
  }
  passive.subStates?.forEach((sub) => {
    state.push(
      <span key={`sub-${sub.label}`} className="flex items-center gap-1">
        {sub.active ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.6} />
        ) : (
          <Circle className="h-3.5 w-3.5 text-zinc-600" strokeWidth={2.6} />
        )}
        <span
          className={`font-body text-xs ${sub.active ? "text-emerald-300" : "text-zinc-500"}`}
        >
          {sub.label}
        </span>
      </span>,
    );
  });
  passive.lines?.forEach((line) => {
    state.push(
      <span key={`line-${line}`} className="font-body text-xs text-emerald-300">
        {line}
      </span>,
    );
  });

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border px-2.5 py-1.5 ${highlight ? "border-amber-400/70 bg-amber-400/10" : "border-zinc-800 bg-zinc-900/40"}`}
    >
      <p className="flex min-w-0 items-center gap-1.5 font-heading text-sm tracking-[0.06em] text-zinc-100">
        <span className="truncate">{passive.label}</span>
        <PassiveActivationTag mode={passive.activationMode} />
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {state}
        {passive.readyMessage ? (
          <span className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-amber-200">
            {passive.readyMessage}
          </span>
        ) : null}
        {passive.note ? (
          <span className="font-body text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            {passive.note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A stat pinned over the art. Layered on a scrim so it stays legible against
 *  whatever the portrait happens to be behind it. */
function OverlayStat({
  label,
  value,
  delta,
  align,
}: {
  label: string;
  value: string;
  delta?: number;
  align: "left" | "right";
}): React.JSX.Element {
  const tone =
    delta === undefined || delta === 0
      ? null
      : delta > 0
        ? "text-emerald-400"
        : "text-rose-400";
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="font-body text-[9px] uppercase tracking-[0.18em] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {label}
      </p>
      <p className="font-heading text-xl leading-none tracking-[0.04em] text-zinc-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tabular-nums md:text-2xl">
        {value}
        {tone ? (
          <span className={`ml-1 font-body text-[11px] ${tone}`}>
            {delta! > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </p>
    </div>
  );
}

type KitTab = { key: string; label: string; art: string | null } & (
  | { kind: "skill"; skill: CharacterSkillData; tag: string }
  | { kind: "passive"; passive: KitPassiveView }
);

/**
 * Full-screen unit inspector, opened by tapping any tile on either side.
 *
 * Laid out by DECISION RELEVANCE rather than by data type. The previous
 * version was a single scrolling column ordered stats -> substats -> ult ->
 * effects -> passive -> every skill at every rank, which put the volatile,
 * decision-driving state (HP, effects, ult gauge) underneath static numbers
 * and above a kit dump that never changes — you saw roughly a third of it at
 * once. Now: threat state and live stats sit together over the art, effects
 * and passive follow as compact rows, and the kit lives in a tab strip so it
 * costs constant height no matter how big the kit is.
 */
export default function UnitDetailPanel({
  unit,
  playerTeam,
  enemyTeam,
  currentTurn,
  onClose,
}: {
  unit: BattleCharacter;
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  currentTurn: number;
  onClose: () => void;
}): React.JSX.Element {
  // Walks whichever side the tapped unit belongs to — the enemy row navigates
  // enemies, the player row navigates allies.
  const ownTeam = unit.team === "player" ? playerTeam : enemyTeam;
  const teamOnField = ownTeam.filter((u) => !u.isSub);
  const [selectedId, setSelectedId] = React.useState(unit.instanceId);
  const [showDetailed, setShowDetailed] = React.useState(false);
  const [tagOverlayTag, setTagOverlayTag] = React.useState<string | null>(null);
  const [detailOverlay, setDetailOverlay] = React.useState<
    | { kind: "ultimate"; skill: CharacterSkillData }
    | { kind: "passive"; passive: KitPassiveView }
    | null
  >(null);
  const [activeTab, setActiveTab] = React.useState(0);

  const idx = Math.max(
    0,
    teamOnField.findIndex((u) => u.instanceId === selectedId),
  );
  const selected = teamOnField[idx] ?? unit;

  const step = (dir: number) => {
    if (teamOnField.length < 2) return;
    const next = (idx + dir + teamOnField.length) % teamOnField.length;
    setSelectedId(teamOnField[next].instanceId);
    setShowDetailed(false);
    setActiveTab(0);
  };

  // Phase-aware kit: a multi-phase boss in a later phase shows THAT phase's
  // skills/ultimate/passives, not the phase-1 catalog entry.
  const catalog = getCharacterById(selected.id);
  const kit = catalog ? getCharacterKit(catalog, selected.phaseIndex ?? 0) : null;
  const passive = getPassiveReadout(selected, {
    playerTeam,
    enemyTeam,
    currentTurn,
  });
  const effAtk = getEffectiveAttack(selected);
  const effDef = getEffectiveDefense(selected);
  const crit = Math.round(getCritChance(selected));
  const evade = Math.round(getEvadeChance(selected));
  const art = getCharacterArt(selected.id);
  const gaugeMax = ultGaugeMax(selected);
  const hpPercent =
    selected.hp > 0 ? Math.max(0, (selected.currentHP / selected.hp) * 100) : 0;

  const tabs: KitTab[] = [];
  kit?.skills.forEach((skill, i) => {
    tabs.push({
      kind: "skill",
      key: `s${i}`,
      label: `S${i + 1}`,
      tag: `S${i + 1}`,
      skill,
      art: getSkillArt(selected.id, skill.skillName),
    });
  });
  if (kit?.ultimate) {
    tabs.push({
      kind: "skill",
      key: "ult",
      label: "ULT",
      tag: "ULT",
      skill: kit.ultimate,
      art: getSkillArt(selected.id, kit.ultimate.skillName),
    });
  }
  (kit?.passives as KitPassiveView[] | undefined)?.forEach((p, i) => {
    tabs.push({
      kind: "passive",
      key: `p${i}`,
      label: tabs.some((t) => t.kind === "passive") ? `PSV ${i + 1}` : "PASSIVE",
      passive: p,
      art: null,
    });
  });
  const tab = tabs[Math.min(activeTab, tabs.length - 1)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-4">
      <Card className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-none border-2 border-zinc-600 bg-zinc-950/95 py-0 ring-0">
        {/* Header: close · name/element/tags · team nav */}
        <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-9 shrink-0 rounded-none border border-zinc-600 px-2 font-body text-xs uppercase tracking-widest"
          >
            <ChevronLeft className="h-4 w-4" /> Close
          </Button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-2">
              <span
                className={`h-2.5 w-2.5 rotate-45 border border-black/40 ${ELEMENT_SWATCH[selected.color]}`}
              />
              <CardTitle className="truncate font-heading text-xl tracking-[0.08em] text-zinc-100">
                {selected.name}
              </CardTitle>
              <span
                className={`shrink-0 border px-1 py-px font-body text-[9px] font-bold uppercase tracking-widest ${
                  selected.team === "player"
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                    : "border-rose-500/60 bg-rose-500/15 text-rose-200"
                }`}
              >
                {selected.team === "player" ? "Ally" : "Enemy"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 font-body text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              <span>{selected.color}</span>
              {selected.tier === "elite" ? <span>· Elite</span> : null}
              {(selected.tags ?? []).map((tag) => (
                <React.Fragment key={tag}>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setTagOverlayTag(tag)}
                    className="cursor-pointer underline decoration-dotted underline-offset-2 transition-colors hover:text-amber-200"
                  >
                    {tag}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={teamOnField.length < 2}
              className="flex h-9 w-9 items-center justify-center border border-zinc-600 text-zinc-300 transition-colors hover:border-zinc-400 disabled:opacity-30"
              aria-label="Previous unit on this side"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={teamOnField.length < 2}
              className="flex h-9 w-9 items-center justify-center border border-zinc-600 text-zinc-300 transition-colors hover:border-zinc-400 disabled:opacity-30"
              aria-label="Next unit on this side"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
          {/* THREAT STATE + LIVE STATS — art band with everything overlaid.
              Stats used to flank a 40x56 thumbnail; putting them over a
              full-bleed portrait fits strictly more on one screen. */}
          <div className="relative h-40 overflow-hidden border border-zinc-700 bg-zinc-900/60 sm:h-48">
            {art ? (
              <Image
                src={art}
                alt={selected.name}
                fill
                sizes="672px"
                priority
                className="object-cover object-[50%_18%]"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-heading text-6xl text-white/60">
                {selected.name.charAt(0)}
              </span>
            )}
            {/* Two scrims: sideways for the stat columns, upward for the
                HP/ult block, which sits over whatever the portrait's lower
                third happens to be. */}
            <span className="absolute inset-0 bg-linear-to-r from-black/85 via-black/40 to-black/85" />
            <span className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/90 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-between p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <OverlayStat
                    label="Attack"
                    value={String(effAtk)}
                    delta={effAtk - selected.atk}
                    align="left"
                  />
                  <OverlayStat
                    label="Defense"
                    value={String(effDef)}
                    delta={effDef - selected.def}
                    align="left"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailed((v) => !v)}
                  title="Detailed info"
                  aria-label="Toggle detailed stats"
                  aria-pressed={showDetailed}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-heading text-sm ${showDetailed ? "border-amber-300 bg-amber-300/25 text-amber-100" : "border-zinc-400 bg-black/70 text-zinc-100"}`}
                >
                  ?
                </button>
              </div>

              {/* HP + ult gauge — the volatile pair, given the bottom band */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-body text-[9px] uppercase tracking-[0.18em] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    HP
                  </span>
                  <span className="font-heading text-lg leading-none text-zinc-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tabular-nums">
                    {Math.max(0, selected.currentHP)}
                    <span className="font-body text-xs text-zinc-400">
                      /{selected.hp}
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900/80">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${hpPercent < 30 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-body text-[9px] uppercase tracking-[0.18em] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    Ult
                  </span>
                  <span className="flex flex-1 items-center gap-0.5">
                    {Array.from({ length: gaugeMax }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 -skew-x-12 ${i < selected.ultGauge ? "bg-amber-400" : "bg-zinc-700/80"}`}
                      />
                    ))}
                  </span>
                  <span className="font-body text-[10px] font-semibold text-amber-200 tabular-nums">
                    {selected.ultGauge}/{gaugeMax}
                  </span>
                </div>
              </div>
            </div>

            {showDetailed ? (
              <div className="absolute inset-0 grid grid-cols-2 content-start gap-x-4 gap-y-1 bg-black/90 px-4 py-3">
                <p className="col-span-2 text-center font-heading text-xs uppercase tracking-[0.16em] text-amber-200">
                  Detailed Info
                </p>
                {(
                  [
                    ["Base ATK", String(selected.atk), undefined],
                    ["Eff. ATK", String(effAtk), effAtk - selected.atk],
                    ["Base DEF", String(selected.def), undefined],
                    ["Eff. DEF", String(effDef), effDef - selected.def],
                    ["Crit Chance", `${crit}%`, undefined],
                    ["Evade", `${evade}%`, undefined],
                  ] as const
                ).map(([label, value, delta]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-zinc-800 py-1"
                  >
                    <span className="font-body text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                      {label}
                    </span>
                    <span className="font-heading text-sm text-zinc-100 tabular-nums">
                      {value}
                      {delta ? (
                        <span
                          className={`ml-1 font-body text-[10px] ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
                <div className="col-span-2 mt-1">
                  <SubstatDrawer unit={selected} />
                </div>
              </div>
            ) : null}
          </div>

          {/* ACTIVE EFFECTS — merged in from what used to be a separate
              separate overlay answering the same question. */}
          <div className="space-y-1">
            <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Active Effects
            </p>
            <EffectsList
              unit={selected}
              allUnits={[...playerTeam, ...enemyTeam]}
            />
          </div>

          {passive ? <PassiveReadoutRow passive={passive} /> : null}

          {/* KIT — a tab strip, so a 2-skill kit and an 8-skill boss phase
              cost the same vertical space. Tabs carry the skill art that
              already exists for all 48 playable/boss skills. */}
          {tabs.length > 0 && tab ? (
            <div className="border border-zinc-800">
              <div className="flex gap-px overflow-x-auto border-b border-zinc-800 bg-zinc-900/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tabs.map((t, i) => {
                  const active = t.key === tab.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(i)}
                      aria-pressed={active}
                      className={`flex min-h-11 shrink-0 items-center gap-1.5 px-2.5 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                        active
                          ? "bg-amber-300/15 text-amber-200"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      {t.art ? (
                        <span className="relative h-6 w-6 shrink-0 overflow-hidden border border-zinc-700">
                          <Image
                            src={t.art}
                            alt=""
                            fill
                            sizes="24px"
                            className="object-cover object-top"
                          />
                        </span>
                      ) : null}
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="p-2">
                {tab.kind === "skill" ? (
                  <SkillBlock
                    skill={tab.skill}
                    tag={tab.tag}
                    onDetails={
                      tab.skill.type === "ultimate"
                        ? () =>
                            setDetailOverlay({
                              kind: "ultimate",
                              skill: tab.skill,
                            })
                        : undefined
                    }
                  />
                ) : (
                  <PassiveProse
                    passive={tab.passive}
                    showName
                    onDetails={() =>
                      setDetailOverlay({ kind: "passive", passive: tab.passive })
                    }
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {detailOverlay ? (
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
      ) : null}

      {tagOverlayTag ? (
        <CharacterListOverlay
          tag={tagOverlayTag}
          onClose={() => setTagOverlayTag(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Tapping a tag chip opens a grid of every character carrying that tag.
 *
 * Uses the full playable catalog rather than the player's owned roster:
 * ownership gating here would show almost nothing until the gacha roster is
 * actually populated, and TeamSelect's practice roster already ignores
 * ownership for the same reason. Revisit when owned-vs-unowned is real.
 */
function CharacterListOverlay({
  tag,
  onClose,
}: {
  tag: string;
  onClose: () => void;
}): React.JSX.Element {
  const matches = getPlayableCharacters().filter((c) =>
    (c.tags ?? []).includes(tag),
  );
  return (
    <DetailOverlay title={`Tag: ${tag}`} onClose={onClose}>
      {matches.length === 0 ? (
        <p className="py-6 text-center font-body text-sm uppercase tracking-[0.14em] text-zinc-500">
          No characters found.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {matches.map((char) => {
            const charArt = getCharacterArt(char.id);
            return (
              <div
                key={char.id}
                className="flex flex-col items-center gap-1 border border-zinc-800 bg-zinc-900/40 p-1.5"
              >
                <div className="relative aspect-square w-full overflow-hidden border border-zinc-700">
                  {charArt ? (
                    <Image
                      src={charArt}
                      alt={char.name}
                      fill
                      sizes="100px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-heading text-2xl text-white/80">
                      {char.name.charAt(0)}
                    </span>
                  )}
                </div>
                <Badge
                  className={`w-full justify-center truncate rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest text-zinc-950 ${ELEMENT_SWATCH[char.color]}`}
                >
                  {char.name}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </DetailOverlay>
  );
}
