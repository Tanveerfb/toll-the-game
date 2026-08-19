import { beforeEach, describe, expect, it } from "vitest";
import { isSingleAllyTarget, useGameStore } from "@/store/gameStore";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { ActionCard } from "@/types/action";
import type { SkillCard } from "@/types/skillCard";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import leorioData from "@/data/characters/leorio.json";
import isoldeData from "@/data/characters/isolde.json";

const zodiacSkill = leorioData.skills[0] as unknown as SkillCard;

function makeChar(
  overrides: Partial<BattleCharacter> & { instanceId: string },
): BattleCharacter {
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "red",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [zodiacSkill, zodiacSkill] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...overrides,
  } as BattleCharacter;
}

function makeCard(rank: 1 | 2 | 3): ActionCard {
  return {
    id: `card-${rank}`,
    sourceInstanceId: "leorio",
    skill: zodiacSkill,
    rank,
  } as ActionCard;
}

beforeEach(() => {
  useGameStore.getState().resetBattle();
});

describe("single-ally targeting (Leorio's Member of the Zodiac)", () => {
  it("rank 1 is single-ally-target; rank 2+ is not (aoeRanked active)", () => {
    expect(isSingleAllyTarget(makeCard(1))).toBe(true);
    expect(isSingleAllyTarget(makeCard(2))).toBe(false);
    expect(isSingleAllyTarget(makeCard(3))).toBe(false);
  });

  it("selecting a rank-1 card opens the ally chooser instead of queuing", () => {
    useGameStore.setState({
      playerTeam: [makeChar({ instanceId: "leorio" }), makeChar({ instanceId: "ally" })],
      enemyTeam: [makeChar({ instanceId: "enemy", team: "enemy" })],
      deck: [makeCard(1)],
      battlePhase: "PlayerAction",
    });
    useGameStore.getState().selectCard("card-1");
    const state = useGameStore.getState();
    expect(state.actionQueue).toHaveLength(0);
    expect(state.pendingAllyCardId).toBe("card-1");
  });

  it("confirmAllyTarget queues the pending card against the chosen ally (caster included)", () => {
    useGameStore.setState({
      playerTeam: [makeChar({ instanceId: "leorio" }), makeChar({ instanceId: "ally" })],
      enemyTeam: [makeChar({ instanceId: "enemy", team: "enemy" })],
      deck: [makeCard(1)],
      battlePhase: "PlayerAction",
    });
    useGameStore.getState().selectCard("card-1");
    useGameStore.getState().confirmAllyTarget("ally");
    const state = useGameStore.getState();
    expect(state.pendingAllyCardId).toBeNull();
    expect(state.actionQueue[0]?.targetInstanceId).toBe("ally");
  });

  it("cancelAllyTarget dismisses the chooser and leaves the card in the deck", () => {
    useGameStore.setState({
      playerTeam: [makeChar({ instanceId: "leorio" }), makeChar({ instanceId: "ally" })],
      enemyTeam: [makeChar({ instanceId: "enemy", team: "enemy" })],
      deck: [makeCard(1)],
      battlePhase: "PlayerAction",
    });
    useGameStore.getState().selectCard("card-1");
    useGameStore.getState().cancelAllyTarget();
    const state = useGameStore.getState();
    expect(state.pendingAllyCardId).toBeNull();
    expect(state.actionQueue).toHaveLength(0);
    expect(state.deck).toHaveLength(1);
  });

  it("rank-2 card (all allies) queues without any ally marker", () => {
    useGameStore.setState({
      playerTeam: [makeChar({ instanceId: "leorio" })],
      enemyTeam: [makeChar({ instanceId: "enemy", team: "enemy" })],
      deck: [makeCard(2)],
      battlePhase: "PlayerAction",
    });
    useGameStore.getState().selectCard("card-2");
    expect(useGameStore.getState().actionQueue).toHaveLength(1);
  });

  it("does not repeat a target an ally-facing description already names", () => {
    // Ruling: "Grants all allies … to all allies" said it twice — the target
    // guard only recognised enemy phrasings (Tanveer, 2026-08-10).
    const ward = isoldeData.ultimate as unknown as CharacterSkillData;
    // Index 2 = ult level 3, the level Debuff Immunity first appears at
    // (minUltLevel 3) and where the buff runs 30% for 2 turns.
    const text = buildDescriptionForRank(ward, 2);
    expect(text).toBe(
      "Grants all allies Debuff Immunity and increases their basic stats by 30% for 2 turns.",
    );
    expect(text.match(/all allies/g)).toHaveLength(1);

    // The guard has to hold on the OTHER branch too. Below UL3 the immunity
    // clause is gone entirely (2026-08-19), so the sentence is rebuilt from a
    // different opening — and that opening names the target just as much.
    const low = buildDescriptionForRank(ward, 0);
    expect(low).toBe("Increases all allies' basic stats by 20% for 2 turns.");
    expect(low).not.toContain("Debuff Immunity");
    expect(low.match(/all allies/g)).toHaveLength(1);
  });

  it("description reads single-target at rank 1, all allies at rank 2+", () => {
    const skill = zodiacSkill as unknown as CharacterSkillData;
    const r1 = buildDescriptionForRank(skill, 0);
    expect(r1).toContain("one chosen ally");
    expect(r1).toContain("20% for 1 turn");
    const r3 = buildDescriptionForRank(skill, 2);
    expect(r3).toContain("all allies");
    expect(r3).toContain("50% for 2 turns");
  });
});

