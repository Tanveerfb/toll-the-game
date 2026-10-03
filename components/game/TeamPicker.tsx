"use client";

import React from "react";
import Image from "next/image";
import PresetNameDialog from "@/components/game/PresetNameDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { panelVariants } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/toggle";
import RosterToolbar from "@/components/game/RosterToolbar";
import { useReturnFocus } from "@/hooks/useReturnFocus";
import { useRosterFilters } from "@/hooks/useRosterFilters";
import type { RosterFilterItem } from "@/lib/game/rosterFilter";
import { cn } from "@/lib/utils";
import UnitTileFace, { unitTileWrapperClass } from "@/components/game/UnitTileFace";
import { getCharacterArt } from "@/lib/game/characterArt";
import { elementCode, elementHue } from "@/lib/game/elementStyle";
import {
  getCharacterMechanics,
  getPlayableCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import { battleStats } from "@/lib/game/battleStats";
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
 *
 * **Shōnen Ink (ruling #154):** the picker is its own paper panel, so it reads
 * on any screen that hosts it (the practice bench and the event brief both
 * sit on the ground). Its two overlays are the shadcn `Dialog`, the preset
 * chips are the shadcn `Toggle`, and every other control is a `Button`.
 */

/** One character on the roster sheet, with the numbers it is searched and sorted by. */
interface PickerRow extends RosterFilterItem {
  character: CharacterData;
}

export interface TeamPickerProps {
  team: CharacterData[];
  onChange: (team: CharacterData[]) => void;
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
  /**
   * Which side this team fights on, which decides the stats a tile shows.
   * The player's side fights at the save's progression and an enemy at the
   * bare statline — the same rule `startCustomBattle` applies — so a tile
   * shows exactly what the unit will field.
   */
  side?: "player" | "enemy";
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
            className="block size-4.5 overflow-hidden border border-border bg-muted"
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
              <span className="block text-center text-micro text-muted-foreground">
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
  source = "roster",
  ownedIds = [],
  title = "Your team",
  showPresets = true,
  fieldCap = FIELD_CAP,
  side = "player",
}: TeamPickerProps): React.JSX.Element {
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  /** Which naming the name dialog is doing, if any. */
  const [naming, setNaming] = React.useState<
    { kind: "save" } | { kind: "rename"; preset: TeamPreset } | null
  >(null);
  // Four slot buttons open the roster, so there is no single trigger for
  // radix to return focus to.
  const returnFocus = useReturnFocus();
  // The name dialog opens from "+ Save current" or from a Rename button.
  const nameFocus = useReturnFocus();
  const openRoster = (event: React.MouseEvent<HTMLElement>) => {
    returnFocus.remember(event.currentTarget);
    setRosterOpen(true);
  };
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
  const progress = usePlayerStore((s) => s.characters);


  const catalog = React.useMemo(() => getPlayableCharacters(), []);
  const selectable = React.useMemo(
    () =>
      source === "catalog"
        ? catalog
        : catalog.filter((c) => ownedIds.includes(c.id)),
    [catalog, source, ownedIds],
  );

  /**
   * The roster sheet's rows, carrying the stats a unit will actually field,
   * through the battle's own pipeline. This printed the catalog statline, so a
   * Lv30 unit read the same as a fresh pull on the one screen used to choose
   * between them (2026-09-26). The search and sorts read the same numbers the
   * tiles show.
   */
  const rows = React.useMemo<PickerRow[]>(
    () =>
      selectable.map((character) => {
        const saved = side === "player" ? progress[character.id] : undefined;
        const stats = battleStats(character, {
          progression: saved
            ? { level: saved.level, ascension: saved.ascension }
            : undefined,
          side,
        });
        return {
          character,
          id: character.id,
          name: character.name,
          color: character.color,
          atk: stats.atk,
          def: stats.def,
          hp: stats.hp,
          tags: character.tags ?? [],
          mechanics: getCharacterMechanics(character),
          // The plate's level: none for an enemy, or a unit not in the save.
          level: saved?.level,
        };
      }),
    [selectable, progress, side],
  );
  const filters = useRosterFilters(rows);

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
    if (team.length > 0 || lastTeam.length === 0) return;
    const ids = resolveLastTeam(lastTeam, {
      ownedIds: source === "catalog" ? null : ownedIds,
      openSlots: TEAM_CAP,
    });
    if (ids.length > 0) onChange(byId(ids));
  }, [
    hasHydrated,
    team.length,
    lastTeam,
    ownedIds,
    source,
    byId,
    onChange,
  ]);

  const toggle = (character: CharacterData) => {
    setActivePresetId(null);
    if (team.some((c) => c.id === character.id)) {
      onChange(team.filter((c) => c.id !== character.id));
    } else if (team.length < TEAM_CAP) {
      onChange([...team, character]);
    }
  };

  const applyPreset = (preset: TeamPreset) => {
    const resolved = resolvePreset(preset, {
      ownedIds: source === "catalog" ? null : ownedIds,
      openSlots: TEAM_CAP,
    });
    onChange(byId(resolved.memberIds));
    setIssues(resolved.issues);
    setActivePresetId(preset.id);
    noteTeamPresetUsed(preset.id);
  };

  const saveCurrent = (event: React.MouseEvent<HTMLElement>) => {
    if (team.length === 0) return;
    nameFocus.remember(event.currentTarget);
    setNaming({ kind: "save" });
  };

  /** Returns an error to show in the name dialog, or null when it worked. */
  const submitName = (name: string): string | null => {
    if (!naming) return null;
    if (naming.kind === "rename") {
      renameTeamPreset(naming.preset.id, name);
      return null;
    }
    const ok = saveTeamPreset(
      name,
      team.map((c) => c.id),
    );
    return ok
      ? null
      : `You already have ${MAX_PRESETS} presets. Delete one to save another.`;
  };


  return (
    <>
      <div className={panelVariants({ surface: "paper", density: "none", lift: "slab" })}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
          <h3 className="font-heading text-lg tracking-label">{title}</h3>
        </div>

        {showPresets ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-rule px-3 py-2">
            <span className="mr-1 font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
              Preset
            </span>
            {presets.map((preset) => (
              <Toggle
                key={preset.id}
                variant="outline"
                size="sm"
                pressed={activePresetId === preset.id}
                onPressedChange={() => applyPreset(preset)}
                className="gap-2"
              >
                <PresetFaces ids={preset.memberIds} />
                {preset.name}
              </Toggle>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={saveCurrent}
              disabled={team.length === 0}
              className="border-dashed"
            >
              + Save current
            </Button>
            {presets.length > 0 ? (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setManageOpen(true)}
                aria-label="Manage presets"
              >
                ⋯
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Room above for the break-out heads and below for the plates, which
            both overhang their tile. */}
        <div className="grid grid-cols-4 gap-3 px-3.5 pb-6 pt-10">
          {Array.from({ length: TEAM_CAP }).map((_, index) => {
            const character = team[index];
            // The bench is real now that three units take the field, so the
            // fourth slot says so rather than looking identical.
            const benched = index >= fieldCap;
            if (!character) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={openRoster}
                  aria-label={benched ? "Add a sub" : "Add a unit"}
                  className={unitTileWrapperClass}
                >
                  <UnitTileFace id="" name="" hue="" code="" empty plate={benched ? "Sub" : undefined} />
                </button>
              );
            }
            // The player fields at the save's progression; an enemy has no
            // level to show (the same rule `fightStats` applies).
            const saved = side === "player" ? progress[character.id] : undefined;
            const plate = benched ? "Sub" : saved ? `Lv ${saved.level}` : undefined;
            const label = benched
              ? `${character.name}, sub`
              : saved
                ? `${character.name}, level ${saved.level}`
                : character.name;
            return (
              <button
                key={`${character.id}-${index}`}
                type="button"
                onClick={openRoster}
                aria-label={label}
                className={unitTileWrapperClass}
              >
                <UnitTileFace
                  id={character.id}
                  name={character.name}
                  hue={elementHue(character.color)}
                  code={elementCode(character.color)}
                  plate={plate}
                  dimmed={benched}
                />
              </button>
            );
          })}
        </div>

        {issues.length > 0 ? (
          <Alert variant="info" className="mx-3 mb-3 w-auto">
            {issues.map((issue) => {
              const name =
                catalog.find((c) => c.id === issue.characterId)?.name ??
                issue.characterId;
              return `${name} isn't one of your characters.`;
            })}
            Those slots were left open — the preset itself is unchanged.
          </Alert>
        ) : null}
      </div>

      <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
        <DialogContent
          className="sm:max-w-2xl"
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <DialogHeader>
            <DialogTitle>
              {source === "catalog" ? "All characters" : "Your characters"}
            </DialogTitle>
            <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
              Tap to add or remove · {team.length}/{TEAM_CAP} picked
            </DialogDescription>
          </DialogHeader>
          {selectable.length === 0 ? (
            <EmptyState>No characters available yet.</EmptyState>
          ) : (
            <>
              <RosterToolbar
                filters={filters}
                sortFields={
                  side === "player"
                    ? ["level", "atk", "def", "hp"]
                    : ["atk", "def", "hp"]
                }
                surface="paper"
              />
              {filters.filtered.length === 0 ? (
                <EmptyState
                  action={
                    <Button variant="secondary" size="sm" onClick={filters.clearAll}>
                      Clear
                    </Button>
                  }
                >
                  No units match this query.
                </EmptyState>
              ) : (
                <div className="grid grid-cols-3 gap-x-3.5 gap-y-7 pt-5 sm:grid-cols-4">
                  {filters.filtered.map(({ character, atk, def, hp }) => {
                    const pickIndex = team.findIndex((c) => c.id === character.id);
                    const isPicked = pickIndex !== -1;
                    const disabled = !isPicked && team.length >= TEAM_CAP;
                    return (
                      <button
                        key={character.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={isPicked}
                        aria-label={`${character.name}, attack ${atk}, defense ${def}, health ${hp}`}
                        onClick={() => toggle(character)}
                        className={cn(
                          unitTileWrapperClass,
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <UnitTileFace
                          id={character.id}
                          name={character.name}
                          hue={elementHue(character.color)}
                          code={elementCode(character.color)}
                          picked={isPicked}
                          pickNumber={isPicked ? pickIndex + 1 : undefined}
                        />
                        {/* The name and statline sit under the tile, which carries
                            neither. The heading (#141) wraps rather than
                            truncating: two Dukes differed only by where their
                            subtitle was cut (audit 4.1). */}
                        <span className="mt-3.5 block text-center">
                          {character.heading ? (
                            <span className="line-clamp-2 block font-body text-micro font-bold uppercase tracking-label text-muted-foreground">
                              {character.heading}
                            </span>
                          ) : null}
                          <span className="block truncate font-heading text-sm tracking-title">
                            {character.name}
                          </span>
                          <span className="block font-body text-micro font-bold uppercase tracking-label tabular-nums text-muted-foreground">
                            {atk} / {def} / {hp}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team presets</DialogTitle>
            <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
              {presets.length} of {MAX_PRESETS} saved
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 border-b border-rule py-2 last:border-b-0"
              >
                <PresetFaces ids={preset.memberIds} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-base tracking-title">
                    {preset.name}
                  </span>
                  <span className="block font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                    {preset.memberIds.length} units · used {preset.useCount}×
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    nameFocus.remember(event.currentTarget);
                    setNaming({ kind: "rename", preset });
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteTeamPreset(preset.id)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* The browser's own prompt until 2026-09-26: unthemed, no 44px floor,
          and a system sheet on some phones (his pick: an in-game dialog). */}
      <PresetNameDialog
        open={naming !== null}
        onOpenChange={(open) => {
          if (!open) setNaming(null);
        }}
        title={naming?.kind === "rename" ? "Rename preset" : "Save preset"}
        description={
          naming?.kind === "rename"
            ? undefined
            : "Saves this team so you can load it in any battle."
        }
        initialName={
          naming?.kind === "rename"
            ? naming.preset.name
            : `Team ${presets.length + 1}`
        }
        submitLabel={naming?.kind === "rename" ? "Rename" : "Save"}
        onSubmit={submitName}
        onCloseAutoFocus={nameFocus.onCloseAutoFocus}
      />
    </>
  );
}

/** Converts a picked team into the `TeamPick[]` shape `startCustomBattle`
 *  expects. Order is preserved — the field/sub split reads off it. */
export function toTeamPicks(team: CharacterData[]): Array<{ id: string }> {
  return team.map((c) => ({ id: c.id }));
}
