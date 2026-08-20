import { describe, expect, it } from "vitest";
import {
  getEffectiveCritDamage,
  getEffectiveRecoveryRate,
  getEffectiveLifesteal,
  getEffectiveCritResist,
} from "@/lib/game/substats";
import {
  getDamageReductionMultiplier,
  getDamageDealtMultiplier,
} from "@/lib/game/stats";
import { getEvadeChance } from "@/lib/game/evade";
import { getCritChance } from "@/lib/game/combat";
import chiara from "@/data/characters/chiara.json";
import { scaleMaxHp, inverseHpPercent } from "@/lib/game/maxHp";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import { getEffectiveHealAmount, applyHeal } from "@/lib/game/heal";
import { calculateDamage } from "@/lib/game/damage";
import { executeSkill } from "@/lib/game/combat";
import { tickTeamBuffs } from "@/lib/game/tick";
import { trySurviveLethal } from "@/lib/game/lethal";

function dummySkill(): SkillCard {
  return {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
}

function makeChar(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "c",
    name: "c",
    color: "blue",
    atk: 100,
    def: 50,
    hp: 1000,
    skills: [dummySkill(), dummySkill()] as [SkillCard, SkillCard],
    instanceId: "c",
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 50,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...overrides,
  } as BattleCharacter;
}

describe("substat defaults", () => {
  it("defaults to 50/100/5/10 when the character has no explicit fields", () => {
    const c = makeChar();
    expect(getEffectiveCritDamage(c)).toBe(50);
    expect(getEffectiveRecoveryRate(c)).toBe(100);
    expect(getEffectiveLifesteal(c)).toBe(5);
    expect(getEffectiveCritResist(c)).toBe(10);
  });

  it("reads an explicit per-character base value", () => {
    const c = makeChar({ critDamagePercent: 70, lifestealPercent: 20 });
    expect(getEffectiveCritDamage(c)).toBe(70);
    expect(getEffectiveLifesteal(c)).toBe(20);
  });
});

describe("substat buff/debuff stacking (multiplicative)", () => {
  it("a +20% recoveryRate buff raises the base 100 to 120", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "recoveryRate", valuePercent: 20 });
    expect(getEffectiveRecoveryRate(c)).toBe(120);
  });

  it("two +10% critDamage buffs add ten points each", () => {
    // Substats are percentages, so modifiers add POINTS rather than scaling
    // (Tanveer, 2026-08-09) — 50% crit damage buffed twice by 10% is 70%.
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "critDamage", valuePercent: 10 });
    c.buffs.push({ type: "buff", stat: "critDamage", valuePercent: 10 });
    expect(getEffectiveCritDamage(c)).toBe(70);
  });

  it("a -50% lifesteal debuff wipes out a 5% base and floors at zero", () => {
    // 5 points - 50 points is negative; substats clamp at 0 rather than
    // going inverse.
    const c = makeChar();
    c.debuffs.push({ type: "debuff", stat: "lifesteal", valuePercent: 50 });
    expect(getEffectiveLifesteal(c)).toBe(0);
  });

  it("a -2% lifesteal debuff shaves two points off a 5% base", () => {
    const c = makeChar();
    c.debuffs.push({ type: "debuff", stat: "lifesteal", valuePercent: 2 });
    expect(getEffectiveLifesteal(c)).toBe(3);
  });

  it("Isolde's +10% lifesteal aura actually does something now", () => {
    // Under the old multiplicative reading this computed 5 * 1.1 = 5.5 and
    // floored back to 5 — the aura was a no-op in every shipped battle.
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "lifesteal", valuePercent: 10 });
    expect(getEffectiveLifesteal(c)).toBe(15);
  });

  it("a generic 'all' buff DOES affect substats (reversed 2026-08-09, ruling #55)", () => {
    // Was asserted the other way under a 2026-07-24 basic-stats-only reading.
    // Tanveer's definition, restated 2026-08-09: "all stats" = basic stats
    // PLUS substats, excluding damage reduction and evade chance.
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "all", valuePercent: 50 });
    expect(getEffectiveCritResist(c)).toBe(60); // 10 base + 50 points
  });

  it("still cannot reach damage reduction or evade — those are excluded by name", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "all", valuePercent: 50 });
    // Both are read by exact stat name elsewhere (stats.ts / evade.ts), so an
    // "all" entry never touches them.
    expect(getDamageReductionMultiplier(c)).toBe(1);
  });
});

