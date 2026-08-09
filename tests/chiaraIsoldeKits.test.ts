import { describe, expect, it, vi } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { QueueItem } from "@/hooks/MechanicProvider";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";
import chiaraData from "@/data/characters/chiara.json";
import isoldeData from "@/data/characters/isolde.json";

const noopLog = () => {};

function makeChar(
  overrides: Partial<BattleCharacter> & {
    instanceId: string;
    team: "player" | "enemy";
  },
): BattleCharacter {
  const dummy: SkillCard = {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [dummy, dummy] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 5,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ...overrides,
  } as BattleCharacter;
}

describe("Debuff Immunity (Isolde's Starbound Ward)", () => {
  const debuffImmunityGrant: UltimateCard = {
    skillName: "Starbound Ward",
    characterId: "isolde",
    type: "ultimate",
    statMultiplier: "atk",
    damage: 0,
    mechanics: [
      { type: "debuffImmunity", duration: 3 },
      { type: "aoe" },
    ],
  };

  it("cleanses existing cancellable debuffs and blocks new ones", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      debuffs: [
        { type: "debuff", stat: "atk", valuePercent: 30, debuffDuration: 2 },
      ],
    });
    const result = executeSkill(
      {
        sourceInstanceId: "isolde",
        skill: debuffImmunityGrant,
        targetInstanceId: "ally",
      },
      { playerTeam: [isolde, ally], enemyTeam: [] },
      noopLog,
    );
    const updatedAlly = result.playerTeam.find((c) => c.instanceId === "ally")!;
    expect(updatedAlly.debuffs).toHaveLength(0);
    expect(updatedAlly.buffs.some((b) => b.debuffImmune)).toBe(true);
  });

  it("blocks a subsequent hostile debuff mechanic but not damage or defeat", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    let ally = makeChar({ instanceId: "ally", team: "player" });
    const granted = executeSkill(
      {
        sourceInstanceId: "isolde",
        skill: debuffImmunityGrant,
        targetInstanceId: "ally",
      },
      { playerTeam: [isolde, ally], enemyTeam: [] },
      noopLog,
    );
    ally = granted.playerTeam.find((c) => c.instanceId === "ally")!;

    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const stunAttack: SkillCard = {
      skillName: "Stunning Blow",
      characterId: "enemy",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "stun", duration: 2 }],
    };
    const hit = executeSkill(
      {
        sourceInstanceId: "enemy",
        skill: stunAttack,
        targetInstanceId: "ally",
      },
      { playerTeam: [ally], enemyTeam: [enemy] },
      noopLog,
    );
    const hitAlly = hit.playerTeam.find((c) => c.instanceId === "ally")!;
    // Damage still lands...
    expect(hitAlly.currentHP).toBeLessThan(1000);
    // ...but the stun does not.
    expect(hitAlly.debuffs.some((d) => d.type === "stun")).toBe(false);
  });

  it("still marks the target defeated even while Debuff Immune", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    let ally = makeChar({ instanceId: "ally", team: "player" });
    const granted = executeSkill(
      {
        sourceInstanceId: "isolde",
        skill: debuffImmunityGrant,
        targetInstanceId: "ally",
      },
      { playerTeam: [isolde, ally], enemyTeam: [] },
      noopLog,
    );
    ally = granted.playerTeam.find((c) => c.instanceId === "ally")!;
    ally.currentHP = 50;

    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const lethal: SkillCard = {
      skillName: "Lethal Blow",
      characterId: "enemy",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [1000, 1000, 1000],
      mechanics: [{ type: "stun", duration: 2 }],
    };
    const hit = executeSkill(
      {
        sourceInstanceId: "enemy",
        skill: lethal,
        targetInstanceId: "ally",
      },
      { playerTeam: [ally], enemyTeam: [enemy] },
      noopLog,
    );
    const hitAlly = hit.playerTeam.find((c) => c.instanceId === "ally")!;
    expect(hitAlly.currentHP).toBe(0);
  });
});

