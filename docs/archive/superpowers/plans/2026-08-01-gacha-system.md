# Gacha System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gacha system per `docs/superpowers/specs/2026-08-01-gacha-design.md` — two banners (Limited debut + evergreen Permanent), a milestone-bar pity system, dupe→Ultimate Level, a miss-pull item pool, and a GSAP-animated `/gacha` screen.

**Architecture:** Pure-function core in `lib/gacha/` (roll, milestone math, dupe resolution — all unit-tested with injectable `rng`, mirroring `lib/game/worldBossRewards.ts`), thin Zustand actions in `store/playerStore.ts`, thin UI in `components/gacha/` + `app/gacha/page.tsx`. GSAP (`gsap` + `@gsap/react`, already installed) drives the banner-screen polish and the pull-reveal cutin sequence; framer-motion is untouched everywhere else.

**Tech Stack:** Next.js 16 App Router, Zustand (persist), Vitest, GSAP 3 + `@gsap/react`'s `useGSAP` hook, existing Tailwind/shadcn UI primitives.

---

**IMPORTANT — do not run ComfyUI / generate any art during this plan.** Tanveer's GPU is in use for something else this session. Task 17 (banner splash art) is included for completeness but must stay un-started — use a plain placeholder (`public/banners/debut-2026-08-placeholder.svg`, a flat rectangle with the banner name as text, built in code, not generated) everywhere the plan calls for the real splash image. Every other task should be completed normally.

---

## Task 1: Character data — `permanentPool` flag + specialty material grouping

**Files:**
- Modify: `lib/game/characterCatalog.ts` (add `permanentPool?: boolean` to `CharacterData`)
- Modify: `lib/game/characterSchema.ts` (add matching optional Zod field)
- Create: `lib/gacha/materials.ts`
- Test: `tests/gachaMaterials.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/gachaMaterials.test.ts
import { describe, expect, it } from "vitest";
import { materialForCharacter } from "@/lib/gacha/materials";

describe("materialForCharacter", () => {
  it("maps a blue character to riverstone_fragment", () => {
    expect(materialForCharacter("duke")).toBe("riverstone_fragment"); // duke is blue
  });

  it("maps a red character to scorched_ember", () => {
    expect(materialForCharacter("lyra")).toBe("scorched_ember"); // lyra is red
  });

  it("maps a green character to bramble_thorn", () => {
    expect(materialForCharacter("yalina")).toBe("bramble_thorn"); // yalina is green
  });

  it("maps a light character to prism_dust", () => {
    expect(materialForCharacter("seras")).toBe("prism_dust"); // seras is light
  });

  it("maps a dark character to prism_dust", () => {
    expect(materialForCharacter("chiara")).toBe("prism_dust"); // chiara is dark
  });

  it("falls back to riverstone_fragment for an unknown character id", () => {
    expect(materialForCharacter("not-a-real-id")).toBe("riverstone_fragment");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gachaMaterials.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gacha/materials'`

- [ ] **Step 3: Add the `permanentPool` field to the character type and schema**

In `lib/game/characterCatalog.ts`, inside the `CharacterData` interface (it already has `storyOnly?: boolean;` around line 66), add directly below it:

```ts
  /** Evergreen-pool membership for the Permanent gacha banner. Flipped by
   *  hand per character (docs/superpowers/specs/2026-08-01-gacha-design.md)
   *  — never set automatically. Absent/false = not in the pool. */
  permanentPool?: boolean;
```

In `lib/game/characterSchema.ts`, find the line `storyOnly: z.boolean().optional(),` (around line 61) and add directly below it:

```ts
  permanentPool: z.boolean().optional(),
```

- [ ] **Step 4: Write `lib/gacha/materials.ts`**

```ts
import { getCharacterById } from "@/lib/game/characterCatalog";

/** The 4 shared local-specialty materials, grouped by each character's
 *  existing `color` tag (already used for type-advantage — no new schema
 *  needed). See "Local specialty matz" in the gacha design spec:
 *  docs/superpowers/specs/2026-08-01-gacha-design.md */
const SPECIALTY_MATERIAL_BY_COLOR: Record<string, string> = {
  blue: "riverstone_fragment",
  red: "scorched_ember",
  green: "bramble_thorn",
  light: "prism_dust",
  dark: "prism_dust",
};

const DEFAULT_MATERIAL = "riverstone_fragment";

export function materialForCharacter(characterId: string): string {
  const character = getCharacterById(characterId);
  if (!character) return DEFAULT_MATERIAL;
  return SPECIALTY_MATERIAL_BY_COLOR[character.color] ?? DEFAULT_MATERIAL;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/gachaMaterials.test.ts`
Expected: PASS (6/6)

- [ ] **Step 6: Run the full check and commit**

Run: `npm run check`
Expected: all green (tsc, eslint, vitest)

```bash
git add lib/game/characterCatalog.ts lib/game/characterSchema.ts lib/gacha/materials.ts tests/gachaMaterials.test.ts
git commit -m "feat: add permanentPool character flag + specialty material mapping"
```

---

## Task 2: Debut banner config + banner loaders

**Files:**
- Create: `data/banners/debut-2026-08.json`
- Create: `lib/gacha/banners.ts`
- Test: `tests/gachaBanners.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/gachaBanners.test.ts
import { describe, expect, it } from "vitest";
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";

describe("getActiveLimitedBanner", () => {
  it("returns the debut banner with 12 featured characters at 5% rate", () => {
    const banner = getActiveLimitedBanner();
    expect(banner.id).toBe("debut-2026-08");
    expect(banner.featured).toHaveLength(12);
    expect(banner.featured).toContain("duke");
    expect(banner.featured).toContain("isolde");
    expect(banner.rate).toBe(0.05);
  });
});

describe("getPermanentBanner", () => {
  it("returns an empty pool when no character has permanentPool set (current real data)", () => {
    const banner = getPermanentBanner();
    expect(banner.id).toBe("permanent");
    expect(Array.isArray(banner.featured)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gachaBanners.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gacha/banners'`

- [ ] **Step 3: Create the banner data file**

```json
// data/banners/debut-2026-08.json
{
  "id": "debut-2026-08",
  "name": "Debut Banner",
  "featured": [
    "duke",
    "lyra",
    "batra",
    "gabrist",
    "sara",
    "yalina",
    "mustafa",
    "siddiq",
    "master_tao",
    "seras",
    "chiara",
    "isolde"
  ],
  "rate": 0.05,
  "endsAt": "2026-09-05T00:00:00.000Z"
}
```

- [ ] **Step 4: Write `lib/gacha/banners.ts`**

```ts
import debutBanner from "@/data/banners/debut-2026-08.json";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

export interface LimitedBannerConfig {
  id: string;
  name: string;
  featured: string[];
  rate: number;
  endsAt: string;
}

export interface PermanentBannerConfig {
  id: "permanent";
  featured: string[];
}

/** Only one Limited banner exists at a time right now — the debut banner.
 *  When banner rotation is built, this becomes a lookup by current date
 *  against a list of banner files instead of a single static import. */
export function getActiveLimitedBanner(): LimitedBannerConfig {
  return debutBanner as LimitedBannerConfig;
}

/** Pool is computed live from character data, not a static file — see
 *  the `permanentPool` flag added in Task 1. Starts empty until Tanveer
 *  flips flags on individual characters. */
export function getPermanentBanner(): PermanentBannerConfig {
  const featured = getPlayableCharacters()
    .filter((character) => character.permanentPool === true)
    .map((character) => character.id);
  return { id: "permanent", featured };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/gachaBanners.test.ts`
Expected: PASS (2/2)

- [ ] **Step 6: Commit**

```bash
git add data/banners/debut-2026-08.json lib/gacha/banners.ts tests/gachaBanners.test.ts
git commit -m "feat: add debut Limited banner config + Permanent banner pool loader"
```

---

## Task 3: Pull roll engine

