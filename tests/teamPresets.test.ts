import { describe, expect, it } from "vitest";
import {
  addPreset,
  deletePreset,
  MAX_PRESETS,
  notePresetUsed,
  presetFromTeam,
  renamePreset,
  resolveLastTeam,
  resolvePreset,
} from "@/lib/game/teamPresets";

const preset = (memberIds: string[]) => ({ memberIds });

describe("resolvePreset", () => {
  it("places every member when nothing is in the way", () => {
    const result = resolvePreset(preset(["duke", "sara", "isolde"]), {
      ownedIds: ["duke", "sara", "isolde"],
      openSlots: 4,
    });
    expect(result.memberIds).toEqual(["duke", "sara", "isolde"]);
    expect(result.issues).toEqual([]);
  });

  it("preserves preset order, because the last slot is the bench", () => {
    const result = resolvePreset(preset(["c", "a", "b"]), {
      ownedIds: ["a", "b", "c"],
      openSlots: 4,
    });
    expect(result.memberIds).toEqual(["c", "a", "b"]);
  });

  it("reports an anchored member instead of duplicating them", () => {
    const result = resolvePreset(preset(["duke", "sara"]), {
      anchoredIds: ["duke"],
      ownedIds: ["duke", "sara"],
      openSlots: 3,
    });
    expect(result.memberIds).toEqual(["sara"]);
    expect(result.issues).toEqual([
      { characterId: "duke", reason: "anchored" },
    ]);
  });

  it("reports a member who has left the roster", () => {
    const result = resolvePreset(preset(["duke", "seras"]), {
      ownedIds: ["duke"],
      openSlots: 4,
    });
    expect(result.memberIds).toEqual(["duke"]);
    expect(result.issues).toEqual([
      { characterId: "seras", reason: "unowned" },
    ]);
  });

  it("ignores ownership entirely on the practice bench", () => {
    // `ownedIds: null` is the full-catalog picker — testing a kit you haven't
    // pulled is the whole point of that screen.
    const result = resolvePreset(preset(["duke", "molvarr"]), {
      ownedIds: null,
      openSlots: 4,
    });
    expect(result.memberIds).toEqual(["duke", "molvarr"]);
    expect(result.issues).toEqual([]);
  });

  it("stops at the open-slot count without calling it a problem", () => {
    // A 4-unit preset loaded into a chapter with one anchor genuinely has one
    // member too many. That isn't worth a warning.
    const result = resolvePreset(preset(["a", "b", "c", "d"]), {
      anchoredIds: ["lead"],
      ownedIds: ["a", "b", "c", "d"],
      openSlots: 3,
    });
    expect(result.memberIds).toEqual(["a", "b", "c"]);
    expect(result.issues).toEqual([]);
  });

  it("de-duplicates a preset that somehow lists a unit twice", () => {
    const result = resolvePreset(preset(["a", "a", "b"]), {
      ownedIds: ["a", "b"],
      openSlots: 4,
    });
    expect(result.memberIds).toEqual(["a", "b"]);
  });

  it("places nothing when there are no open slots", () => {
    const result = resolvePreset(preset(["a", "b"]), {
      ownedIds: ["a", "b"],
      openSlots: 0,
    });
    expect(result.memberIds).toEqual([]);
  });

  it("never mutates the stored preset", () => {
    const stored = preset(["duke", "seras"]);
    const before = [...stored.memberIds];
    resolvePreset(stored, { ownedIds: ["duke"], openSlots: 4 });
    expect(stored.memberIds).toEqual(before);
  });
});

describe("resolveLastTeam", () => {
  it("drops members the current context can't place", () => {
    expect(
      resolveLastTeam(["duke", "sara", "seras"], {
        anchoredIds: ["duke"],
        ownedIds: ["duke", "sara"],
        openSlots: 3,
      }),
    ).toEqual(["sara"]);
  });

  it("returns nothing for an empty history rather than throwing", () => {
    expect(resolveLastTeam([], { ownedIds: [], openSlots: 4 })).toEqual([]);
  });
});

describe("preset CRUD", () => {
  it("caps the member list at a full team", () => {
    const made = presetFromTeam("Main", ["a", "b", "c", "d", "e"], 1000);
    expect(made.memberIds).toHaveLength(4);
  });

  it("falls back to a usable name rather than saving a blank one", () => {
    expect(presetFromTeam("   ", ["a"], 1000).name).toBe("Team");
  });

  it("refuses to add past the cap instead of evicting something", () => {
    const full = Array.from({ length: MAX_PRESETS }, (_, i) =>
      presetFromTeam(`p${i}`, ["a"], 1000 + i),
    );
    expect(addPreset(full, presetFromTeam("one more", ["b"], 2000))).toBeNull();
    expect(addPreset(full.slice(1), presetFromTeam("fits", ["b"], 2000))).
      toHaveLength(MAX_PRESETS);
  });

  it("renames, but refuses to blank a name", () => {
    const list = [presetFromTeam("Main", ["a"], 1000)];
    expect(renamePreset(list, list[0].id, "Collab")[0].name).toBe("Collab");
    expect(renamePreset(list, list[0].id, "  ")[0].name).toBe("Main");
  });

  it("deletes by id and leaves the rest alone", () => {
    const a = presetFromTeam("A", ["a"], 1000);
    const b = presetFromTeam("B", ["b"], 1001);
    expect(deletePreset([a, b], a.id)).toEqual([b]);
  });

  it("counts uses so a stale preset is identifiable later", () => {
    const a = presetFromTeam("A", ["a"], 1000);
    expect(notePresetUsed([a], a.id)[0].useCount).toBe(1);
    expect(notePresetUsed(notePresetUsed([a], a.id), a.id)[0].useCount).toBe(2);
  });
});
