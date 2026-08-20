import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  passiveBlocks,
  blocksFor,
  findPassiveMechanic,
  findAnyPassiveMechanic,
  hasPassiveTrigger,
  passiveMechanics,
  activePassiveMechanics,
  rawPassiveMechanics,
  rawPassiveTrigger,
} from "@/lib/game/passiveBlocks";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { Passive } from "@/types/passive";

/**
 * One passive, made of blocks — spec Plans/2026-08-20-passive-structure.md.
 * Tanveer, 2026-08-20: *"Keep it the dokkan way. it basically is a single but
 * possibly long passive."*
 */
const SHORTHAND: Passive = {
  name: "Old Shape",
  trigger: "onAttackReceived",
  mechanics: [{ type: "chargedStacks", maxStacks: 5 }],
};

const TWO_BLOCKS: Passive = {
  name: "Super Saiyan for Starters",
  worksFromSub: true,
  blocks: [
    {
      heading: "Basic effects",
      trigger: "aura",
      mechanics: [{ type: "aura", stats: ["atk", "def"], valuePercent: 10 }],
    },
    {
      heading: "When attacking a [Demon] enemy",
      trigger: "always",
      mechanics: [
        { type: "targetTagBonus", conditionTags: ["Demon"], valuePercent: 30 },
      ],
    },
  ],
};

function unit(passive: Passive, overrides: Partial<BattleCharacter> = {}) {
  return {
    id: "u",
    name: "u",
    instanceId: "u",
    passive,
    passiveState: {},
    buffs: [],
    debuffs: [],
    ...overrides,
  } as unknown as BattleCharacter;
}

describe("passiveBlocks", () => {
  it("reads the single-block shorthand as one block", () => {
    expect(passiveBlocks(SHORTHAND)).toEqual([
      {
        trigger: "onAttackReceived",
        mechanics: [{ type: "chargedStacks", maxStacks: 5 }],
      },
    ]);
  });

  it("treats a trigger-less passive carrying mechanics as unconditional", () => {
    // Boss phase passives author no trigger; `activeBossMechanics` never read
    // one, so they must not vanish.
    const blocks = passiveBlocks({
      name: "Corrosive Tide",
      mechanics: [{ type: "bossApplyCorrosion", perTurn: 1 }],
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].trigger).toBe("always");
  });

  it("keeps each block's mechanics separate by trigger", () => {
    const u = unit(TWO_BLOCKS);
    expect(blocksFor(u, "aura")).toHaveLength(1);
    expect(hasPassiveTrigger(u, "always")).toBe(true);
    expect(hasPassiveTrigger(u, "onLethalDamage")).toBe(false);
    expect(findPassiveMechanic(u, "always", "targetTagBonus")).toBeDefined();
    // The whole point: a mechanic in block 2 is NOT reachable through block 1.
    expect(findPassiveMechanic(u, "aura", "targetTagBonus")).toBeUndefined();
  });

  it("flattens every block when no trigger is named", () => {
    expect(passiveMechanics(unit(TWO_BLOCKS)).map((m) => m.type)).toEqual([
      "aura",
      "targetTagBonus",
    ]);
    expect(findAnyPassiveMechanic(unit(TWO_BLOCKS), "targetTagBonus")).toBeDefined();
  });

  it("applies the bench rule per passive, not per block", () => {
    const benched = unit(TWO_BLOCKS, { isSub: true });
    // worksFromSub: true — every block inherits it (Tanveer: "stays per passive").
    expect(activePassiveMechanics(benched, "aura")).toHaveLength(1);

    const denied = unit({ ...TWO_BLOCKS, worksFromSub: false }, { isSub: true });
    expect(activePassiveMechanics(denied, "aura")).toHaveLength(0);
  });

  it("registers one queue entry per block, and keeps the id of a lone block", () => {
    const multi: Array<{ id: string }> = [];
    registerCharacterPassives(
      unit({
        name: "Two Phases",
        blocks: [
          {
            trigger: "aura",
            mechanics: [{ type: "aura", stat: "atk", valuePercent: 10 }],
          },
          {
            trigger: "OnPlayerTurnStart",
            mechanics: [{ type: "aura", stat: "def", valuePercent: 10 }],
          },
        ],
      }) as BattleCharacter,
      (item) => multi.push(item as { id: string }),
    );
    // Both blocks reach the queue, at their own phases. A single-trigger
    // passive registered once and dropped everything after the first block.
    expect(multi.filter((i) => i.id.includes("Two Phases"))).toHaveLength(2);

    // An "always" block is read inline by the damage engine, not queued —
    // TWO_BLOCKS registers only its aura half.
    const inline: Array<{ id: string }> = [];
    registerCharacterPassives(unit(TWO_BLOCKS) as BattleCharacter, (item) =>
      inline.push(item as { id: string }),
    );
    expect(inline.filter((i) => i.id.includes("Super Saiyan"))).toHaveLength(1);

    const single: Array<{ id: string }> = [];
    registerCharacterPassives(
      unit({
        name: "Aura Only",
        trigger: "aura",
        mechanics: [{ type: "aura", stat: "atk", valuePercent: 10 }],
      }) as BattleCharacter,
      (item) => single.push(item as { id: string }),
    );
    expect(single[0].id).toBe("u_passive_Aura Only");
  });

  it("flattens raw kit JSON too, for the catalog and archive readers", () => {
    const raw = {
      name: "Blocked",
      blocks: [
        { trigger: "aura", mechanics: [{ type: "aura" }] },
        { trigger: "always", mechanics: [{ type: "guard" }] },
      ],
    };
    expect(rawPassiveMechanics(raw).map((m) => m.type)).toEqual([
      "aura",
      "guard",
    ]);
    expect(rawPassiveTrigger(raw)).toBe("aura");
    expect(rawPassiveTrigger({ trigger: "afterSkill" })).toBe("afterSkill");
  });
});

describe("no engine file reads a passive's mechanics directly", () => {
  // A site keeping the old `char.passive?.trigger` / `.mechanics` pair sees
  // only the FIRST block and drops the rest without erroring — the same
  // silent-miss shape as the `stats`-array family in ruling #55. This scan is
  // the only thing that catches it, since both forms still typecheck.
  const ROOTS = ["lib", "hooks", "components", "app", "store"];
  const ALLOWED = [path.join("lib", "game", "passiveBlocks.ts")];

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it("uses the passiveBlocks helpers everywhere else", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      if (!fs.existsSync(root)) continue;
      for (const file of walk(root)) {
        if (ALLOWED.some((a) => file.endsWith(a))) continue;
        const source = fs.readFileSync(file, "utf8");
        source.split("\n").forEach((line, i) => {
          if (/\bpassive\??\.(mechanics|trigger)\b/.test(line)) {
            // `typeof passive.mechanics` is a type reference, not a read.
            if (/\btypeof\b/.test(line)) return;
            offenders.push(`${file}:${i + 1}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
