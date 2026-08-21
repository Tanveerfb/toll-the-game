"use client";

import React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Infinity as InfinityIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useSettingsStore } from "@/store/settingsStore";
import {
  EffectCountStrip,
  effectCounts,
  EffectsTables,
} from "@/components/game/battle/EffectsList";
import {
  PassiveDetailSections,
  PassiveProse,
  SkillBlock,
  type KitPassiveView,
} from "@/components/game/KitDetails";
import type { BattleCharacter } from "@/types/character";

// Never resubscribes — the store has no updates, it exists only so the server
// snapshot and the client snapshot differ (see DetailOverlay for the same
// pattern and why an effect isn't used).
const NO_SUBSCRIBE = () => () => {};

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
      <span className="inline-flex items-center gap-0.5 border border-edge bg-inset px-1 py-px text-readout-dim">
        <InfinityIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
      </span>
    );
  }
  if (mode === "once") {
    return (
      <span className="inline-flex items-center gap-0.5 border border-role-ultimate/70 bg-role-ultimate/15 px-1 py-px font-body text-[9px] font-bold text-role-ultimate">
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
      <span key="stacks" className="flex items-center gap-1.5">
        <span className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: passive.stacks.max }).map((_, i) => (
            <span
              key={i}
              className={`block h-1.5 w-2.5 ${
                i < passive.stacks!.current
                  ? passive.ready
                    ? "bg-role-ultimate"
                    : "bg-signal"
                  : "bg-hairline"
              }`}
            />
          ))}
        </span>
        <span
          className={`font-body text-xs font-semibold tabular-nums ${passive.ready ? "text-role-ultimate" : "text-readout"}`}
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
          <CheckCircle2 className="h-3.5 w-3.5 text-role-heal" strokeWidth={2.6} />
          <span className="font-body text-xs font-bold uppercase tracking-[0.1em] text-role-heal">
            Active
          </span>
        </span>
      ) : (
        <span
          key="progress"
          className="font-body text-xs font-semibold tabular-nums text-readout"
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
          <CheckCircle2 className="h-3.5 w-3.5 text-role-heal" strokeWidth={2.6} />
        ) : (
          <Circle className="h-3.5 w-3.5 text-readout-muted" strokeWidth={2.6} />
        )}
        <span
          className={`font-body text-xs font-semibold uppercase tracking-[0.1em] ${passive.conditionMet ? "text-role-heal" : "text-readout-muted"}`}
        >
          {passive.conditionMet ? "Active" : "Inactive"}
        </span>
      </span>,
    );
  }
  passive.subStates?.forEach((sub) => {
    state.push(
      <span key={`sub-${sub.label}`} className="flex items-center gap-1">
        {sub.active ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-role-heal" strokeWidth={2.6} />
        ) : (
          <Circle className="h-3.5 w-3.5 text-readout-muted" strokeWidth={2.6} />
        )}
        <span
          className={`font-body text-xs ${sub.active ? "text-role-heal" : "text-readout-muted"}`}
        >
          {sub.label}
        </span>
      </span>,
    );
  });
  passive.lines?.forEach((line) => {
    state.push(
      <span key={`line-${line}`} className="font-body text-xs text-role-heal">
        {line}
      </span>,
    );
  });

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border px-2.5 py-1.5 ${highlight ? "border-role-ultimate/70 bg-role-ultimate/10" : "border-edge bg-inset"}`}
    >
      <p className="flex min-w-0 items-center gap-1.5 font-heading text-sm tracking-[0.06em] text-readout-strong">
        <span className="truncate">{passive.label}</span>
        <PassiveActivationTag mode={passive.activationMode} />
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {state}
        {passive.readyMessage ? (
          <span className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-role-ultimate">
            {passive.readyMessage}
          </span>
        ) : null}
        {passive.note ? (
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-muted">
            {passive.note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One stat, read as a single line: effective value, its delta, and the base
 *  it came from. The old panel printed base and effective as four separate
 *  rows behind a "?" toggle — six numbers for two facts. */
function Stat({
  label,
  base,
  effective,
}: {
  label: string;
  base: number;
  effective: number;
}): React.JSX.Element {
  const delta = effective - base;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-readout-muted">
        {label}
      </span>
      <span className="font-heading text-lg leading-none tabular-nums text-readout-strong">
        {effective}
      </span>
      {delta !== 0 ? (
        <span
          className={`font-body text-[11px] font-bold tabular-nums ${delta > 0 ? "text-role-heal" : "text-role-attack"}`}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      ) : null}
    </span>
  );
}

type KitTab = { key: string; label: string; art: string | null } & (
  | { kind: "skill"; skill: CharacterSkillData; tag: string; ranked?: boolean }
  | { kind: "passive"; passive: KitPassiveView }
);

/**
 * Full-screen unit inspector, opened by tapping any tile on either side.
 *
 * Split into a **pinned state block and a scrolling kit** (Tanveer,
 * 2026-08-11: "the info panel bothers me the most, not good layout and it's a
 * mess"). What changed and why:
 *
 * - Stats had been drawn over the portrait behind a `?` toggle that covered
 *   the whole art band, so the character and their numbers were mutually
 *   exclusive and the toggle was an undiscoverable mode. Stats now have a real
 *   place and are always on.
 * - The pinned block's height is **constant**. The effect strip scrolls
 *   sideways rather than wrapping, so a unit carrying ten effects doesn't push
 *   the kit off screen; the expander below opens the itemised list with
 *   descriptions and sources.
 * - The kit tab strip is sticky inside the scroll zone, so a long rank table
 *   can't scroll the tabs away.
 *
 * Portalled to `document.body`: `BattleArena` puts `battle-shake-strong` on
 * its wrapper during heavy hits, and an active transform creates a containing
 * block that would otherwise scope this `fixed` overlay to the arena.
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
}): React.JSX.Element | null {
  // Walks whichever side the tapped unit belongs to — the enemy row navigates
  // enemies, the player row navigates allies.
  const ownTeam = unit.team === "player" ? playerTeam : enemyTeam;
  const teamOnField = ownTeam.filter((u) => !u.isSub);
  const [selectedId, setSelectedId] = React.useState(unit.instanceId);
  const [effectsOpen, setEffectsOpen] = React.useState(false);
  // A preference, not panel state: whoever wants the grey entries wants them
  // on every unit and every battle, not once per panel open.
  const showUncancellable = useSettingsStore((s) => s.showUncancellableEffects);
  const setShowUncancellable = useSettingsStore(
    (s) => s.setShowUncancellableEffects,
  );
  const [tagOverlayTag, setTagOverlayTag] = React.useState<string | null>(null);
  const [detailOverlay, setDetailOverlay] = React.useState<
    | { kind: "ultimate"; skill: CharacterSkillData }
    | { kind: "passive"; passive: KitPassiveView }
    | null
  >(null);
  const [activeTab, setActiveTab] = React.useState(0);

  const mounted = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

  // A bench unit is reachable from the Team list but isn't in `teamOnField`,
  // so the old `Math.max(0, findIndex)` silently resolved it to the FIRST
  // field unit — you opened the sub and got someone else. Now the bench is
  // the only way to meet a sub, so it has to resolve honestly.
  const fieldIdx = teamOnField.findIndex((u) => u.instanceId === selectedId);
  const isBenched = fieldIdx < 0;
  const idx = Math.max(0, fieldIdx);
  const selected =
    (isBenched
      ? ownTeam.find((u) => u.instanceId === selectedId)
      : teamOnField[idx]) ?? unit;

  // Plain function, not `useCallback`: `teamOnField` is derived inline, so
  // manual memoization can't be preserved and the React Compiler refuses to
  // optimize the component. The compiler memoizes this for us.
  const step = (dir: number) => {
    if (teamOnField.length < 2) return;
    const next = (idx + dir + teamOnField.length) % teamOnField.length;
    setSelectedId(teamOnField[next].instanceId);
    setEffectsOpen(false);
    setActiveTab(0);
  };

  // Keyboard: Escape closes, arrows walk the side. The panel was previously
  // mouse-only. Suppressed while a nested overlay owns the keyboard.
  //
  // The handler goes through a ref rather than the effect's dependency list:
  // `step` can't be a `useCallback` (see above) and listing it would re-bind
  // the listener on every render.
  const nestedOpen = detailOverlay !== null || tagOverlayTag !== null;
  const keyHandler = React.useRef<(event: KeyboardEvent) => void>(undefined);
  // Refs can't be written during render, so the latest closure is stored in
  // its own dependency-free effect.
  React.useEffect(() => {
    keyHandler.current = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
    };
  });
  React.useEffect(() => {
    if (nestedOpen) return;
    const onKey = (event: KeyboardEvent) => keyHandler.current?.(event);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nestedOpen]);

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
  // Grey (uncancellable) entries are hidden by default — see the toggle on
  // the effect strip and `settingsStore.showUncancellableEffects`.
  const counts = effectCounts(selected);

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
  // The SP Skill fires on the boss's own timer instead of off a card, which is
  // exactly why it needs a tab: it's the one action you can't see coming from
  // the hand (Tanveer, 2026-08-13).
  if (kit?.spSkill) {
    tabs.push({
      kind: "skill",
      key: "sp",
      label: "SP",
      tag: "SP",
      skill: kit.spSkill,
      ranked: false,
      art: getSkillArt(selected.id, kit.spSkill.skillName),
    });
  }
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

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${selected.name} details`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 px-3 py-4 backdrop-blur-sm"
    >
      <div className="chamfer-lg flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden border border-edge-strong bg-panel">
        {/* Header — two rows, so identity never fights the controls for space.
            The old single row put the name between two button clusters. */}
        <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-px border-b border-hairline bg-inset px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="row-span-2 flex h-11 w-11 items-center justify-center border border-edge text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rotate-45 border border-void/40 ${ELEMENT_SWATCH[selected.color]}`}
            />
            <h2 className="truncate font-heading text-xl leading-none tracking-[0.08em] text-readout-strong">
              {selected.name}
            </h2>
            <span
              className={`shrink-0 border px-1 py-px font-body text-[9px] font-bold uppercase tracking-widest ${
                selected.team === "player"
                  ? "border-role-heal/60 text-role-heal"
                  : "border-role-attack/60 text-role-attack"
              }`}
            >
              {selected.team === "player" ? "Ally" : "Enemy"}
            </span>
          </div>

          <div className="row-span-2 flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={teamOnField.length < 2}
              className="flex h-11 w-11 items-center justify-center border border-edge text-readout-dim transition-colors hover:border-edge-strong hover:text-signal disabled:opacity-30"
              aria-label="Previous unit on this side"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Position readout — with four units on a side, stepping blind
                gave no sense of where you were. */}
            <span className="min-w-8 text-center font-body text-[10px] font-bold tabular-nums text-readout-muted">
              {isBenched ? "Sub" : `${idx + 1}/${teamOnField.length}`}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={teamOnField.length < 2}
              className="flex h-11 w-11 items-center justify-center border border-edge text-readout-dim transition-colors hover:border-edge-strong hover:text-signal disabled:opacity-30"
              aria-label="Next unit on this side"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="col-start-2 flex flex-wrap items-center gap-x-1 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-muted">
            <span>{selected.color}</span>
            {selected.tier === "elite" ? <span>· Elite</span> : null}
            {(selected.tags ?? []).map((tag) => (
              <React.Fragment key={tag}>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setTagOverlayTag(tag)}
                  // Inline in a metadata run, so it grows its hit area with
                  // padding the line box gives back — the same compromise the
                  // keyword triggers make in `Hint`.
                  className="cursor-pointer py-1 -my-1 underline decoration-dotted underline-offset-2 transition-colors hover:text-signal"
                >
                  {tag}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* PINNED STATE — fixed height whatever the unit is carrying. */}
        <div className="shrink-0 border-b border-edge bg-inset px-3 py-2.5">
          <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3">
            <span className="block h-19 w-19 overflow-hidden border border-edge bg-void">
              {art ? (
                <Image
                  src={art}
                  alt=""
                  width={152}
                  height={152}
                  priority
                  className="h-full w-full object-cover object-[50%_12%]"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-heading text-3xl text-readout-dim">
                  {selected.name.charAt(0)}
                </span>
              )}
            </span>

            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
                  HP
                </span>
                <span className="font-heading text-xl leading-none tabular-nums text-readout-strong">
                  {Math.max(0, selected.currentHP)}
                  <span className="font-body text-xs font-semibold text-readout-muted">
                    /{selected.hp}
                  </span>
                </span>
              </div>
              <span className="mt-1 block h-1.5 w-full bg-hairline">
                <span
                  className={`block h-full transition-[width] duration-300 ${hpPercent < 30 ? "bg-role-attack" : "bg-role-heal"}`}
                  style={{ width: `${hpPercent}%` }}
                />
              </span>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
                  Ult
                </span>
                <span className="flex flex-1 items-center gap-0.5">
                  {Array.from({ length: gaugeMax }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 -skew-x-12 ${i < selected.ultGauge ? "bg-role-ultimate" : "bg-hairline"}`}
                    />
                  ))}
                </span>
                <span className="font-body text-[10px] font-bold tabular-nums text-role-ultimate">
                  {selected.ultGauge}/{gaugeMax}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Stat label="Atk" base={selected.atk} effective={effAtk} />
                <Stat label="Def" base={selected.def} effective={effDef} />
                <span className="font-body text-[11px] font-semibold tabular-nums text-readout-dim">
                  <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.16em] text-readout-muted">
                    Crit
                  </span>
                  {crit}%
                </span>
                <span className="font-body text-[11px] font-semibold tabular-nums text-readout-dim">
                  <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.16em] text-readout-muted">
                    Evade
                  </span>
                  {evade}%
                </span>
              </div>
            </div>
          </div>

          {/* Effect counts: `↑4 ↓3`, a side with none omitted entirely. This
              was a chip per effect, which outgrew the one line it is allowed
              (the point of pinning this block is that its height can't move).
              The names moved to the Detail modal (Tanveer, 2026-08-13). */}
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {counts.buffs === 0 && counts.debuffs === 0 ? (
                <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-muted">
                  No active effects
                </span>
              ) : (
                <EffectCountStrip unit={selected} />
              )}
            </div>
            <button
              type="button"
              onClick={() => setEffectsOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-11 shrink-0 items-center gap-1 border border-edge px-3 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-dim transition-colors hover:border-edge-strong hover:text-readout"
            >
              Detail
            </button>
          </div>
        </div>

        {/* SCROLL ZONE — everything that can grow without limit. */}
        <div className="hud-scroll min-h-0 flex-1 overflow-y-auto">
          {/* The effects list used to expand INTO this column — an unbounded
              list inside an already-scrolling panel. It lives in a modal now;
              the passive readout stays, since it is one fixed-height row. */}
          {passive ? (
            <div className="border-b border-hairline p-3">
              <PassiveReadoutRow passive={passive} />
            </div>
          ) : null}

          {/* KIT — a tab strip, so a 2-skill kit and an 8-skill boss phase
              cost the same vertical space. The strip is sticky: a long rank
              table used to scroll the tabs out of reach. */}
          {tabs.length > 0 && tab ? (
            <div>
              <div className="hud-scroll sticky top-0 z-10 flex gap-px overflow-x-auto border-b border-hairline bg-inset">
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
                          ? "bg-signal/10 text-signal shadow-[inset_0_-2px_0_var(--color-signal)]"
                          : "text-readout-dim hover:text-readout"
                      }`}
                    >
                      {t.art ? (
                        <span className="relative h-6 w-6 shrink-0 overflow-hidden border border-edge">
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
              <div className="p-3">
                {tab.kind === "skill" ? (
                  <SkillBlock
                    skill={tab.skill}
                    tag={tab.tag}
                    ranked={tab.ranked ?? true}
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
      </div>

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

      {effectsOpen ? (
        <DetailOverlay
          title="Active Effects"
          subtitle={selected.name}
          onClose={() => setEffectsOpen(false)}
        >
          <EffectsTables
            unit={selected}
            allUnits={[...playerTeam, ...enemyTeam]}
            showUncancellable={showUncancellable}
            onToggleUncancellable={() =>
              setShowUncancellable(!showUncancellable)
            }
          />
          <div className="mt-4 border-t border-hairline pt-3">
            <SubstatDrawer unit={selected} />
          </div>
        </DetailOverlay>
      ) : null}

      {tagOverlayTag ? (
        <CharacterListOverlay
          tag={tagOverlayTag}
          onClose={() => setTagOverlayTag(null)}
        />
      ) : null}
    </div>,
    document.body,
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
        <p className="py-6 text-center font-body text-sm font-bold uppercase tracking-[0.18em] text-readout-muted">
          No characters found.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {matches.map((char) => {
            const charArt = getCharacterArt(char.id);
            return (
              <div
                key={char.id}
                className="flex flex-col items-center gap-1 border border-edge bg-inset p-1.5"
              >
                <div className="relative aspect-square w-full overflow-hidden border border-hairline">
                  {charArt ? (
                    <Image
                      src={charArt}
                      alt={char.name}
                      fill
                      sizes="100px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-heading text-2xl text-readout-dim">
                      {char.name.charAt(0)}
                    </span>
                  )}
                </div>
                <Badge
                  className={`w-full justify-center truncate px-1 text-[9px] text-void ${ELEMENT_SWATCH[char.color]}`}
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
