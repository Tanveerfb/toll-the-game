import { TEAM_CAP } from "@/lib/game/format";

/**
 * Saved team loadouts, shared by every mode.
 *
 * One global list rather than per-mode lists (Tanveer, 2026-08-11) — at this
 * roster size, separate story/practice/world-boss lists would mostly hold the
 * same three teams under three names.
 *
 * A preset is an ordered list of ids, so it rots: a member can get anchored by
 * a story chapter, or leave the roster entirely. Resolving one therefore
 * *reports* what it couldn't place instead of silently dropping units or
 * refusing to load, and never edits the stored preset behind the player's
 * back — updating it is a deliberate action.
 *
 * Order matters. With 3-on-field the fourth slot is the bench, so a preset
 * that reordered itself on load would quietly change who starts benched.
 */

/** Beyond this the chip row stops being scannable, which was the point of it. */
export const MAX_PRESETS = 8;

export interface TeamPreset {
  id: string;
  name: string;
  /** Ordered character ids. May contain ids the player no longer owns. */
  memberIds: string[];
  createdAt: number;
  /** Bumped on load — after a month, "which of these five do I actually use". */
  useCount: number;
}

export type PresetIssueReason = "anchored" | "unowned";

export interface PresetIssue {
  characterId: string;
  reason: PresetIssueReason;
}

export interface ResolvedPreset {
  /** Ids that can actually be placed, in preset order, capped to open slots. */
  memberIds: string[];
  /** Everything that couldn't be placed, and why — surfaced, never hidden. */
  issues: PresetIssue[];
}

/**
 * Works out what a preset can contribute to the current picker.
 *
 * `anchoredIds` are units the mode has already fixed in place — a preset
 * naming one is not an error, the unit is simply already present and can't
 * occupy two slots. `ownedIds` gates the rest; pass `null` when the picker
 * runs off the full catalog (the practice bench), where ownership is
 * irrelevant.
 */
export function resolvePreset(
  preset: Pick<TeamPreset, "memberIds">,
  {
    anchoredIds = [],
    ownedIds,
    openSlots,
  }: {
    anchoredIds?: string[];
    ownedIds: string[] | null;
    openSlots: number;
  },
): ResolvedPreset {
  const anchored = new Set(anchoredIds);
  const owned = ownedIds === null ? null : new Set(ownedIds);
  const memberIds: string[] = [];
  const issues: PresetIssue[] = [];
  const seen = new Set<string>();

  for (const id of preset.memberIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (anchored.has(id)) {
      issues.push({ characterId: id, reason: "anchored" });
      continue;
    }
    if (owned !== null && !owned.has(id)) {
      issues.push({ characterId: id, reason: "unowned" });
      continue;
    }
    // Silently stopping at the cap is right: a 4-unit preset loaded into a
    // chapter with one anchor genuinely has one member too many, and that
    // isn't a problem worth a warning.
    if (memberIds.length >= Math.max(0, openSlots)) continue;
    memberIds.push(id);
  }

  return { memberIds, issues };
}

/** A preset built from what's currently picked. Anchors are excluded — they
 *  belong to the chapter, not to the player's loadout. */
export function presetFromTeam(
  name: string,
  memberIds: string[],
  now: number = Date.now(),
): TeamPreset {
  return {
    id: `preset_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Team",
    memberIds: memberIds.slice(0, TEAM_CAP),
    createdAt: now,
    useCount: 0,
  };
}

/** Adds a preset, refusing past the cap rather than evicting one the player
 *  might still want. Returns null when full. */
export function addPreset(
  presets: TeamPreset[],
  preset: TeamPreset,
): TeamPreset[] | null {
  if (presets.length >= MAX_PRESETS) return null;
  return [...presets, preset];
}

export function renamePreset(
  presets: TeamPreset[],
  id: string,
  name: string,
): TeamPreset[] {
  const trimmed = name.trim();
  if (trimmed.length === 0) return presets;
  return presets.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
}

export function deletePreset(presets: TeamPreset[], id: string): TeamPreset[] {
  return presets.filter((p) => p.id !== id);
}

export function notePresetUsed(
  presets: TeamPreset[],
  id: string,
): TeamPreset[] {
  return presets.map((p) =>
    p.id === id ? { ...p, useCount: p.useCount + 1 } : p,
  );
}

/**
 * The team to open a picker with: whatever the player last took into battle,
 * filtered to what's currently placeable.
 *
 * This is the actual fix for "tired of picking chars manually each time" —
 * presets are for switching between loadouts, this is for not re-picking the
 * same one. The brief reset its selection to empty on every visit.
 */
export function resolveLastTeam(
  lastTeam: string[],
  options: {
    anchoredIds?: string[];
    ownedIds: string[] | null;
    openSlots: number;
  },
): string[] {
  return resolvePreset({ memberIds: lastTeam }, options).memberIds;
}
