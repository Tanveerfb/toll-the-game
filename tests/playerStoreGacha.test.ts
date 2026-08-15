import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/store/playerStore";
import * as bannersModule from "@/lib/gacha/banners";
import { getGemBanner } from "@/lib/gacha/banners";
import {
  LIMITED_MILESTONE_FINAL,
  LIMITED_MILESTONE_FIRST,
  PERMANENT_MILESTONE_FINAL,
} from "@/lib/gacha/milestone";

// getTicketBanner is wrapped in a vi.fn (delegating to the real
// implementation by default) so individual tests can point it at a fixed
// non-empty pool without touching real character data (Task 1's
// `permanentPool` flag isn't set on any shipped character yet). Tests that
// don't override it exercise the real, currently-empty pool.
vi.mock("@/lib/gacha/banners", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gacha/banners")>();
  return { ...actual, getTicketBanner: vi.fn(actual.getTicketBanner) };
});

function resetToKnownState() {
  // Default: no character flagged `permanentPool` yet, matching real, current
  // character data — same as the un-mocked getTicketBanner would return.
  // Tests that need a populated pool call mockPermanentPool(...) afterward.
  vi.mocked(bannersModule.getTicketBanner).mockReturnValue({ id: "permanent", featured: [] });
  usePlayerStore.setState({
    uid: null,
    roster: ["duke"],
    currencies: { gems: 100, coin: 0, permanentTicket: 100 },
    inventory: {},
    characters: {},
    stamina: { current: 120, updatedAt: Date.now() },
    pity: {
      limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      permanent: { bar: 0, claimedFinal: false },
    },
    hasHydrated: true,
  });
}

/** Points the mocked getTicketBanner at a fixed, non-empty pool for a
 *  single test — the real permanent pool is empty until a character is
 *  hand-flagged `permanentPool: true` (Task 1), which hasn't happened yet. */
function mockPermanentPool(featured: string[]) {
  vi.mocked(bannersModule.getTicketBanner).mockReturnValue({ id: "permanent", featured });
}

