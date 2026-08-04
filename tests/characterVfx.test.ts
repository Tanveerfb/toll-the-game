import { describe, expect, it } from "vitest";
import {
  getVfxAccent,
  getVfxShape,
  getVfxTint,
  vfxShapeStyle,
} from "@/lib/game/characterVfx";
import { FLASH_TINTS } from "@/lib/game/elementSwatch";
import { getAllCharacters } from "@/lib/game/characterCatalog";

/** "rgba(45,212,191,0.8)" -> [45, 212, 191] */
function rgb(css: string): [number, number, number] {
  const nums = css.match(/[\d.]+/g);
  if (!nums || nums.length < 3) throw new Error(`unparsable color: ${css}`);
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}

function channelDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

describe("character VFX registry", () => {
  const characters = getAllCharacters();

  it("covers every character in the catalog", () => {
    // A missing entry isn't an error — it falls back to the plain element ring
    // — but the roster-wide pass (2026-08-04) was meant to leave none behind.
    const missing = characters.filter(
      (c) => getVfxShape(c.id) === "ring" && getVfxTint(c.id, "") === "",
    );
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it("gives every character a tint visibly away from their own element tint", () => {
    // The whole point of a flavor is to differ from the default team-color
    // ring; a tint landing on the same hue renders as no flavor at all.
    const tooClose = characters
      .map((c) => ({
        id: c.id,
        distance: channelDistance(
          getVfxTint(c.id, FLASH_TINTS[c.color]),
          FLASH_TINTS[c.color],
        ),
      }))
      .filter((entry) => entry.distance < 60);
    expect(tooClose).toEqual([]);
  });

  it("falls back to the element tint for an unknown character", () => {
    expect(getVfxTint("no_such_character", FLASH_TINTS.red)).toBe(
      FLASH_TINTS.red,
    );
    expect(getVfxTint(undefined, FLASH_TINTS.red)).toBe(FLASH_TINTS.red);
    expect(getVfxShape(undefined)).toBe("ring");
  });

  it("returns a renderable style for every shape in use", () => {
    for (const character of characters) {
      const style = vfxShapeStyle(getVfxShape(character.id));
      // Either a radius or a clip-path — otherwise the burst is a bare square.
      expect(
        style.borderRadius !== undefined || style.clipPath !== undefined,
      ).toBe(true);
    }
  });

  it("maps each shape to a known accent", () => {
    const accents = new Set(
      characters.map((c) => getVfxAccent(getVfxShape(c.id))),
    );
    for (const accent of accents) {
      expect([
        "none",
        "second-ring",
        "inner-pop",
        "core",
        "wave",
      ]).toContain(accent);
    }
  });
});
