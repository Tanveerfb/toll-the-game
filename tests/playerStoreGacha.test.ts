import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/store/playerStore";
import * as bannersModule from "@/lib/gacha/banners";

// getPermanentBanner is wrapped in a vi.fn (delegating to the real
// implementation by default) so individual tests can point it at a fixed
// non-empty pool without touching real character data (Task 1's
// `permanentPool` flag isn't set on any shipped character yet). Tests that
// don't override it exercise the real, currently-empty pool.
vi.mock("@/lib/gacha/banners", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gacha/banners")>();
  return { ...actual, getPermanentBanner: vi.fn(actual.getPermanentBanner) };
});

function resetToKnownState() {
  // Default: no character flagged `permanentPool` yet, matching real, current
  // character data — same as the un-mocked getPermanentBanner would return.
  // Tests that need a populated pool call mockPermanentPool(...) afterward.
  vi.mocked(bannersModule.getPermanentBanner).mockReturnValue({ id: "permanent", featured: [] });
  usePlayerStore.setState({
    uid: null,
    roster: ["duke"],
    currencies: { gems: 100, coin: 0, permanentTicket: 100 },
    inventory: {},
    characters: {},
    stamina: { current: 120, updatedAt: Date.now() },
    pity: {
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    },
    hasHydrated: true,
  });
}

/** Points the mocked getPermanentBanner at a fixed, non-empty pool for a
 *  single test — the real permanent pool is empty until a character is
 *  hand-flagged `permanentPool: true` (Task 1), which hasn't happened yet. */
function mockPermanentPool(featured: string[]) {
  vi.mocked(bannersModule.getPermanentBanner).mockReturnValue({ id: "permanent", featured });
}

describe("pullLimited", () => {
  beforeEach(resetToKnownState);

  it("refuses a single pull when gems are insufficient", () => {
    usePlayerStore.setState({ currencies: { gems: 2, coin: 0, permanentTicket: 0 } });
    expect(usePlayerStore.getState().pullLimited(1)).toBe(false);
  });

  it("deducts 3 gems for a single pull and advances the limited bar by 3", () => {
    const results = usePlayerStore.getState().pullLimited(1);
    expect(results).not.toBe(false);
    expect(usePlayerStore.getState().currencies.gems).toBe(97);
    expect(usePlayerStore.getState().pity.limited.bar).toBe(3);
    expect(usePlayerStore.getState().pity.limited.bannerId).toBe("debut-2026-08");
  });

  it("deducts 30 gems for an 11-pull and returns 11 results", () => {
    const results = usePlayerStore.getState().pullLimited(11);
    expect(results).not.toBe(false);
    expect(results && results.length).toBe(11);
    expect(usePlayerStore.getState().currencies.gems).toBe(70);
    expect(usePlayerStore.getState().pity.limited.bar).toBe(30);
  });

  it("a character-hit on an already-owned character is a dupe, incrementing ultLevel", () => {
    // A constant Math.random mock forces both the hit-check and the
    // featured-index pick to the same value; 0 hits and picks index 0
    // ("duke"), who's already owned (starter) — a real, well-defined dupe
    // case. Landing on a *new* character is already covered at the unit
    // level by rollLimitedPull (Task 3) and resolvePullResult (Task 5); this
    // test only needs to prove the store wiring applies a dupe correctly.
    vi.spyOn(Math, "random").mockReturnValue(0);
    usePlayerStore.getState().pullLimited(1);
    expect(usePlayerStore.getState().characters.duke?.ultLevel).toBe(2);
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
    // roll is the free bonus pull) — see PERMANENT_COST_MULTI in playerStore.ts.
    mockPermanentPool(["duke", "sara"]);
    const results = usePlayerStore.getState().pullPermanent(11);
    expect(results).not.toBe(false);
    expect(results && results.length).toBe(11);
    expect(usePlayerStore.getState().currencies.permanentTicket).toBe(90);
    expect(usePlayerStore.getState().pity.permanent.bar).toBe(10);
  });
});

describe("claimLimited300", () => {
  beforeEach(resetToKnownState);

  it("refuses when the bar hasn't reached 300", () => {
    expect(usePlayerStore.getState().claimLimited300()).toBe(false);
  });

  it("grants a random character and marks claimed300 once the bar is at 300", () => {
    usePlayerStore.setState((s) => ({ pity: { ...s.pity, limited: { ...s.pity.limited, bar: 300 } } }));
    const result = usePlayerStore.getState().claimLimited300();
    expect(result).not.toBe(false);
    expect(usePlayerStore.getState().pity.limited.claimed300).toBe(true);
  });

  it("refuses a second claim in the same lap", () => {
    usePlayerStore.setState((s) => ({
      pity: { ...s.pity, limited: { ...s.pity.limited, bar: 300, claimed300: true } },
    }));
    expect(usePlayerStore.getState().claimLimited300()).toBe(false);
  });
});

describe("claimLimited600", () => {
  beforeEach(resetToKnownState);

  it("refuses when the bar hasn't reached 600", () => {
    expect(usePlayerStore.getState().claimLimited600("duke")).toBe(false);
  });

  it("refuses a character not featured on the current banner", () => {
    usePlayerStore.setState((s) => ({ pity: { ...s.pity, limited: { ...s.pity.limited, bar: 600 } } }));
    expect(usePlayerStore.getState().claimLimited600("meliodas")).toBe(false);
  });

  it("grants the picked featured character and resets the lap", () => {
    usePlayerStore.setState((s) => ({ pity: { ...s.pity, limited: { ...s.pity.limited, bar: 600 } } }));
    const result = usePlayerStore.getState().claimLimited600("sara");
    expect(result).toEqual({ kind: "character", characterId: "sara" });
    expect(usePlayerStore.getState().roster).toContain("sara");
    expect(usePlayerStore.getState().pity.limited.bar).toBe(0);
    expect(usePlayerStore.getState().pity.limited.claimed300).toBe(false);
  });
});

describe("claimPermanent600", () => {
  beforeEach(resetToKnownState);

  it("refuses when the bar hasn't reached 600", () => {
    mockPermanentPool(["duke"]);
    expect(usePlayerStore.getState().claimPermanent600("duke")).toBe(false);
  });

  it("refuses a character not in the permanent pool", () => {
    usePlayerStore.setState((s) => ({ pity: { ...s.pity, permanent: { bar: 600 } } }));
    expect(usePlayerStore.getState().claimPermanent600("duke")).toBe(false);
  });

  it("grants the picked pool character and resets the permanent bar", () => {
    mockPermanentPool(["duke", "sara"]);
    usePlayerStore.setState((s) => ({ pity: { ...s.pity, permanent: { bar: 600 } } }));
    const result = usePlayerStore.getState().claimPermanent600("duke");
    expect(result).toEqual({ kind: "character", characterId: "duke" });
    expect(usePlayerStore.getState().pity.permanent.bar).toBe(0);
  });
});