describe("getEffectiveHealAmount (Recovery Rate scaling)", () => {
  it("100 raw heal at 100% recovery rate stays 100", () => {
    const c = makeChar();
    expect(getEffectiveHealAmount(c, 100)).toBe(100);
  });

  it("100 raw heal at 150% recovery rate becomes 150", () => {
    const c = makeChar({ recoveryRatePercent: 150 });
    expect(getEffectiveHealAmount(c, 100)).toBe(150);
  });

  it("never returns negative for a 0 or negative raw amount", () => {
    const c = makeChar();
    expect(getEffectiveHealAmount(c, 0)).toBe(0);
    expect(getEffectiveHealAmount(c, -50)).toBe(0);
  });
});

describe("applyHeal", () => {
  it("adds the recovery-rate-scaled amount to currentHP", () => {
    const c = makeChar({ currentHP: 500, recoveryRatePercent: 150 });
    const { character, healed } = applyHeal(c, 100);
    expect(healed).toBe(150);
    expect(character.currentHP).toBe(650);
  });

  it("clamps at max HP", () => {
    const c = makeChar({ currentHP: 950, hp: 1000 });
    const { character, healed } = applyHeal(c, 200);
    expect(character.currentHP).toBe(1000);
    expect(healed).toBe(50);
  });

  it("logs the heal when a log function is passed", () => {
    const c = makeChar({ currentHP: 500 });
    const logs: string[] = [];
    applyHeal(c, 100, (e) => logs.push(e));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("100");
  });
});

describe("Crit Damage substat wiring (damage.ts)", () => {
  it("a proc'd crit (no explicit damageBonusPercent) uses the attacker's crit damage substat", () => {
    const attacker = makeChar({ critDamagePercent: 80 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical" }],
      target,
      attacker,
    });
    // 200 base * (1 + 80/100) = 360
    expect(dmg).toBe(360);
  });

  it("a skill with an explicit damageBonusPercent overrides the substat", () => {
    const attacker = makeChar({ critDamagePercent: 80 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical", damageBonusPercent: 30 }],
      target,
      attacker,
    });
    // 200 * (1 + 30/100) = 260, substat ignored
    expect(dmg).toBe(260);
  });

  it("falls back to 50% when no attacker is passed (backward compatible)", () => {
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical" }],
      target,
    });
    expect(dmg).toBe(300);
  });
});

describe("Crit Resistance substat wiring (combat.ts crit roll)", () => {
  it("subtracts the target's crit resistance from the attacker's crit chance", () => {
    // Deathblow-style attacker forced to a known crit chance via currentHP loss
    const attacker = makeChar({
      passive: {
        name: "Test Deathblow",
        trigger: "always",
        mechanics: [
          {
            type: "deathblow",
            hpStepPercent: 25,
            critPerStepPercent: 100,
            // Deathblow also drives an unrelated flat damage-boost mechanic
            // (combat.ts ~line 436, keyed off the same mechanic entry) —
            // zero it out so this test isolates the crit-chance roll only.
            damagePerStepPercent: 0,
          },
        ],
      },
      // 750/1000 (not 900/1000) deliberately avoids a binary floating-point
      // trap: 1 - 900/1000 evaluates to 9.999999999999998, which floors one
      // step short of the intended value and silently zeroes the crit chance.
      currentHP: 750, // 25% lost -> 1 step -> 100% crit chance base
      hp: 1000,
    });
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      currentDefense: 0, // isolate the crit-chance roll from defense math
      critResistPercent: 100, // fully negates the 100% base crit chance
    });
    const result = executeSkill(
      {
        sourceInstanceId: "c",
        skill: dummySkill(),
        targetInstanceId: "t",
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
      0,
      () => 0.01, // would crit if chance > 1%
    );
    // 100% - 100% crit resist = 0% chance -> no crit -> no CRITICAL package
    // (target has 0 def, so a non-crit hit deals plain base damage; a crit
    // would add +50% and ignore defense — neither special case fires here)
    expect(result.enemyTeam[0].currentHP).toBe(target.hp - attacker.currentAttack);
  });
});

