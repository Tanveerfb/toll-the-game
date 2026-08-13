import { describe, expect, it } from "vitest";
import { registerCharacterPassives } from "@/lib/game/passive";
import { statPhrase } from "@/lib/game/stats";
import type { BattleCharacter } from "@/types/character";
import gonData from "@/data/characters/gon.json";
import killuaData from "@/data/characters/killua.json";
import serasData from "@/data/characters/seras.json";
import saraData from "@/data/characters/sara.json";
import isoldeData from "@/data/characters/isolde.json";

/**
 * Open Issue #26 and the defect underneath it.
 *
 * The reported symptom was a log line reading `gained 5% undefined`. The cause
 * ran deeper: every tribe synergy in the roster declares `stats:
 * ["atk","def","hp"]` with no `stat`, and `passive.ts` copied only `stat` onto
 * the buff — so those synergies were display badges that moved no stat at all.
 * STATUS.md recorded "the buff works"; it did not (2026-08-13).
 */

function fromData(
  raw: unknown,
  team: "player" | "enemy",
  instanceId: string,
): BattleCharacter {
  const data = raw as BattleCharacter;
  return {
    ...data,
    instanceId,
    currentAttack: data.atk,
    currentDefense: data.def,
    currentHP: data.hp,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
  } as BattleCharacter;
}

async function runBattleStart(units: BattleCharacter[], log: (e: string) => void) {
  const items: Array<{
    phase: string;
    sourceInstanceId: string;
    action: (
      source: BattleCharacter,
      teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
      log: (entry: string) => void,
    ) => Promise<{
      playerTeam: BattleCharacter[];
      enemyTeam: BattleCharacter[];
    }>;
  }> = [];
  units.forEach((c) => registerCharacterPassives(c, (item) => items.push(item)));

  let teams = { playerTeam: units, enemyTeam: [] as BattleCharacter[] };
  for (const item of items.filter((q) => q.phase === "OnBattleStart")) {
    const source = teams.playerTeam.find(
      (c) => c.instanceId === item.sourceInstanceId,
    );
    if (source) teams = await item.action(source, teams, log);
  }
  return teams;
}

describe("a tag synergy declared with `stats` actually moves those stats", () => {
  it("raises ATK, DEF and max HP for a lone carrier", async () => {
    const gon = fromData(gonData, "player", "p1_gon");
    const teams = await runBattleStart([gon], () => {});
    const buffed = teams.playerTeam[0];

    // flatBonus: true, so 5% regardless of carrier count (ruling #35).
    expect(buffed.buffs.some((b) => b.name === "[Collab] Synergy")).toBe(true);
    expect(buffed.currentAttack).toBe(gon.atk + Math.floor(gon.atk * 0.05));
    expect(buffed.currentDefense).toBe(gon.def + Math.floor(gon.def * 0.05));
    // `hp` is max HP; scaleMaxHp raises it and carries current HP with it.
    expect(buffed.hp).toBe(Math.floor(gon.hp * 1.05 + 1e-9));
  });

  it("stacks once per carrying source, not once per team", async () => {
    // Gon and Killua each own a [Collab] synergy and each applies it to every
    // carrier, so a two-Collab team pays 5% twice. That is the pre-existing
    // shape of the mechanic — it only became observable once the buff started
    // moving stats at all.
    const gon = fromData(gonData, "player", "p1_gon");
    const killua = fromData(killuaData, "player", "p2_killua");

    const teams = await runBattleStart([gon, killua], () => {});
    const buffed = teams.playerTeam[0];

    expect(buffed.currentAttack).toBe(gon.atk + 2 * Math.floor(gon.atk * 0.05));
    expect(buffed.currentDefense).toBe(
      gon.def + 2 * Math.floor(gon.def * 0.05),
    );
  });

  it("carries `stats` onto the buff so entryAffectsStat can see it", async () => {
    const teams = await runBattleStart(
      [fromData(gonData, "player", "p1_gon")],
      () => {},
    );
    const synergy = teams.playerTeam[0].buffs.find(
      (b) => b.name === "[Collab] Synergy",
    );
    expect(synergy).toBeDefined();
    expect(synergy!.stats).toEqual(["atk", "def", "hp"]);
  });

  it("still bakes a `stat: \"all\"` synergy the way it always did", async () => {
    const seras = fromData(serasData, "player", "p1_seras");
    const teams = await runBattleStart([seras], () => {});
    const buffed = teams.playerTeam[0];

    expect(buffed.currentAttack).toBe(seras.atk + Math.floor(seras.atk * 0.1));
    expect(buffed.currentDefense).toBe(seras.def + Math.floor(seras.def * 0.1));
  });

  it("leaves a damageDealt synergy unbaked — it is read at damage time", async () => {
    const sara = fromData(saraData, "player", "p1_sara");
    const teams = await runBattleStart([sara], () => {});
    const buffed = teams.playerTeam[0];

    expect(buffed.currentAttack).toBe(sara.atk);
    const female = buffed.buffs.find((b) => b.name === "[Female] Synergy");
    expect(female?.preApplied).toBe(false);
  });
});

describe("the synergy and aura log lines name their stats (issue #26)", () => {
  it("says 'basic stats' and never prints undefined", async () => {
    const lines: string[] = [];
    await runBattleStart(
      [
        fromData(gonData, "player", "p1_gon"),
        fromData(killuaData, "player", "p2_killua"),
      ],
      (e) => lines.push(e),
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join("\n")).not.toContain("undefined");
    expect(lines.some((l) => l.includes("5% basic stats"))).toBe(true);
  });

  it("says 'all stats' for a stat: \"all\" synergy", async () => {
    const lines: string[] = [];
    await runBattleStart([fromData(serasData, "player", "p1_seras")], (e) =>
      lines.push(e),
    );
    expect(lines.some((l) => l.includes("10% all stats"))).toBe(true);
  });

  it("names a single-stat aura by that stat", async () => {
    const lines: string[] = [];
    await runBattleStart([fromData(isoldeData, "player", "p1_isolde")], (e) =>
      lines.push(e),
    );
    expect(lines.join("\n")).not.toContain("undefined");
    expect(lines.some((l) => l.includes("% HP from"))).toBe(true);
  });
});

describe("statPhrase", () => {
  it("collapses the three basic stats to a category name", () => {
    expect(statPhrase({ stats: ["atk", "def", "hp"] })).toBe("basic stats");
    // Order is not significant — it is a set.
    expect(statPhrase({ stats: ["hp", "atk", "def"] })).toBe("basic stats");
  });

  it("keeps 'all stats' distinct from 'basic stats'", () => {
    // They are NOT synonyms: "all" reaches substats too (Tanveer, 2026-08-13).
    expect(statPhrase({ stat: "all" })).toBe("all stats");
  });

  it("lists any other combination readably", () => {
    expect(statPhrase({ stats: ["atk", "def"] })).toBe("ATK and DEF");
    expect(statPhrase({ stats: ["atk", "def", "lifesteal"] })).toBe(
      "ATK, DEF and lifesteal",
    );
    expect(statPhrase({ stat: "def" })).toBe("DEF");
    expect(statPhrase({ stat: "damageDealt" })).toBe("damage dealt");
  });

  it("degrades to a generic word rather than printing undefined", () => {
    expect(statPhrase({})).toBe("stats");
    expect(statPhrase({ stats: [] })).toBe("stats");
  });
});