describe("Ally-wide buff bakes HP for stat 'hp'/'all' (Isolde's Starbound Ward)", () => {
  it("increases max HP and current HP, not just a display badge", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const ally = makeChar({ instanceId: "ally", team: "player", hp: 1000, currentHP: 1000 });
    const ult: UltimateCard = {
      skillName: "Starbound Ward",
      characterId: "isolde",
      type: "ultimate",
      statMultiplier: "atk",
      damage: 0,
      mechanics: [
        { type: "buff", stat: "all", valuePercent: 30, duration: 3 },
        { type: "aoe" },
      ],
    };
    const result = executeSkill(
      { sourceInstanceId: "isolde", skill: ult, targetInstanceId: "ally" },
      { playerTeam: [isolde, ally], enemyTeam: [] },
      noopLog,
    );
    const updatedAlly = result.playerTeam.find((c) => c.instanceId === "ally")!;
    expect(updatedAlly.hp).toBe(1300);
    // A support-only ultimate does NOT attack (Tanveer, 2026-08-09: "it is
    // only a buff based ultimate"). This used to assert 1298: every ultimate
    // counted as isAttack even at damage: 0, and damage.ts floors damage at 1,
    // so Starbound Ward chipped a point off each ALLY it buffed before the
    // buff landed. Now the ally is untouched, so a clean 1000 * 1.3 = 1300.
    expect(updatedAlly.currentHP).toBe(1300);
  });
});

describe("healOverTime mechanic (Isolde's Threads of Renewal)", () => {
  it("applies a HoT worth valuePercent of the actual heal amount", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      hp: 1000,
      currentHP: 500,
    });
    const heal: SkillCard = {
      skillName: "Threads of Renewal",
      characterId: "isolde",
      type: "heal",
      statMultiplier: "hp",
      damageRanked: [30, 30, 30],
      mechanics: [
        { type: "cleanse" },
        { type: "healOverTime", valuePercent: 30, duration: 2 },
      ],
    };
    const result = executeSkill(
      { sourceInstanceId: "isolde", skill: heal, targetInstanceId: "ally" },
      { playerTeam: [isolde, ally], enemyTeam: [] },
      noopLog,
    );
    const updatedAlly = result.playerTeam.find((c) => c.instanceId === "ally")!;
    // Isolde's own maxHP is 1000, 30% heal = 300 HP restored
    expect(updatedAlly.currentHP).toBe(800);
    const hot = updatedAlly.buffs.find((b) => b.type === "healOverTime");
    expect(hot).toBeDefined();
    expect(hot!.value).toBe(90); // 30% of the 300 healed
    expect(hot!.buffDuration).toBe(2);
  });
});

