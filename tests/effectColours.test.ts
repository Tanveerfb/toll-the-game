import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { categorizeEffects } from "@/components/game/battle/EffectsList";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Ruling #133 (Tanveer, 2026-09-16): what an effect IS reads as a colour, and
 * the colour is the cancel rule made visible.
 *
 *   buff    blue    free-standing raise   → `cancelBuffs` takes it
 *   stance  yellow  a stance and its parts → `cancelStances` takes it
 *   debuff  red     hostile
 *   effect  grey    uncancellable — *"they are not affected by any cancel
 *                   buffs or any cleanses … they are just effects"*
 *
 * A stance rendered blue beside ordinary buffs until this, which is exactly
 * the distinction #132 had spent an engine change drawing.
 */

function unit(buffs: StatusEffect[], debuffs: StatusEffect[] = []) {
  return { buffs, debuffs } as BattleCharacter;
}

const categoriesOf = (u: BattleCharacter) =>
  categorizeEffects(u).map((r) => r.category);

describe("#133 — what lands in which class", () => {
  it("a plain buff is a buff", () => {
    expect(
      categoriesOf(unit([{ type: "buff", stat: "atk" } as StatusEffect])),
    ).toEqual(["buff"]);
  });

  it("a stance entry is a stance", () => {
    expect(
      categoriesOf(unit([{ type: "stance", stat: "def" } as StatusEffect])),
    ).toEqual(["stance"]);
  });

  it("a taunt is a stance — it is part of one (#131)", () => {
    expect(categoriesOf(unit([{ type: "taunt" } as StatusEffect]))).toEqual([
      "stance",
    ]);
  });

  it("a buff-typed entry inside a stance group is a stance", () => {
    // Same predicate the cancel step uses (#132). If these two ever disagreed,
    // the panel would colour something blue that `cancelBuffs` cannot remove.
    expect(
      categoriesOf(
        unit([
          { type: "buff", stat: "def", groupId: "g1" } as StatusEffect,
        ]),
      ),
    ).toEqual(["stance"]);
  });

  it("uncancellable wins over everything — it is a grey effect (#30)", () => {
    expect(
      categoriesOf(
        unit([
          { type: "stance", stat: "def", uncancellable: true } as StatusEffect,
        ]),
      ),
    ).toEqual(["effect"]);
  });

  it("orders buffs, stances, debuffs, then grey", () => {
    expect(
      categoriesOf(
        unit(
          [
            { type: "stance", stat: "def" } as StatusEffect,
            { type: "buff", stat: "atk" } as StatusEffect,
            { type: "buff", uncancellable: true } as StatusEffect,
          ],
          [{ type: "debuff", stat: "def" } as StatusEffect],
        ),
      ),
    ).toEqual(["buff", "stance", "debuff", "effect"]);
  });
});

describe("#133 — the colours themselves", () => {
  /**
   * A source-level contract. The classes are Tailwind strings inside a
   * component, so nothing else can assert them, and a silent hue change is
   * exactly the kind of drift that makes the colour stop meaning anything.
   */
  const source = readFileSync(
    path.resolve(__dirname, "../components/game/battle/EffectsList.tsx"),
    "utf8",
  );

  const styleBlock = source.slice(
    source.indexOf("const CATEGORY_STYLE"),
    source.indexOf("interface CategorizedEffect"),
  );

  it("has a block to read", () => {
    // Without this the greps below pass by matching nothing.
    expect(styleBlock.length).toBeGreaterThan(200);
  });

  it.each([
    ["buff", "el-blue"],
    ["stance", "el-light"],
    ["debuff", "role-attack"],
    ["effect", "readout-muted"],
  ])("%s is %s", (category, token) => {
    const entry = styleBlock.slice(
      styleBlock.indexOf(`${category}: {`),
      styleBlock.indexOf("}", styleBlock.indexOf(`${category}: {`)),
    );
    expect(entry).toContain(token);
  });

  it("no two classes share a hue", () => {
    const hues = ["el-blue", "el-light", "role-attack", "readout-muted"];
    expect(new Set(hues).size).toBe(hues.length);
  });
});
