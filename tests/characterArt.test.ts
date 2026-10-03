import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  artFolder,
  getCharacterArt,
  getSkillArt,
  getTileArt,
  registeredSkillArt,
  registeredTileArt,
  skillArtAliases,
} from "@/lib/game/characterArt";
import { characterCoinId, characterIdFromCoin } from "@/lib/game/materials";

/**
 * Art registration is a hand-maintained allowlist, so a new kit silently
 * renders with no art until someone remembers to add it. That is exactly how
 * `lyra_npc_2` shipped art-less into Part 2 Chapter 2 (Tanveer, 2026-08-10).
 * These tests make the omission fail here instead of in a playtest.
 */
describe("character art registration", () => {
  const dir = path.join(process.cwd(), "data", "characters");
  const kits = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as {
          id: string;
          unreleased?: boolean;
        },
    );
  const ids = kits.map((k) => k.id);

  /**
   * An `unreleased` kit is exempt: missing art is the reason it is not live
   * (Tanveer, 2026-10-02), and releasing it means adding the art AND removing
   * the flag. Every live kit still has to have art.
   */
  it("covers every released kit in data/characters", () => {
    const unregistered = kits
      .filter((k) => k.unreleased !== true)
      .map((k) => k.id)
      .filter((id) => getCharacterArt(id) === null);
    expect(unregistered).toEqual([]);
  });

  it("points every borrowed skill art at art that exists", () => {
    const broken = Object.entries(skillArtAliases)
      .filter(([, target]) => !registeredSkillArt.includes(target))
      .map(([key]) => key);
    expect(broken).toEqual([]);
    expect(getSkillArt("blue_lyra", "Latent Heat")).toContain(
      "/characters/red_lyra/skills/latent-heat.png",
    );
  });

  it("points every kit at a file that exists on disk", () => {
    const broken = ids
      .map((id) => [id, getCharacterArt(id)] as const)
      .filter(([, url]) => url !== null)
      .map(([id, url]) => {
        const rel = (url as string).split("?")[0];
        return [id, path.join(process.cwd(), "public", rel)] as const;
      })
      .filter(([, file]) => !fs.existsSync(file))
      .map(([id]) => id);
    expect(broken).toEqual([]);
  });

  it("resolves the Part 2 boss, who now fights both chapters", () => {
    // 2-2 used to run a duplicate kit (`lyra_npc_2`) that was never registered
    // for art, so the boss rendered blank. The duplicate is gone — both
    // chapters use `lyra_npc`, and 2-2's extra 5% comes from a stage effect.
    expect(getCharacterArt("lyra_npc")).toContain(
      "/npc/red_lyra_npc/portrait.png",
    );
  });
});

/**
 * Art lives in one folder per unit, `<color>_<id>` (his call, 2026-09-27), and
 * the colour is read from the kit. 91 files moved in that change; these pin
 * that every registered skill image made it, and that the folder name follows
 * the kit rather than a hand-kept list.
 */
describe("per-unit art folders", () => {
  it("points every registered skill art at a file that exists on disk", () => {
    const broken = registeredSkillArt.filter((key) => {
      const [id, slug] = key.split("__");
      const url = getSkillArt(id, slug);
      if (url === null) return true;
      return !fs.existsSync(
        path.join(process.cwd(), "public", url.split("?")[0]),
      );
    });
    expect(broken).toEqual([]);
  });

  it("points every frame-break tile cut-out at a file that exists on disk", () => {
    const broken = registeredTileArt.filter((id) => {
      const tile = getTileArt(id);
      return tile === null || !fs.existsSync(path.join(process.cwd(), "public", tile.src.split("?")[0]));
    });
    expect(registeredTileArt.length).toBeGreaterThan(0);
    expect(broken).toEqual([]);
  });

  // His call, 2026-10-03: a unit's tile and its portrait are the same image.
  // A unit with tile art therefore has a portrait re-cut from the tile's
  // transparent cut-out, and the background behind it comes from the screen
  // (the detail page's element burst, the battle's ground). An opaque portrait
  // here would paint a box over both. PNG colour type is byte 25 of the file:
  // 6 is RGBA, 2 is opaque RGB.
  it("cuts the portrait of every unit with tile art as a transparent RGBA PNG", () => {
    const opaque = registeredTileArt.filter((id) => {
      const url = getCharacterArt(id);
      if (url === null) return true;
      const file = fs.readFileSync(path.join(process.cwd(), "public", url.split("?")[0]));
      return file[25] !== 6;
    });
    expect(opaque).toEqual([]);
  });

  it("names the folder after the kit's colour", () => {
    expect(artFolder("lyra")).toBe("red_lyra");
    expect(getCharacterArt("lyra")).toContain(
      "/characters/red_lyra/portrait.png",
    );
    expect(getSkillArt("lyra", "Latent Heat")).toContain(
      "/characters/red_lyra/skills/latent-heat.png",
    );
  });

  // Tanveer, 2026-10-02: an id that already starts with its colour is not
  // doubled. Pinned on both a variant and a coin, since one function names
  // both (lib/game/unitKey.ts).
  it("does not double a colour the id already carries", () => {
    expect(artFolder("blue_lyra")).toBe("blue_lyra");
    expect(artFolder("green_duke")).toBe("green_duke");
    expect(artFolder("caila")).toBe("red_caila");
    expect(characterCoinId({ id: "blue_lyra", color: "blue" })).toBe(
      "blue_lyra_coin",
    );
    expect(characterIdFromCoin("blue_lyra_coin")).toBe("blue_lyra");
    expect(characterIdFromCoin("red_lyra_coin")).toBe("lyra");
  });
});