describe("a buff never lands on the unit being attacked", () => {
  /**
   * An attack's targets are the enemy team, and the buff branch used to check
   * only `!mech.targetSelf` — so a buff authored for the caster's allies was
   * applied to the enemy the skill had just hit. Its three sibling branches
   * (cleanse, debuffImmunity, healOverTime) all guarded on `isHealOrBuff`;
   * this one did not.
   *
   * Found 2026-08-20 while mapping a Dokkan kit that buffs allies and damages
   * an enemy in one card. No shipped kit reached it — all four non-self buffs
   * in the roster sit on zero-damage support skills — so the fix is inert for
   * the current roster and stops the trap for the next author.
   */
  const mk = (id: string, team: "player" | "enemy") =>
    ({
      id, instanceId: id, name: id, team, color: "blue",
      atk: 200, def: 50, hp: 3000, currentHP: 3000,
      currentAttack: 200, currentDefense: 50, ultGauge: 0,
      buffs: [], debuffs: [], passiveState: {}, lifestealPercent: 0,
    }) as unknown as BattleCharacter;

  it("an attacking skill's non-self buff reaches nobody, least of all the enemy", () => {
    const skill = {
      skillName: "Test", characterId: "a", type: "attack",
      statMultiplier: "atk", damageRanked: [200, 200, 200],
      mechanics: [
        { type: "buff", stat: "atk", valuePercent: 50, targetSelf: true },
        { type: "buff", stat: "def", valuePercent: 60, duration: 1 },
      ],
    } as unknown as CharacterSkillData;

    const result = executeSkill(
      {
        sourceInstanceId: "caster",
        skill: skill as never,
        targetInstanceId: "foe",
        rank: 1,
      },
      {
        playerTeam: [mk("caster", "player"), mk("ally", "player")],
        enemyTeam: [mk("foe", "enemy")],
      },
      () => {},
    );

    // The self-buff still lands — that half was always correct.
    expect(result.playerTeam[0].buffs).toHaveLength(1);
    expect(result.playerTeam[0].buffs[0].stat).toBe("atk");
    // And the enemy is not handed a 60% DEF buff by the card that hit it.
    expect(result.enemyTeam[0].buffs).toEqual([]);
    expect(result.playerTeam[1].buffs).toEqual([]);
  });
});
