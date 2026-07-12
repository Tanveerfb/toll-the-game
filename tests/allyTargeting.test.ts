import { beforeEach, describe, expect, it } from "vitest";
import { isSingleAllyTarget, useGameStore } from "@/store/gameStore";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
import type { BattleCharacter } from "@/types/character";
import type { ActionCard } from "@/types/action";
import type { SkillCard } from "@/types/skillCard";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import leorioData from "@/data/characters/leorio.json";

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

  it("description reads single-target at rank 1, all allies at rank 2+", () => {
    const skill = zodiacSkill as unknown as CharacterSkillData;
    const r1 = buildDescriptionForRank(skill, 0);
    expect(r1).toContain("one chosen ally");
    expect(r1).toContain("15% for 1 turn");
    const r3 = buildDescriptionForRank(skill, 2);
    expect(r3).toContain("all allies");
    expect(r3).toContain("40% for 2 turn");
  });
});
