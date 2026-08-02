import { describe, expect, it } from "vitest";
import { materialForCharacter } from "@/lib/gacha/materials";

describe("materialForCharacter", () => {
  it("maps a blue character to riverstone_fragment", () => {
    expect(materialForCharacter("duke")).toBe("riverstone_fragment"); // duke is blue
  });

  it("maps a red character to scorched_ember", () => {
    expect(materialForCharacter("lyra")).toBe("scorched_ember"); // lyra is red
  });

  it("maps a green character to bramble_thorn", () => {
    expect(materialForCharacter("yalina")).toBe("bramble_thorn"); // yalina is green
  });

  it("maps a light character to prism_dust", () => {
    expect(materialForCharacter("seras")).toBe("prism_dust"); // seras is light
  });

  it("maps a dark character to prism_dust", () => {
    expect(materialForCharacter("chiara")).toBe("prism_dust"); // chiara is dark
  });

  it("falls back to riverstone_fragment for an unknown character id", () => {
    expect(materialForCharacter("not-a-real-id")).toBe("riverstone_fragment");
  });
});
