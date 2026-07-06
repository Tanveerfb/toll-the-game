import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/store/gameStore";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

const skillA: SkillCard = {
  skillName: "Alpha",
  characterId: "unit",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 150, 200],
};

const skillB: SkillCard = {
  skillName: "Beta",
  characterId: "unit",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 150, 200],
};

const ult: UltimateCard = {
  skillName: "Omega",
  characterId: "unit",
  type: "ultimate",
  statMultiplier: "atk",
  damage: 300,
};

function makeChar(
  overrides: Partial<BattleCharacter> & { instanceId: string },
): BattleCharacter {
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [skillA, skillB] as [SkillCard, SkillCard],
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

beforeEach(() => {
  useGameStore.getState().resetBattle();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deck flow (7DS GC draw behavior)", () => {
  it("initializeDeck loads each field unit's cards; subs excluded", () => {
    useGameStore.setState({
      playerTeam: [
        makeChar({ instanceId: "field" }),
        makeChar({ instanceId: "bench", isSub: true }),
      ],
    });
    useGameStore.getState().initializeDeck();
    const deck = useGameStore.getState().deck;
    expect(deck).toHaveLength(2);
    expect(deck.every((c) => c.sourceInstanceId === "field")).toBe(true);
  });

  it("drawCards refills to capacity without resetting existing cards", () => {
    const unit = makeChar({ instanceId: "unit" });
    useGameStore.setState({
      playerTeam: [unit],
      deck: [
        {
          id: "keep",
          sourceInstanceId: "unit",
          skill: skillB,
          rank: 3, // rank 3 can't merge — must survive untouched
        },
      ],
    });
    useGameStore.getState().drawCards();
    const deck = useGameStore.getState().deck;
    // capacity for 1 field character is 4
    expect(deck).toHaveLength(4);
    expect(deck.some((c) => c.id === "keep" && c.rank === 3)).toBe(true);
  });

  it("auto-merges adjacent identical draws and grants +1 ult gauge per merge", () => {
    // Force every random pick to skill A so merges are guaranteed
    vi.spyOn(Math, "random").mockReturnValue(0);
    const unit = makeChar({ instanceId: "unit" });
    useGameStore.setState({ playerTeam: [unit], deck: [] });
    useGameStore.getState().drawCards();

    const state = useGameStore.getState();
    expect(state.deck).toHaveLength(4); // filled to capacity despite merges
    expect(state.deck.every((c) => c.skill.skillName === "Alpha")).toBe(true);
    expect(state.deck.some((c) => c.rank > 1)).toBe(true); // merges happened
    expect(state.playerTeam[0].ultGauge).toBeGreaterThan(0); // gauge granted
  });

  it("a gauge filled by mid-refill merges does NOT draw the ultimate in the same refill", () => {
    // Every random pick is skill A → merges cascade and fill the gauge
    vi.spyOn(Math, "random").mockReturnValue(0);
    const unit = makeChar({
      instanceId: "unit",
      ultGauge: 4, // one merge away from full
      ultimate: ult,
    });
    useGameStore.setState({ playerTeam: [unit], deck: [] });
    useGameStore.getState().drawCards();

    const state = useGameStore.getState();
    expect(state.playerTeam[0].ultGauge).toBe(5); // merges filled it
    // ...but the ultimate only becomes guaranteed on the NEXT turn's draw
    expect(state.deck.some((c) => c.skill.type === "ultimate")).toBe(false);
  });

  it("guarantees the ultimate card when gauge is full (one copy max)", () => {
    const unit = makeChar({ instanceId: "unit", ultGauge: 5, ultimate: ult });
    useGameStore.setState({ playerTeam: [unit], deck: [] });
    useGameStore.getState().drawCards();

    const ults = useGameStore
      .getState()
      .deck.filter((c) => c.skill.type === "ultimate");
    expect(ults).toHaveLength(1);
  });

  it("fills the hand from a freshly promoted sub's cards after a field wipe", () => {
    // Field dead, sub just promoted (isSub now false)
    useGameStore.setState({
      playerTeam: [
        makeChar({ instanceId: "dead", currentHP: 0 }),
        makeChar({ instanceId: "promoted" }),
      ],
      deck: [],
    });
    useGameStore.getState().drawCards();
    const deck = useGameStore.getState().deck;
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((c) => c.sourceInstanceId === "promoted")).toBe(true);
  });
});