**Files:**
- Create: `lib/gacha/pull.ts`
- Test: `tests/gachaPull.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/gachaPull.test.ts
import { describe, expect, it } from "vitest";
import { rollLimitedPull, rollPermanentPull, rollUniformFromPool } from "@/lib/gacha/pull";
import type { LimitedBannerConfig } from "@/lib/gacha/banners";

const banner: LimitedBannerConfig = {
  id: "test-banner",
  name: "Test Banner",
  featured: ["duke", "lyra", "batra"],
  rate: 0.05,
  endsAt: "2026-09-05T00:00:00.000Z",
};

describe("rollLimitedPull", () => {
  it("hits the featured pool when rng is just under the rate", () => {
    const result = rollLimitedPull(banner, () => 0.049);
    expect(result.kind).toBe("character");
  });

  it("does not hit at exactly the rate boundary (uses < not <=)", () => {
    const result = rollLimitedPull(banner, () => 0.05);
    expect(result.kind).not.toBe("character");
  });

  it("picks the first featured unit when rng is 0 on a hit", () => {
    const result = rollLimitedPull(banner, () => 0);
    expect(result).toEqual({ kind: "character", characterId: "duke" });
  });

  it("picks the last featured unit when the index-pick roll is just under 1", () => {
    // rollLimitedPull makes 2 rng() calls on a hit: the hit-check, then the
    // featured-index pick. A constant-value stub can't satisfy "hit" (needs
    // a low value) and "last index" (needs a high value) at once, so this
    // uses a small sequence stub instead — first call low (hit), second
    // call high (last of 3 featured slots).
    const sequence = [0.01, 0.99];
    let call = 0;
    const rng = () => sequence[call++ % sequence.length];
    const result = rollLimitedPull(banner, rng);
    expect(result).toEqual({ kind: "character", characterId: "batra" });
  });

  it("lands in the currency category on a miss with a low miss-roll", () => {
    // hitRoll=0.1 misses (0.1 >= the 0.05 rate); missRoll reuses the same
    // 0.1, landing in the first third [0, 0.333) → coin category.
    const result = rollLimitedPull(banner, () => 0.1);
    expect(result.kind).toBe("coin");
  });

  it("lands in the level-mat category on a miss with a mid miss-roll", () => {
    const result = rollLimitedPull(banner, () => 0.4);
    expect(result).toEqual({ kind: "material", materialId: expect.stringMatching(/^training_manual/), amount: 1 });
  });

  it("lands in the specialty-mat category on a miss with a high miss-roll", () => {
    const result = rollLimitedPull(banner, () => 0.9);
    expect(result.kind).toBe("material");
    if (result.kind === "material") {
      expect(["riverstone_fragment", "scorched_ember", "bramble_thorn", "prism_dust"]).toContain(result.materialId);
    }
  });

  it("coin bundle is one of the 4 defined amounts", () => {
    const result = rollLimitedPull(banner, () => 0.1);
    expect(result.kind).toBe("coin");
    if (result.kind === "coin") {
      expect([1000, 2000, 5000, 10000]).toContain(result.amount);
    }
  });
});

describe("rollUniformFromPool", () => {
  it("returns null for an empty pool", () => {
    expect(rollUniformFromPool([], () => 0)).toBeNull();
  });

  it("picks the first entry when rng is 0", () => {
    expect(rollUniformFromPool(["a", "b", "c"], () => 0)).toBe("a");
  });

  it("picks the last entry when rng is just under 1", () => {
    expect(rollUniformFromPool(["a", "b", "c"], () => 0.99)).toBe("c");
  });
});

describe("rollPermanentPull", () => {
  it("returns null when the pool is empty", () => {
    expect(rollPermanentPull([], () => 0)).toBeNull();
  });

  it("always returns a character outcome for a non-empty pool (no miss category)", () => {
    const result = rollPermanentPull(["duke", "lyra"], () => 0);
    expect(result).toEqual({ kind: "character", characterId: "duke" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gachaPull.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gacha/pull'`

- [ ] **Step 3: Write `lib/gacha/pull.ts`**

```ts
import { materialForCharacter } from "@/lib/gacha/materials";
import type { LimitedBannerConfig } from "@/lib/gacha/banners";

export type PullOutcome =
  | { kind: "character"; characterId: string }
  | { kind: "coin"; amount: number }
  | { kind: "material"; materialId: string; amount: number };

const COIN_BUNDLES = [1000, 2000, 5000, 10000];
const LEVEL_MAT_TIERS = ["training_manual", "training_manual_advanced", "training_manual_premium"];

/** Uniform pick from a pool of character ids. Shared by the Permanent
 *  banner's every-pull-is-a-character roll and the 300-milestone's
 *  random-pull-from-the-whole-roster reward (both are the same operation:
 *  equal odds across a flat list of ids). Returns null for an empty pool
 *  instead of throwing, since callers (an unpopulated Permanent pool) are a
 *  real, expected state, not a bug. */
export function rollUniformFromPool(pool: string[], rng: () => number = Math.random): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

/** Limited banner roll: flat hit/miss, hit picks a featured unit, miss picks
 *  one of 3 equally-weighted item categories (currency / level-mat /
 *  local-specialty-mat), each split evenly within itself. See "The other
 *  95%" in docs/superpowers/specs/2026-08-01-gacha-design.md. */
export function rollLimitedPull(banner: LimitedBannerConfig, rng: () => number = Math.random): PullOutcome {
  const hitRoll = rng();
  if (hitRoll < banner.rate) {
    const characterId = rollUniformFromPool(banner.featured, rng);
    return { kind: "character", characterId: characterId! };
  }

  const missRoll = rng();
  const third = 1 / 3;
  if (missRoll < third) {
    const amount = COIN_BUNDLES[Math.floor(rng() * COIN_BUNDLES.length)];
    return { kind: "coin", amount };
  }
  if (missRoll < third * 2) {
    const materialId = LEVEL_MAT_TIERS[Math.floor(rng() * LEVEL_MAT_TIERS.length)];
    return { kind: "material", materialId, amount: 1 };
  }
  const characterId = rollUniformFromPool(banner.featured, rng)!;
  return { kind: "material", materialId: materialForCharacter(characterId), amount: 1 };
}

/** Permanent banner roll: no miss category at all — every pull is a
 *  character, equal odds across the whole pool. Returns null if the pool is
 *  empty (no character currently flagged `permanentPool: true`); the caller
 *  (store action) must refuse the pull in that case rather than call this. */
export function rollPermanentPull(pool: string[], rng: () => number = Math.random): PullOutcome | null {
  const characterId = rollUniformFromPool(pool, rng);
  return characterId ? { kind: "character", characterId } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/gachaPull.test.ts`
Expected: PASS (13/13)

- [ ] **Step 5: Commit**

```bash
git add lib/gacha/pull.ts tests/gachaPull.test.ts
git commit -m "feat: add gacha pull-roll engine (Limited hit/miss + Permanent uniform)"
```

---

## Task 4: Milestone bar engine

**Files:**
- Create: `lib/gacha/milestone.ts`
- Test: `tests/gachaMilestone.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/gachaMilestone.test.ts
import { describe, expect, it } from "vitest";
import {
  LIMITED_MILESTONE_300,
  LIMITED_MILESTONE_600,
  PERMANENT_MILESTONE_600,
  advanceLimitedBar,
  advancePermanentBar,
  canClaimLimited300,
  canClaimLimited600,
  canClaimPermanent600,
  resetLimitedLap,
  resetPermanentLap,
  type LimitedPityState,
} from "@/lib/gacha/milestone";

describe("advanceLimitedBar", () => {
  it("accumulates spend on the same banner", () => {
    const state: LimitedPityState = { bannerId: "debut-2026-08", bar: 100, claimed300: false };
    const result = advanceLimitedBar(state, "debut-2026-08", 30);
    expect(result).toEqual({ bannerId: "debut-2026-08", bar: 130, claimed300: false });
  });

  it("resets to 0 (and clears claimed300) before adding spend when the banner changes", () => {
    const state: LimitedPityState = { bannerId: "old-banner", bar: 250, claimed300: true };
    const result = advanceLimitedBar(state, "new-banner", 30);
    expect(result).toEqual({ bannerId: "new-banner", bar: 30, claimed300: false });
  });

  it("adopts the active banner id on first-ever spend (bannerId starts null)", () => {
    const state: LimitedPityState = { bannerId: null, bar: 0, claimed300: false };
    const result = advanceLimitedBar(state, "debut-2026-08", 3);
    expect(result).toEqual({ bannerId: "debut-2026-08", bar: 3, claimed300: false });
  });
});

describe("canClaimLimited300 / canClaimLimited600", () => {
  it("is not claimable just under the threshold", () => {
    expect(canClaimLimited300(299, false)).toBe(false);
    expect(canClaimLimited600(599)).toBe(false);
  });

  it("is claimable at exactly the threshold", () => {
    expect(canClaimLimited300(300, false)).toBe(true);
    expect(canClaimLimited600(600)).toBe(true);
  });

  it("300 is not claimable again once already claimed this lap", () => {
    expect(canClaimLimited300(450, true)).toBe(false);
  });

  it("600 stays claimable regardless of the 300 claimed flag (independent)", () => {
    expect(canClaimLimited600(600)).toBe(true);
  });
});

describe("resetLimitedLap", () => {
  it("zeroes the bar and clears claimed300, keeping the banner id", () => {
    const state: LimitedPityState = { bannerId: "debut-2026-08", bar: 650, claimed300: true };
    expect(resetLimitedLap(state)).toEqual({ bannerId: "debut-2026-08", bar: 0, claimed300: false });
  });
});

describe("Permanent bar", () => {
  it("advancePermanentBar accumulates", () => {
    expect(advancePermanentBar(100, 10)).toBe(110);
  });

  it("canClaimPermanent600 follows the same exact-threshold rule", () => {
    expect(canClaimPermanent600(599)).toBe(false);
    expect(canClaimPermanent600(600)).toBe(true);
  });

  it("resetPermanentLap zeroes the bar", () => {
    expect(resetPermanentLap()).toBe(0);
  });
});

describe("milestone constants", () => {
  it("are the locked spec numbers", () => {
    expect(LIMITED_MILESTONE_300).toBe(300);
    expect(LIMITED_MILESTONE_600).toBe(600);
    expect(PERMANENT_MILESTONE_600).toBe(600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gachaMilestone.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gacha/milestone'`

