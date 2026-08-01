import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/store/playerStore";

function resetToKnownState() {
  usePlayerStore.setState({
    uid: null,
    roster: ["duke"],
    currencies: { gems: 1000, coin: 100000 },
    inventory: {
      sea_monster_eye: 5,
      corroded_seaweed: 20,
      training_manual: 3,
    },
    characters: {},
    stamina: { current: 120, updatedAt: Date.now() },
    pity: { standard: 0, limited: 0 },
    hasHydrated: true,
  });
}

describe("feedManualToCharacter", () => {
  beforeEach(resetToKnownState);

  it("refuses when no manual of that tier is owned", () => {
    usePlayerStore.setState({ inventory: { training_manual: 0 } });
    const ok = usePlayerStore.getState().feedManualToCharacter("duke", "training_manual");
    expect(ok).toBe(false);
  });

  it("refuses when the character is at ascension 0 (maxLevel 1, already at floor)", () => {
    const ok = usePlayerStore.getState().feedManualToCharacter("duke", "training_manual");
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().inventory.training_manual).toBe(3);
    expect(usePlayerStore.getState().currencies.coin).toBe(100000);
  });

  it("levels up, deducts one manual and the coin cost, once ascended past 0", () => {
    usePlayerStore.setState({ characters: { duke: { level: 1, ascension: 1, xp: 0 } } });
    const ok = usePlayerStore.getState().feedManualToCharacter("duke", "training_manual");
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().characters.duke).toEqual({ level: 2, ascension: 1, xp: 0 });
    expect(usePlayerStore.getState().inventory.training_manual).toBe(2);
    expect(usePlayerStore.getState().currencies.coin).toBe(100000 - 200);
  });

  it("refuses when coin is insufficient even if the manual is owned", () => {
    usePlayerStore.setState({
      characters: { duke: { level: 1, ascension: 1, xp: 0 } },
      currencies: { gems: 0, coin: 50 },
    });
    const ok = usePlayerStore.getState().feedManualToCharacter("duke", "training_manual");
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().inventory.training_manual).toBe(3);
    expect(usePlayerStore.getState().characters.duke).toEqual({ level: 1, ascension: 1, xp: 0 });
    expect(usePlayerStore.getState().currencies.coin).toBe(50);
  });
});

describe("ascendCharacter", () => {
  beforeEach(resetToKnownState);

  it("ascends from 0 to 1, deducting the exact Band 1 cost", () => {
    const ok = usePlayerStore.getState().ascendCharacter("duke");
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().characters.duke.ascension).toBe(1);
    expect(usePlayerStore.getState().inventory.sea_monster_eye).toBe(2);
    expect(usePlayerStore.getState().inventory.corroded_seaweed).toBe(10);
    expect(usePlayerStore.getState().currencies.coin).toBe(90000);
  });

  it("refuses when materials are insufficient, spending nothing", () => {
    usePlayerStore.setState({ inventory: { sea_monster_eye: 1, corroded_seaweed: 20, training_manual: 3 } });
    const ok = usePlayerStore.getState().ascendCharacter("duke");
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().inventory.sea_monster_eye).toBe(1);
    expect(usePlayerStore.getState().currencies.coin).toBe(100000);
  });

  it("refuses past band 3 (no cost table entry for ascension 4)", () => {
    usePlayerStore.setState({ characters: { duke: { level: 40, ascension: 3, xp: 0 } } });
    const ok = usePlayerStore.getState().ascendCharacter("duke");
    expect(ok).toBe(false);
  });
});

describe("grantWorldBossRewards", () => {
  beforeEach(resetToKnownState);

  it("adds materials and coin to the existing totals", () => {
    usePlayerStore.getState().grantWorldBossRewards({
      sea_monster_eye: 2,
      corroded_seaweed: 3,
      training_manual: 4,
      coin: 5000,
    });
    const state = usePlayerStore.getState();
    expect(state.inventory.sea_monster_eye).toBe(7);
    expect(state.inventory.corroded_seaweed).toBe(23);
    expect(state.inventory.training_manual).toBe(7);
    expect(state.currencies.coin).toBe(105000);
  });
});