describe("Lifesteal substat wiring (combat.ts)", () => {
  it("a plain attack with no skill lifesteal mechanic still heals the attacker for their base lifestealPercent", () => {
    const attacker = makeChar({ lifestealPercent: 10, currentHP: 500 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const result = executeSkill(
      { sourceInstanceId: "c", skill: dummySkill(), targetInstanceId: "t" },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    // dealt = attacker.currentAttack (100) - 0 def = 100; 10% lifesteal = 10
    expect(result.playerTeam[0].currentHP).toBe(510);
  });

  it("stacks additively with an existing skill-level lifesteal mechanic", () => {
    const attacker = makeChar({ lifestealPercent: 10, currentHP: 500 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const skill: SkillCard = {
      skillName: "Drain",
      characterId: "c",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "lifesteal", valuePercent: 30 }],
    };
    const result = executeSkill(
      { sourceInstanceId: "c", skill, targetInstanceId: "t" },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    // dealt = 100; skill lifesteal 30 -> +30; substat lifesteal 10% -> +10
    expect(result.playerTeam[0].currentHP).toBe(540);
  });
});

describe("Recovery Rate applied at existing heal call sites", () => {
  it("a heal-type skill scales by the target's recovery rate", () => {
    const healer = makeChar({ instanceId: "h" });
    const target = makeChar({
      instanceId: "t",
      currentHP: 500,
      recoveryRatePercent: 150,
    });
    const healSkill: SkillCard = {
      skillName: "Heal",
      characterId: "h",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
    };
    const result = executeSkill(
      { sourceInstanceId: "h", skill: healSkill, targetInstanceId: "t" },
      { playerTeam: [healer, target], enemyTeam: [] },
      () => {},
    );
    // base heal = healer.currentAttack (100) scaled by 150% recovery = 150
    const healedTarget = result.playerTeam.find((c) => c.instanceId === "t")!;
    expect(healedTarget.currentHP).toBe(650);
  });

  it("HoT ticks scale by the recipient's CURRENT recovery rate, recalculated live", async () => {
    const char = makeChar({ currentHP: 500, recoveryRatePercent: 100 });
    char.buffs.push({
      type: "healOverTime",
      value: 100,
      buffDuration: 2,
    });
    let [ticked] = tickTeamBuffs([char], () => {});
    // tick 1 at 100% recovery rate -> +100
    expect(ticked.currentHP).toBe(600);

    // recipient's recovery rate improves mid-duration
    ticked.recoveryRatePercent = 200;
    [ticked] = tickTeamBuffs([ticked], () => {});
    // tick 2 at 200% recovery rate -> +200 (not the original +100)
    expect(ticked.currentHP).toBe(800);
  });

  it("lethal-survival heal scales by the survivor's recovery rate", () => {
    const char = makeChar({
      currentHP: 400, // >= 30% of 1000 max HP, so the condition is met
      recoveryRatePercent: 200,
      passive: {
        name: "Nine Lives",
        trigger: "onLethalDamage",
        mechanics: [
          { type: "surviveLethal", hpConditionPercent: 30, healDamagePercent: 50 },
        ],
      },
    });
    const healAmount = trySurviveLethal(char, 1000);
    // 1000 incoming * 50% = 500 raw heal, * 200% recovery rate = 1000
    expect(healAmount).toBe(1000);
    expect(char.currentHP).toBe(1000);
  });
});

describe("max-HP changes preserve the HP ratio (Tanveer, 2026-08-09)", () => {
  it("raising max HP 50% takes 1500/2000 to 2250/3000", () => {
    expect(scaleMaxHp({ hp: 2000, currentHP: 1500 }, 50)).toEqual({
      hp: 3000,
      currentHP: 2250,
    });
  });

  it("lowering max HP 30% takes 1500/2000 to 1050/1400", () => {
    expect(scaleMaxHp({ hp: 2000, currentHP: 1500 }, -30)).toEqual({
      hp: 1400,
      currentHP: 1050,
    });
  });

  it("keeps the ratio rather than adding the max-HP delta", () => {
    // The old behaviour added the delta to both, turning 75% into 83%.
    const after = scaleMaxHp({ hp: 2000, currentHP: 1500 }, 50);
    expect(after.currentHP / after.hp).toBeCloseTo(0.75, 5);
  });

  it("never rounds a living unit down to zero", () => {
    expect(scaleMaxHp({ hp: 100, currentHP: 1 }, -99).currentHP).toBe(1);
  });

  it("leaves a downed unit at zero rather than reviving it", () => {
    expect(scaleMaxHp({ hp: 100, currentHP: 0 }, 50).currentHP).toBe(0);
  });

  it("never lets current exceed the new max", () => {
    const after = scaleMaxHp({ hp: 100, currentHP: 100 }, -50);
    expect(after.currentHP).toBeLessThanOrEqual(after.hp);
  });
});

describe("max-HP changes unwind when their effect expires", () => {
  const mkChar = (hp: number, currentHP: number): BattleCharacter =>
    makeChar({ hp, currentHP, name: "Subject" }) as BattleCharacter;

  it("a durationed HP buff raises max HP, then gives it back on expiry", () => {
    // "+30% all stats for 1 turn" used to leave the HP raise behind forever,
    // because max HP is baked rather than read through effectiveStat.
    let c = mkChar(2000, 1000);
    c.buffs.push({
      type: "buff", stat: "all", valuePercent: 30, buffDuration: 1,
      hpScalePercent: 30, name: "Test Ward",
    });
    Object.assign(c, scaleMaxHp(c, 30));
    expect(c.hp).toBe(2600);
    expect(c.currentHP).toBe(1300);

    c = tickTeamBuffs([c], () => {})[0];
    expect(c.buffs).toHaveLength(0);
    expect(c.hp).toBe(2000); // back where it started
    expect(c.currentHP).toBe(1000);
  });

  it("undoes a raise by its inverse, not by the same percent", () => {
    // +50% is undone by -33.3%, not -50%; otherwise 3000 would fall to 1500.
    expect(inverseHpPercent(50)).toBeCloseTo(-33.333, 2);
    let c = mkChar(2000, 1500);
    c.buffs.push({
      type: "buff", stat: "hp", valuePercent: 50, buffDuration: 1,
      hpScalePercent: 50, name: "Test",
    });
    Object.assign(c, scaleMaxHp(c, 50));
    expect(c.hp).toBe(3000);
    c = tickTeamBuffs([c], () => {})[0];
    expect(c.hp).toBe(2000);
  });

  it("leaves a permanent (undurationed) HP raise alone", () => {
    let c = mkChar(2000, 1000);
    c.buffs.push({ type: "buff", stat: "hp", valuePercent: 30, hpScalePercent: 30 });
    Object.assign(c, scaleMaxHp(c, 30));
    c = tickTeamBuffs([c], () => {})[0];
    expect(c.hp).toBe(2600); // no duration = never expires = never unwinds
  });

  it("keeps the HP ratio across raise and expiry", () => {
    let c = mkChar(2000, 1500); // 75%
    c.buffs.push({
      type: "buff", stat: "all", valuePercent: 40, buffDuration: 1,
      hpScalePercent: 40,
    });
    Object.assign(c, scaleMaxHp(c, 40));
    expect(c.currentHP / c.hp).toBeCloseTo(0.75, 2);
    c = tickTeamBuffs([c], () => {})[0];
    expect(c.currentHP / c.hp).toBeCloseTo(0.75, 2);
  });
});

describe("synergies target basic stats; only Seras and Batra reach substats", () => {
  const synergyOf = (id: string) =>
    (getCharacterById(id)?.passive?.mechanics ?? []).find(
      (m) => m.type === "synergy" || m.type === "characterSynergy",
    ) as { stat?: string; stats?: string[] } | undefined;

  it.each(["ban", "diane", "gon", "killua", "leorio", "meliodas"])(
    "%s's synergy names basic stats, not 'all'",
    (id) => {
      const m = synergyOf(id);
      expect(m?.stat).toBeUndefined();
      expect(m?.stats).toEqual(["atk", "def", "hp"]);
    },
  );

  it.each(["seras", "batra"])("%s's synergy keeps 'all' and reaches substats", (id) => {
    expect(synergyOf(id)?.stat).toBe("all");
  });

  it("Sara's is damageDealt — a damage modifier, not a stat change", () => {
    expect(synergyOf("sara")?.stat).toBe("damageDealt");
  });

  it("Mustafa's targets DEF only", () => {
    expect(synergyOf("mustafa")?.stat).toBe("def");
  });
});

describe("Kind Hearted Friend's two halves target differently", () => {
  it("the base bond names basic stats and the both-alive bonus names all", () => {
    // Tanveer, 2026-08-09: the bond's base is basic stats, but the both-alive
    // half is restrictive enough to justify reaching substats.
    const m = (getCharacterById("leorio")?.passive?.mechanics ?? []).find(
      (x) => x.type === "characterSynergy",
    ) as { stats?: string[]; bothAliveStat?: string };
    expect(m.stats).toEqual(["atk", "def", "hp"]);
    expect(m.bothAliveStat).toBe("all");
  });

  it("the passive wording matches what each half actually targets", () => {
    const text = getCharacterById("leorio")?.passive?.description ?? "";
    // Base bond
    expect(text).toContain("All allies' basic stats 10%");
    // Both-alive bonus
    expect(text).toContain("All allies' all stats 10%");
    // And the [Collab] tag synergy is basic like every other tag synergy
    expect(text).toContain("[Collab] allies' basic stats 5%");
  });

  it.each(["ban", "diane", "gon", "killua", "meliodas"])(
    "%s's passive says 'basic stats', matching its retargeted synergy",
    (id) => {
      expect(getCharacterById(id)?.passive?.description).toContain("basic stats");
    },
  );

  it.each(["seras", "batra"])("%s's passive still says 'all stats'", (id) => {
    expect(getCharacterById(id)?.passive?.description).toContain("all stats");
  });
});

describe("substat buffs authored as a stats array (ruling #55)", () => {
  /**
   * One entry may cover a basic stat and a substat together — Chiara's
   * ultimate raises ATK and evade chance as a single effect, so it is one
   * pill and one thing to cleanse. `evade.ts` matched on `stat === "evade"`
   * alone, so merging Chiara's two entries into one silently zeroed her
   * dodge: the buff rendered on the card and never reached the roll.
   *
   * Same failure family as the lifesteal/evade no-ops #55 was written for.
   */
  const mk = (buffs: unknown[]) =>
    ({ buffs, debuffs: [], passiveState: {} }) as unknown as BattleCharacter;

  it("reads evade from a stats array, not just a bare stat", () => {
    expect(
      getEvadeChance(mk([{ type: "buff", stat: "evade", valuePercent: 33 }])),
    ).toBe(33);
    expect(
      getEvadeChance(
        mk([{ type: "buff", stats: ["atk", "evade"], valuePercent: 33 }]),
      ),
    ).toBe(33);
  });

  it("keeps evade out of reach of stat: 'all'", () => {
    // Ruling #55: "all stats" is basic stats plus substats, EXCLUDING damage
    // reduction and evade chance. This is why evade can't just call
    // `entryAffectsStat`, which honours "all".
    expect(
      getEvadeChance(mk([{ type: "buff", stat: "all", valuePercent: 30 }])),
    ).toBe(0);
  });

  it("Chiara's shipped ultimate actually grants her dodge", () => {
    const ult = chiara.ultimate as unknown as {
      mechanics: { type: string; stats?: string[]; valuePercent?: number }[];
    };
    const evadeEntry = ult.mechanics.find(
      (m) => m.type === "buff" && m.stats?.includes("evade"),
    );
    expect(evadeEntry).toBeDefined();
    expect(
      getEvadeChance(mk([{ type: "buff", ...evadeEntry }])),
    ).toBe(evadeEntry?.valuePercent);
  });
});

describe("crit chance is buffable by skills and ultimates", () => {
  /**
   * Tanveer, 2026-08-19: *"skills or ults can also increase crit chance, just
   * like how chiara increases her evade chance."* `getCritChance` summed only
   * the Deathblow passive and returned, so an authored crit buff never reached
   * the roll in `combat.ts`.
   */
  const mk = (buffs: unknown[], debuffs: unknown[] = []) =>
    ({ buffs, debuffs, passiveState: {} }) as unknown as BattleCharacter;

  it("base is 0 with no sources (ruling #16)", () => {
    expect(getCritChance(mk([]))).toBe(0);
  });

  it("a skill buff raises it, in percentage points", () => {
    expect(
      getCritChance(mk([{ type: "buff", stat: "critChance", valuePercent: 50 }])),
    ).toBe(50);
  });

  it("reads a stats array and clamps at zero", () => {
    expect(
      getCritChance(
        mk([{ type: "buff", stats: ["atk", "critChance"], valuePercent: 20 }]),
      ),
    ).toBe(20);
    expect(
      getCritChance(
        mk(
          [{ type: "buff", stat: "critChance", valuePercent: 10 }],
          [{ type: "debuff", stat: "critChance", valuePercent: 40 }],
        ),
      ),
    ).toBe(0);
  });
});

/**
 * Ruling #55's one-effect-one-entry shape means a modifier covering several
 * stats is authored `stats: [...]` with no `stat` field. Every reader keyed on
 * `entry.stat` alone silently dropped the whole entry — three live bugs on
 * 2026-08-20 (evade, crit chance, the damage preview). These are the last two
 * readers in that family, plus the debuff halves evade and DR were missing.
 * Spec: Plans/2026-08-20-substat-stats-arrays.md
 */
describe("damage modifiers read `stats` arrays but never `all`", () => {
  it("raises damage dealt from an array-authored buff", () => {
    const c = makeChar({
      buffs: [{ type: "buff", stats: ["atk", "damageDealt"], valuePercent: 50 }],
    } as Partial<BattleCharacter>);
    expect(getDamageDealtMultiplier(c)).toBeCloseTo(1.5);
  });

  it("reduces incoming damage from an array-authored buff", () => {
    const c = makeChar({
      buffs: [
        { type: "buff", stats: ["def", "damageReduction"], valuePercent: 25 },
      ],
    } as Partial<BattleCharacter>);
    expect(getDamageReductionMultiplier(c)).toBeCloseTo(0.75);
  });

  it("keeps `stat: \"all\"` out of both — #55 excludes damage reduction, #36 makes damageDealt a modifier", () => {
    const c = makeChar({
      buffs: [{ type: "buff", stat: "all", valuePercent: 50 }],
    } as Partial<BattleCharacter>);
    expect(getDamageDealtMultiplier(c)).toBe(1);
    expect(getDamageReductionMultiplier(c)).toBe(1);
  });

  it("leaves single-stat authoring and multiplicative buff stacking unchanged", () => {
    const c = makeChar({
      buffs: [
        { type: "buff", stat: "damageReduction", valuePercent: 25 },
        { type: "buff", stat: "damageReduction", valuePercent: 40 },
      ],
    } as Partial<BattleCharacter>);
    // 0.75 * 0.6 — Mustafa's Fortress and Iron Wall depend on this, NOT on 65%.
    expect(getDamageReductionMultiplier(c)).toBeCloseTo(0.45);
  });

  it("lets a debuff strip damage reduction away, but never past zero", () => {
    const stripped = makeChar({
      buffs: [{ type: "buff", stat: "damageReduction", valuePercent: 25 }],
      debuffs: [{ type: "debuff", stats: ["damageReduction"], valuePercent: 25 }],
    } as Partial<BattleCharacter>);
    expect(getDamageReductionMultiplier(stripped)).toBeCloseTo(0.9375);

    const overStripped = makeChar({
      debuffs: [{ type: "debuff", stat: "damageReduction", valuePercent: 60 }],
    } as Partial<BattleCharacter>);
    // A DR debuff removes reduction; it never becomes damage amplification.
    expect(getDamageReductionMultiplier(overStripped)).toBe(1);
  });

  it("subtracts evade debuffs and floors the chance at zero", () => {
    const partial = makeChar({
      buffs: [{ type: "buff", stats: ["atk", "evade"], valuePercent: 33 }],
      debuffs: [{ type: "debuff", stat: "evade", valuePercent: 10 }],
    } as Partial<BattleCharacter>);
    expect(getEvadeChance(partial)).toBe(23);

    const floored = makeChar({
      buffs: [{ type: "buff", stat: "evade", valuePercent: 10 }],
      debuffs: [{ type: "debuff", stats: ["evade"], valuePercent: 40 }],
    } as Partial<BattleCharacter>);
    expect(getEvadeChance(floored)).toBe(0);
  });

  it("still keeps `stat: \"all\"` away from evade chance", () => {
    const c = makeChar({
      buffs: [{ type: "buff", stat: "all", valuePercent: 50 }],
    } as Partial<BattleCharacter>);
    expect(getEvadeChance(c)).toBe(0);
  });
});
