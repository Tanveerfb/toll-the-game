import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/store/gameStore";
import type { BattleCharacter } from "@/types/character";
import type { ActionCard } from "@/types/action";
import type { SkillCard } from "@/types/skillCard";
import leorioData from "@/data/characters/leorio.json";

/**
 * `mergeAllCards` end to end through the store.
 *
 * `tests/mergeAll.test.ts` proves the pure pass; this proves the three things
 * only the store does — it writes the merged hand back, it banks one ult gauge
 * point per merge against the right unit, and it says so. The gauge half is the
 * reason Merge All is a button rather than an automatic toggle, so it is worth
 * holding down rather than trusting the wrapper to stay thin.
 */
const skill = leorioData.skills[0] as unknown as SkillCard;

function makeChar(instanceId: string, ultGauge = 0): BattleCharacter {
  return {
    id: instanceId,
    name: instanceId,
    color: "red",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [skill, skill] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    instanceId,
  } as unknown as BattleCharacter;
}

function makeCard(id: string, owner: string, rank: 1 | 2 | 3): ActionCard {
  return { id, sourceInstanceId: owner, skill, rank } as ActionCard;
}

beforeEach(() => {
  useGameStore.getState().resetBattle();
});

describe("mergeAllCards", () => {
  it("settles a non-adjacent pair and banks the gauge on its owner", () => {
    useGameStore.setState({
      playerTeam: [makeChar("a"), makeChar("b")],
      deck: [
        makeCard("a1", "a", 1),
        makeCard("b1", "b", 1),
        makeCard("a2", "a", 1),
      ],
    });

    useGameStore.getState().mergeAllCards();
    const state = useGameStore.getState();

    expect(state.deck).toHaveLength(2);
    expect(state.deck.find((c) => c.sourceInstanceId === "a")?.rank).toBe(2);
    expect(
      state.playerTeam.find((c) => c.instanceId === "a")?.ultGauge,
    ).toBe(1);
    // The bystander's gauge must not move.
    expect(
      state.playerTeam.find((c) => c.instanceId === "b")?.ultGauge,
    ).toBe(0);
  });

  it("three identical cards leave one behind, and bank exactly one point", () => {
    // Tanveer's stated rule, held at the level the player actually meets it.
    useGameStore.setState({
      playerTeam: [makeChar("a")],
      deck: [
        makeCard("a1", "a", 1),
        makeCard("a2", "a", 1),
        makeCard("a3", "a", 1),
      ],
    });

    useGameStore.getState().mergeAllCards();
    const state = useGameStore.getState();

    expect(state.deck.map((c) => c.rank).sort()).toEqual([1, 2]);
    expect(state.playerTeam[0].ultGauge).toBe(1);
  });

  it("a four-card cascade banks three points and lands on R3", () => {
    useGameStore.setState({
      playerTeam: [makeChar("a")],
      deck: ["a1", "a2", "a3", "a4"].map((id) => makeCard(id, "a", 1)),
    });

    useGameStore.getState().mergeAllCards();
    const state = useGameStore.getState();

    expect(state.deck).toHaveLength(1);
    expect(state.deck[0].rank).toBe(3);
    expect(state.playerTeam[0].ultGauge).toBe(3);
  });

  it("changes nothing and says so when no pair can merge", () => {
    const deck = [makeCard("a1", "a", 1), makeCard("b1", "b", 1)];
    useGameStore.setState({
      playerTeam: [makeChar("a", 2), makeChar("b", 2)],
      deck,
    });

    useGameStore.getState().mergeAllCards();
    const state = useGameStore.getState();

    expect(state.deck).toEqual(deck);
    expect(state.playerTeam.map((c) => c.ultGauge)).toEqual([2, 2]);
    expect(state.interactionNotice).toMatch(/nothing/i);
  });

  it("never pushes a gauge past its maximum", () => {
    // `ultGaugeMax` defaults to 5; a cascade must clamp rather than overflow.
    useGameStore.setState({
      playerTeam: [makeChar("a", 5)],
      deck: ["a1", "a2", "a3", "a4"].map((id) => makeCard(id, "a", 1)),
    });

    useGameStore.getState().mergeAllCards();
    expect(useGameStore.getState().playerTeam[0].ultGauge).toBe(5);
  });
});
