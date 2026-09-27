import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  artFolder,
  getCharacterArt,
  getSkillArt,
  registeredSkillArt,
} from "@/lib/game/characterArt";

/**
 * Art registration is a hand-maintained allowlist, so a new kit silently
 * renders with no art until someone remembers to add it. That is exactly how
 * `lyra_npc_2` shipped art-less into Part 2 Chapter 2 (Tanveer, 2026-08-10).
 * These tests make the omission fail here instead of in a playtest.
 */
describe("character art registration", () => {
  const dir = path.join(process.cwd(), "data", "characters");
  const ids = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).id);

  it("covers every kit in data/characters", () => {
    const unregistered = ids.filter((id) => getCharacterArt(id) === null);
    expect(unregistered).toEqual([]);
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

  it("names the folder after the kit's colour", () => {
    expect(artFolder("lyra")).toBe("red_lyra");
    expect(getCharacterArt("lyra")).toContain(
      "/characters/red_lyra/portrait.png",
    );
    expect(getSkillArt("lyra", "Latent Heat")).toContain(
      "/characters/red_lyra/skills/latent-heat.png",
    );
  });
});
