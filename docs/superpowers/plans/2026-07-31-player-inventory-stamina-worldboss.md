# Player Profile, Inventory, Stamina & World-Boss Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `playerStore`'s stub into a real profile (level/ascension/xp per
character, stamina, materials, two currencies) and wire up the actual
world-boss loop (enter → fight Molvarr → get rewards → spend them).

**Architecture:** Pure, fully-unit-tested logic modules
(`lib/game/stamina.ts`, `lib/game/leveling.ts`, `lib/game/ascension.ts`,
`lib/game/worldBossRewards.ts`) built first, standalone, with no store/UI
dependency. `store/playerStore.ts` then wires all four into its actions in
one pass. UI (world-boss route, profile rebuild, character-detail progression
panel, dev grant panel) is thin — it calls store actions and renders their
return values, no game logic in components. Molvarr's fight engine is
untouched; this plan only adds the meta-layer around it.

**Tech Stack:** Next.js 16 (App Router), Zustand + `persist` (localStorage),
Firebase Firestore (`users/{uid}` doc), Vitest, TypeScript, shadcn/ui + Tailwind.

---

## Spec reference

Full design: `docs/superpowers/specs/2026-07-31-player-inventory-stamina-worldboss-design.md`.
Read that first if anything below is ambiguous — it has the "why" behind every number.

## Task order rationale

Tasks 1-4 are pure logic modules, each standalone and independently testable
with zero dependency on each other or on `playerStore`. Task 5 is the single
point where `playerStore` wires all four into its data shape and actions —
deliberately done in one pass now that every module it needs already exists,
rather than splitting the store edit across two tasks with a forward
reference in between. Task 6 is cloud sync. Tasks 7-13 are UI, built in the
order a player would encounter them (world boss entry → nav → dev tooling →
profile hub → character spend actions). Task 14 is final verification.

---

### Task 1: Stamina — `lib/game/stamina.ts`

**Files:**
- Create: `lib/game/stamina.ts`
- Test: `tests/stamina.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/stamina.test.ts
import { describe, expect, it } from "vitest";
import { getCurrentStamina, spendStamina, STAMINA_CAP, STAMINA_REGEN_MS } from "@/lib/game/stamina";

describe("getCurrentStamina", () => {
  it("returns the stored value unchanged when no time has passed", () => {
    const now = 1_000_000;
    expect(getCurrentStamina({ current: 50, updatedAt: now }, now)).toBe(50);
  });

  it("regenerates +1 per full 5-minute tick elapsed", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS * 3 - 1000; // 3 full ticks + partial
    expect(getCurrentStamina({ current: 50, updatedAt }, now)).toBe(53);
  });

  it("does not round up a partial tick", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS + 1000; // just under one tick
    expect(getCurrentStamina({ current: 50, updatedAt }, now)).toBe(50);
  });

  it("clamps at the cap even after a long offline period", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS * 1000;
    expect(getCurrentStamina({ current: 100, updatedAt }, now)).toBe(STAMINA_CAP);
  });
});

describe("spendStamina", () => {
  it("succeeds and deducts when enough stamina is available", () => {
    const now = 1_000_000;
    const result = spendStamina({ current: 50, updatedAt: now }, 40, now);
    expect(result).toEqual({ ok: true, next: { current: 10, updatedAt: now } });
  });

  it("accounts for regen before checking affordability", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS * 5; // +5 stamina regenerated
    const result = spendStamina({ current: 36, updatedAt }, 40, now);
    expect(result).toEqual({ ok: true, next: { current: 1, updatedAt: now } });
  });

  it("refuses when stamina (after regen) is below the amount", () => {
    const now = 1_000_000;
    const result = spendStamina({ current: 10, updatedAt: now }, 40, now);
    expect(result).toEqual({ ok: false });
  });

  it("succeeds on an exact-amount spend, leaving 0", () => {
    const now = 1_000_000;
    const result = spendStamina({ current: 40, updatedAt: now }, 40, now);
    expect(result).toEqual({ ok: true, next: { current: 0, updatedAt: now } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stamina.test.ts`
Expected: FAIL — cannot find module `@/lib/game/stamina`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/game/stamina.ts

/** Max stamina a player can bank. */
export const STAMINA_CAP = 120;

/** +1 stamina per this many ms (5 minutes) — full bar in 10h from empty. */
export const STAMINA_REGEN_MS = 5 * 60 * 1000;

export interface StaminaState {
  current: number;
  updatedAt: number; // epoch ms
}

/** Computed on every read, never a timer — works offline, no cron. */
export function getCurrentStamina(stored: StaminaState, now: number = Date.now()): number {
  const regenerated = Math.floor((now - stored.updatedAt) / STAMINA_REGEN_MS);
  return Math.min(STAMINA_CAP, stored.current + regenerated);
}

export type SpendStaminaResult =
  | { ok: true; next: StaminaState }
  | { ok: false };

/** Applies regen first, then checks affordability. Writing back `updatedAt`
 *  on spend means the next read's regen math starts fresh from the spend
 *  moment, not from whenever it was last topped up. */
export function spendStamina(
  stored: StaminaState,
  amount: number,
  now: number = Date.now(),
): SpendStaminaResult {
  const current = getCurrentStamina(stored, now);
  if (current < amount) return { ok: false };
  return { ok: true, next: { current: current - amount, updatedAt: now } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stamina.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/game/stamina.ts tests/stamina.test.ts
git commit -m "feat: add stamina regen/spend module"
```

---

### Task 2: Leveling — `lib/game/leveling.ts`

**Files:**
- Create: `lib/game/leveling.ts`
- Test: `tests/leveling.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/leveling.test.ts
import { describe, expect, it } from "vitest";
import { COIN_PER_XP, feedManual, xpToNext, XP_PER_MANUAL_TIER } from "@/lib/game/leveling";

describe("xpToNext", () => {
  it("is 100 * level", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(19)).toBe(1900);
  });
});