describe("pullLimited", () => {
  beforeEach(resetToKnownState);

  it("refuses a single pull when gems are insufficient", () => {
    usePlayerStore.setState({ currencies: { gems: 4, coin: 0, permanentTicket: 0 } });
    expect(usePlayerStore.getState().pullLimited(1)).toBe(false);
  });

  it("deducts 5 gems for a single pull and advances the bar 1:1", () => {
    const results = usePlayerStore.getState().pullLimited(1);
    expect(results).not.toBe(false);
    expect(usePlayerStore.getState().currencies.gems).toBe(95);
    expect(usePlayerStore.getState().pity.limited.bar).toBe(5);
    expect(usePlayerStore.getState().pity.limited.bannerId).toBe("debut-2026-08");
  });

  it("deducts 50 gems for an 11-pull and returns 11 results", () => {
    const results = usePlayerStore.getState().pullLimited(11);
    expect(results).not.toBe(false);
    expect(results && results.length).toBe(11);
    expect(usePlayerStore.getState().currencies.gems).toBe(50);
    expect(usePlayerStore.getState().pity.limited.bar).toBe(50);
  });

  it("a character-hit on an already-owned character pays that character a coin", () => {
    // A constant Math.random mock forces both the hit-check and the
    // featured-index pick to the same value; 0 hits and picks index 0
    // ("duke"), who's already owned (starter) — a real, well-defined dupe
    // case. Landing on a *new* character is already covered at the unit
    // level by rollLimitedPull (Task 3) and resolvePullResult (Task 5); this
    // test only needs to prove the store wiring applies a dupe correctly.
    vi.spyOn(Math, "random").mockReturnValue(0);
    usePlayerStore.getState().pullLimited(1);
    // A dupe no longer touches ultLevel — it banks a coin the player spends
    // when they choose to (Tanveer, 2026-08-14).
    expect(usePlayerStore.getState().characters.duke?.ultLevel ?? 1).toBe(1);
    expect(usePlayerStore.getState().inventory.blue_duke_coin).toBe(1);
    vi.restoreAllMocks();
  });

  it("a coin-miss result adds to the coin currency", () => {
    // rng=0.1: miss (0.1 >= 0.05 rate), missRoll reuses 0.1 which lands in
    // the first third → coin category.
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    usePlayerStore.getState().pullLimited(1);
    expect(usePlayerStore.getState().currencies.coin).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});

describe("pullPermanent", () => {
  beforeEach(resetToKnownState);

  it("refuses when the permanent pool is empty (no character flagged yet)", () => {
    expect(usePlayerStore.getState().pullPermanent(1)).toBe(false);
  });

  it("refuses when tickets are insufficient even with a non-empty pool", () => {
    usePlayerStore.setState({ currencies: { gems: 0, coin: 0, permanentTicket: 0 } });
    expect(usePlayerStore.getState().pullPermanent(1)).toBe(false);
  });

  it("deducts 1 ticket for a single pull, grants a character, and advances the permanent bar", () => {
    mockPermanentPool(["duke", "sara"]);
    const results = usePlayerStore.getState().pullPermanent(1);
    expect(results).not.toBe(false);
    expect(results && results.length).toBe(1);
    expect(usePlayerStore.getState().currencies.permanentTicket).toBe(99);
    expect(usePlayerStore.getState().pity.permanent.bar).toBe(1);
  });

  it("deducts 10 tickets for an 11-pull and returns 11 results", () => {
    // Same "11 rolls, 10x cost" pricing as pullLimited's 11-pull (the 11th
    // roll is the free bonus pull) — see PERMANENT_TICKET_COST in lib/gacha/cost.ts.
    mockPermanentPool(["duke", "sara"]);
    const results = usePlayerStore.getState().pullPermanent(11);
    expect(results).not.toBe(false);
    expect(results && results.length).toBe(11);
    expect(usePlayerStore.getState().currencies.permanentTicket).toBe(90);
    expect(usePlayerStore.getState().pity.permanent.bar).toBe(10);
  });
});

/** Puts the bar somewhere without touching the claim flags. */
function setBar(bar: number) {
  usePlayerStore.setState((s) => ({
    pity: { ...s.pity, limited: { ...s.pity.limited, bar } },
  }));
}

describe("claimLimitedFirst", () => {
  beforeEach(resetToKnownState);

  it("refuses below the first threshold", () => {
    expect(usePlayerStore.getState().claimLimitedFirst()).toBe(false);
  });

  it("grants a random character and marks it taken", () => {
    setBar(LIMITED_MILESTONE_FIRST);
    const result = usePlayerStore.getState().claimLimitedFirst();
    expect(result).not.toBe(false);
    expect(usePlayerStore.getState().pity.limited.claimedFirst).toBe(true);
  });

  it("rolls from the banner's featured units, not the whole roster", () => {
    // The two milestones differ only in who chooses — the first rolls a
    // featured unit for you, the final lets you pick one. It used to draw
    // from every playable character in the game (Tanveer, 2026-08-11).
    const featured = new Set(getGemBanner().featured);
    // Every seat in the pool, so a bad pool choice can't slip through on luck.
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      resetToKnownState();
      setBar(LIMITED_MILESTONE_FIRST);
      vi.spyOn(Math, "random").mockReturnValue(roll);
      const result = usePlayerStore.getState().claimLimitedFirst();
      vi.restoreAllMocks();
      expect(result).not.toBe(false);
      if (result && result.kind === "character") {
        expect(featured.has(result.characterId)).toBe(true);
      }
    }
  });

  it("refuses a second claim in the same lap", () => {
    setBar(LIMITED_MILESTONE_FIRST);
    usePlayerStore.getState().claimLimitedFirst();
    expect(usePlayerStore.getState().claimLimitedFirst()).toBe(false);
  });

  it("stays claimable past the final threshold", () => {
    // The ruling: the final milestone does not override the first.
    setBar(LIMITED_MILESTONE_FINAL + 200);
    expect(usePlayerStore.getState().claimLimitedFirst()).not.toBe(false);
  });
});

describe("claimLimitedFinal", () => {
  beforeEach(resetToKnownState);

  it("refuses below the final threshold", () => {
    expect(usePlayerStore.getState().claimLimitedFinal("duke")).toBe(false);
  });

  it("refuses a character not featured on the current banner", () => {
    setBar(LIMITED_MILESTONE_FINAL);
    expect(usePlayerStore.getState().claimLimitedFinal("meliodas")).toBe(false);
  });

  it("grants the pick but does NOT wrap the lap while the first is unclaimed", () => {
    // This is the behaviour that changed. Claiming the final milestone used to
    // reset the bar to 0 and clear the flags, destroying an unclaimed first
    // reward outright.
    setBar(LIMITED_MILESTONE_FINAL);
    const result = usePlayerStore.getState().claimLimitedFinal("sara");
    expect(result).not.toBe(false);
    expect(usePlayerStore.getState().roster).toContain("sara");
    expect(usePlayerStore.getState().pity.limited.bar).toBe(
      LIMITED_MILESTONE_FINAL,
    );
    expect(usePlayerStore.getState().pity.limited.claimedFinal).toBe(true);
    // Still there for the taking.
    expect(usePlayerStore.getState().claimLimitedFirst()).not.toBe(false);
  });

  it("wraps the lap once both rewards have been taken, in either order", () => {
    setBar(LIMITED_MILESTONE_FINAL);
    usePlayerStore.getState().claimLimitedFinal("sara");
    usePlayerStore.getState().claimLimitedFirst();
    const pity = usePlayerStore.getState().pity.limited;
    expect(pity.bar).toBe(0);
    expect(pity.claimedFirst).toBe(false);
    expect(pity.claimedFinal).toBe(false);
  });

  it("reports whether the pick was new or a dupe", () => {
    // "duke" is the starter, so this is a guaranteed dupe.
    setBar(LIMITED_MILESTONE_FINAL);
    const result = usePlayerStore.getState().claimLimitedFinal("duke");
    expect(result).toMatchObject({ isNew: false, coinId: "blue_duke_coin" });
  });
});

describe("claimPermanentFinal", () => {
  beforeEach(resetToKnownState);

  it("refuses below the threshold", () => {
    mockPermanentPool(["duke"]);
    expect(usePlayerStore.getState().claimPermanentFinal("duke")).toBe(false);
  });

  it("refuses a character not in the permanent pool", () => {
    usePlayerStore.setState((s) => ({
      pity: { ...s.pity, permanent: { bar: PERMANENT_MILESTONE_FINAL, claimedFinal: false } },
    }));
    expect(usePlayerStore.getState().claimPermanentFinal("duke")).toBe(false);
  });

  it("grants the pick and wraps — permanent has only the one reward", () => {
    mockPermanentPool(["duke", "sara"]);
    usePlayerStore.setState((s) => ({
      pity: { ...s.pity, permanent: { bar: PERMANENT_MILESTONE_FINAL, claimedFinal: false } },
    }));
    const result = usePlayerStore.getState().claimPermanentFinal("duke");
    expect(result).not.toBe(false);
    expect(usePlayerStore.getState().pity.permanent.bar).toBe(0);
    expect(usePlayerStore.getState().pity.permanent.claimedFinal).toBe(false);
  });
});
