"use client";

import React from "react";
import Image from "next/image";
import PresetNameDialog from "@/components/game/PresetNameDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { panelVariants } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/toggle";
import { useReturnFocus } from "@/hooks/useReturnFocus";
import { cn } from "@/lib/utils";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
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
        className={`flex items-center justify-center bg-muted font-heading text-2xl text-muted-foreground ${className}`}
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
            className="block size-[18px] overflow-hidden border border-border bg-muted"
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
   * The stats a unit will actually field, through the battle's own pipeline.
   * This printed the catalog statline, so a Lv30 unit read the same as a
   * fresh pull on the one screen used to choose between them (2026-09-26).
   */
  const fightStats = (character: CharacterData) => {
    const saved = side === "player" ? progress[character.id] : undefined;
    return battleStats(character, {
      progression: saved
        ? { level: saved.level, ascension: saved.ascension }
        : undefined,
      side,
    });
  };

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
          <span className="font-body text-caption font-bold uppercase tracking-label tabular-nums">
            {`${team.length} / ${TEAM_CAP}`}
            <span className="ml-2 text-muted-foreground">
              {fieldCap} on field
            </span>
          </span>
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
            {/* With nothing saved, the row was a bare label and a dashed `+`,
                which reads as a missing feature rather than an empty one
                (Tanveer, 2026-08-13). Say what a preset is for instead. */}
            {presets.length === 0 ? (
              <span className="font-body text-caption text-muted-foreground">
                Save a team here to load it in any battle.
              </span>
            ) : null}
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

        <div className="grid grid-cols-4 gap-2 p-3">
          {Array.from({ length: TEAM_CAP }).map((_, index) => {
            const character = team[index];
            const benched = index >= fieldCap;
            if (!character) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={openRoster}
                  className="flex h-24 flex-col items-center justify-center border-2 border-dashed border-muted-foreground text-3xl leading-none text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-card-foreground"
                >
                  +
                  {benched ? (
                    <span className="mt-1 font-body text-micro font-bold uppercase tracking-label">
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
                onClick={openRoster}
                className={`relative flex h-24 flex-col justify-end overflow-hidden border-2 bg-muted ${benched ? "border-rule" : "border-border"}`}
              >
                <Portrait
                  character={character}
                  className={`absolute inset-0 h-full w-full ${benched ? "opacity-70 grayscale" : ""}`}
                />
                {/* The bench is real now that three units take the field, so
                    the fourth slot says so rather than looking identical. */}
                {benched ? (
                  <span className="absolute left-0 top-0 z-10 bg-card-foreground/85 px-1.5 py-0.5 font-body text-micro font-bold uppercase tracking-label text-card">
                    Sub
                  </span>
                ) : null}
                {/* An ink strip lettered in paper: it sits on the portrait,
                    not on the panel. */}
                <span className="relative z-10 w-full bg-card-foreground/80 px-1 py-0.5 text-center font-heading text-xs tracking-title text-card">
                  {character.name}
                </span>
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
              return `${name} isn't on your roster. `;
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
              {source === "catalog" ? "All characters" : "Your roster"}
            </DialogTitle>
            <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
              Tap to add or remove · {team.length}/{TEAM_CAP} picked
            </DialogDescription>
          </DialogHeader>
          {selectable.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-muted-foreground">
              No characters available yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selectable.map((character) => {
                const pickIndex = team.findIndex((c) => c.id === character.id);
                const isPicked = pickIndex !== -1;
                const disabled = !isPicked && team.length >= TEAM_CAP;
                const stats = fightStats(character);
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isPicked}
                    onClick={() => toggle(character)}
                    // Picked is the action yellow, the same as every other
                    // "selected" in the game.
                    className={cn(
                      "relative flex h-32 flex-col justify-end overflow-hidden border-2 bg-muted text-left transition-colors",
                      isPicked
                        ? "border-border ink-slab-primary"
                        : disabled
                          ? "cursor-not-allowed border-rule opacity-40"
                          : "border-rule hover:border-border",
                    )}
                  >
                    <Portrait
                      character={character}
                      className="absolute inset-0 h-full w-full"
                    />
                    {isPicked ? (
                      <span className="absolute right-0 top-0 z-10 border-b-2 border-l-2 border-border bg-primary px-1.5 py-0.5 font-body text-label font-bold tabular-nums text-primary-foreground">
                        {pickIndex + 1}
                      </span>
                    ) : null}
                    <span className="relative z-10 w-full bg-card-foreground/85 px-1.5 py-1 text-card">
                      {/* Heading above the name (#141). The roster picker's
                          tile already carries a stat line, so this is a third
                          line on a small tile - flagged for his eye. */}
                      {character.heading ? (
                        <span className="block truncate font-body text-micro font-bold uppercase tracking-label opacity-70">
                          {character.heading}
                        </span>
                      ) : null}
                      <span className="block truncate font-heading text-sm tracking-title">
                        {character.name}
                      </span>
                      <span className="block font-body text-micro font-bold uppercase tracking-label tabular-nums opacity-80">
                        {stats.atk} / {stats.def} / {stats.hp}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
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