describe("feedManual", () => {
  it("refuses to feed when already at maxLevel", () => {
    const result = feedManual({ level: 20, xp: 0 }, 20, "training_manual");
    expect(result).toBeNull();
  });

  it("grants XP and levels up once when XP crosses the threshold, banking overflow", () => {
    // level 1 needs 100 xp to hit level 2; feeding a 100-xp manual with 50 already banked
    const result = feedManual({ level: 1, xp: 50 }, 20, "training_manual");
    expect(result).toEqual({ level: 2, xp: 50, coinCost: 100 * COIN_PER_XP });
  });

  it("chains multiple level-ups from one large feed", () => {
    // level 1: needs 100 to hit 2, level 2: needs 200 to hit 3 -> 1000xp premium manual
    // chains 1->2 (100 spent, 900 left), 2->3 (200 spent, 700 left), 3->4 (300 spent, 400 left),
    // 4->5 (400 spent, 0 left) -> lands exactly on level 5 with 0 xp
    const result = feedManual({ level: 1, xp: 0 }, 20, "training_manual_premium");
    expect(result).toEqual({ level: 5, xp: 0, coinCost: 1000 * COIN_PER_XP });
  });

  it("stops chaining at maxLevel and discards excess XP rather than banking past the cap", () => {
    // level 19 needs 1900 to hit 20 (maxLevel); a 1000-xp premium manual isn't enough on its own,
    // but starting with 950 banked plus 1000 fed = 1950, crosses the 1900 threshold to hit 20 (cap)
    const result = feedManual({ level: 19, xp: 950 }, 20, "training_manual_premium");
    expect(result).toEqual({ level: 20, xp: 0, coinCost: 1000 * COIN_PER_XP });
  });

  it("computes coin cost per tier from XP_PER_MANUAL_TIER * COIN_PER_XP", () => {
    expect(feedManual({ level: 1, xp: 0 }, 20, "training_manual")?.coinCost).toBe(XP_PER_MANUAL_TIER.training_manual * COIN_PER_XP);
    expect(feedManual({ level: 1, xp: 0 }, 20, "training_manual_advanced")?.coinCost).toBe(XP_PER_MANUAL_TIER.training_manual_advanced * COIN_PER_XP);
    expect(feedManual({ level: 1, xp: 0 }, 20, "training_manual_premium")?.coinCost).toBe(XP_PER_MANUAL_TIER.training_manual_premium * COIN_PER_XP);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/leveling.test.ts`
Expected: FAIL — cannot find module `@/lib/game/leveling`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/game/leveling.ts

/** XP granted per manual tier — only `training_manual` (tier 1) has a real
 *  drop source (Molvarr) as of this update; tiers 2-3 exist in the model,
 *  granted via the dev panel until a real source is built. */
export const XP_PER_MANUAL_TIER = {
  training_manual: 100,
  training_manual_advanced: 400,
  training_manual_premium: 1000,
} as const;

export type ManualTier = keyof typeof XP_PER_MANUAL_TIER;

/** Coin cost per XP point fed — a manual's coin cost is xpGranted * this. */
export const COIN_PER_XP = 2;

/** Total XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 100 * level;
}

export interface LevelProgress {
  level: number;
  xp: number;
}

export interface FeedManualResult extends LevelProgress {
  coinCost: number;
}

/** Feeds one manual's XP into a character, chaining level-ups on overflow,
 *  capped at `maxLevel` (from `lib/game/ascension.ts`'s per-ascension table).
 *  Returns null (feed refused, no cost charged) if already at maxLevel. */
export function feedManual(
  progress: LevelProgress,
  maxLevel: number,
  manualTier: ManualTier,
): FeedManualResult | null {
  if (progress.level >= maxLevel) return null;

  const xpGained = XP_PER_MANUAL_TIER[manualTier];
  let level = progress.level;
  let xp = progress.xp + xpGained;

  while (level < maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= maxLevel) xp = 0; // no banking XP past the reachable cap

  return { level, xp, coinCost: xpGained * COIN_PER_XP };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/leveling.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/game/leveling.ts tests/leveling.test.ts
git commit -m "feat: add XP-based leveling module (xpToNext curve, feedManual)"
```

---

### Task 3: Ascension — `lib/game/ascension.ts`

**Files:**
- Create: `lib/game/ascension.ts`
- Test: `tests/ascension.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ascension.test.ts
import { describe, expect, it } from "vitest";
import {
  ASCENSION_COSTS,
  canAffordAscension,
  getAscensionCost,
  maxLevelForAscension,
} from "@/lib/game/ascension";

describe("maxLevelForAscension", () => {
  it("caps an unascended character at level 1 — must ascend before leveling", () => {
    expect(maxLevelForAscension(0)).toBe(1);
  });

  it("returns the locked per-band max level for ascensions 1-3", () => {
    expect(maxLevelForAscension(1)).toBe(20);
    expect(maxLevelForAscension(2)).toBe(30);
    expect(maxLevelForAscension(3)).toBe(40);
  });

  it("clamps at the current ceiling (40) for unspecced future bands", () => {
    expect(maxLevelForAscension(4)).toBe(40);
  });
});

describe("getAscensionCost", () => {
  it("returns the locked cost for bands 1-3", () => {
    expect(getAscensionCost(1)).toEqual({ sea_monster_eye: 3, corroded_seaweed: 10, coin: 10000 });
    expect(getAscensionCost(2)).toEqual({ sea_monster_eye: 6, corroded_seaweed: 15, coin: 25000 });
    expect(getAscensionCost(3)).toEqual({ sea_monster_eye: 10, corroded_seaweed: 25, coin: 50000 });
  });

  it("returns null for an uncosted band", () => {
    expect(getAscensionCost(4)).toBeNull();
    expect(getAscensionCost(0)).toBeNull();
  });
});

describe("canAffordAscension", () => {
  const cost = ASCENSION_COSTS[1]; // 3 eye, 10 seaweed, 10000 coin

  it("returns true when inventory and coin both meet the cost exactly", () => {
    const inventory = { sea_monster_eye: 3, corroded_seaweed: 10 };
    expect(canAffordAscension(cost, inventory, 10000)).toBe(true);
  });

  it("returns false when a material is short", () => {
    const inventory = { sea_monster_eye: 2, corroded_seaweed: 10 };
    expect(canAffordAscension(cost, inventory, 10000)).toBe(false);
  });

  it("returns false when coin is short", () => {
    const inventory = { sea_monster_eye: 3, corroded_seaweed: 10 };
    expect(canAffordAscension(cost, inventory, 9999)).toBe(false);
  });

  it("treats a missing material key as 0 owned", () => {
    expect(canAffordAscension(cost, {}, 10000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ascension.test.ts`
Expected: FAIL — cannot find module `@/lib/game/ascension`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/game/ascension.ts

export interface AscensionCost {
  sea_monster_eye: number;
  corroded_seaweed: number;
  coin: number;
}

/** Locked bands 1-3 (docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md). Bands 4-6
 *  (Lv50/60) are a later update — deliberately absent, not defaulted, so a
 *  lookup miss is a real "not costed yet" signal rather than an invented
 *  number. */
export const ASCENSION_COSTS: Record<number, AscensionCost> = {
  1: { sea_monster_eye: 3, corroded_seaweed: 10, coin: 10_000 },
  2: { sea_monster_eye: 6, corroded_seaweed: 15, coin: 25_000 },
  3: { sea_monster_eye: 10, corroded_seaweed: 25, coin: 50_000 },
};

/** maxLevel reachable AT a given ascension tier. Ascension 0 (unascended)
 *  caps at level 1 — a character must cross Band 1 before any leveling. */
const ASCENSION_MAX_LEVEL: Record<number, number> = { 0: 1, 1: 20, 2: 30, 3: 40 };

export function maxLevelForAscension(ascension: number): number {
  return ASCENSION_MAX_LEVEL[ascension] ?? 40; // bands 4-6 TODO, clamp at the current ceiling
}

export function getAscensionCost(targetAscension: number): AscensionCost | null {
  return ASCENSION_COSTS[targetAscension] ?? null;
}

export function canAffordAscension(
  cost: AscensionCost,
  inventory: Record<string, number>,
  coin: number,
): boolean {
  return (
    (inventory.sea_monster_eye ?? 0) >= cost.sea_monster_eye &&
    (inventory.corroded_seaweed ?? 0) >= cost.corroded_seaweed &&
    coin >= cost.coin
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ascension.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/game/ascension.ts tests/ascension.test.ts
git commit -m "feat: add ascension cost table + afford check (bands 1-3 locked)"
```

---

### Task 4: World-boss reward roll — `lib/game/worldBossRewards.ts`

**Files:**
- Create: `lib/game/worldBossRewards.ts`
- Test: `tests/worldBossRewards.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/worldBossRewards.test.ts
import { describe, expect, it } from "vitest";
import { rollWorldBossRewards } from "@/lib/game/worldBossRewards";

describe("rollWorldBossRewards", () => {
  it("grants the base amounts with no bonus when the rng always misses the 10% roll", () => {
    const result = rollWorldBossRewards(() => 0.99);
    expect(result.sea_monster_eye).toBe(1);
    expect(result.corroded_seaweed).toBe(2);
  });

  it("grants the +1 bonus on both rolls when the rng always hits the 10% threshold", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.sea_monster_eye).toBe(2);
    expect(result.corroded_seaweed).toBe(3);
  });

  it("keeps training_manual within the 3-6 inclusive range across many samples", () => {
    for (let i = 0; i < 200; i++) {
      const result = rollWorldBossRewards(Math.random);
      expect(result.training_manual).toBeGreaterThanOrEqual(3);
      expect(result.training_manual).toBeLessThanOrEqual(6);
    }
  });

  it("keeps coin within the 2000-10000 inclusive range across many samples", () => {
    for (let i = 0; i < 200; i++) {
      const result = rollWorldBossRewards(Math.random);
      expect(result.coin).toBeGreaterThanOrEqual(2000);
      expect(result.coin).toBeLessThanOrEqual(10000);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldBossRewards.test.ts`
Expected: FAIL — cannot find module `@/lib/game/worldBossRewards`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/game/worldBossRewards.ts

export interface WorldBossRewards {
  sea_monster_eye: number;
  corroded_seaweed: number;
  training_manual: number;
  coin: number;
}

/** Molvarr's per-clear reward roll. `rng` is injectable (defaults to
 *  Math.random) so tests can force both the base and +1-bonus branches
 *  deterministically. */
export function rollWorldBossRewards(rng: () => number = Math.random): WorldBossRewards {
  return {
    sea_monster_eye: 1 + (rng() < 0.1 ? 1 : 0),
    corroded_seaweed: 2 + (rng() < 0.1 ? 1 : 0),
    training_manual: 3 + Math.floor(rng() * 4), // 3-6 inclusive
    coin: 2000 + Math.floor(rng() * 8001), // 2000-10000 inclusive
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldBossRewards.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/game/worldBossRewards.ts tests/worldBossRewards.test.ts
git commit -m "feat: add Molvarr world-boss reward roll (Eye/Seaweed/Manual/coin)"
```

---

### Task 5: Rebuild `store/playerStore.ts`

All four pure modules (Tasks 1-4) exist now — this task wires them into the
store's data shape and actions in one pass.

**Files:**
- Modify: `store/playerStore.ts` (full rewrite)
- Test: `tests/playerStoreMigration.test.ts`, `tests/playerStoreActions.test.ts`

- [ ] **Step 1: Write the failing migration test**

```ts
// tests/playerStoreMigration.test.ts
import { describe, expect, it } from "vitest";
import { migratePlayerState } from "@/store/playerStore";

describe("migratePlayerState — v1 (inventory.gems) to v2 (currencies split)", () => {
  it("moves inventory.gems into currencies.gems and clears inventory to materials only", () => {
    const v1 = {
      uid: "abc",
      roster: ["duke", "seras"],
      inventory: { gems: 2500 },
      pity: { standard: 3, limited: 0 },
    };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies).toEqual({ gems: 2500, coin: 0 });
    expect(result.inventory).toEqual({});
    expect(result.roster).toEqual(["duke", "seras"]);
    expect(result.characters).toEqual({});
    expect(result.stamina.current).toBe(120);
  });

  it("defaults gems to 1000 if the v1 inventory had none", () => {
    const v1 = { uid: null, roster: ["duke"], inventory: {}, pity: { standard: 0, limited: 0 } };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies.gems).toBe(1000);
  });

  it("passes through unchanged when already at the current version", () => {
    const v2 = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000 },
      inventory: { sea_monster_eye: 3 },
      characters: { duke: { level: 5, ascension: 1, xp: 20 } },
      stamina: { current: 80, updatedAt: 12345 },
      pity: { standard: 0, limited: 0 },
    };
    const result = migratePlayerState(v2, 2);
    expect(result).toEqual(v2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/playerStoreMigration.test.ts`
Expected: FAIL — `migratePlayerState` is not exported from `@/store/playerStore` (module doesn't exist in that form yet).

- [ ] **Step 3: Rewrite `store/playerStore.ts`**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { spendStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { feedManual, type ManualTier } from "@/lib/game/leveling";
import { canAffordAscension, getAscensionCost, maxLevelForAscension } from "@/lib/game/ascension";

export interface CharacterProgress {
  level: number;
  ascension: number;
  xp: number;
}

export interface PlayerState {
  uid: string | null;
  roster: string[]; // Character IDs
  currencies: { gems: number; coin: number };
  inventory: Record<string, number>; // materials only: sea_monster_eye, corroded_seaweed, training_manual(_advanced|_premium)
  characters: Record<string, CharacterProgress>;
  stamina: { current: number; updatedAt: number };
  pity: {
    standard: number;
    limited: number;
  };
  /** True once zustand-persist has rehydrated from localStorage — gate any
   *  first-paint read of roster/inventory on this to avoid a flash of the
   *  default starter state ahead of the real persisted data (SSR/CSR
   *  mismatch risk). */
  hasHydrated: boolean;
  setPlayerState: (state: Partial<PlayerState>) => void;
  addCharacterToRoster: (characterId: string) => void;
  resetPlayerState: () => void;
  grantMaterials: (materials: Record<string, number>) => void;
  grantCurrency: (currency: Partial<{ gems: number; coin: number }>) => void;
  spendStaminaAction: (amount: number) => boolean;
  feedManualToCharacter: (characterId: string, manualTier: ManualTier) => boolean;
  ascendCharacter: (characterId: string) => boolean;
  grantWorldBossRewards: (rewards: Record<string, number>) => void;
}

const defaultState = {
  uid: null,
  roster: ["duke"], // Starter characters
  currencies: { gems: 1000, coin: 0 }, // Starter currency
  inventory: {} as Record<string, number>,
  characters: {} as Record<string, CharacterProgress>,
  stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
  pity: { standard: 0, limited: 0 },
};

/** Extracted from the persist `migrate` option so it's unit-testable without
 *  touching localStorage. v1 → v2: `inventory.gems` (old shape, currency
 *  mixed into materials) splits into `currencies.gems`; `currencies.coin`,
 *  `characters`, and `stamina` are new fields with sane defaults. */
export function migratePlayerState(persistedState: unknown, version: number): PlayerState {
  const state = persistedState as Record<string, unknown>;
  if (version < 2) {
    const oldInventory = (state.inventory as Record<string, number> | undefined) ?? {};
    const { gems, ...materials } = oldInventory;
    return {
      ...state,
      currencies: { gems: gems ?? 1000, coin: 0 },
      inventory: materials,
      characters: {},
      stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
    } as PlayerState;
  }
  return state as PlayerState;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      hasHydrated: false,

      setPlayerState: (newState) => set((state) => ({ ...state, ...newState })),

      addCharacterToRoster: (characterId) => set((state) => ({
        roster: state.roster.includes(characterId) ? state.roster : [...state.roster, characterId]
      })),

      resetPlayerState: () => set((state) => ({ ...defaultState, hasHydrated: state.hasHydrated })),

      grantMaterials: (materials) => set((state) => {
        const inventory = { ...state.inventory };
        for (const [id, qty] of Object.entries(materials)) {
          inventory[id] = (inventory[id] ?? 0) + qty;
        }
        return { inventory };
      }),

      grantCurrency: (currency) => set((state) => ({
        currencies: {
          gems: state.currencies.gems + (currency.gems ?? 0),
          coin: state.currencies.coin + (currency.coin ?? 0),
        },
      })),

      spendStaminaAction: (amount) => {
        let succeeded = false;
        set((state) => {
          const result = spendStamina(state.stamina, amount);
          if (!result.ok) return state;
          succeeded = true;
          return { stamina: result.next };
        });
        return succeeded;
      },

      feedManualToCharacter: (characterId, manualTier) => {
        const state = get();
        const owned = state.inventory[manualTier] ?? 0;
        if (owned < 1) return false;

        const progress = getCharacterProgress(state, characterId);
        const maxLevel = maxLevelForAscension(progress.ascension);
        const result = feedManual(progress, maxLevel, manualTier);
        if (!result) return false;
        if (state.currencies.coin < result.coinCost) return false;

        set({
          inventory: { ...state.inventory, [manualTier]: owned - 1 },
          currencies: { ...state.currencies, coin: state.currencies.coin - result.coinCost },
          characters: {
            ...state.characters,
            [characterId]: { ...progress, level: result.level, xp: result.xp },
          },
        });
        return true;
      },

      ascendCharacter: (characterId) => {
        const state = get();
        const progress = getCharacterProgress(state, characterId);
        const cost = getAscensionCost(progress.ascension + 1);
        if (!cost) return false;
        if (!canAffordAscension(cost, state.inventory, state.currencies.coin)) return false;

        set({
          inventory: {
            ...state.inventory,
            sea_monster_eye: (state.inventory.sea_monster_eye ?? 0) - cost.sea_monster_eye,
            corroded_seaweed: (state.inventory.corroded_seaweed ?? 0) - cost.corroded_seaweed,
          },
          currencies: { ...state.currencies, coin: state.currencies.coin - cost.coin },
          characters: {
            ...state.characters,
            [characterId]: { ...progress, ascension: progress.ascension + 1 },
          },
        });
        return true;
      },

      grantWorldBossRewards: (rewards) => {
        const { coin, ...materials } = rewards;
        get().grantMaterials(materials);
        if (coin) get().grantCurrency({ coin });
      },
    }),
    {
      name: 'toll-player-storage',
      version: 2,
      migrate: migratePlayerState,
      onRehydrateStorage: () => (state) => {
        state?.setPlayerState({ hasHydrated: true });
      },
    }
  )
);

/** Reading an untouched character returns the level-1/ascension-0 floor
 *  without needing every roster id pre-seeded in `characters`. */
export function getCharacterProgress(state: PlayerState, characterId: string): CharacterProgress {
  return state.characters[characterId] ?? { level: 1, ascension: 0, xp: 0 };
}
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `npx vitest run tests/playerStoreMigration.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing actions test**

```ts
// tests/playerStoreActions.test.ts
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
    // no coin or manual spent on a refused feed
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
    expect(usePlayerStore.getState().inventory.training_manual).toBe(3); // untouched
  });
});

describe("ascendCharacter", () => {
  beforeEach(resetToKnownState);

  it("ascends from 0 to 1, deducting the exact Band 1 cost", () => {
    const ok = usePlayerStore.getState().ascendCharacter("duke");
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().characters.duke.ascension).toBe(1);
    expect(usePlayerStore.getState().inventory.sea_monster_eye).toBe(2); // 5 - 3
    expect(usePlayerStore.getState().inventory.corroded_seaweed).toBe(10); // 20 - 10
    expect(usePlayerStore.getState().currencies.coin).toBe(90000); // 100000 - 10000
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/playerStoreActions.test.ts`
Expected: FAIL if any action is missing or misnamed. Since Step 3 already
wrote all actions, this should mostly pass immediately — treat any failure
here as a real bug in Step 3's implementation, not an expected red step.

- [ ] **Step 7: Fix any failures, then confirm both test files pass**

Run: `npx vitest run tests/playerStoreMigration.test.ts tests/playerStoreActions.test.ts`
Expected: PASS (3 + 10 = 13 tests)

- [ ] **Step 8: Run the full check**

Run: `npm run check`
Expected: PASS (tsc, eslint, full vitest suite)

- [ ] **Step 9: Commit**

```bash
git add store/playerStore.ts tests/playerStoreMigration.test.ts tests/playerStoreActions.test.ts
git commit -m "feat: rebuild playerStore with currencies/inventory/characters/stamina + spend actions"
```

---

### Task 6: Cloud sync — widen `AuthProvider.tsx`'s field list

**Files:**
- Modify: `hooks/AuthProvider.tsx:52-113`

No automated test — this path talks to live Firestore and the existing file
has no test coverage to extend (Firebase mocking is out of scope for this
plan). Verify manually in Step 3.

- [ ] **Step 1: Widen the on-login hydrate branch**

In `hooks/AuthProvider.tsx`, inside the `onAuthStateChanged` callback
(`hooks/AuthProvider.tsx:56-74`), change:
```ts
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlayerState({
              uid: currentUser.uid,
              roster: data.roster || [],
              inventory: data.inventory || {},
              pity: data.pity || { standard: 0, limited: 0 }
            });
          } else {
            const state = usePlayerStore.getState();
            await setDoc(docRef, {
              roster: state.roster,
              inventory: state.inventory,
              pity: state.pity
            });
            setPlayerState({ uid: currentUser.uid });
          }
```
to:
```ts
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlayerState({
              uid: currentUser.uid,
              roster: data.roster || [],
              currencies: data.currencies || { gems: 1000, coin: 0 },
              inventory: data.inventory || {},
              characters: data.characters || {},
              stamina: data.stamina || { current: 120, updatedAt: Date.now() },
              pity: data.pity || { standard: 0, limited: 0 }
            });
          } else {
            const state = usePlayerStore.getState();
            await setDoc(docRef, {
              roster: state.roster,
              currencies: state.currencies,
              inventory: state.inventory,
              characters: state.characters,
              stamina: state.stamina,
              pity: state.pity
            });
            setPlayerState({ uid: currentUser.uid });
          }
```

- [ ] **Step 2: Widen `saveToCloud`**

Change `hooks/AuthProvider.tsx:104-113`:
```ts
  const saveToCloud = async (state: Partial<PlayerState>) => {
    if (!user || !db) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const { roster, inventory, pity } = { ...usePlayerStore.getState(), ...state };
      await setDoc(docRef, { roster, inventory, pity }, { merge: true });
    } catch (e) {
      console.error("Error saving to Firestore", e);
    }
  };
```
to:
```ts
  const saveToCloud = async (state: Partial<PlayerState>) => {
    if (!user || !db) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const { roster, currencies, inventory, characters, stamina, pity } = {
        ...usePlayerStore.getState(),
        ...state,
      };
      await setDoc(docRef, { roster, currencies, inventory, characters, stamina, pity }, { merge: true });
    } catch (e) {
      console.error("Error saving to Firestore", e);
    }
  };
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, sign in with a test account (or guest), use the dev grant
panel (Task 10) to set some currency/materials, sign out and back in — confirm
the values round-trip through Firestore instead of resetting.

- [ ] **Step 4: Run the full check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/AuthProvider.tsx
git commit -m "feat: extend cloud sync to cover currencies/characters/stamina"
```

---

### Task 7: `BattleArena.tsx` — generalize `story` handlers for world-boss reuse

**Files:**
- Modify: `components/game/BattleArena.tsx:956-969,1805-1829`

- [ ] **Step 1: Rename the shared handler interface**

Change `components/game/BattleArena.tsx:956-964`:
```ts
/** Story mode swaps the result screen's actions for chapter-flow ones */
export interface StoryBattleHandlers {
  /** Victory → return to the story reader for the outro scenes */
  onContinue: () => void;
  /** Defeat → restart the same canon battle */
  onRetry: () => void;
  /** Defeat → abandon and go back to the chapter list */
  onQuit: () => void;
}
```
to:
```ts
/** Swaps the result screen's default actions (Rematch/Change Teams/Main Menu)
 *  for a caller-driven flow — used by both story mode (chapter progression)
 *  and the world-boss route (reward grant + stamina re-spend on retry). */
export interface BattleEndHandlers {
  /** Victory → caller-defined continuation (next story beat / reward screen) */
  onContinue: () => void;
  /** Defeat → restart (story: same canon battle; world-boss: re-spend stamina) */
  onRetry: () => void;
  /** Defeat → abandon (story: back to chapter list; world-boss: back to select) */
  onQuit: () => void;
}
```

- [ ] **Step 2: Add the second optional prop**

Change `components/game/BattleArena.tsx:966-970`:
```ts
export default function BattleArena({
  story,
}: {
  story?: StoryBattleHandlers;
} = {}): React.JSX.Element {
```
to:
```ts
export default function BattleArena({
  story,
  worldBoss,
}: {
  story?: BattleEndHandlers;
  worldBoss?: BattleEndHandlers;
} = {}): React.JSX.Element {
  const battleEnd = story ?? worldBoss;
```

- [ ] **Step 3: Update the victory/defeat button block**

Change `components/game/BattleArena.tsx:1805-1829` from checking `story` to
checking `battleEnd`:
```tsx
              {battleEnd && battlePhase === "victory" ? (
                <Button
                  onClick={battleEnd.onContinue}
                  className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                >
                  {story ? "CONTINUE STORY" : "CLAIM REWARDS"}
                </Button>
              ) : null}
              {battleEnd && battlePhase === "defeat" ? (
                <>
                  <Button
                    onClick={battleEnd.onRetry}
                    className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                  >
                    RETRY BATTLE
                  </Button>
                  <Button
                    variant="outline"
                    onClick={battleEnd.onQuit}
                    className="h-12 rounded-none border-2 border-zinc-400 bg-transparent font-heading text-lg tracking-[0.14em] text-zinc-100"
                  >
                    {story ? "BACK TO CHAPTERS" : "BACK TO WORLD BOSS"}
                  </Button>
                </>
              ) : null}
```

- [ ] **Step 4: Update the two remaining `!story` guards to `!battleEnd`**

Change `components/game/BattleArena.tsx:1830` (`{!story && lastBattleConfig ? (`)
to `{!battleEnd && lastBattleConfig ? (`, and line 1859 (`{!story ? (`) to
`{!battleEnd ? (`. These gate the "REMATCH" / "CHANGE TEAMS" / "MAIN MENU"
buttons that only make sense in the free-form practice flow — world-boss and
story both replace them with their own handlers, same as before.

- [ ] **Step 5: Run the full check**

Run: `npm run check`
Expected: PASS — this is a rename plus one new optional prop, no behavior
change for the existing `story` call site in `app/story/page.tsx` (still
passes `story={{...}}`, unaffected by the rename since it's a type name, not
a prop name).

- [ ] **Step 6: Commit**

```bash
git add components/game/BattleArena.tsx
git commit -m "refactor: generalize StoryBattleHandlers -> BattleEndHandlers, add worldBoss prop"
```

---

### Task 8: `WorldBossTeamSelect` — roster-gated team picker

**Files:**
- Create: `components/game/WorldBossTeamSelect.tsx`

No automated test for this file — no `.tsx` component tests exist anywhere in
this repo (`vitest.config.ts` only includes `tests/**/*.test.ts`); UI
correctness here is verified manually in Task 14.

- [ ] **Step 1: Write the component**

```tsx
// components/game/WorldBossTeamSelect.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getPlayableCharacters, type CharacterData } from "@/lib/game/characterCatalog";
import type { TeamPick } from "@/hooks/BattleProvider";

const MAX_TEAM_SIZE = 4;

/** Same slot-picker UX as TeamSelect's player side, restricted to
 *  roster-owned characters — TeamSelect itself stays a full-catalog dev
 *  sandbox and is intentionally not reused/parameterized for this. */
export default function WorldBossTeamSelect({
  ownedIds,
  onChange,
  team,
}: {
  ownedIds: string[];
  team: CharacterData[];
  onChange: (team: CharacterData[]) => void;
}): React.JSX.Element {
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const owned = React.useMemo(
    () => getPlayableCharacters().filter((c) => ownedIds.includes(c.id)),
    [ownedIds],
  );

  const toggle = (character: CharacterData) => {
    if (team.some((c) => c.id === character.id)) {
      onChange(team.filter((c) => c.id !== character.id));
    } else if (team.length < MAX_TEAM_SIZE) {
      onChange([...team, character]);
    }
  };

  return (
    <>
      <Card className="rounded-none border-2 border-sky-400/70 bg-black/50 ring-0">
        <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg tracking-[0.12em] text-sky-200">
              YOUR TEAM
            </CardTitle>
            <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
              {team.length}/{MAX_TEAM_SIZE}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2 p-3">
          {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
            const character = team[index];
            if (!character) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => setRosterOpen(true)}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-zinc-700 text-3xl leading-none text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-400"
                >
                  +
                </button>
              );
            }
            const art = getCharacterArt(character.id);
            return (
              <button
                key={`${character.id}-${index}`}
                type="button"
                onClick={() => setRosterOpen(true)}
                className="group relative flex h-24 cursor-pointer flex-col items-center justify-end overflow-hidden border-2 border-zinc-600 bg-zinc-900/70"
              >
                {art ? (
                  <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                ) : null}
                <span className="relative z-10 w-full bg-black/60 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-zinc-100">
                  {character.name}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {rosterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
          <Card className="flex max-h-full w-full max-w-4xl flex-col rounded-none border-2 border-sky-400/70 bg-zinc-950/95 ring-0">
            <CardHeader className="border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-2xl tracking-[0.12em] text-sky-200">
                    YOUR ROSTER
                  </CardTitle>
                  <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Tap to add or remove • {team.length}/{MAX_TEAM_SIZE} picked
                  </CardDescription>
                </div>
                <Button onClick={() => setRosterOpen(false)} className="h-10 rounded-none border-2 border-amber-300 px-6 font-heading text-base tracking-[0.14em]">
                  DONE
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
              {owned.length === 0 ? (
                <p className="col-span-full py-8 text-center font-body text-sm text-zinc-500">
                  No owned characters yet.
                </p>
              ) : null}
              {owned.map((character) => {
                const pickIndex = team.findIndex((c) => c.id === character.id);
                const isPicked = pickIndex !== -1;
                const disabled = !isPicked && team.length >= MAX_TEAM_SIZE;
                const art = getCharacterArt(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(character)}
                    className={`group relative flex h-40 flex-col justify-end overflow-hidden border-2 text-left transition-all ${
                      isPicked
                        ? "border-sky-400/70 ring-2 ring-sky-400/60"
                        : disabled
                          ? "cursor-not-allowed border-zinc-800 opacity-40"
                          : "border-zinc-700 hover:border-zinc-400"
                    } bg-zinc-900/70`}
                  >
                    {art ? (
                      <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                    ) : null}
                    {isPicked ? (
                      <span className="absolute right-1 top-1 z-10 border border-sky-400/70 bg-black/70 px-1.5 py-0.5 font-heading text-xs text-sky-200">
                        ✓ {pickIndex + 1}
                      </span>
                    ) : null}
                    <span className="relative z-10 w-full bg-black/70 px-2 py-1">
                      <span className="block truncate font-heading text-base tracking-[0.06em] text-zinc-100">
                        {character.name}
                      </span>
                      <span className="mt-0.5 flex gap-1">
                        <Badge variant="secondary" className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest">ATK {character.atk}</Badge>
                        <Badge variant="secondary" className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest">DEF {character.def}</Badge>
                        <Badge variant="secondary" className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest">HP {character.hp}</Badge>
                      </span>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}

/** Converts the picked team into the TeamPick[] shape startCustomBattle expects. */
export function toWorldBossTeamPicks(team: CharacterData[]): TeamPick[] {
  return team.map((c) => ({ id: c.id }));
}
```

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/game/WorldBossTeamSelect.tsx
git commit -m "feat: add roster-gated team picker for the world-boss route"
```

---

### Task 9: `app/world-boss/page.tsx` — the encounter route

**Files:**
- Create: `app/world-boss/page.tsx`
- Modify: `components/ui/TopNav.tsx:6-12`

- [ ] **Step 1: Add the nav link**

Change `components/ui/TopNav.tsx:6-12`:
```ts
const LINKS = [
  { href: "/", label: "Main Menu" },
  { href: "/story", label: "Story" },
  { href: "/practice", label: "Practice" },
  { href: "/archive", label: "Archive" },
  { href: "/profile", label: "Profile" },
] as const;
```
to:
```ts
const LINKS = [
  { href: "/", label: "Main Menu" },
  { href: "/story", label: "Story" },
  { href: "/world-boss", label: "World Boss" },
  { href: "/practice", label: "Practice" },
  { href: "/archive", label: "Archive" },
  { href: "/profile", label: "Profile" },
] as const;
```

- [ ] **Step 2: Write the route**

```tsx
// app/world-boss/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import WorldBossTeamSelect, { toWorldBossTeamPicks } from "@/components/game/WorldBossTeamSelect";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { rollWorldBossRewards, type WorldBossRewards } from "@/lib/game/worldBossRewards";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById, getCharacterPhases, type CharacterData } from "@/lib/game/characterCatalog";

const MOLVARR_ID = "molvarr";
const STAMINA_COST = 40;

type View = { kind: "select" } | { kind: "battle" } | { kind: "results"; rewards: WorldBossRewards };

const PAGE_BG = {
  backgroundImage:
    "radial-gradient(70% 50% at 50% 0%, rgba(245,158,11,0.2), transparent 72%), linear-gradient(140deg, #09090b 0%, #111827 52%, #0a0a0a 100%)",
};

export default function WorldBossPage(): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const { resetBattle } = useGameStore();
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const grantWorldBossRewards = usePlayerStore((s) => s.grantWorldBossRewards);

  const [view, setView] = React.useState<View>({ kind: "select" });
  const [team, setTeam] = React.useState<CharacterData[]>([]);
  const [insufficientStaminaNotice, setInsufficientStaminaNotice] = React.useState(false);

  const molvarr = getCharacterById(MOLVARR_ID);
  const phaseCount = molvarr ? getCharacterPhases(molvarr).length : 1;
  const currentStamina = getCurrentStamina(stamina);
  const canEnter = team.length > 0 && currentStamina >= STAMINA_COST;

  const enter = React.useCallback(() => {
    if (!spendStaminaAction(STAMINA_COST)) {
      setInsufficientStaminaNotice(true);
      return;
    }
    setInsufficientStaminaNotice(false);
    startCustomBattle(toWorldBossTeamPicks(team), [{ id: MOLVARR_ID }]);
    setView({ kind: "battle" });
  }, [spendStaminaAction, startCustomBattle, team]);

  if (view.kind === "battle") {
    return (
      <main className="relative flex h-[calc(100dvh-2.875rem)] flex-col overflow-hidden text-zinc-100" style={PAGE_BG}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
        <BattleArena
          worldBoss={{
            onContinue: () => {
              const rewards = rollWorldBossRewards();
              grantWorldBossRewards(rewards);
              resetBattle();
              setView({ kind: "results", rewards });
            },
            onRetry: enter,
            onQuit: () => {
              resetBattle();
              setView({ kind: "select" });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  if (view.kind === "results") {
    const rows: Array<[string, number]> = [
      ["Sea Monster's Eye", view.rewards.sea_monster_eye],
      ["Corroded Sea Weed", view.rewards.corroded_seaweed],
      ["Training Manual", view.rewards.training_manual],
      ["Coin", view.rewards.coin],
    ];
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950" style={PAGE_BG}>
        <Card className="w-full max-w-md rounded-none border-2 border-amber-300 bg-black/70 ring-0">
          <CardHeader className="border-b border-zinc-800 px-6 py-5">
            <CardTitle className="font-heading text-3xl tracking-[0.14em] text-amber-300">
              REWARDS
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-6 py-6">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-body text-sm uppercase tracking-[0.12em] text-zinc-400">{label}</span>
                <span className="font-heading text-xl text-zinc-100">+{value}</span>
              </div>
            ))}
            <Button
              onClick={() => setView({ kind: "select" })}
              className="mt-2 h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
            >
              CONTINUE
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950" style={PAGE_BG}>
      <section className="relative z-10 mx-auto w-full max-w-4xl space-y-4 px-4 py-8 md:px-8">
        <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-5xl">
          WORLD BOSS
        </h1>

        <Card className="rounded-none border-2 border-rose-400/70 bg-black/50 ring-0">
          <CardContent className="flex items-center gap-4 p-4">
            {molvarr && getCharacterArt(molvarr.id) ? (
              <Image
                src={getCharacterArt(molvarr.id)!}
                alt={molvarr.name}
                width={96}
                height={96}
                className="h-24 w-24 border-2 border-rose-400/70 object-cover object-top"
              />
            ) : null}
            <div>
              <p className="font-heading text-2xl tracking-[0.1em] text-rose-200">
                {molvarr?.name ?? "Molvarr"}
              </p>
              <p className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
                Elite • {phaseCount} phase{phaseCount === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-zinc-700 bg-black/50 ring-0">
          <CardContent className="flex items-center justify-between p-4">
            <span className="font-body text-sm uppercase tracking-[0.14em] text-zinc-400">Stamina</span>
            <span className="font-heading text-xl text-zinc-100">{currentStamina} / {STAMINA_CAP}</span>
          </CardContent>
        </Card>

        <WorldBossTeamSelect ownedIds={roster} team={team} onChange={setTeam} />

        {insufficientStaminaNotice ? (
          <p className="font-body text-sm text-red-400">Not enough stamina — wait for it to regenerate.</p>
        ) : null}

        <Button
          size="lg"
          disabled={!canEnter}
          onClick={enter}
          className="h-12 w-full rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] font-heading text-lg tracking-[0.14em] text-zinc-950"
        >
          ENTER ({STAMINA_COST} STAMINA)
        </Button>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, navigate to `/world-boss`. Confirm: Molvarr card renders,
stamina reads `120 / 120`, team picker only shows roster characters (default
roster is just Duke — pick him), Enter is disabled until a character is
picked, clicking Enter drops stamina to 80 and launches the fight. Win or
lose, confirm the results/retry flow behaves (rewards screen on win; retry
re-spends stamina on loss, quit returns to select without a grant).

- [ ] **Step 5: Commit**

```bash
git add app/world-boss/page.tsx components/ui/TopNav.tsx
git commit -m "feat: add /world-boss route (stamina-gated Molvarr encounter + rewards)"
```

---

### Task 10: Dev-only grant panel

**Files:**
- Create: `components/game/DevGrantPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/game/DevGrantPanel.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerStore } from "@/store/playerStore";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

const MATERIAL_IDS = [
  "sea_monster_eye",
  "corroded_seaweed",
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
] as const;

/** Dev-only testing tool — same NODE_ENV gate as BattleArena's "SAVE BATTLE
 *  LOG" button. Lets currency/materials/level/ascension/stamina be set
 *  directly instead of grinding, and simulates a stamina spend so the
 *  regen/guard math is exercised without a real fight. */
export default function DevGrantPanel(): React.JSX.Element | null {
  if (process.env.NODE_ENV === "production") return null;

  const { currencies, inventory, characters, roster, addCharacterToRoster, grantMaterials, grantCurrency, spendStaminaAction, setPlayerState } =
    usePlayerStore();
  const [selectedCharId, setSelectedCharId] = React.useState(roster[0] ?? "duke");
  const [levelInput, setLevelInput] = React.useState("1");
  const [ascensionInput, setAscensionInput] = React.useState("0");

  const setCharacterProgress = () => {
    setPlayerState({
      characters: {
        ...characters,
        [selectedCharId]: {
          level: Number(levelInput) || 1,
          ascension: Number(ascensionInput) || 0,
          xp: 0,
        },
      },
    });
  };

  return (
    <Card className="rounded-none border-2 border-sky-400 bg-black/50 ring-0">
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <CardTitle className="font-heading text-lg tracking-[0.12em] text-sky-200">
          DEV GRANT PANEL
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => grantCurrency({ gems: 1000 })}>+1000 Gems</Button>
          <Button variant="outline" onClick={() => grantCurrency({ coin: 50000 })}>+50000 Coin</Button>
          {MATERIAL_IDS.map((id) => (
            <Button key={id} variant="outline" onClick={() => grantMaterials({ [id]: 10 })}>
              +10 {id}
            </Button>
          ))}
          <Button variant="outline" onClick={() => spendStaminaAction(40)}>Simulate a run (-40 stamina)</Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-3">
          <label className="flex flex-col gap-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Character</span>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            >
              {getPlayableCharacters().map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Level</span>
            <Input value={levelInput} onChange={(e) => setLevelInput(e.target.value)} className="w-16" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Ascension</span>
            <Input value={ascensionInput} onChange={(e) => setAscensionInput(e.target.value)} className="w-16" />
          </label>
          <Button variant="outline" onClick={setCharacterProgress}>Set</Button>
          <Button
            variant="outline"
            disabled={roster.includes(selectedCharId)}
            onClick={() => addCharacterToRoster(selectedCharId)}
          >
            Add to roster
          </Button>
        </div>

        <p className="font-body text-xs text-zinc-500">
          Gems {currencies.gems} • Coin {currencies.coin} • Roster: {roster.join(", ")}
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/game/DevGrantPanel.tsx
git commit -m "feat: add dev-only grant panel for currency/materials/level/ascension testing"
```

---

### Task 11: Rebuild `app/profile/page.tsx`

**Files:**
- Modify: `app/profile/page.tsx` (full rewrite)

- [ ] **Step 1: Write the rebuilt page**

```tsx
// app/profile/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore } from "@/store/playerStore";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import DevGrantPanel from "@/components/game/DevGrantPanel";

const MATERIAL_LABELS: Record<string, string> = {
  sea_monster_eye: "Sea Monster's Eye",
  corroded_seaweed: "Corroded Sea Weed",
  training_manual: "Training Manual",
  training_manual_advanced: "Advanced Training Manual",
  training_manual_premium: "Premium Training Manual",
};

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { roster, currencies, inventory, characters, stamina } = usePlayerStore();

  if (!loading && !user) {
    router.replace("/login");
    return null;
  }

  const currentStamina = getCurrentStamina(stamina);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-6 py-10">
        <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100">PROFILE</h1>

        {loading ? (
          <p className="font-body text-sm text-zinc-400">Loading…</p>
        ) : (
          <>
            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs uppercase tracking-[0.16em] text-zinc-500">Stamina</span>
                  <span className="font-heading text-lg text-zinc-100">{currentStamina} / {STAMINA_CAP}</span>
                </div>
                <Progress value={(currentStamina / STAMINA_CAP) * 100} />
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
                <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">Currencies</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-6 p-4">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Gems</p>
                  <p className="font-heading text-xl text-amber-200">{currencies.gems}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Coin</p>
                  <p className="font-heading text-xl text-zinc-100">{currencies.coin}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
                <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">Materials</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {Object.entries(MATERIAL_LABELS).map(([id, label]) => (
                  <div key={id} className="border border-zinc-800 px-3 py-2">
                    <p className="font-body text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
                    <p className="font-heading text-lg text-zinc-100">{inventory[id] ?? 0}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
                <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">Roster</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-4">
                {roster.map((id) => {
                  const character = getCharacterById(id);
                  const progress = characters[id] ?? { level: 1, ascension: 0, xp: 0 };
                  return (
                    <Link
                      key={id}
                      href={`/archive/${id}`}
                      className="flex items-center justify-between border border-zinc-800 px-3 py-2 hover:border-amber-300"
                    >
                      <span className="font-body text-sm text-zinc-200">{character?.name ?? id}</span>
                      <span className="font-body text-xs uppercase tracking-widest text-zinc-500">
                        Lv {progress.level} • Ascension {progress.ascension}
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <DevGrantPanel />

            <div className="border-2 border-zinc-800 bg-black/40 px-4 py-4">
              <p className="font-body text-[10px] uppercase tracking-[0.2em] text-zinc-500">Signed in as</p>
              <p className="mt-1 font-body text-sm text-zinc-100">{user?.email ?? user?.displayName ?? user?.uid}</p>
            </div>

            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
              className="h-12 rounded-none border-2 border-red-400 bg-transparent font-heading tracking-[0.14em] text-red-200 hover:text-red-100"
            >
              LOGOUT
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="h-12 rounded-none border-2 border-zinc-700 font-heading tracking-[0.14em] text-zinc-300"
        >
          BACK TO MENU
        </Button>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, sign in, visit `/profile`. Confirm stamina bar, currencies,
materials grid, and roster list render; dev panel's buttons update the
displayed numbers live.

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: rebuild /profile with stamina/currencies/materials/roster + dev panel"
```

---

### Task 12: `CharacterProgressionPanel` — feed/ascend UI on character detail

**Files:**
- Create: `components/game/CharacterProgressionPanel.tsx`
- Modify: `app/archive/[id]/page.tsx:320` (insert the panel)

- [ ] **Step 1: Write the component**

```tsx
// components/game/CharacterProgressionPanel.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerStore, getCharacterProgress } from "@/store/playerStore";
import { xpToNext } from "@/lib/game/leveling";
import { getAscensionCost, maxLevelForAscension } from "@/lib/game/ascension";

const MANUAL_TIERS = [
  { id: "training_manual", label: "Training Manual" },
  { id: "training_manual_advanced", label: "Advanced Manual" },
  { id: "training_manual_premium", label: "Premium Manual" },
] as const;

export default function CharacterProgressionPanel({ characterId }: { characterId: string }): React.JSX.Element {
  const state = usePlayerStore();
  const progress = getCharacterProgress(state, characterId);
  const maxLevel = maxLevelForAscension(progress.ascension);
  const nextCost = getAscensionCost(progress.ascension + 1);
  const atMaxLevel = progress.level >= maxLevel;
  const xpNeeded = atMaxLevel ? 0 : xpToNext(progress.level);

  return (
    <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">
          Level {progress.level} • Ascension {progress.ascension}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        {!atMaxLevel ? (
          <div>
            <div className="flex items-center justify-between font-body text-xs uppercase tracking-widest text-zinc-500">
              <span>XP</span>
              <span>{progress.xp} / {xpNeeded}</span>
            </div>
            <Progress value={(progress.xp / xpNeeded) * 100} className="mt-1" />
          </div>
        ) : (
          <p className="font-body text-xs uppercase tracking-widest text-amber-300">
            Max level for this ascension tier — ascend to continue leveling.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {MANUAL_TIERS.map((tier) => {
            const owned = state.inventory[tier.id] ?? 0;
            const disabled = atMaxLevel || owned < 1;
            return (
              <Button
                key={tier.id}
                variant="outline"
                disabled={disabled}
                onClick={() => state.feedManualToCharacter(characterId, tier.id)}
                title={atMaxLevel ? "At max level for this ascension tier" : owned < 1 ? `No ${tier.label} owned` : undefined}
              >
                Feed {tier.label} ({owned})
              </Button>
            );
          })}
        </div>

        {nextCost ? (
          <div className="border-t border-zinc-800 pt-3">
            <p className="font-body text-xs uppercase tracking-widest text-zinc-500">
              Ascend to tier {progress.ascension + 1} (unlocks Lv{maxLevelForAscension(progress.ascension + 1)})
            </p>
            <p className="mt-1 font-body text-sm text-zinc-300">
              {nextCost.sea_monster_eye}x Sea Monster's Eye ({state.inventory.sea_monster_eye ?? 0} owned) •{" "}
              {nextCost.corroded_seaweed}x Corroded Sea Weed ({state.inventory.corroded_seaweed ?? 0} owned) •{" "}
              {nextCost.coin} coin ({state.currencies.coin} owned)
            </p>
            <Button
              className="mt-2"
              onClick={() => state.ascendCharacter(characterId)}
            >
              Ascend
            </Button>
          </div>
        ) : (
          <p className="border-t border-zinc-800 pt-3 font-body text-xs uppercase tracking-widest text-zinc-500">
            No further ascension costed yet (bands 4-6 come in a later update).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the character detail page**

In `app/archive/[id]/page.tsx`, add the import near the other component
imports (after the `PreviewButton` import, `app/archive/[id]/page.tsx:22`):
```ts
import CharacterProgressionPanel from "@/components/game/CharacterProgressionPanel";
```

Insert the panel into the identity aside, right after `<PreviewButton .../>`
at `app/archive/[id]/page.tsx:320`:
```tsx
            <PreviewButton characterId={character.id} />
            <CharacterProgressionPanel characterId={character.id} />
```

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, visit `/archive/duke`. Confirm the progression panel
renders below the Preview button, showing Lv1/Ascension0/max-level notice
(Duke starts unascended). Use the dev panel on `/profile` to grant Duke
ascension-1 worth of materials + coin, ascend him from `/archive/duke`,
confirm the XP bar appears and feeding a manual (after granting one) advances
it.

- [ ] **Step 5: Commit**

```bash
git add components/game/CharacterProgressionPanel.tsx app/archive/[id]/page.tsx
git commit -m "feat: add character-detail level/ascension panel with feed/ascend actions"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: tsc, eslint, and the full vitest suite (existing tests + all new
ones from Tasks 1-5) all pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean production build, every route (including the new
`/world-boss`) generates without error.

- [ ] **Step 3: End-to-end manual playtest**

Run: `npm run dev`. Walk the full loop once:
1. `/profile` — use the dev panel to grant enough Eye/Seaweed/coin for Band 1,
   and add a second roster character if desired.
2. `/archive/duke` — ascend Duke to tier 1, confirm `maxLevel` becomes 20.
3. `/world-boss` — pick a team, confirm stamina reads 120/120, Enter (drops to
   80), fight Molvarr to a win, confirm the rewards screen shows Eye (1-2),
   Corroded Sea Weed (2-3), Training Manual (3-6), coin (2000-10000), and that
   `/profile`'s materials grid reflects the grant after returning.
4. Back on `/archive/duke`, feed a Training Manual, confirm the XP bar moves
   and coin is deducted.
5. Lose a fight on purpose (or use a weak team) to confirm Retry re-spends
   stamina (blocked with the inline message if insufficient) and Quit returns
   to select with no reward and stamina still spent.

- [ ] **Step 4: Update doc status banners**

In `docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md`, change the top status line
```
> Status: DESIGN LOCKED (core), NOT BUILT. Drafted 2026-07-18.
```
to:
```
> Status: BUILT 2026-07-31 (character level/ascension, stamina, world-boss
> encounter + reward loop, dev grant panel). Bands 4-6 and the ult-level
> per-pull stat step remain future work. See
> docs/superpowers/specs/2026-07-31-player-inventory-stamina-worldboss-design.md.
```

In `docs/ROADMAP.md`, change roadmap step 3's line:
```
3. **World Boss + Ascension update** — leveling (base/59, ~3x with ascension bumps), stamina, world-boss encounter, drops/inventory. Reachable cap Lv40 this update. Spec: `WORLD_BOSS_AND_ASCENSION_PLAN.md`. ...
```
Prepend `**BUILT 2026-07-31.**` to the start of that bullet, keeping the rest
of the sentence (the UX-reference context) unchanged.

- [ ] **Step 5: Commit the doc updates**

```bash
git add docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md docs/ROADMAP.md
git commit -m "docs: mark player/inventory/stamina/world-boss foundation as built"
```

---

## Self-review notes

- **Spec coverage:** every locked decision in the design doc has a
  corresponding task — data model + stamina (Tasks 1, 5), leveling (Task 2),
  ascension (Task 3), reward roll (Task 4), store wiring (Task 5), cloud sync
  (Task 6), world-boss route (Tasks 7-9), dev panel (Task 10), profile UI
  (Task 11), character-detail spend UI (Task 12). Patch notes is explicitly
  out of scope (separate spec, per the design doc's own framing).
- **Ordering fix applied:** the first draft of this plan built `playerStore`
  (Task 1) before the pure modules it imports (`stamina.ts`, `leveling.ts`,
  `ascension.ts`), which would have made Task 1's own code snippet
  uncompilable as written. Reordered so all four standalone modules (Tasks
  1-4) exist before `playerStore` (Task 5) ever imports them.
- **Deferred, not forgotten:** ascension bands 4-6, the `stats.ts` wiring of
  `leveledBase` into actual combat stats, ult-level per-pull step, and
  training-manual tiers 2-3 real drop sources are all called out as
  out-of-scope in the design doc and untouched by this plan.
- **Type consistency check:** `ManualTier` (Task 2) is reused verbatim in
  `playerStore`'s `feedManualToCharacter` signature (Task 5) and
  `CharacterProgressionPanel` (Task 12) — no renaming drift.
  `getCharacterProgress` (Task 5) is the single source of the
  "untouched character defaults to Lv1/Ascension0" rule, reused by Task 5's
  own actions and Task 12's UI rather than each reimplementing the fallback.
