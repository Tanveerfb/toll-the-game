import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAllCharacters } from "@/lib/game/characterCatalog";

/**
 * `characterCatalog.ts` registers kits with a hand-written import line plus a
 * hand-written array entry, so adding a character takes three edits (the JSON,
 * the import, the array). Miss either code edit and the character simply does
 * not exist in the game — no build error, no type error, no runtime warning.
 * It just isn't there.
 *
 * `import.meta.glob` would remove the hand-maintenance, but Turbopack only
 * *compiles* it — at runtime it throws `.glob is not a function` and the
 * prerender fails (measured 2026-08-04). So the registration stays explicit
 * and this test guards it instead: cheap, no bundler feature, and it fails
 * loudly on the exact mistake.
 */
const KIT_DIR = path.join(process.cwd(), "data", "characters");

function kitFilesOnDisk(): string[] {
  return fs
    .readdirSync(KIT_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();
}

describe("character catalog registration", () => {
  it("registers every kit JSON that exists on disk", () => {
    const onDisk = kitFilesOnDisk();
    const registered = getAllCharacters()
      .map((character) => character.id)
      .sort();

    const missing = onDisk.filter((id) => !registered.includes(id));
    expect(
      missing,
      `kit JSON on disk but not registered in characterCatalog.ts — add the import AND the rawCharacters entry: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("registers nothing that has no kit JSON behind it", () => {
    const onDisk = kitFilesOnDisk();
    const stale = getAllCharacters()
      .map((character) => character.id)
      .filter((id) => !onDisk.includes(id))
      .sort();
    expect(stale, `registered id with no matching JSON file: ${stale.join(", ")}`).toEqual([]);
  });

  it("keeps each kit's `id` field equal to its filename", () => {
    // Everything addresses characters by `id` (art lookup, routes, team picks,
    // save data), while humans navigate by filename. A mismatch resolves at
    // runtime but makes every lookup a guess.
    const mismatched: string[] = [];
    for (const file of kitFilesOnDisk()) {
      const raw = JSON.parse(
        fs.readFileSync(path.join(KIT_DIR, `${file}.json`), "utf8"),
      ) as { id?: string };
      if (raw.id !== file) mismatched.push(`${file}.json declares id "${raw.id}"`);
    }
    expect(mismatched).toEqual([]);
  });
});