- [ ] **Step 3: Write `lib/gacha/milestone.ts`**

```ts
export const LIMITED_MILESTONE_300 = 300;
export const LIMITED_MILESTONE_600 = 600;
export const PERMANENT_MILESTONE_600 = 600;

export interface LimitedPityState {
  bannerId: string | null;
  bar: number;
  claimed300: boolean;
}

/** Advances the Limited bar by `amountSpent` gems. If the active banner has
 *  changed since the last spend, the bar (and the 300-claimed flag) resets
 *  to 0 first — the milestone bar never carries over between banners. */
export function advanceLimitedBar(
  state: LimitedPityState,
  activeBannerId: string,
  amountSpent: number,
): LimitedPityState {
  const base: LimitedPityState =
    state.bannerId === activeBannerId ? state : { bannerId: activeBannerId, bar: 0, claimed300: false };
  return { ...base, bar: base.bar + amountSpent };
}

/** 300 and 600 are independent — reaching 600 doesn't forfeit an unclaimed
 *  300, and either can be claimed in any order (or both, before either has
 *  been claimed). 300 can only be claimed once per lap. */
export function canClaimLimited300(bar: number, claimed300: boolean): boolean {
  return bar >= LIMITED_MILESTONE_300 && !claimed300;
}

export function canClaimLimited600(bar: number): boolean {
  return bar >= LIMITED_MILESTONE_600;
}

/** Only fires on an actual 600 claim (not the moment the bar crosses 600),
 *  so further spend between "reached" and "claimed" isn't lost. This is the
 *  only thing that starts a new lap — claiming 300 does not reset anything.
 *  Note: if 300 was never claimed before 600 is claimed, that lap's 300
 *  reward is forfeited once the reset happens — "independent" means claim
 *  order doesn't matter, not that an unclaimed reward survives a reset. */
export function resetLimitedLap(state: LimitedPityState): LimitedPityState {
  return { ...state, bar: 0, claimed300: false };
}

export function advancePermanentBar(bar: number, amountSpent: number): number {
  return bar + amountSpent;
}

export function canClaimPermanent600(bar: number): boolean {
  return bar >= PERMANENT_MILESTONE_600;
}

export function resetPermanentLap(): number {
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/gachaMilestone.test.ts`
Expected: PASS (13/13)

- [ ] **Step 5: Commit**

```bash
git add lib/gacha/milestone.ts tests/gachaMilestone.test.ts
git commit -m "feat: add milestone-bar pity engine (300/600, independent claims, reset-on-claim)"
```

---

## Task 5: Dupe → Ultimate Level resolution

**Files:**
- Create: `lib/gacha/dupes.ts`
- Test: `tests/gachaDupes.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/gachaDupes.test.ts
import { describe, expect, it } from "vitest";
import { resolvePullResult } from "@/lib/gacha/dupes";

describe("resolvePullResult", () => {
  it("a character not in the roster is new, starting at ultLevel 1", () => {
    const result = resolvePullResult("sara", ["duke"], {});
    expect(result).toEqual({ isNew: true, ultLevel: 1 });
  });

  it("a character already in the roster is a dupe, incrementing ultLevel", () => {
    const result = resolvePullResult("duke", ["duke"], { duke: { level: 5, ascension: 1, xp: 0, ultLevel: 2 } });
    expect(result).toEqual({ isNew: false, ultLevel: 3 });
  });

  it("a dupe on a character with no characters[] entry yet defaults from ultLevel 1", () => {
    // roster can contain an id before `characters[id]` exists (e.g. Duke's
    // free starter grant only touches roster, not characters).
    const result = resolvePullResult("duke", ["duke"], {});
    expect(result).toEqual({ isNew: false, ultLevel: 2 });
  });

  it("caps ultLevel at 6 — a dupe past the cap is a no-op increment", () => {
    const result = resolvePullResult("duke", ["duke"], { duke: { level: 40, ascension: 3, xp: 0, ultLevel: 6 } });
    expect(result).toEqual({ isNew: false, ultLevel: 6 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gachaDupes.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gacha/dupes'`

- [ ] **Step 3: Write `lib/gacha/dupes.ts`**

```ts
export interface DupeResolution {
  isNew: boolean;
  ultLevel: number;
}

const MAX_ULT_LEVEL = 6;

/** A pull result lands on a character already owned (dupe) or not owned
 *  (new). Reused by every reward source — normal pulls, the 300 milestone,
 *  and the 600 milestone — since dupe handling is identical everywhere.
 *  Dupes past ultLevel 6 currently do nothing extra (no bonus reward) —
 *  that's an open tuning question in the design spec, not a bug. */
export function resolvePullResult(
  characterId: string,
  roster: string[],
  characters: Record<string, { ultLevel?: number }>,
): DupeResolution {
  const owned = roster.includes(characterId);
  if (!owned) {
    return { isNew: true, ultLevel: 1 };
  }
  const current = characters[characterId]?.ultLevel ?? 1;
  return { isNew: false, ultLevel: Math.min(current + 1, MAX_ULT_LEVEL) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/gachaDupes.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add lib/gacha/dupes.ts tests/gachaDupes.test.ts
git commit -m "feat: add gacha dupe-to-Ultimate-Level resolution"
```

---

## Task 6: `playerStore` schema changes + migration v2→v3

**Files:**
- Modify: `store/playerStore.ts`
- Modify: `tests/playerStoreMigration.test.ts`

- [ ] **Step 1: Write the failing migration tests**

**First, update the 4 pre-existing `v1 to v2` tests already in this file.**
Migrations chain — `migratePlayerState` will run the v1→v2 step and then
immediately fall through to the new v3 step in the same call, so a v1 input
now comes out fully v3-shaped, not v2-shaped. Update each existing
`expect(result.currencies)...`/`expect(result)...` assertion in the
`describe("migratePlayerState — v1 (inventory.gems) to v2 (currencies split)"...)`
block:

```ts
  it("moves inventory.gems into currencies.gems and clears inventory to materials only", () => {
    const v1 = {
      uid: "abc",
      roster: ["duke", "seras"],
      inventory: { gems: 2500 },
      pity: { standard: 3, limited: 0 },
    };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies).toEqual({ gems: 2500, coin: 0, permanentTicket: 0 });
    expect(result.inventory).toEqual({});
    expect(result.roster).toEqual(["duke", "seras"]);
    expect(result.characters).toEqual({});
    expect(result.stamina.current).toBe(120);
    expect(result.pity).toEqual({
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    });
  });

  it("defaults gems to 1000 if the v1 inventory had none", () => {
    const v1 = { uid: null, roster: ["duke"], inventory: {}, pity: { standard: 0, limited: 0 } };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies.gems).toBe(1000);
    expect(result.currencies.permanentTicket).toBe(0);
  });

  it("preserves other pre-existing material keys alongside the gems split", () => {
    const v1 = {
      uid: null,
      roster: ["duke"],
      inventory: { gems: 2500, sea_monster_eye: 1 },
      pity: { standard: 0, limited: 0 },
    };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies.gems).toBe(2500);
    expect(result.inventory).toEqual({ sea_monster_eye: 1 });
  });

  it("passes through unchanged when already at the current version", () => {
    const v3 = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
      inventory: { sea_monster_eye: 3 },
      characters: { duke: { level: 5, ascension: 1, xp: 20, ultLevel: 2 } },
      stamina: { current: 80, updatedAt: 12345 },
      pity: { limited: { bannerId: "debut-2026-08", bar: 30, claimed300: false }, permanent: { bar: 0 } },
    };
    const result = migratePlayerState(v3, 3);
    expect(result).toEqual(v3);
  });
```

(The last case replaces the old "passes through unchanged" v2 test — it now
asserts against v3, since v3 is the current version. The old v2-shaped input
for that specific case no longer applies once version 3 exists.)

Then add the new v2→v3-specific cases to the bottom of the file:

```ts
describe("migratePlayerState — v2 to v3 (gacha fields)", () => {
  it("adds permanentTicket:0, restructures pity, and defaults ultLevel:1 on existing characters", () => {
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
    expect(result.currencies).toEqual({ gems: 500, coin: 10000, permanentTicket: 0 });
    expect(result.pity).toEqual({
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    });
    expect(result.characters.duke).toEqual({ level: 5, ascension: 1, xp: 20, ultLevel: 1 });
  });
});
```

