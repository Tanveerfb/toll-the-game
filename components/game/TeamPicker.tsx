"use client";

import React from "react";
import Image from "next/image";
import DetailOverlay from "@/components/game/DetailOverlay";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getPlayableCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import { FIELD_CAP, TEAM_CAP } from "@/lib/game/format";
import {
  MAX_PRESETS,
  resolveLastTeam,
  resolvePreset,
  type PresetIssue,
  type TeamPreset,
} from "@/lib/game/teamPresets";
import { usePlayerStore } from "@/store/playerStore";

/**
 * The team picker. One component, everywhere.
 *
 * There used to be two — `TeamSelect` (full-catalog practice bench, which also
 * owned the format rules) and `OwnedTeamSelect` (roster-limited, used by the
 * story brief and world boss, with no format concept at all). Neither knew
 * what the other knew, which is how story battles ended up fielding four units
 * (Tanveer, 2026-08-11: "a global team picker used everywhere across the game,
 * not duplicated instances specially made for certain sections").
 *
 * It picks ONE team. The practice bench composes two of them — picking your
 * side and the opposing side are the same job with different sources.
 */

export interface TeamPickerProps {
  team: CharacterData[];
  onChange: (team: CharacterData[]) => void;
  /**
   * Units the mode fixes in place: they lead the team, can't be removed, and
   * **bypass the ownership check** — a story lead has to be playable by an
   * account that never pulled them.
   */
  anchors?: CharacterData[];
  /** Slots the player may fill. Defaults to whatever the anchors leave. */
  openSlots?: number;
  /**
   * Which characters may be chosen. `roster` respects ownership; `catalog`
   * ignores it, which is the practice bench — testing a kit you haven't pulled
   * is the point of that screen.
   */
  source?: "roster" | "catalog";
  ownedIds?: string[];
  title?: string;
  /** Presets are a player-team affordance; the practice enemy side turns them
   *  off rather than offering to save an opposing team as "Main". */
  showPresets?: boolean;
  /** Total units on the field before the rest bench. */
  fieldCap?: number;
  lockedNote?: string;
  /**
   * Anchors the player doesn't own, lent for this battle only. Rendered as
   * Trial rather than Required, with a line saying what that means — the
   * behaviour has always existed (anchors bypass ownership) but nothing told
   * the player, so a character they never pulled just appeared.
   */
  trialIds?: string[];
  /**
   * Anchors the player owns AND is currently fielding as the lent version.
   *
   * Distinct from `trialIds`, which is "no other copy exists". These are a
   * choice, so their tile is a button — owning a lead must never be worse than
   * not owning one (Tanveer, 2026-08-14).
   */
  lentByChoiceIds?: string[];
  /** Toggles an owned anchor between the player's copy and the lent one.
   *  Omit to render anchors as static tiles, which is what every non-story
   *  caller wants. */
  onToggleLent?: (characterId: string) => void;
  /** Per-anchor caption under the toggle, e.g. "Lv40" vs "Yours Lv12". */
  anchorNote?: (characterId: string, lent: boolean) => string | null;
}

const CHIP =
  "chamfer min-h-11 border px-2.5 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] transition-colors";
const CHIP_OFF =
  "border-edge bg-void/60 text-readout-dim hover:border-edge-strong hover:text-readout";
const CHIP_ON = "border-signal bg-signal/10 text-signal";

function Portrait({
  character,
  className = "",
}: {
  character: CharacterData;
  className?: string;
}): React.JSX.Element {
  const art = getCharacterArt(character.id);
  if (!art) {
    return (
      <span
        className={`flex items-center justify-center bg-inset font-heading text-2xl text-readout-dim ${className}`}
      >
        {character.name.charAt(0)}
      </span>
    );
  }
  return (
    <Image
      src={art}
      alt=""
      width={256}
      height={256}
      className={`object-cover object-top ${className}`}
    />
  );
}

/** Member faces on a preset chip — a team is recognised faster than its name
 *  is read, especially once there are eight of them. */
