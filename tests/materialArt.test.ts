import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { getCoinFrameArt, getMaterialArt } from "@/lib/game/materialArt";
import {
  MATERIAL_IDS,
  characterCoinId,
  isCharacterCoin,
} from "@/lib/game/materials";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

/**
 * `lib/game/materialArt.ts` shipped with nineteen icons on 2026-08-20 and no
 * callers at all — the art was on disk, the registry resolved it, and every
 * inventory surface still rendered a text label. The wiring landed 2026-08-21.
 *
 * Two failure modes these guard, both silent on screen:
 *
 *  - a registered id pointing at a file that isn't there (a broken image, and
 *    `next/image` will not fall back to the label for you);
 *  - a registered id that is not a material at all — a typo resolves to a URL
 *    the same as a real id does, so nothing complains until a player sees a
 *    blank square where a Riverstone Fragment should be.
 */

const publicFile = (url: string) =>
  path.join(process.cwd(), "public", url.split("?")[0]);

describe("material art registration", () => {
  const registered = MATERIAL_IDS.filter((id) => getMaterialArt(id) !== null);
  // Currencies aren't inventory materials — they live on `currencies`, not in
  // `inventory` — so they never appear in MATERIAL_IDS and are listed here.
  const currencies = ["gems", "coin", "permanent_ticket", "auto_clear_ticket", "stamina"];

  it("points every registered material at a file that exists", () => {
    const broken = [...registered, ...currencies]
      .map((id) => [id, getMaterialArt(id)] as const)
      .filter(([, url]) => url !== null)
      .filter(([, url]) => !fs.existsSync(publicFile(url as string)))
      .map(([id]) => id);
    expect(broken).toEqual([]);
  });

  it("has an icon for every currency the HUD counts", () => {
    const missing = currencies.filter((id) => getMaterialArt(id) === null);
    expect(missing).toEqual([]);
  });

  it("returns null for an unknown id rather than a broken URL", () => {
    // The whole fallback design rests on this: a caller renders its text label
    // when the registry says no, so an unregistered material has to say no.
    expect(getMaterialArt("not_a_material")).toBeNull();
  });

  it("never claims art for a character coin", () => {
    // There is one coin per playable character and no per-coin icon will ever
    // exist — they are drawn from a colour frame plus the character portrait.
    const claimed = getPlayableCharacters()
      .map((character) => characterCoinId(character))
      .filter((id) => getMaterialArt(id) !== null);
    expect(claimed).toEqual([]);
  });
});

describe("coin frames", () => {
  it("covers every colour a playable character can be", () => {
    const uncovered = [
      ...new Set(getPlayableCharacters().map((c) => c.color)),
    ].filter((color) => getCoinFrameArt(color) === null);
    expect(uncovered).toEqual([]);
  });

  it("points every frame at a file that exists", () => {
    const broken = ["blue", "red", "green", "light", "dark"]
      .map((color) => [color, getCoinFrameArt(color)] as const)
      .filter(([, url]) => url === null || !fs.existsSync(publicFile(url)))
      .map(([color]) => color);
    expect(broken).toEqual([]);
  });

  it("gives every coin id a frame, via its colour prefix", () => {
    // `ItemIcon` splits the frame colour off the id (`{color}_{id}_coin`). If a
    // coin id ever stops leading with its colour, the coin renders frameless.
    const frameless = getPlayableCharacters()
      .map((character) => characterCoinId(character))
      .filter((id) => !isCharacterCoin(id) || getCoinFrameArt(id.split("_")[0]) === null);
    expect(frameless).toEqual([]);
  });
});