describe("Seal generalization (Chiara's House Rules)", () => {
  const debuffSkill: SkillCard = {
    skillName: "Wither",
    characterId: "enemy",
    type: "debuff",
    statMultiplier: "def",
    damageRanked: [0, 0, 0],
    mechanics: [{ type: "debuff", stat: "atk", valuePercent: 20, duration: 2 }],
  };
  const attackDebuffSkill: SkillCard = {
    skillName: "Rush Rock",
    characterId: "enemy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
    mechanics: [{ type: "seal", sealType: "attack", duration: 1 }],
  };
  const plainAttack: SkillCard = {
    skillName: "Plain Hit",
    characterId: "enemy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };

  it("sealType 'debuff' fizzles a debuff-type skill", () => {
    const source = makeChar({
      instanceId: "sealed",
      team: "enemy",
      debuffs: [{ type: "seal", sealType: "debuff", debuffDuration: 2 }],
    });
    const target = makeChar({ instanceId: "target", team: "player" });
    const result = executeSkill(
      { sourceInstanceId: "sealed", skill: debuffSkill, targetInstanceId: "target" },
      { playerTeam: [target], enemyTeam: [source] },
      noopLog,
    );
    const updatedTarget = result.playerTeam.find((c) => c.instanceId === "target")!;
    expect(updatedTarget.debuffs).toHaveLength(0);
  });

  it("sealType 'attackDebuff' fizzles an attack skill carrying a debuff mechanic", () => {
    const source = makeChar({
      instanceId: "sealed",
      team: "enemy",
      debuffs: [{ type: "seal", sealType: "attackDebuff", debuffDuration: 2 }],
    });
    const target = makeChar({ instanceId: "target", team: "player", currentHP: 1000 });
    const result = executeSkill(
      { sourceInstanceId: "sealed", skill: attackDebuffSkill, targetInstanceId: "target" },
      { playerTeam: [target], enemyTeam: [source] },
      noopLog,
    );
    const updatedTarget = result.playerTeam.find((c) => c.instanceId === "target")!;
    // The whole skill fizzles — no damage, no seal applied
    expect(updatedTarget.currentHP).toBe(1000);
    expect(updatedTarget.debuffs).toHaveLength(0);
  });

  it("sealType 'attackDebuff' does NOT block a plain attack with no debuff mechanic", () => {
    const source = makeChar({
      instanceId: "sealed",
      team: "enemy",
      debuffs: [{ type: "seal", sealType: "attackDebuff", debuffDuration: 2 }],
    });
    const target = makeChar({ instanceId: "target", team: "player", currentHP: 1000 });
    const result = executeSkill(
      { sourceInstanceId: "sealed", skill: plainAttack, targetInstanceId: "target" },
      { playerTeam: [target], enemyTeam: [source] },
      noopLog,
    );
    const updatedTarget = result.playerTeam.find((c) => c.instanceId === "target")!;
    expect(updatedTarget.currentHP).toBeLessThan(1000);
  });

  it("original sealType 'attack' still blocks plain attacks (no regression)", () => {
    const source = makeChar({
      instanceId: "sealed",
      team: "enemy",
      debuffs: [{ type: "seal", sealType: "attack", debuffDuration: 2 }],
    });
    const target = makeChar({ instanceId: "target", team: "player", currentHP: 1000 });
    const result = executeSkill(
      { sourceInstanceId: "sealed", skill: plainAttack, targetInstanceId: "target" },
      { playerTeam: [target], enemyTeam: [source] },
      noopLog,
    );
    const updatedTarget = result.playerTeam.find((c) => c.instanceId === "target")!;
    expect(updatedTarget.currentHP).toBe(1000);
  });
});

describe("lowerUltGauge explicit 0 (Isolde's Severed Ledger R1)", () => {
  it("does not reduce ult gauge when value is explicitly 0", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy", ultGauge: 5 });
    const skill: SkillCard = {
      skillName: "Severed Ledger",
      characterId: "isolde",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [280, 340, 400],
      mechanics: [{ type: "aoe" }, { type: "lowerUltGauge", valueRanked: [0, 1, 3] }],
    };
    const result = executeSkill(
      { sourceInstanceId: "isolde", skill, targetInstanceId: "enemy", rank: 1 },
      { playerTeam: [isolde], enemyTeam: [enemy] },
      noopLog,
    );
    const updatedEnemy = result.enemyTeam.find((c) => c.instanceId === "enemy")!;
    expect(updatedEnemy.ultGauge).toBe(5);
  });

  it("reduces by the ranked value at R3", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy", ultGauge: 5 });
    const skill: SkillCard = {
      skillName: "Severed Ledger",
      characterId: "isolde",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [280, 340, 400],
      mechanics: [{ type: "aoe" }, { type: "lowerUltGauge", valueRanked: [0, 1, 3] }],
    };
    const result = executeSkill(
      { sourceInstanceId: "isolde", skill, targetInstanceId: "enemy", rank: 3 },
      { playerTeam: [isolde], enemyTeam: [enemy] },
      noopLog,
    );
    const updatedEnemy = result.enemyTeam.find((c) => c.instanceId === "enemy")!;
    expect(updatedEnemy.ultGauge).toBe(2);
  });
});