(The "passes through unchanged at the current version" case is already covered
by the updated v1-block test above — no need to duplicate it here.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/playerStoreMigration.test.ts`
Expected: FAIL — new v2→v3 assertions don't match current migration (still version-2 shape)

- [ ] **Step 3: Update `store/playerStore.ts`**

Update the `CharacterProgress` interface (top of file):

```ts
export interface CharacterProgress {
  level: number;
  ascension: number;
  xp: number;
  ultLevel: number;
}
```

Update `PlayerState`'s `currencies` and `pity` fields:

```ts
  currencies: { gems: number; coin: number; permanentTicket: number };
  // ...
  pity: {
    limited: { bannerId: string | null; bar: number; claimed300: boolean };
    permanent: { bar: number };
  };
```

Update `defaultState`:

```ts
const defaultState = {
  uid: null,
  roster: ["duke"],
  currencies: { gems: 1000, coin: 0, permanentTicket: 0 },
  inventory: {} as Record<string, number>,
  characters: {} as Record<string, CharacterProgress>,
  stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
  pity: {
    limited: { bannerId: null, bar: 0, claimed300: false },
    permanent: { bar: 0 },
  },
};
```

Update `migratePlayerState` — bump the version check and chain a v3 step. Replace the whole function:

```ts
export function migratePlayerState(persistedState: unknown, version: number): PersistedPlayerData {
  let state = persistedState as Record<string, unknown>;

  if (version < 2) {
    const oldInventory = (state.inventory as Record<string, number> | undefined) ?? {};
    const { gems, ...materials } = oldInventory;
    state = {
      ...state,
      currencies: { gems: gems ?? 1000, coin: 0 },
      inventory: materials,
      characters: {},
      stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
    };
  }

  if (version < 3) {
    const oldCurrencies = (state.currencies as { gems: number; coin: number } | undefined) ?? { gems: 1000, coin: 0 };
    const oldCharacters =
      (state.characters as Record<string, { level: number; ascension: number; xp: number }> | undefined) ?? {};
    const migratedCharacters: Record<string, CharacterProgress> = {};
    for (const [id, progress] of Object.entries(oldCharacters)) {
      migratedCharacters[id] = { ...progress, ultLevel: 1 };
    }
    state = {
      ...state,
      currencies: { ...oldCurrencies, permanentTicket: 0 },
      characters: migratedCharacters,
      pity: {
        limited: { bannerId: null, bar: 0, claimed300: false },
        permanent: { bar: 0 },
      },
    };
  }

  return state as unknown as PersistedPlayerData;
}
```

Update the persist config's `version`:

```ts
    {
      name: 'toll-player-storage',
      version: 3,
      migrate: migratePlayerState,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/playerStoreMigration.test.ts`
Expected: PASS (all cases, including the pre-existing v1→v2 ones — check they still pass since v1 states now fall through both `if` blocks)

- [ ] **Step 5: Update `tests/playerStoreActions.test.ts`'s `resetToKnownState` to the new shape**

The existing `resetToKnownState()` helper (top of `tests/playerStoreActions.test.ts`) sets `currencies: { gems: 1000, coin: 100000 }` and `pity: { standard: 0, limited: 0 }` — both now stale shapes that no longer type-check. Update it:

```ts
function resetToKnownState() {
  usePlayerStore.setState({
    uid: null,
    roster: ["duke"],
    currencies: { gems: 1000, coin: 100000, permanentTicket: 0 },
    inventory: {
      sea_monster_eye: 5,
      corroded_seaweed: 20,
      training_manual: 3,
    },
    characters: {},
    stamina: { current: 120, updatedAt: Date.now() },
    pity: {
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    },
    hasHydrated: true,
  });
}
```

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: all green — `tsc` will catch any other stale `pity`/`currencies` shape references if they exist; fix any that surface the same way as Step 5.

- [ ] **Step 7: Commit**

```bash
git add store/playerStore.ts tests/playerStoreMigration.test.ts tests/playerStoreActions.test.ts
git commit -m "feat: playerStore v3 — permanentTicket currency, restructured pity, ultLevel"
```

---

## Task 7: `playerStore` gacha actions (pull, claim)

**Files:**
- Modify: `store/playerStore.ts`
- Test: `tests/playerStoreGacha.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/playerStoreGacha.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/store/playerStore";

function resetToKnownState() {
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

  it("refuses a character not in the permanent pool", () => {
    usePlayerStore.setState((s) => ({ pity: { ...s.pity, permanent: { bar: 600 } } }));
    expect(usePlayerStore.getState().claimPermanent600("duke")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/playerStoreGacha.test.ts`
Expected: FAIL — `pullLimited`/`pullPermanent`/`claimLimited300`/`claimLimited600`/`claimPermanent600` don't exist on the store yet

- [ ] **Step 3: Add the actions to `store/playerStore.ts`**

Add these imports at the top:

```ts
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";
import { rollLimitedPull, rollPermanentPull, rollUniformFromPool, type PullOutcome } from "@/lib/gacha/pull";
import {
  advanceLimitedBar,
  advancePermanentBar,
  canClaimLimited300,
  canClaimLimited600,
  canClaimPermanent600,
  resetLimitedLap,
  resetPermanentLap,
} from "@/lib/gacha/milestone";
import { resolvePullResult } from "@/lib/gacha/dupes";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
```

Add these constants near the top of the file (after the imports):

```ts
const LIMITED_COST_SINGLE = 3;
const LIMITED_COST_MULTI = 30;
const PERMANENT_COST_SINGLE = 1;
const PERMANENT_COST_MULTI = 10;
```

Add these fields to the `PlayerState` interface (alongside the other action signatures):

```ts
  pullLimited: (count: 1 | 11) => PullOutcome[] | false;
  pullPermanent: (count: 1 | 11) => PullOutcome[] | false;
  claimLimited300: () => PullOutcome | false;
  claimLimited600: (characterId: string) => PullOutcome | false;
  claimPermanent600: (characterId: string) => PullOutcome | false;
```

Add the same 5 keys to the `PersistedPlayerData` omit-list (the `Omit<PlayerState, ...>` block).

Add the implementations inside the store body, after `grantWorldBossRewards` and before the closing `}),`:

```ts
      pullLimited: (count) => {
        const state = get();
        const banner = getActiveLimitedBanner();
        const cost = count === 1 ? LIMITED_COST_SINGLE : LIMITED_COST_MULTI;
        if (state.currencies.gems < cost) return false;

        let coin = state.currencies.coin;
        const inventory = { ...state.inventory };
        const roster = [...state.roster];
        const characters = { ...state.characters };
        const results: PullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const outcome = rollLimitedPull(banner);
          results.push(outcome);
          if (outcome.kind === "character") {
            const resolution = resolvePullResult(outcome.characterId, roster, characters);
            if (resolution.isNew) roster.push(outcome.characterId);
            const existing = characters[outcome.characterId] ?? { level: 1, ascension: 0, xp: 0, ultLevel: 1 };
            characters[outcome.characterId] = { ...existing, ultLevel: resolution.ultLevel };
          } else if (outcome.kind === "coin") {
            coin += outcome.amount;
          } else {
            inventory[outcome.materialId] = (inventory[outcome.materialId] ?? 0) + outcome.amount;
          }
        }

        const limitedPity = advanceLimitedBar(state.pity.limited, banner.id, cost);
        set({
          currencies: { ...state.currencies, gems: state.currencies.gems - cost, coin },
          inventory,
          roster,
          characters,
          pity: { ...state.pity, limited: limitedPity },
        });
        return results;
      },

      pullPermanent: (count) => {
        const state = get();
        const banner = getPermanentBanner();
        if (banner.featured.length === 0) return false;
        const cost = count === 1 ? PERMANENT_COST_SINGLE : PERMANENT_COST_MULTI;
        if (state.currencies.permanentTicket < cost) return false;

        const roster = [...state.roster];
        const characters = { ...state.characters };
        const results: PullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const outcome = rollPermanentPull(banner.featured);
          if (!outcome) break;
          results.push(outcome);
          const resolution = resolvePullResult(outcome.characterId, roster, characters);
          if (resolution.isNew) roster.push(outcome.characterId);
          const existing = characters[outcome.characterId] ?? { level: 1, ascension: 0, xp: 0, ultLevel: 1 };
          characters[outcome.characterId] = { ...existing, ultLevel: resolution.ultLevel };
        }

        const permanentBar = advancePermanentBar(state.pity.permanent.bar, cost);
        set({
          currencies: { ...state.currencies, permanentTicket: state.currencies.permanentTicket - cost },
          roster,
          characters,
          pity: { ...state.pity, permanent: { bar: permanentBar } },
        });
        return results;
      },

      claimLimited300: () => {
        const state = get();
        if (!canClaimLimited300(state.pity.limited.bar, state.pity.limited.claimed300)) return false;
        const pool = getPlayableCharacters().map((c) => c.id);
        const characterId = rollUniformFromPool(pool);
        if (!characterId) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = state.characters[characterId] ?? { level: 1, ascension: 0, xp: 0, ultLevel: 1 };

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, limited: { ...state.pity.limited, claimed300: true } },
        });
        return { kind: "character", characterId };
      },

      claimLimited600: (characterId) => {
        const state = get();
        const banner = getActiveLimitedBanner();
        if (!canClaimLimited600(state.pity.limited.bar)) return false;
        if (!banner.featured.includes(characterId)) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = state.characters[characterId] ?? { level: 1, ascension: 0, xp: 0, ultLevel: 1 };

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, limited: resetLimitedLap(state.pity.limited) },
        });
        return { kind: "character", characterId };
      },

      claimPermanent600: (characterId) => {
        const state = get();
        const banner = getPermanentBanner();
        if (!canClaimPermanent600(state.pity.permanent.bar)) return false;
        if (!banner.featured.includes(characterId)) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = state.characters[characterId] ?? { level: 1, ascension: 0, xp: 0, ultLevel: 1 };

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, permanent: { bar: resetPermanentLap() } },
        });
        return { kind: "character", characterId };
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/playerStoreGacha.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Run the full check and commit**

