import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getCharacterArt } from "@/lib/game/characterArt";

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
    expect(getCharacterArt("lyra_npc")).toContain("/npc/lyra_npc.png");
  });
});