describe("Isolde's kit JSON", () => {
  it("passive 'aura' mechanics bake HP and stack recoveryRate/lifesteal badges from sub", async () => {
    const isolde: BattleCharacter = {
      id: "isolde",
      name: "Isolde",
      color: "light",
      atk: isoldeData.atk,
      def: isoldeData.def,
      hp: isoldeData.hp,
      skills: isoldeData.skills as unknown as [SkillCard, SkillCard],
      currentHP: isoldeData.hp,
      currentAttack: isoldeData.atk,
      currentDefense: isoldeData.def,
      ultGauge: 0,
      buffs: [],
      debuffs: [],
      passiveState: {},
      passive: isoldeData.passive as BattleCharacter["passive"],
      team: "player",
      instanceId: "isolde",
      isSub: true,
    } as BattleCharacter;
    const ally = {
      ...isolde,
      instanceId: "ally",
      name: "ally",
      hp: 1000,
      currentHP: 1000,
      isSub: false,
      passive: undefined,
    } as BattleCharacter;

    let captured: QueueItem | null = null;
    registerCharacterPassives(isolde, (item) => {
      if (item.mechanicId.includes("Woven Blessing") && !captured) captured = item;
    });
    expect(captured).not.toBeNull();

    const teams = { playerTeam: [isolde, ally], enemyTeam: [] as BattleCharacter[] };
    const result = await captured!.action(isolde, teams, noopLog);
    const updatedAlly = result.playerTeam.find((c) => c.instanceId === "ally")!;
    expect(updatedAlly.hp).toBe(1100); // +10% of 1000
    expect(updatedAlly.buffs.some((b) => b.stat === "recoveryRate")).toBe(true);
    expect(updatedAlly.buffs.some((b) => b.stat === "lifesteal")).toBe(true);
  });
});

