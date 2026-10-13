import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { characterSchema } from "@/lib/game/characterSchema";
import { getAllCharacters } from "@/lib/game/characterCatalog";
import { buildKitJsonSchema } from "@/lib/game/kitJsonSchema";
import {
  materialiseKit,
  nextFreeCardNumber,
  stripTemplateKeys,
} from "@/lib/game/kitTemplate";

/**
 * The kit schema and template (his ask, 2026-10-13): a new kit starts from
 * data/kit.template.json, and data/kit.schema.json is the zod schema written
 * out for editors. Both are only useful while they agree with the schema the
 * catalog actually validates against, which is what these pin.
 */
const TEMPLATE_PATH = "data/kit.template.json";
const SCHEMA_PATH = "data/kit.schema.json";

const template = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8")) as Record<string, unknown>;

describe("data/kit.schema.json", () => {
  it("is exactly what the zod schema generates (run `npm run kit:schema` after a schema change)", () => {
    const onDisk = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildKitJsonSchema())));
  });

  it("describes the fields a kit author has to get right", () => {
    const properties = (buildKitJsonSchema().properties ?? {}) as Record<string, { description?: string }>;
    for (const field of ["id", "cardNumber", "color", "hp", "skills", "ultimate", "passive"]) {
      expect(properties[field]?.description, field).toBeTruthy();
    }
  });
});

describe("data/kit.template.json", () => {
  it("validates once its commentary is stripped", () => {
    const result = characterSchema.safeParse(stripTemplateKeys(template));
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("is a placeholder: its id and number collide with no shipped kit", () => {
    const ids = new Set(getAllCharacters().map((c) => c.id));
    const numbers = new Set(getAllCharacters().map((c) => c.cardNumber));
    expect(ids.has(String(template.id))).toBe(false);
    expect(numbers.has(Number(template.cardNumber))).toBe(false);
  });

  it("materialises into a kit the catalog would accept, stamped and unreleased", () => {
    const kit = materialiseKit(template, {
      id: "zed",
      name: "Zed",
      color: "red",
      heading: "The Example",
      cardNumber: 100099,
    });
    expect(characterSchema.safeParse(kit).success).toBe(true);
    expect(kit.id).toBe("zed");
    expect(kit.unreleased).toBe(true);
    expect(kit.heading).toBe("The Example");
    const skills = kit.skills as { characterId: string }[];
    expect(skills.map((s) => s.characterId)).toEqual(["zed", "zed"]);
    expect((kit.ultimate as { characterId: string }).characterId).toBe("zed");
    expect(JSON.stringify(kit)).not.toContain("$comment");
    expect(JSON.stringify(kit)).not.toContain("$schema");
  });

  it("drops the heading when none is given", () => {
    const kit = materialiseKit(template, { id: "zed", name: "Zed", color: "red", cardNumber: 100099 });
    expect("heading" in kit).toBe(false);
  });
});

describe("nextFreeCardNumber", () => {
  it("is one past the highest real number, never a reused gap, never a placeholder", () => {
    expect(nextFreeCardNumber([100001, 100007, 100030])).toBe(100031);
    // A deleted kit's number stays retired (ruling #187): the gap is not refilled.
    expect(nextFreeCardNumber([100001, 100003])).toBe(100004);
    expect(nextFreeCardNumber([100001, 999901])).toBe(100002);
    expect(nextFreeCardNumber([])).toBe(100001);
  });

  it("the shipped catalog's next number is above every card in it", () => {
    const next = nextFreeCardNumber(getAllCharacters().map((c) => c.cardNumber));
    for (const c of getAllCharacters()) expect(next).toBeGreaterThan(c.cardNumber);
  });
});