function PresetFaces({ ids }: { ids: string[] }): React.JSX.Element {
  const catalog = getPlayableCharacters();
  return (
    <span className="flex gap-px">
      {ids.slice(0, 4).map((id, i) => {
        const character = catalog.find((c) => c.id === id);
        const art = getCharacterArt(id);
        return (
          <span
            key={`${id}-${i}`}
            className="block h-[18px] w-[18px] overflow-hidden border border-hairline bg-inset"
          >
            {art ? (
              <Image
                src={art}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <span className="block text-center text-[9px] text-readout-muted">
                {character?.name.charAt(0) ?? "?"}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export default function TeamPicker({
  team,
  onChange,
  anchors = [],
  openSlots: openSlotsProp,
  source = "roster",
  ownedIds = [],
  title = "Your team",
  showPresets = true,
  fieldCap = FIELD_CAP,
  lockedNote = "Required",
  trialIds = [],
  lentByChoiceIds = [],
  onToggleLent,
  anchorNote,
}: TeamPickerProps): React.JSX.Element {
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [issues, setIssues] = React.useState<PresetIssue[]>([]);
  const [activePresetId, setActivePresetId] = React.useState<string | null>(
    null,
  );

  const presets = usePlayerStore((s) => s.presets);
  const lastTeam = usePlayerStore((s) => s.lastTeam);
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const saveTeamPreset = usePlayerStore((s) => s.saveTeamPreset);
  const deleteTeamPreset = usePlayerStore((s) => s.deleteTeamPreset);
  const renameTeamPreset = usePlayerStore((s) => s.renameTeamPreset);
  const noteTeamPresetUsed = usePlayerStore((s) => s.noteTeamPresetUsed);

  const openSlots = Math.max(
    0,
    Math.min(
      openSlotsProp ?? TEAM_CAP - anchors.length,
      TEAM_CAP - anchors.length,
    ),
  );
  const anchoredIds = React.useMemo(
    () => anchors.map((c) => c.id),
    [anchors],
  );

  const catalog = React.useMemo(() => getPlayableCharacters(), []);
  const selectable = React.useMemo(() => {
    const pool =
      source === "catalog"
        ? catalog
        : catalog.filter((c) => ownedIds.includes(c.id));
    return pool.filter((c) => !anchoredIds.includes(c.id));
  }, [catalog, source, ownedIds, anchoredIds]);

  const byId = React.useCallback(
    (ids: string[]) =>
      ids
        .map((id) => catalog.find((c) => c.id === id))
        .filter((c): c is CharacterData => Boolean(c)),
    [catalog],
  );

  // Sticky last team: open on whatever was last taken into battle rather than
  // on nothing. This is the actual answer to "tired of picking chars manually
  // each time" — the brief used to reset its selection on every visit.
  // Only fires once, and never over a selection the player already made.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || !hasHydrated) return;
    seeded.current = true;
    if (team.length > 0 || openSlots === 0 || lastTeam.length === 0) return;
    const ids = resolveLastTeam(lastTeam, {
      anchoredIds,
      ownedIds: source === "catalog" ? null : ownedIds,
      openSlots,
    });
    if (ids.length > 0) onChange(byId(ids));
  }, [
    hasHydrated,
    team.length,
    openSlots,
    lastTeam,
    anchoredIds,
    ownedIds,
    source,
    byId,
    onChange,
  ]);

  const toggle = (character: CharacterData) => {
    setActivePresetId(null);
    if (team.some((c) => c.id === character.id)) {
      onChange(team.filter((c) => c.id !== character.id));
    } else if (team.length < openSlots) {
      onChange([...team, character]);
    }
  };

  const applyPreset = (preset: TeamPreset) => {
    const resolved = resolvePreset(preset, {
      anchoredIds,
      ownedIds: source === "catalog" ? null : ownedIds,
      openSlots,
    });
    onChange(byId(resolved.memberIds));
    setIssues(resolved.issues);
    setActivePresetId(preset.id);
    noteTeamPresetUsed(preset.id);
  };

  const saveCurrent = () => {
    if (team.length === 0) return;
    const name = window.prompt("Name this preset", `Team ${presets.length + 1}`);
    if (name === null) return;
    const ok = saveTeamPreset(
      name,
      team.map((c) => c.id),
    );
    if (!ok) {
      window.alert(
        `You already have ${MAX_PRESETS} presets. Delete one to save another.`,
      );
    }
  };

  const filled = anchors.length + team.length;

  return (
    <>
      <div className="chamfer-lg border border-signal bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
          <h3 className="font-heading text-lg tracking-[0.12em] text-signal">
            {title}
          </h3>
          <span className="font-body text-[11px] font-bold uppercase tracking-[0.18em] tabular-nums text-readout-muted">
            {openSlots === 0
              ? `${anchors.length} locked`
              : `${filled} / ${anchors.length + openSlots}`}
            <span className="ml-2 text-readout-dim">
              {fieldCap} on field
            </span>
          </span>
        </div>

        {showPresets && openSlots > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-3 py-2">
            <span className="mr-1 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
              Preset
            </span>
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`${CHIP} flex items-center gap-2 ${activePresetId === preset.id ? CHIP_ON : CHIP_OFF}`}
              >
                <PresetFaces ids={preset.memberIds} />
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={saveCurrent}
              disabled={team.length === 0}
              className={`${CHIP} border-dashed ${CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
            >
              + Save current
            </button>
            {/* With nothing saved, the row was a bare label and a dashed `+`,
                which reads as a missing feature rather than an empty one
                (Tanveer, 2026-08-13). Say what a preset is for instead. */}
            {presets.length === 0 ? (
              <span className="font-body text-[11px] text-readout-muted">
                Save a team here to load it in any battle.
              </span>
            ) : null}
            {presets.length > 0 ? (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                aria-label="Manage presets"
                className={`${CHIP} ${CHIP_OFF}`}
              >
                ⋯
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-2 p-3">
          {anchors.map((character, index) => {
            const unowned = trialIds.includes(character.id);
            const lentByChoice = lentByChoiceIds.includes(character.id);
            const lent = unowned || lentByChoice;
            // Only an owned anchor can swap: an unowned one has no second copy.
            const swappable = Boolean(onToggleLent) && !unowned;
            const note = anchorNote?.(character.id, lent) ?? null;
            const Tile = swappable ? "button" : "div";
            return (
              <Tile
                key={`anchor-${character.id}-${index}`}
                {...(swappable
                  ? {
                      type: "button" as const,
                      onClick: () => onToggleLent?.(character.id),
                      "aria-pressed": lent,
                      title: lent
                        ? `Using the story's ${character.name} — tap to use yours`
                        : `Using your ${character.name} — tap to use the story's`,
                    }
                  : {})}
                className={`relative flex h-24 w-full flex-col justify-end overflow-hidden border bg-inset text-left ${lent ? "border-signal" : "border-role-ultimate"} ${swappable ? "transition-colors hover:border-signal-strong" : ""}`}
              >
                <Portrait
                  character={character}
                  className="absolute inset-0 h-full w-full"
                />
                <span
                  className={`absolute left-0 top-0 z-10 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-widest text-void ${lent ? "bg-signal" : "bg-role-ultimate"}`}
                >
                  {lent ? "Trial" : swappable ? "Yours" : lockedNote}
                </span>
                {/* The swap affordance has to be visible without a hover —
                    this screen is played on touch as much as on desktop. */}
                {swappable ? (
                  <span className="absolute right-0 top-0 z-10 bg-void/85 px-1 py-0.5 font-body text-[10px] leading-none text-signal">
                    ⇄
                  </span>
                ) : null}
                <span className="relative z-10 w-full bg-void/75 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-readout-strong">
                  {character.name}
                </span>
                {note ? (
                  <span className="relative z-10 w-full bg-void/75 px-1 pb-0.5 text-center font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-dim">
                    {note}
                  </span>
                ) : null}
              </Tile>
            );
          })}

          {Array.from({ length: openSlots }).map((_, index) => {
            const character = team[index];
            const slotIndex = anchors.length + index;
            const benched = slotIndex >= fieldCap;
            if (!character) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => setRosterOpen(true)}
                  className="flex h-24 flex-col items-center justify-center border border-dashed border-edge text-3xl leading-none text-readout-muted transition-colors hover:border-signal hover:text-signal"
                >
                  +
                  {benched ? (
                    <span className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]">
                      Sub
                    </span>
                  ) : null}
                </button>
              );
            }
            return (
              <button
                key={`${character.id}-${index}`}
                type="button"
                onClick={() => setRosterOpen(true)}
                className={`relative flex h-24 flex-col justify-end overflow-hidden border bg-inset ${benched ? "border-edge" : "border-signal/60"}`}
              >
                <Portrait
                  character={character}
                  className={`absolute inset-0 h-full w-full ${benched ? "opacity-70 grayscale" : ""}`}
                />
                {/* The bench is real now that three units take the field, so
                    the fourth slot says so rather than looking identical. */}
                {benched ? (
                  <span className="absolute left-0 top-0 z-10 border-b border-r border-edge bg-void/85 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-widest text-readout-dim">
                    Sub
                  </span>
                ) : null}
                <span className="relative z-10 w-full bg-void/75 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-readout-strong">
                  {character.name}
                </span>
              </button>
            );
          })}
        </div>

        {trialIds.length > 0 ? (
          <p className="border-t border-hairline px-3 py-2 font-body text-[11px] leading-relaxed text-readout-dim">
            <span className="font-semibold text-signal">
              {anchors
                .filter((c) => trialIds.includes(c.id))
                .map((c) => c.name)
                .join(", ")}
            </span>{" "}
            {trialIds.length === 1 ? "leads" : "lead"} this chapter and{" "}
            {trialIds.length === 1 ? "isn't" : "aren't"} on your roster. A story
            version is lent for this battle only — not added to your roster, and
            nothing they earn is kept.
          </p>
        ) : null}

        {issues.length > 0 ? (
          <p className="border-t border-hairline px-3 py-2 font-body text-[11px] leading-relaxed text-role-ultimate">
            {issues.map((issue) => {
              const name =
                catalog.find((c) => c.id === issue.characterId)?.name ??
                issue.characterId;
              return issue.reason === "anchored"
                ? `${name} already leads this battle. `
                : `${name} isn't on your roster. `;
            })}
            Those slots were left open — the preset itself is unchanged.
          </p>
        ) : null}
      </div>

      {rosterOpen ? (
        <DetailOverlay
          title={source === "catalog" ? "All characters" : "Your roster"}
          subtitle={`Tap to add or remove · ${team.length}/${openSlots} picked`}
          size="wide"
          onClose={() => setRosterOpen(false)}
        >
          {selectable.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-readout-muted">
              No characters available yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selectable.map((character) => {
                const pickIndex = team.findIndex((c) => c.id === character.id);
                const isPicked = pickIndex !== -1;
                const disabled = !isPicked && team.length >= openSlots;
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(character)}
                    className={`relative flex h-32 flex-col justify-end overflow-hidden border bg-inset text-left transition-colors ${
                      isPicked
                        ? "border-signal"
                        : disabled
                          ? "cursor-not-allowed border-hairline opacity-40"
                          : "border-edge hover:border-edge-strong"
                    }`}
                  >
                    <Portrait
                      character={character}
                      className="absolute inset-0 h-full w-full"
                    />
                    {isPicked ? (
                      <span className="absolute right-0 top-0 z-10 bg-signal px-1.5 py-0.5 font-body text-[10px] font-bold tabular-nums text-void">
                        {anchors.length + pickIndex + 1}
                      </span>
                    ) : null}
                    <span className="relative z-10 w-full bg-void/80 px-1.5 py-1">
                      <span className="block truncate font-heading text-sm tracking-[0.06em] text-readout-strong">
                        {character.name}
                      </span>
                      <span className="block font-body text-[9px] font-bold uppercase tracking-[0.12em] tabular-nums text-readout-muted">
                        {character.atk} / {character.def} / {character.hp}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DetailOverlay>
      ) : null}

      {manageOpen ? (
        <DetailOverlay
          title="Team presets"
          subtitle={`${presets.length} of ${MAX_PRESETS} saved`}
          onClose={() => setManageOpen(false)}
        >
          <div className="flex flex-col">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 border-b border-hairline py-2"
              >
                <PresetFaces ids={preset.memberIds} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-base tracking-[0.04em] text-readout-strong">
                    {preset.name}
                  </span>
                  <span className="block font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-muted">
                    {preset.memberIds.length} units · used {preset.useCount}×
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt("Rename preset", preset.name);
                    if (name !== null) renameTeamPreset(preset.id, name);
                  }}
                  className={`${CHIP} ${CHIP_OFF}`}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => deleteTeamPreset(preset.id)}
                  className={`${CHIP} border-edge text-readout-dim hover:border-role-attack hover:text-role-attack`}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </DetailOverlay>
      ) : null}
    </>
  );
}

/** Converts a picked team into the `TeamPick[]` shape `startCustomBattle`
 *  expects. Order is preserved — the field/sub split reads off it. */
export function toTeamPicks(team: CharacterData[]): Array<{ id: string }> {
  return team.map((c) => ({ id: c.id }));
}