describe("Chiara's Cut the Deck (randomTurnEffect)", () => {
  it("applies the chosen option to the right target with the badge duration", async () => {
    const chiara: BattleCharacter = {
      id: "chiara",
      name: "Chiara",
      color: "dark",
      atk: chiaraData.atk,
      def: chiaraData.def,
      hp: chiaraData.hp,
      skills: chiaraData.skills as unknown as [SkillCard, SkillCard],
      currentHP: chiaraData.hp,
      currentAttack: chiaraData.atk,
      currentDefense: chiaraData.def,
      ultGauge: 0,
      buffs: [],
      debuffs: [],
      passiveState: {},
      passive: chiaraData.passive as BattleCharacter["passive"],
      team: "player",
      instanceId: "chiara",
      isSub: false,
    } as BattleCharacter;
    const enemy = { ...chiara, instanceId: "enemy", team: "enemy" as const, isSub: false };

    let captured: QueueItem | null = null;
    registerCharacterPassives(chiara, (item) => {
      if (item.mechanicId.includes("(roll)")) captured = item;
    });
    expect(captured).not.toBeNull();

    // Force the "debuffEnemies" option (index 0)
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const teams = { playerTeam: [chiara], enemyTeam: [enemy] };
      const result = await captured!.action(chiara, teams, noopLog);
      const updatedEnemy = result.enemyTeam.find((c) => c.instanceId === "enemy")!;
      expect(updatedEnemy.debuffs).toHaveLength(1);
      expect(updatedEnemy.debuffs[0].stat).toBe("atk");
      expect(updatedEnemy.debuffs[0].valuePercent).toBe(20);
      // 2 turns, not 1 (Tanveer, 2026-08-09).
      expect(updatedEnemy.debuffs[0].debuffDuration).toBe(2);
      // A passive-rolled debuff is an ordinary cancellable one, so Debuff
      // Immunity and cleanses can remove it.
      expect(updatedEnemy.debuffs[0].uncancellable).toBeFalsy();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("does not roll while benched (default-deny, no worksFromSub)", async () => {
    const chiara: BattleCharacter = {
      id: "chiara",
      name: "Chiara",
      color: "dark",
      atk: chiaraData.atk,
      def: chiaraData.def,
      hp: chiaraData.hp,
      skills: chiaraData.skills as unknown as [SkillCard, SkillCard],
      currentHP: chiaraData.hp,
      currentAttack: chiaraData.atk,
      currentDefense: chiaraData.def,
      ultGauge: 0,
      buffs: [],
      debuffs: [],
      passiveState: {},
      passive: chiaraData.passive as BattleCharacter["passive"],
      team: "player",
      instanceId: "chiara",
      isSub: true,
    } as BattleCharacter;

    let captured: QueueItem | null = null;
    registerCharacterPassives(chiara, (item) => {
      if (item.mechanicId.includes("(roll)")) captured = item;
    });
    expect(captured).not.toBeNull();

    const teams = { playerTeam: [chiara], enemyTeam: [] as BattleCharacter[] };
    const result = await captured!.action(chiara, teams, noopLog);
    const updatedChiara = result.playerTeam.find((c) => c.instanceId === "chiara")!;
    expect(updatedChiara.buffs).toHaveLength(0);
  });
});

describe("rankUpCharacterCards store action", () => {
  it("ranks up only the matching, non-ultimate, sub-max cards", async () => {
    const { useGameStore } = await import("@/store/gameStore");
    const skill: SkillCard = {
      skillName: "Marked Card",
      characterId: "chiara",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [260, 320, 400],
    };
    const ult: UltimateCard = {
      skillName: "All In",
      characterId: "chiara",
      type: "ultimate",
      statMultiplier: "atk",
      damage: 333,
    };
    useGameStore.setState({
      deck: [
        { id: "c1", sourceInstanceId: "chiara", skill, rank: 1 },
        { id: "c2", sourceInstanceId: "chiara", skill, rank: 3 },
        { id: "c3", sourceInstanceId: "chiara", skill: ult, rank: 1 },
        { id: "c4", sourceInstanceId: "other", skill, rank: 1 },
      ],
    });
    useGameStore.getState().rankUpCharacterCards("chiara", "player");
    const deck = useGameStore.getState().deck;
    expect(deck.find((c) => c.id === "c1")!.rank).toBe(2);
    expect(deck.find((c) => c.id === "c2")!.rank).toBe(3); // already max, unchanged
    expect(deck.find((c) => c.id === "c3")!.rank).toBe(1); // ultimate, untouched
    expect(deck.find((c) => c.id === "c4")!.rank).toBe(1); // different owner, untouched
  });
});

describe("Chiara/Isolde stat sanity (matches author_notes.md)", () => {
  it("Chiara", () => {
    expect(chiaraData.atk).toBe(191);
    expect(chiaraData.def).toBe(99);
    expect(chiaraData.hp).toBe(1100);
  });
  it("Isolde", () => {
    expect(isoldeData.atk).toBe(184);
    expect(isoldeData.def).toBe(77);
    expect(isoldeData.hp).toBe(1333);
  });
});

describe("Archive-page description rendering (the actual bug Tanveer caught)", () => {
  it("Chiara's Marked Card: word swaps 'lowers' -> 'greatly lowers' as the rank curve crosses tiers", async () => {
    const { buildRankedSkillDescriptions } = await import(
      "@/lib/game/descriptionTranslator"
    );
    const markedCard = chiaraData.skills[0] as never;
    const lines = buildRankedSkillDescriptions(markedCard);
    expect(lines[0]).toMatch(/\blowers DEF for 1 turns?\b/i);
    expect(lines[0]).not.toMatch(/greatly lowers/i);
    expect(lines[1]).toMatch(/\bgreatly lowers DEF for 1 turns?\b/i);
    expect(lines[2]).toMatch(/\bgreatly lowers DEF for 2 turns?\b/i);
  });

  it("Chiara's House Rules: R1 mentions neither seal, R2 only the active one, R3 both", async () => {
    const { buildRankedSkillDescriptions } = await import(
      "@/lib/game/descriptionTranslator"
    );
    const houseRules = chiaraData.skills[1] as never;
    const lines = buildRankedSkillDescriptions(houseRules);
    expect(lines[0]).not.toMatch(/seal/i);
    // "debuff" seal is still inactive at R2 — only "attack debuff" shows
    expect(lines[1]).not.toMatch(/seals debuff skills/i);
    expect(lines[1]).toMatch(/seals attack debuff skills for 1 turns?/i);
    expect(lines[2]).toMatch(/seals debuff skills for 2 turns?/i);
    expect(lines[2]).toMatch(/seals attack debuff skills for 2 turns?/i);
  });

  it("Isolde's Threads of Renewal: no inline HoT percentage, Rejuvenate is a bare glossary keyword", async () => {
    const { buildRankedSkillDescriptions } = await import(
      "@/lib/game/descriptionTranslator"
    );
    const threadsOfRenewal = isoldeData.skills[0] as never;
    const lines = buildRankedSkillDescriptions(threadsOfRenewal);
    for (const line of lines) {
      expect(line).not.toMatch(/30%\s*of\s*heal/i);
      expect(line).toMatch(/\bRejuvenate\b/);
    }
    expect(lines[0]).toMatch(/\bone ally\b/i);
    expect(lines[1]).toMatch(/\ballies\b/i);
    expect(lines[2]).toMatch(/\ballies\b/i);
  });

  it("Isolde's heal scales up by rank like every other stat-scaled skill (not flat)", () => {
    expect(isoldeData.skills[0].damageRanked).toEqual([20, 25, 30]);
  });

  it("Rejuvenate resolves to the correct HoT explanation via the shared glossary", async () => {
    const { mechanicGlossary } = await import("@/lib/game/mechanicGlossary");
    expect(mechanicGlossary.rejuvenate).toMatch(/30%/);
    expect(mechanicGlossary.rejuvenate).toMatch(/heal/i);
  });
});

describe("Starbound Ward is buff-only (2026-08-09)", () => {
  const supportUlt: UltimateCard = {
    skillName: "Starbound Ward",
    characterId: "isolde",
    type: "ultimate",
    statMultiplier: "atk",
    damage: 0,
    mechanics: [
      { type: "debuffImmunity", duration: 3 },
      { type: "buff", stat: "all", valuePercent: 30, duration: 3 },
      { type: "aoe" },
    ],
  };

  it("deals no damage to the enemy team", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const ally = makeChar({ instanceId: "ally", team: "player" });
    const foe = makeChar({
      instanceId: "foe",
      team: "enemy",
      hp: 1000,
      currentHP: 1000,
    });
    const result = executeSkill(
      { sourceInstanceId: "isolde", skill: supportUlt, targetInstanceId: "ally" },
      { playerTeam: [isolde, ally], enemyTeam: [foe] },
      noopLog,
    );
    // Previously every ultimate ran an attack pass, so this landed a floored
    // 1 damage on each enemy before buffing.
    expect(result.enemyTeam[0].currentHP).toBe(1000);
  });

  it("still buffs the caster's own team", () => {
    const isolde = makeChar({ instanceId: "isolde", team: "player" });
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      hp: 1000,
      currentHP: 1000,
    });
    const result = executeSkill(
      { sourceInstanceId: "isolde", skill: supportUlt, targetInstanceId: "ally" },
      { playerTeam: [isolde, ally], enemyTeam: [] },
      noopLog,
    );
    const buffed = result.playerTeam.find((c) => c.instanceId === "ally")!;
    expect(buffed.hp).toBe(1300);
    expect(buffed.currentHP).toBe(1300);
  });

  it("leaves a damage-dealing ultimate attacking as authored", () => {
    // Chiara's All In buffs herself and then hits everyone — the zero-damage
    // requirement is what keeps it hostile.
    const chiara = makeChar({ instanceId: "chiara", team: "player", atk: 100 });
    const foe = makeChar({
      instanceId: "foe",
      team: "enemy",
      hp: 5000,
      currentHP: 5000,
      def: 0,
    });
    const allIn: UltimateCard = {
      skillName: "All In",
      characterId: "chiara",
      type: "ultimate",
      statMultiplier: "atk",
      damage: 333,
      mechanics: [
        { type: "buff", stat: "atk", valuePercent: 30, duration: 3, targetSelf: true },
        { type: "aoe" },
      ],
    };
    const result = executeSkill(
      { sourceInstanceId: "chiara", skill: allIn, targetInstanceId: "foe" },
      { playerTeam: [chiara], enemyTeam: [foe] },
      noopLog,
    );
    expect(result.enemyTeam[0].currentHP).toBeLessThan(5000);
  });
});