Run: `npm run check`

```bash
git add store/playerStore.ts tests/playerStoreGacha.test.ts
git commit -m "feat: wire gacha pull/claim actions into playerStore"
```

---

## Task 8: World Boss faucet — small gem/ticket drip

**Files:**
- Modify: `lib/game/worldBossRewards.ts`
- Modify: `store/playerStore.ts` (`grantWorldBossRewards`)
- Test: `tests/worldBossRewards.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/worldBossRewards.test.ts`:

```ts
  it("grants gems minimum (20) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.gems).toBe(20);
  });

  it("grants gems maximum (50) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.gems).toBe(50);
  });

  it("grants permanentTicket minimum (1) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.permanentTicket).toBe(1);
  });

  it("grants permanentTicket maximum (3) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.permanentTicket).toBe(3);
  });
```

(These go inside the existing `describe("rollWorldBossRewards", ...)` block, alongside the current cases.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldBossRewards.test.ts`
Expected: FAIL — `result.gems`/`result.permanentTicket` are `undefined`

- [ ] **Step 3: Extend `lib/game/worldBossRewards.ts`**

```ts
export const BONUS_CHANCE = 0.1;
export const BASE_SEA_MONSTER_EYE = 1;
export const BASE_CORRODED_SEAWEED = 2;
export const TRAINING_MANUAL_MIN = 3;
export const TRAINING_MANUAL_MAX = 6;
export const COIN_MIN = 2000;
export const COIN_MAX = 10000;
export const GEMS_MIN = 20;
export const GEMS_MAX = 50;
export const PERMANENT_TICKET_MIN = 1;
export const PERMANENT_TICKET_MAX = 3;

export interface WorldBossRewards {
  sea_monster_eye: number;
  corroded_seaweed: number;
  training_manual: number;
  coin: number;
  gems: number;
  permanentTicket: number;
}

/** Molvarr's per-clear reward roll. `rng` is injectable (defaults to
 *  Math.random) so tests can force both the base and +1-bonus branches
 *  deterministically. Gems/permanentTicket are the only real faucet for
 *  either gacha currency right now — see
 *  docs/superpowers/specs/2026-08-01-gacha-design.md's "Faucet" section. */
export function rollWorldBossRewards(rng: () => number = Math.random): WorldBossRewards {
  return {
    sea_monster_eye: BASE_SEA_MONSTER_EYE + (rng() < BONUS_CHANCE ? 1 : 0),
    corroded_seaweed: BASE_CORRODED_SEAWEED + (rng() < BONUS_CHANCE ? 1 : 0),
    training_manual: TRAINING_MANUAL_MIN + Math.floor(rng() * (TRAINING_MANUAL_MAX - TRAINING_MANUAL_MIN + 1)),
    coin: COIN_MIN + Math.floor(rng() * (COIN_MAX - COIN_MIN + 1)),
    gems: GEMS_MIN + Math.floor(rng() * (GEMS_MAX - GEMS_MIN + 1)),
    permanentTicket:
      PERMANENT_TICKET_MIN + Math.floor(rng() * (PERMANENT_TICKET_MAX - PERMANENT_TICKET_MIN + 1)),
  };
}
```

- [ ] **Step 4: Wire the new fields into `grantWorldBossRewards` in `store/playerStore.ts`**

Find:

```ts
      grantWorldBossRewards: (rewards) => {
        const { coin, ...materials } = rewards;
        get().grantMaterials(materials);
        if (coin) get().grantCurrency({ coin });
      },
```

Replace with:

```ts
      grantWorldBossRewards: (rewards) => {
        const { coin, gems, permanentTicket, ...materials } = rewards;
        get().grantMaterials(materials);
        if (coin || gems) get().grantCurrency({ coin, gems });
        if (permanentTicket) {
          set((state) => ({
            currencies: { ...state.currencies, permanentTicket: state.currencies.permanentTicket + permanentTicket },
          }));
        }
      },
```

`grantCurrency` already accepts a `Partial<{ gems, coin }>` and adds whichever keys are present (see its existing implementation) — no change needed there. `permanentTicket` isn't part of `grantCurrency`'s type, so it's granted with a direct `set()` instead, matching the pattern already used elsewhere in this file for fields `grantCurrency` doesn't cover.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/worldBossRewards.test.ts`
Expected: PASS (all cases, old + new)

- [ ] **Step 6: Run the full check and commit**

Run: `npm run check`

```bash
git add lib/game/worldBossRewards.ts store/playerStore.ts tests/worldBossRewards.test.ts
git commit -m "feat: add gems/permanentTicket to World Boss clear rewards (gacha faucet)"
```

---

## Task 9: Archive owned/unowned + Ultimate Level badge

**Files:**
- Modify: `components/game/CharacterBrowser.tsx`

- [ ] **Step 1: Add the store read + badge markup**

At the top of `components/game/CharacterBrowser.tsx` (it's already `"use client"`), add the import:

```ts
import { usePlayerStore } from "@/store/playerStore";
```

Inside the component function (near its other hooks), add:

```ts
  const roster = usePlayerStore((s) => s.roster);
  const characters = usePlayerStore((s) => s.characters);
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
```

In the tile-render block (the `filtered.map((character) => { ... })` from the earlier read, right after the `const style = COLOR_STYLES[character.color];` line), add:

```ts
            const owned = hasHydrated && roster.includes(character.id);
            const ultLevel = characters[character.id]?.ultLevel ?? 1;
```

Then, inside the tile's image wrapper `<div className="relative flex aspect-square ...">` (right after the existing color-chip `<span>` that shows `{character.color}`), add a second badge:

```tsx
                  {hasHydrated && !owned ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/70 font-body text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Not Owned
                    </span>
                  ) : null}
                  {owned && ultLevel > 1 ? (
                    <span className="absolute bottom-1.5 right-1.5 border border-amber-300/70 bg-black/70 px-1.5 py-0.5 font-body text-[9px] font-bold text-amber-200">
                      Lv.{ultLevel}
                    </span>
                  ) : null}
```

(`hasHydrated` gates the "Not Owned" overlay specifically — per the existing convention documented on `hasHydrated` itself in `store/playerStore.ts` — so a not-yet-hydrated client doesn't flash "Not Owned" over characters the player actually owns.)

- [ ] **Step 2: Manual verification (no unit test — this is a visual/store-read wiring change on an existing component with no dedicated test file)**

Run: `npm run build`
Expected: succeeds. Then start `npm run dev`, open `/archive`, confirm: Duke shows no "Not Owned" overlay (starter character); every other character shows "Not Owned" on a fresh player state; pulling a dupe (once Task 7's actions are wired into UI in a later task) should make the "Lv.N" badge appear.

- [ ] **Step 3: Run the full check and commit**

Run: `npm run check`

```bash
git add components/game/CharacterBrowser.tsx
git commit -m "feat: show owned/unowned + Ultimate Level badges on archive tiles"
```

---

## Task 10: Dev-grant panel additions for gacha QA

**Files:**
- Modify: `components/game/DevGrantPanel.tsx`

- [ ] **Step 1: Add gacha-testing buttons**

In `components/game/DevGrantPanel.tsx`, extend the `MATERIAL_IDS` array:

```ts
const MATERIAL_IDS = [
  "sea_monster_eye",
  "corroded_seaweed",
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
  "riverstone_fragment",
  "scorched_ember",
  "bramble_thorn",
  "prism_dust",
] as const;
```

In the top button row (after the existing `grantCurrency` buttons), add:

```tsx
          <Button variant="outline" onClick={() => grantCurrency({ permanentTicket: 100 })}>+100 Tickets</Button>
          <Button
            variant="outline"
            onClick={() =>
              setPlayerState({
                pity: { ...usePlayerStore.getState().pity, limited: { ...usePlayerStore.getState().pity.limited, bar: 300 } },
              })
            }
          >
            Force Limited bar to 300
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setPlayerState({
                pity: { ...usePlayerStore.getState().pity, limited: { ...usePlayerStore.getState().pity.limited, bar: 600 } },
              })
            }
          >
            Force Limited bar to 600
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setPlayerState({ pity: { ...usePlayerStore.getState().pity, permanent: { bar: 600 } } })
            }
          >
            Force Permanent bar to 600
          </Button>
```

**Already done as of Task 8** — its implementer widened `grantCurrency` to `Partial<{ gems: number; coin: number; permanentTicket: number }>` (with a `...state.currencies` spread so future fields can't silently drop) and simplified `grantWorldBossRewards` to a single `grantCurrency({ coin, gems, permanentTicket })` call, ahead of schedule but reviewed and approved. **Nothing to do here** — verify `store/playerStore.ts`'s `grantCurrency`/`grantWorldBossRewards` already look like this rather than re-deriving them; `git add store/playerStore.ts` in this task's Step 3 will be a no-op diff.

- [ ] **Step 2: Manual verification**

Run: `npm run build` (dev panel is `NODE_ENV`-gated out of production, but must still compile)
Expected: succeeds

- [ ] **Step 3: Run the full check and commit**

Run: `npm run check`

```bash
git add components/game/DevGrantPanel.tsx store/playerStore.ts
git commit -m "feat: extend DevGrantPanel + grantCurrency for gacha QA (tickets, forced pity)"
```

---

## Task 11: `/gacha` banner screen shell (Layout A, no animation yet)

**Files:**
- Create: `app/gacha/page.tsx`
- Create: `components/gacha/BannerScreen.tsx`
- Create: `public/banners/debut-2026-08-placeholder.svg`

- [ ] **Step 1: Create the placeholder splash art**

**Do not use ComfyUI for this — it's a hand-written SVG placeholder, per this session's instruction to leave art generation alone.**

```svg
<!-- public/banners/debut-2026-08-placeholder.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="768" viewBox="0 0 1536 768">
  <rect width="1536" height="768" fill="#18181b" />
  <rect x="0" y="0" width="1536" height="768" fill="url(#g)" opacity="0.5" />
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#78350f" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
  </defs>
  <text x="768" y="384" fill="#fcd34d" font-family="sans-serif" font-size="48" font-weight="700"
        text-anchor="middle" letter-spacing="4">DEBUT BANNER</text>
  <text x="768" y="440" fill="#a1a1aa" font-family="sans-serif" font-size="20"
        text-anchor="middle" letter-spacing="2">placeholder — real splash art pending</text>
</svg>
```

- [ ] **Step 2: Create `app/gacha/page.tsx`**

```tsx
import BannerScreen from "@/components/gacha/BannerScreen";

export default function GachaPage() {
  return <BannerScreen />;
}
```

- [ ] **Step 3: Create `components/gacha/BannerScreen.tsx`**

```tsx
"use client";

import Image from "next/image";
import React from "react";
import { usePlayerStore } from "@/store/playerStore";
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";
import { canClaimLimited300, canClaimLimited600, canClaimPermanent600 } from "@/lib/gacha/milestone";

type Tab = "limited" | "permanent";

export default function BannerScreen() {
  const [tab, setTab] = React.useState<Tab>("limited");
  const currencies = usePlayerStore((s) => s.currencies);
  const pity = usePlayerStore((s) => s.pity);
  const pullLimited = usePlayerStore((s) => s.pullLimited);
  const pullPermanent = usePlayerStore((s) => s.pullPermanent);

  const limitedBanner = getActiveLimitedBanner();
  const permanentBanner = getPermanentBanner();

  const isLimited = tab === "limited";
  const bar = isLimited ? pity.limited.bar : pity.permanent.bar;
  const barPercent = Math.min((bar / 600) * 100, 100);

  const claimable300 = isLimited && canClaimLimited300(pity.limited.bar, pity.limited.claimed300);
  const claimable600 = isLimited ? canClaimLimited600(pity.limited.bar) : canClaimPermanent600(pity.permanent.bar);

  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-4 flex border-b-2 border-zinc-800">
          {(["limited", "permanent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-0.5 border-b-2 px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                tab === t ? "border-amber-400 text-amber-200" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "limited" ? "Limited" : "Permanent"}
            </button>
          ))}
        </div>

        <div className="relative aspect-[2/1] w-full overflow-hidden border border-zinc-800 bg-zinc-900">
          <Image
            src="/banners/debut-2026-08-placeholder.svg"
            alt={limitedBanner.name}
            fill
            className="object-cover"
          />
        </div>

        <h1 className="mt-3 font-heading text-3xl tracking-[0.08em] text-zinc-100">
          {isLimited ? limitedBanner.name : "Permanent Banner"}
        </h1>
        {isLimited ? (
          <p className="font-body text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Ends {new Date(limitedBanner.endsAt).toLocaleDateString()}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end font-body text-sm text-amber-200">
          {isLimited ? `◆ ${currencies.gems.toLocaleString()} gems` : `◆ ${currencies.permanentTicket.toLocaleString()} tickets`}
        </div>

        <div className="mt-2">
          <div className="flex justify-between font-body text-[9px] uppercase tracking-[0.08em] text-zinc-500">
            <span>Milestone</span>
            <span>{bar} / 600</span>
          </div>
          <div className="relative mt-1 h-2 rounded bg-zinc-800">
            <div className="h-full rounded bg-amber-400" style={{ width: `${barPercent}%` }} />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => (isLimited ? pullLimited(1) : pullPermanent(1))}
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 py-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-100"
          >
            Draw ×1
          </button>
          <button
            onClick={() => (isLimited ? pullLimited(11) : pullPermanent(11))}
            className="flex-1 rounded bg-amber-400 py-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-950"
          >
            Draw ×11
          </button>
        </div>

        {claimable300 || claimable600 ? (
          <div className="mt-3 flex gap-2 border-t border-zinc-800 pt-3 font-body text-xs text-zinc-400">
            {claimable300 ? <span>300 milestone ready to claim</span> : null}
            {claimable600 ? <span>600 milestone ready to claim</span> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
```

(Milestone claiming here is just a text hint for now — the real Claim buttons + 600 picker modal are built in Task 13.)

- [ ] **Step 2: Manual verification**

Run: `npm run build`
Expected: succeeds, `/gacha` in the route list

Start `npm run dev`, open `/gacha`: confirm Layout A shape (tabs → splash → name → currency → bar → buttons), confirm switching tabs swaps currency/bar/buttons between gems/tickets.

- [ ] **Step 3: Run the full check and commit**

Run: `npm run check`

```bash
git add app/gacha/page.tsx components/gacha/BannerScreen.tsx public/banners/debut-2026-08-placeholder.svg
git commit -m "feat: add /gacha banner screen shell (Layout A, static)"
```

---

## Task 12: Rates modal

**Files:**
- Create: `components/gacha/RatesModal.tsx`
- Modify: `components/gacha/BannerScreen.tsx`

- [ ] **Step 1: Create `components/gacha/RatesModal.tsx`**

```tsx
"use client";

import { getCharacterById } from "@/lib/game/characterCatalog";

interface RatesModalProps {
  featured: string[];
  rate: number;
  onClose: () => void;
}

export default function RatesModal({ featured, rate, onClose }: RatesModalProps) {
  const perUnitPercent = ((rate / featured.length) * 100).toFixed(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto border border-zinc-700 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-xl text-zinc-100">Rates</h2>
        <p className="mt-1 font-body text-xs text-zinc-500">
          Overall featured rate: {(rate * 100).toFixed(2)}%
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {featured.map((id) => {
            const character = getCharacterById(id);
            return (
              <li key={id} className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-body text-sm">
                <span className="text-zinc-200">{character?.name ?? id}</span>
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                    Rate Up
                  </span>
                  {perUnitPercent}%
                </span>
              </li>
            );
          })}
        </ul>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded border border-zinc-700 py-2 font-body text-xs uppercase tracking-widest text-zinc-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `BannerScreen.tsx`**

Add state and the trigger link, plus the modal render:

```ts
  const [showRates, setShowRates] = React.useState(false);
```

After the Draw buttons `<div>` in the JSX, add:

```tsx
        <button
          onClick={() => setShowRates(true)}
          className="mt-2 w-full text-center font-body text-[10px] uppercase tracking-[0.1em] text-zinc-500 underline underline-offset-2"
        >
          Rates
        </button>
```

At the end of the component, before the closing `</main>`, add:

```tsx
        {showRates ? (
          <RatesModal
            featured={isLimited ? limitedBanner.featured : permanentBanner.featured}
            rate={isLimited ? limitedBanner.rate : 1 / Math.max(permanentBanner.featured.length, 1)}
            onClose={() => setShowRates(false)}
          />
        ) : null}
```

Add the import at the top: `import RatesModal from "@/components/gacha/RatesModal";`

- [ ] **Step 3: Manual verification**

Run: `npm run build`, then `npm run dev`, open `/gacha`, click "Rates" — confirm the modal lists every featured character with a %, and closes on backdrop click or the Close button.

- [ ] **Step 4: Run the full check and commit**

Run: `npm run check`

```bash
git add components/gacha/RatesModal.tsx components/gacha/BannerScreen.tsx
git commit -m "feat: add gacha Rates modal"
```

---

## Task 12.5: Fix AuthProvider cloud-load to run migratePlayerState (discovered during Task 12 review)

**Why this exists:** Task 6 flagged that `hooks/AuthProvider.tsx`'s Firestore cloud-load path never calls `migratePlayerState` — only zustand-persist's localStorage path does — and that no `version` field is ever written to Firestore. Task 12's spec reviewer reproduced this live: opening `/gacha` on the dev Firebase account (which has a pre-v3 cloud `pity` doc, `{limited: 0, standard: 0}`) crashes with `Cannot read properties of undefined (reading 'bar')`, because `data.pity || DEFAULT_PITY` only substitutes the whole object when falsy — it doesn't migrate a truthy-but-stale-shaped one. This blocks live-testing every remaining gacha task for a logged-in account, so it's fixed now rather than deferred further.

**Files:**
- Modify: `store/playerStore.ts` (export the current persist version as a named constant)
- Modify: `hooks/AuthProvider.tsx`

- [ ] **Step 1: Export the current version number from `store/playerStore.ts`**

Find the `persist(..., { name: 'toll-player-storage', version: 3, ...})` config block. Add a named constant above the `usePlayerStore` definition and reference it in both places:

```ts
export const CURRENT_PLAYER_STATE_VERSION = 3;
```

Change `version: 3,` inside the persist config to `version: CURRENT_PLAYER_STATE_VERSION,`.

- [ ] **Step 2: Use `migratePlayerState` on the Firestore cloud-load path**

In `hooks/AuthProvider.tsx`, add `migratePlayerState`, `CURRENT_PLAYER_STATE_VERSION` to the existing import from `@/store/playerStore` (alongside `usePlayerStore`, `PlayerState`, `DEFAULT_PITY` — `DEFAULT_PITY` can be removed from the import if nothing else in the file uses it after this change, check first). Replace the `if (docSnap.exists())` branch's manual per-field defaulting:

```ts
          if (docSnap.exists()) {
            const data = docSnap.data();
            const migrated = migratePlayerState(data, data.version ?? 1);
            skipSyncRef.current = true;
            setPlayerState({
              uid: currentUser.uid,
              roster: migrated.roster,
              currencies: migrated.currencies,
              inventory: migrated.inventory,
              characters: migrated.characters,
              stamina: migrated.stamina,
              pity: migrated.pity,
            });
          } else {
```

`data.version ?? 1` is safe for every doc that currently exists in this project's Firestore (none of them have ever had a `version` field, and none of them predate the v1 shape either — this game has no other real production users yet) — treating an unversioned doc as v1 runs it through the full v1→v3 migration chain, which is correct for every real document that exists today. Once Step 3 below ships, every doc gets a `version` field on its next write, so this fallback only ever matters for genuinely-pre-v3 docs going forward.

- [ ] **Step 3: Write the version field on every Firestore save**

In the same `else` branch (new-user seed) a few lines down, add `version: CURRENT_PLAYER_STATE_VERSION` to the `setDoc` call:

```ts
            const state = usePlayerStore.getState();
            await setDoc(docRef, {
              roster: state.roster,
              currencies: state.currencies,
              inventory: state.inventory,
              characters: state.characters,
              stamina: state.stamina,
              pity: state.pity,
              version: CURRENT_PLAYER_STATE_VERSION,
            });
```

And in `saveToCloud` (the debounced auto-sync writer further down), add the same field:

```ts
  const saveToCloud = React.useCallback(async (state: Partial<PlayerState>) => {
    if (!user || !db) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const { roster, currencies, inventory, characters, stamina, pity } = {
        ...usePlayerStore.getState(),
        ...state,
      };
      await setDoc(
        docRef,
        { roster, currencies, inventory, characters, stamina, pity, version: CURRENT_PLAYER_STATE_VERSION },
        { merge: true },
      );
    } catch (e) {
      console.error("Error saving to Firestore", e);
    }
  }, [user]);
```

- [ ] **Step 4: Manual verification**

Run `npm run build` and `npm run check` — expect both green. Then `npm run dev`, log in with the dev Firebase test account (the one with the pre-v3 `pity` doc), open `/gacha` — confirm no crash on either tab, and confirm the Rates modal opens correctly on both. Log out and back in again — confirm the account's `pity`/`currencies` now load correctly (v3-shaped) since the previous load's `saveToCloud` should have written a `version` field, making the *next* load take the fast, no-migration path.

- [ ] **Step 5: Run the full check and commit**

Run: `npm run check`

```bash
git add store/playerStore.ts hooks/AuthProvider.tsx
```

(Stage only — do not commit, per this build's convention of one commit at the end.)

---

## Task 13: Milestone claim buttons + 600 picker modal

**Files:**
- Create: `components/gacha/MilestonePicker.tsx`
- Modify: `components/gacha/BannerScreen.tsx`

- [ ] **Step 1: Create `components/gacha/MilestonePicker.tsx`** (the 600-claim character grid)

```tsx
"use client";

import Image from "next/image";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCharacterArt } from "@/lib/game/characterArt";

interface MilestonePickerProps {
  characterIds: string[];
  onPick: (characterId: string) => void;
  onClose: () => void;
}

export default function MilestonePicker({ characterIds, onPick, onClose }: MilestonePickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto border border-amber-400/60 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-xl text-amber-200">Choose your reward</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {characterIds.map((id) => {
            const character = getCharacterById(id);
            const art = getCharacterArt(id);
            return (
              <button
                key={id}
                onClick={() => onPick(id)}
                className="flex flex-col items-center gap-1 border border-zinc-700 bg-zinc-900 p-1.5 hover:border-amber-400"
              >
                {art ? (
                  <Image src={art} alt={character?.name ?? id} width={80} height={80} className="h-16 w-16 object-cover" />
                ) : (
                  <div className="h-16 w-16 bg-zinc-800" />
                )}
                <span className="font-body text-[10px] text-zinc-200">{character?.name ?? id}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire claim buttons + the picker into `BannerScreen.tsx`**

Add store hooks:

```ts
  const claimLimited300 = usePlayerStore((s) => s.claimLimited300);
  const claimLimited600 = usePlayerStore((s) => s.claimLimited600);
  const claimPermanent600 = usePlayerStore((s) => s.claimPermanent600);
  const [showPicker600, setShowPicker600] = React.useState(false);
```

Replace the existing "milestone ready to claim" text hint block with real buttons:

```tsx
        {claimable300 || claimable600 ? (
          <div className="mt-3 flex gap-2 border-t border-zinc-800 pt-3">
            {claimable300 ? (
              <button
                onClick={() => claimLimited300()}
                className="flex-1 rounded border border-amber-400 py-2 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-amber-200"
              >
                Claim 300
              </button>
            ) : null}
            {claimable600 ? (
              <button
                onClick={() => setShowPicker600(true)}
                className="flex-1 rounded border border-amber-400 bg-amber-400/10 py-2 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-amber-200"
              >
                Claim 600
              </button>
            ) : null}
          </div>
        ) : null}

        {showPicker600 ? (
          <MilestonePicker
            characterIds={isLimited ? limitedBanner.featured : permanentBanner.featured}
            onPick={(characterId) => {
              if (isLimited) claimLimited600(characterId);
              else claimPermanent600(characterId);
              setShowPicker600(false);
            }}
            onClose={() => setShowPicker600(false)}
          />
        ) : null}
```

Add the import: `import MilestonePicker from "@/components/gacha/MilestonePicker";`

- [ ] **Step 3: Manual verification**

Run: `npm run build`, then `npm run dev`. Open `/gacha`, use the Dev Grant Panel's "Force Limited bar to 300" then "Claim 300" — confirm a character is granted (check `/archive` for the new owned badge) and the button disappears. Force to 600, click "Claim 600", pick a character from the grid — confirm the bar resets to 0/600.

- [ ] **Step 4: Run the full check and commit**

Run: `npm run check`

```bash
git add components/gacha/MilestonePicker.tsx components/gacha/BannerScreen.tsx
git commit -m "feat: add milestone claim buttons + 600 reward picker"
```

---

## Task 14: GSAP polish on the banner screen

**Files:**
- Modify: `components/gacha/BannerScreen.tsx`

- [ ] **Step 1: Add GSAP-driven bar fill, currency tween, and claim-button pulse**

Add imports at the top of `components/gacha/BannerScreen.tsx`:

```ts
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
```

Add refs (with the other `useState`/hooks):

```ts
  const containerRef = React.useRef<HTMLDivElement>(null);
  const barFillRef = React.useRef<HTMLDivElement>(null);
  const currencyRef = React.useRef<HTMLSpanElement>(null);
  const currencyProxy = React.useRef({ value: 0 });
  const claim300Ref = React.useRef<HTMLButtonElement>(null);
  const claim600Ref = React.useRef<HTMLButtonElement>(null);
```

Replace the plain `<main className="relative min-h-screen bg-zinc-950">` wrapper's inner `<div>` to carry the ref:

```tsx
      <div ref={containerRef} className="mx-auto w-full max-w-2xl px-6 py-10">
```

Replace the static bar-fill `<div className="h-full rounded bg-amber-400" style={{ width: ... }} />` with a ref'd, unstyled-inline-width version (GSAP now owns the width):

```tsx
            <div ref={barFillRef} className="h-full rounded bg-amber-400" />
```

Replace the static currency line's number with a ref'd `<span>`:

```tsx
        <div className="mt-2 flex justify-end font-body text-sm text-amber-200">
          ◆ <span ref={currencyRef}>0</span> {isLimited ? "gems" : "tickets"}
        </div>
```

Add `ref={claim300Ref}` and `ref={claim600Ref}` to the two claim `<button>` elements from Task 13.

Add the animation effect (after the other hooks, before the `return`):

```ts
  const currentCurrencyValue = isLimited ? currencies.gems : currencies.permanentTicket;

  useGSAP(
    () => {
      if (barFillRef.current) {
        gsap.to(barFillRef.current, { width: `${barPercent}%`, duration: 0.6, ease: "power2.out" });
      }
      if (currencyRef.current) {
        gsap.to(currencyProxy.current, {
          value: currentCurrencyValue,
          duration: 0.5,
          ease: "power1.out",
          onUpdate: () => {
            if (currencyRef.current) {
              currencyRef.current.textContent = Math.round(currencyProxy.current.value).toLocaleString();
            }
          },
        });
      }
      [
        { ref: claim300Ref, active: claimable300 },
        { ref: claim600Ref, active: claimable600 },
      ].forEach(({ ref, active }) => {
        if (!ref.current) return;
        gsap.killTweensOf(ref.current);
        if (active) {
          gsap.to(ref.current, {
            boxShadow: "0 0 16px rgba(251,191,36,0.75)",
            repeat: -1,
            yoyo: true,
            duration: 0.8,
          });
        } else {
          gsap.set(ref.current, { boxShadow: "none" });
        }
      });
    },
    { dependencies: [barPercent, currentCurrencyValue, claimable300, claimable600], scope: containerRef },
  );
```

- [ ] **Step 2: Manual verification**

Run: `npm run build`, then `npm run dev`. Open `/gacha`, use the Dev Grant Panel to grant gems and force the pity bar — confirm the currency number tweens up instead of snapping, the bar fills smoothly, and a claim button pulses once its milestone is reached.

- [ ] **Step 3: Run the full check and commit**

Run: `npm run check`

```bash
git add components/gacha/BannerScreen.tsx
git commit -m "feat: GSAP-animate the gacha banner screen (bar fill, currency tween, claim pulse)"
```

---

## Task 15: Pull-reveal cutin sequence (GSAP timeline)

**Files:**
- Create: `components/gacha/PullReveal.tsx`
- Modify: `components/gacha/BannerScreen.tsx`

- [ ] **Step 1: Create `components/gacha/PullReveal.tsx`**

```tsx
"use client";

import Image from "next/image";
import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { PullOutcome } from "@/lib/gacha/pull";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";

gsap.registerPlugin(useGSAP);

interface PullRevealProps {
  results: PullOutcome[];
  onComplete: () => void;
}

function isCharacterHit(outcome: PullOutcome): outcome is Extract<PullOutcome, { kind: "character" }> {
  return outcome.kind === "character";
}

function bestResultIndex(results: PullOutcome[]): number {
  let best = 0;
  for (let i = 1; i < results.length; i++) {
    if (isCharacterHit(results[i]) && !isCharacterHit(results[best])) best = i;
  }
  return best;
}

export default function PullReveal({ results, onComplete }: PullRevealProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const spotlightRef = React.useRef<HTMLDivElement>(null);

  const bestIndex = bestResultIndex(results);
  const bestOutcome = results[bestIndex];
  const bestCharacter = isCharacterHit(bestOutcome) ? getCharacterById(bestOutcome.characterId) : null;

  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete });

      results.forEach((outcome, index) => {
        const card = cardRefs.current[index];
        if (!card) return;
        const hit = isCharacterHit(outcome);
        tl.fromTo(
          card,
          { rotateY: 180, opacity: 0 },
          { rotateY: 0, opacity: 1, duration: hit ? 0.5 : 0.2, ease: "power2.out" },
          "+=0.06",
        );
      });

      if (bestCharacter && spotlightRef.current) {
        tl.fromTo(
          spotlightRef.current,
          { opacity: 0, scale: 0.85 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" },
          "+=0.2",
        ).to(spotlightRef.current, {}, "+=1.4");
      }
    },
    { dependencies: [results], scope: containerRef },
  );

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <div className="flex flex-wrap justify-center gap-3 p-6">
        {results.map((outcome, index) => (
          <div
            key={index}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            className="flex h-32 w-24 items-center justify-center border-2 border-zinc-600 bg-zinc-900"
          >
            {isCharacterHit(outcome) ? (
              <Image
                src={getCharacterArt(outcome.characterId) ?? ""}
                alt={outcome.characterId}
                width={96}
                height={128}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-body text-[10px] uppercase text-zinc-400">
                {outcome.kind === "coin" ? `+${outcome.amount} coin` : outcome.materialId}
              </span>
            )}
          </div>
        ))}
      </div>

      {bestCharacter ? (
        <div
          ref={spotlightRef}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 opacity-0"
        >
          <p className="font-body text-xs uppercase tracking-[0.3em] text-amber-200/80">Featured Unit</p>
          <p className="font-heading text-4xl tracking-[0.1em] text-amber-100">{bestCharacter.name}</p>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `BannerScreen.tsx`**

Add state:

```ts
  const [revealResults, setRevealResults] = React.useState<import("@/lib/gacha/pull").PullOutcome[] | null>(null);
```

Change the two Draw buttons' `onClick` handlers to capture and show the results instead of discarding the return value:

```tsx
          <button
            onClick={() => {
              const results = isLimited ? pullLimited(1) : pullPermanent(1);
              if (results) setRevealResults(results);
            }}
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 py-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-100"
          >
            Draw ×1
          </button>
          <button
            onClick={() => {
              const results = isLimited ? pullLimited(11) : pullPermanent(11);
              if (results) setRevealResults(results);
            }}
            className="flex-1 rounded bg-amber-400 py-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-950"
          >
            Draw ×11
          </button>
```

Add the reveal overlay render near the end of the component:

```tsx
        {revealResults ? (
          <PullReveal results={revealResults} onComplete={() => setRevealResults(null)} />
        ) : null}
```

Add the import: `import PullReveal from "@/components/gacha/PullReveal";`

- [ ] **Step 3: Manual verification**

Run: `npm run build`, then `npm run dev`. Open `/gacha`, grant gems via the Dev Grant Panel, click Draw ×1 and Draw ×11 — confirm cards flip in sequence and, on a featured hit, the spotlight banner appears with the character's name before the overlay auto-closes.

- [ ] **Step 4: Run the full check and commit**

Run: `npm run check`

```bash
git add components/gacha/PullReveal.tsx components/gacha/BannerScreen.tsx
git commit -m "feat: add GSAP pull-reveal cutin (miss flip / featured cutin / 11-pull spotlight)"
```

---

## Task 16: Homepage nav button

**Files:**
- Modify: `components/HomeMenu.tsx`

- [ ] **Step 1: Add the GACHA button**

Following the established rule that World Boss/News/Gacha links live on the homepage, not `TopNav` — add a new button to the grid in `components/HomeMenu.tsx`, after the NEWS button and before the PROFILE/LOGIN button:

```tsx
            <Button
              variant="outline"
              onClick={() => router.push("/gacha")}
              className="h-20 justify-start rounded-none border-2 border-pink-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-pink-200 transition-all hover:bg-pink-400/10 hover:text-pink-100 md:h-24 md:text-3xl"
            >
              GACHA
            </Button>
```

- [ ] **Step 2: Manual verification**

Run: `npm run build`, then `npm run dev`. Open `/`, confirm the GACHA button appears and navigates to `/gacha`.

- [ ] **Step 3: Run the full check and commit**

Run: `npm run check`

```bash
git add components/HomeMenu.tsx
git commit -m "feat: add GACHA button to the homepage menu"
```

---

## Task 17: Banner splash art — DEFERRED, do not start

**Files:** none touched by this task right now.

- [ ] **Do not run ComfyUI or generate any image for this task.** Tanveer's GPU is occupied this session. The placeholder SVG from Task 11 stays in place as the real `/gacha` splash art until he gives the go-ahead.

When unblocked, the real work is: generate one wide (~1536×768) banner splash via ComfyUI covering all 12 debut-banner characters together (reusing each character's locked design/seed per `docs/ART_PIPELINE.md`), save to `public/banners/debut-2026-08.png`, and swap `BannerScreen.tsx`'s `<Image src="/banners/debut-2026-08-placeholder.svg" .../>` to point at the real file.

---

## Plan self-review notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-01-gacha-design.md` has a task — terminology/rarity drop (Task 1, nothing to build, just the schema field), currencies (Task 6), debut banner + rates (Tasks 2, 12), miss-pull item pool (Task 3), milestone bar (Tasks 4, 7, 13), Permanent pool (Tasks 1, 2, 7), Ultimate Level (Task 5), faucet (Task 8), UI layout A (Task 11), rates modal (Task 12), pull reveal + 11-pull spotlight (Task 15), collection browsing badges (Task 9), art (Task 17, deferred), GSAP polish agreed in this session's follow-up (Task 14).
- **Type consistency checked:** `PullOutcome` (Task 3) is the one shape threaded through `pull.ts` → `playerStore.ts` actions → `PullReveal.tsx` → `BannerScreen.tsx`, no renamed duplicates. `LimitedPityState` (Task 4) matches the `pity.limited` shape defined in Task 6 exactly. `CharacterProgress.ultLevel` (Task 6) matches what `resolvePullResult` (Task 5) and every store action reads/writes.
- **No placeholders** beyond the one explicitly-deferred art task and the placeholder SVG, both called out clearly per this session's instruction not to touch ComfyUI.
