# Substat System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new character substats (Crit Damage, Recovery Rate, Lifesteal, Crit Resistance) to toll-the-game's combat engine, per `docs/superpowers/specs/2026-07-24-substat-system-design.md`.

**Architecture:** 4 new optional numeric fields on the character schema (default via fallback, not required in JSON). A new `lib/game/substats.ts` computes each substat's live value (base field + multiplicative buff/debuff stacking), mirroring the existing `getEffectiveAttack`/`getEffectiveDefense` pattern in `lib/game/stats.ts`. A new `lib/game/heal.ts` centralizes Recovery-Rate-scaled healing so every heal source in the engine scales consistently. Crit Damage/Crit Resistance/Lifesteal wire into `damage.ts`/`combat.ts` at the specific points identified in the spec.

**Tech Stack:** TypeScript, Zod (character JSON validation), Vitest.

---

### Task 1: Schema — 4 new optional character fields

**Files:**
- Modify: `types/character.ts:25-52` (`Character` interface)
- Modify: `lib/game/characterCatalog.ts:50-77` (`CharacterData` interface)
- Modify: `lib/game/characterSchema.ts:52-84` (`characterSchema` Zod object)
- Test: `tests/characterSchema.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/characterSchema.test.ts` (new `describe` block at the end of the file, after the existing `describe("boss roster...")` block):

```ts
describe("substat fields (crit dmg, recovery rate, lifesteal, crit resist)", () => {
  function baseCharacter(overrides: Record<string, unknown> = {}) {
    return {
      id: "test",
      name: "Test",
      color: "blue",
      atk: 100,
      def: 50,
      hp: 1000,
      skills: [
        {
          skillName: "A",
          characterId: "test",
          type: "attack",
          statMultiplier: "atk",
          damageRanked: [100, 100, 100],
        },
        {
          skillName: "B",
          characterId: "test",
          type: "attack",
          statMultiplier: "atk",
          damageRanked: [100, 100, 100],
        },
      ],
      ...overrides,
    };
  }

  it("accepts a character with no substat fields", () => {
    expect(characterSchema.safeParse(baseCharacter()).success).toBe(true);
  });

  it("accepts explicit substat fields", () => {
    const result = characterSchema.safeParse(
      baseCharacter({
        critDamagePercent: 60,
        recoveryRatePercent: 120,
        lifestealPercent: 8,
        critResistPercent: 15,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a negative substat value", () => {
    const result = characterSchema.safeParse(
      baseCharacter({ critDamagePercent: -10 }),
    );
    expect(result.success).toBe(false);
  });
});
```

Add `characterSchema` to the existing top import line: change
```ts
import { validateCharacters } from "@/lib/game/characterSchema";
```
to
```ts
import { characterSchema, validateCharacters } from "@/lib/game/characterSchema";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/characterSchema.test.ts`
Expected: FAIL — `characterSchema` import error or the "accepts explicit substat fields" / "rejects a negative substat value" cases fail (the loose Zod object currently accepts anything including negatives, since there's no field-specific rule yet — the negative-rejection case is the one that must fail first).

- [ ] **Step 3: Add the 4 fields to the Zod schema**

In `lib/game/characterSchema.ts`, inside `characterSchema` (after the `boss: z.boolean().optional(),` line):

```ts
  boss: z.boolean().optional(),
  /** Crit damage bonus %, base 50 if absent (lib/game/substats.ts). */
  critDamagePercent: z.number().nonnegative().optional(),
  /** Heal-scaling multiplier %, base 100 if absent. */
  recoveryRatePercent: z.number().nonnegative().optional(),
  /** % of damage dealt returned as self-heal on every hit, base 5 if absent. */
  lifestealPercent: z.number().nonnegative().optional(),
  /** Reduces incoming crit chance by this %, base 10 if absent. */
  critResistPercent: z.number().nonnegative().optional(),
```

- [ ] **Step 4: Add the 4 fields to the `Character` TypeScript interface**

In `types/character.ts`, inside `export interface Character` (right after `hp: number;` at line 31):

```ts
export interface Character {
  id: string;
  name: string;
  color: Color;
  atk: number;
  def: number;
  hp: number;
  /** Crit damage bonus %, base 50 if absent (lib/game/substats.ts). */
  critDamagePercent?: number;
  /** Heal-scaling multiplier %, base 100 if absent. */
  recoveryRatePercent?: number;
  /** % of damage dealt returned as self-heal on every hit, base 5 if absent. */
  lifestealPercent?: number;
  /** Reduces incoming crit chance by this %, base 10 if absent. */
  critResistPercent?: number;
  tags?: string[]; // E.g. [FEMALE], [KHALSA]
```

- [ ] **Step 5: Add the 4 fields to `CharacterData` in the catalog**

In `lib/game/characterCatalog.ts`, inside `export interface CharacterData` (right after `hp: number;` at line 56):

```ts
export interface CharacterData {
  id: string;
  name: string;
  color: CharacterColor;
  atk: number;
  def: number;
  hp: number;
  critDamagePercent?: number;
  recoveryRatePercent?: number;
  lifestealPercent?: number;
  critResistPercent?: number;
  tags?: string[];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/characterSchema.test.ts`
Expected: PASS (all 3 new cases green, plus the pre-existing cases in the file still pass).

- [ ] **Step 7: Commit**

```bash
git add types/character.ts lib/game/characterCatalog.ts lib/game/characterSchema.ts tests/characterSchema.test.ts
git commit -m "feat: add 4 substat fields to character schema (crit dmg, recovery rate, lifesteal, crit resist)"
```

---

### Task 2: `lib/game/substats.ts` — effective-value getters

**Files:**
- Create: `lib/game/substats.ts`
- Test: `tests/substats.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `tests/substats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getEffectiveCritDamage,
  getEffectiveRecoveryRate,
  getEffectiveLifesteal,
  getEffectiveCritResist,
} from "@/lib/game/substats";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

function dummySkill(): SkillCard {
  return {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
}

function makeChar(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "c",
    name: "c",
    color: "blue",
    atk: 100,
    def: 50,
    hp: 1000,
    skills: [dummySkill(), dummySkill()] as [SkillCard, SkillCard],
    instanceId: "c",
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 50,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...overrides,
  } as BattleCharacter;
}

describe("substat defaults", () => {
  it("defaults to 50/100/5/10 when the character has no explicit fields", () => {
    const c = makeChar();
    expect(getEffectiveCritDamage(c)).toBe(50);
    expect(getEffectiveRecoveryRate(c)).toBe(100);
    expect(getEffectiveLifesteal(c)).toBe(5);
    expect(getEffectiveCritResist(c)).toBe(10);
  });

  it("reads an explicit per-character base value", () => {
    const c = makeChar({ critDamagePercent: 70, lifestealPercent: 20 });
    expect(getEffectiveCritDamage(c)).toBe(70);
    expect(getEffectiveLifesteal(c)).toBe(20);
  });
});

describe("substat buff/debuff stacking (multiplicative)", () => {
  it("a +20% recoveryRate buff raises the base 100 to 120", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "recoveryRate", valuePercent: 20 });
    expect(getEffectiveRecoveryRate(c)).toBe(120);
  });

  it("two +10% critDamage buffs compound multiplicatively (not additively)", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "critDamage", valuePercent: 10 });
    c.buffs.push({ type: "buff", stat: "critDamage", valuePercent: 10 });
    // 50 * 1.1 * 1.1 = 60.5 -> floor 60
    expect(getEffectiveCritDamage(c)).toBe(60);
  });

  it("a -50% lifesteal debuff halves the base 5", () => {
    const c = makeChar();
    c.debuffs.push({ type: "debuff", stat: "lifesteal", valuePercent: 50 });
    expect(getEffectiveLifesteal(c)).toBe(2);
  });

  it("a generic 'all' buff does NOT affect substats (basic-stats-only per 2026-07-24 ruling)", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "all", valuePercent: 50 });
    expect(getEffectiveCritResist(c)).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/substats.test.ts`
Expected: FAIL with `Cannot find module '@/lib/game/substats'`.

- [ ] **Step 3: Implement `lib/game/substats.ts`**

```ts
import { BattleCharacter } from "@/types/character";

/**
 * Effective substats = base field (or a hardcoded default if the character's
 * JSON omits it) scaled by percent buff/debuff entries tagged with the
 * matching `stat` key. Stacks MULTIPLICATIVELY, same rule as every other
 * stat in the game (never additive, never reaches 0/runs away) — see
 * lib/game/stats.ts. Unlike ATK/DEF, a generic `stat: "all"` buff/debuff
 * does NOT touch these — "all" stays basic-stats-only (Molvarr/Leorio
 * wording ruling, 2026-07-24).
 */

const DEFAULT_CRIT_DAMAGE_PERCENT = 50;
const DEFAULT_RECOVERY_RATE_PERCENT = 100;
const DEFAULT_LIFESTEAL_PERCENT = 5;
const DEFAULT_CRIT_RESIST_PERCENT = 10;

function effectiveSubstat(
  char: BattleCharacter,
  statKey: string,
  base: number,
): number {
  let mult = 1;
  for (const buff of char.buffs) {
    if (
      (buff.type === "buff" || buff.type === "stance") &&
      buff.stat === statKey
    ) {
      mult *= 1 + (buff.valuePercent ?? buff.value ?? 0) / 100;
    }
  }
  for (const debuff of char.debuffs) {
    if (debuff.type === "debuff" && debuff.stat === statKey) {
      mult *= Math.max(0, 1 - (debuff.valuePercent ?? debuff.value ?? 0) / 100);
    }
  }
  return Math.max(0, Math.floor(base * mult));
}

export function getEffectiveCritDamage(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "critDamage",
    char.critDamagePercent ?? DEFAULT_CRIT_DAMAGE_PERCENT,
  );
}

export function getEffectiveRecoveryRate(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "recoveryRate",
    char.recoveryRatePercent ?? DEFAULT_RECOVERY_RATE_PERCENT,
  );
}

export function getEffectiveLifesteal(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "lifesteal",
    char.lifestealPercent ?? DEFAULT_LIFESTEAL_PERCENT,
  );
}

export function getEffectiveCritResist(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "critResist",
    char.critResistPercent ?? DEFAULT_CRIT_RESIST_PERCENT,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/substats.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/game/substats.ts tests/substats.test.ts
git commit -m "feat: add substat effective-value getters (crit dmg, recovery rate, lifesteal, crit resist)"
```

---

### Task 3: `lib/game/heal.ts` — Recovery-Rate-scaled healing

**Files:**
- Create: `lib/game/heal.ts`
- Test: `tests/substats.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/substats.test.ts`:

```ts
import { getEffectiveHealAmount, applyHeal } from "@/lib/game/heal";

describe("getEffectiveHealAmount (Recovery Rate scaling)", () => {
  it("100 raw heal at 100% recovery rate stays 100", () => {
    const c = makeChar();
    expect(getEffectiveHealAmount(c, 100)).toBe(100);
  });

  it("100 raw heal at 150% recovery rate becomes 150", () => {
    const c = makeChar({ recoveryRatePercent: 150 });
    expect(getEffectiveHealAmount(c, 100)).toBe(150);
  });

  it("never returns negative for a 0 or negative raw amount", () => {
    const c = makeChar();
    expect(getEffectiveHealAmount(c, 0)).toBe(0);
    expect(getEffectiveHealAmount(c, -50)).toBe(0);
  });
});

describe("applyHeal", () => {
  it("adds the recovery-rate-scaled amount to currentHP", () => {
    const c = makeChar({ currentHP: 500, recoveryRatePercent: 150 });
    const { character, healed } = applyHeal(c, 100);
    expect(healed).toBe(150);
    expect(character.currentHP).toBe(650);
  });

  it("clamps at max HP", () => {
    const c = makeChar({ currentHP: 950, hp: 1000 });
    const { character, healed } = applyHeal(c, 200);
    expect(character.currentHP).toBe(1000);
    expect(healed).toBe(50);
  });

  it("logs the heal when a log function is passed", () => {
    const c = makeChar({ currentHP: 500 });
    const logs: string[] = [];
    applyHeal(c, 100, (e) => logs.push(e));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("100");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/substats.test.ts`
Expected: FAIL with `Cannot find module '@/lib/game/heal'`.

- [ ] **Step 3: Implement `lib/game/heal.ts`**

```ts
import { BattleCharacter } from "@/types/character";
import { getEffectiveRecoveryRate } from "./substats";

/**
 * Recovery-Rate-scaled heal amount, recalculated live off the character's
 * CURRENT recovery rate every time this is called (not snapshotted) — a
 * HoT's healing power responds immediately if the recipient's recovery
 * rate changes mid-duration (Tanveer ruling 2026-07-24).
 */
export function getEffectiveHealAmount(
  char: BattleCharacter,
  rawAmount: number,
): number {
  if (rawAmount <= 0) return 0;
  return Math.floor(rawAmount * (getEffectiveRecoveryRate(char) / 100));
}

/**
 * Single choke point for additive healing (adds to currentHP, clamped at
 * max HP). Every heal source in the engine should route through this so
 * Recovery Rate applies consistently. Not used by Sara's lethal-survival
 * heal (lib/game/lethal.ts), which SETS currentHP to an absolute value
 * rather than adding to it — that call site uses getEffectiveHealAmount
 * directly instead.
 */
export function applyHeal(
  char: BattleCharacter,
  rawAmount: number,
  log?: (entry: string) => void,
): { character: BattleCharacter; healed: number } {
  const scaled = getEffectiveHealAmount(char, rawAmount);
  const healed = Math.min(scaled, char.hp - char.currentHP);
  const character = { ...char, currentHP: char.currentHP + Math.max(0, healed) };
  if (log && healed > 0) {
    log(`${char.name} heals ${healed} HP.`);
  }
  return { character, healed: Math.max(0, healed) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/substats.test.ts`
Expected: PASS (all cases so far green).

- [ ] **Step 5: Commit**

```bash
git add lib/game/heal.ts tests/substats.test.ts
git commit -m "feat: add centralized Recovery-Rate-scaled heal helper"
```

---

### Task 4: Wire Crit Damage into `damage.ts`

**Files:**
- Modify: `lib/game/damage.ts:83-87`
- Test: `tests/substats.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/substats.test.ts`:

```ts
import { calculateDamage } from "@/lib/game/damage";

describe("Crit Damage substat wiring (damage.ts)", () => {
  it("a proc'd crit (no explicit damageBonusPercent) uses the attacker's crit damage substat", () => {
    const attacker = makeChar({ critDamagePercent: 80 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical" }],
      target,
      attacker,
    });
    // 200 base * (1 + 80/100) = 360
    expect(dmg).toBe(360);
  });

  it("a skill with an explicit damageBonusPercent overrides the substat", () => {
    const attacker = makeChar({ critDamagePercent: 80 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical", damageBonusPercent: 30 }],
      target,
      attacker,
    });
    // 200 * (1 + 30/100) = 260, substat ignored
    expect(dmg).toBe(260);
  });

  it("falls back to 50% when no attacker is passed (backward compatible)", () => {
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical" }],
      target,
    });
    expect(dmg).toBe(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/substats.test.ts`
Expected: FAIL — the first case expects 360 but currently gets 300 (hardcoded `?? 50`).

- [ ] **Step 3: Update `damage.ts`**

In `lib/game/damage.ts`, add the import:

```ts
import {
  getEffectiveDefense,
  getDamageDealtMultiplier,
  getDamageReductionMultiplier,
} from "./stats";
import { getEffectiveCritDamage } from "./substats";
```

Replace the crit-bonus line (currently `damageTaken *= 1 + (criticalMechanic.damageBonusPercent ?? 50) / 100;`):

```ts
  } else {
    const bonus =
      criticalMechanic.damageBonusPercent ??
      (attacker ? getEffectiveCritDamage(attacker) : 50);
    damageTaken *= 1 + bonus / 100;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/substats.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm run check`
Expected: PASS — no existing test hardcodes the old default-50 behavior in a way that would break (existing crit tests use characters with no `critDamagePercent`, so they still get the same 50 default).

- [ ] **Step 6: Commit**

```bash
git add lib/game/damage.ts tests/substats.test.ts
git commit -m "feat: wire Crit Damage substat into the generic crit-bonus calculation"
```

---

### Task 5: Wire Crit Resistance into the crit-chance roll

**Files:**
- Modify: `lib/game/combat.ts:628-639`
- Test: `tests/substats.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/substats.test.ts`:

```ts
import { executeSkill } from "@/lib/game/combat";

describe("Crit Resistance substat wiring (combat.ts crit roll)", () => {
  it("subtracts the target's crit resistance from the attacker's crit chance", () => {
    // Deathblow-style attacker forced to a known crit chance via currentHP loss
    const attacker = makeChar({
      passive: {
        name: "Test Deathblow",
        trigger: "always",
        mechanics: [
          { type: "deathblow", hpStepPercent: 10, critPerStepPercent: 100 },
        ],
      },
      currentHP: 900, // 10% lost -> 1 step -> 100% crit chance base
      hp: 1000,
    });
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      critResistPercent: 100, // fully negates the 100% base crit chance
    });
    const result = executeSkill(
      {
        sourceInstanceId: "c",
        skill: dummySkill(),
        targetInstanceId: "t",
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
      0,
      () => 0.01, // would crit if chance > 1%
    );
    // 100% - 100% crit resist = 0% chance -> no crit -> no CRITICAL package
    // (target has 0 def, so a non-crit hit deals plain base damage; a crit
    // would add +50% and ignore defense — neither special case fires here)
    expect(result.enemyTeam[0].currentHP).toBe(target.hp - attacker.currentAttack);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/substats.test.ts`
Expected: FAIL — today crit resistance isn't subtracted, so the 100% base crit chance still procs and the damage includes the crit bonus, so `currentHP` doesn't match the plain-hit expectation.

- [ ] **Step 3: Update `combat.ts`**

Add the import (near the other `lib/game` imports at the top of the file):

```ts
import { getEffectiveCritResist } from "./substats";
```

Replace the crit-chance roll block (currently):

```ts
      const critChance = getCritChance(updatedSource);
      const didCrit =
        critChance > 0 &&
        !skillMechanics.some((m) => m.type === "critical") &&
        rng() * 100 < critChance;
```

with:

```ts
      const critChance = Math.max(
        0,
        getCritChance(updatedSource) - getEffectiveCritResist(updatedTarget),
      );
      const didCrit =
        critChance > 0 &&
        !skillMechanics.some((m) => m.type === "critical") &&
        rng() * 100 < critChance;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/substats.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm run check`
Expected: PASS — every existing character defaults to 10% crit resist, so any existing Deathblow-based crit test needs its expected crit chance to still clear 10% (check `tests/collabKits.test.ts`'s "a crit applies the CRITICAL package" test — Meliodas at `currentHP = 1` gives a very high crit chance, comfortably above the default 10% floor, so it still procs; if `npm run check` reports a failure here, re-read that test's exact expected chance before changing anything else).

- [ ] **Step 6: Commit**

```bash
git add lib/game/combat.ts tests/substats.test.ts
git commit -m "feat: wire Crit Resistance substat into the crit-chance roll"
```

---

### Task 6: Lifesteal substat — unconditional heal-on-hit hook

**Files:**
- Modify: `lib/game/combat.ts:653-665` (main attack path)
- Modify: `lib/game/combat.ts:1010-1030` (counter-stance path)
- Test: `tests/substats.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/substats.test.ts`:

```ts
describe("Lifesteal substat wiring (combat.ts)", () => {
  it("a plain attack with no skill lifesteal mechanic still heals the attacker for their base lifestealPercent", () => {
    const attacker = makeChar({ lifestealPercent: 10, currentHP: 500 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const result = executeSkill(
      { sourceInstanceId: "c", skill: dummySkill(), targetInstanceId: "t" },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    // dealt = attacker.currentAttack (100) - 0 def = 100; 10% lifesteal = 10
    expect(result.playerTeam[0].currentHP).toBe(510);
  });

  it("stacks additively with an existing skill-level lifesteal mechanic", () => {
    const attacker = makeChar({ lifestealPercent: 10, currentHP: 500 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const skill: SkillCard = {
      skillName: "Drain",
      characterId: "c",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "lifesteal", valuePercent: 30 }],
    };
    const result = executeSkill(
      { sourceInstanceId: "c", skill, targetInstanceId: "t" },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    // dealt = 100; skill lifesteal 30 -> +30; substat lifesteal 10% -> +10
    expect(result.playerTeam[0].currentHP).toBe(540);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/substats.test.ts`
Expected: FAIL — currentHP stays 500 (no substat lifesteal hook exists yet); the second case only reflects the skill's 30 (530, not 540).

- [ ] **Step 3: Add the import**

In `lib/game/combat.ts`, extend the substats import added in Task 5:

```ts
import { getEffectiveCritResist, getEffectiveLifesteal } from "./substats";
import { applyHeal } from "./heal";
```

- [ ] **Step 4: Add the hook in the main attack path**

Right after `dealtDamage = finalDamage;` / `totalDamageDealt += finalDamage;` (immediately after the block that sets `targetEvent.damage = finalDamage;`, before the `const newHp = ...` line), add:

```ts
      if (dealtDamage > 0) {
        const lifestealPercent = getEffectiveLifesteal(updatedSource);
        if (lifestealPercent > 0) {
          const { character: healedSource, healed } = applyHeal(
            updatedSource,
            Math.floor(dealtDamage * (lifestealPercent / 100)),
          );
          Object.assign(updatedSource, healedSource);
          if (healed > 0) targetEffects.push(`self-healed ${healed} HP (lifesteal)`);
        }
      }
```

(`Object.assign` keeps `updatedSource` as the same mutated-in-place object the rest of the function already relies on, matching the existing style in this function rather than introducing a new local variable that would need threading through every later reference.)

- [ ] **Step 5: Add the hook in the counter-stance path**

In the counter-stance block, right after:

```ts
        updatedSource.currentHP = Math.max(
          0,
          updatedSource.currentHP - counterDamage,
        );
        if (counterDamage > 0) {
          updatedSource.passiveState.tookDamageThisRound = true;
        }
```

add:

```ts
        if (counterDamage > 0) {
          const counterLifestealPercent = getEffectiveLifesteal(updatedTarget);
          if (counterLifestealPercent > 0) {
            const { character: healedCounterer, healed } = applyHeal(
              updatedTarget,
              Math.floor(counterDamage * (counterLifestealPercent / 100)),
            );
            Object.assign(updatedTarget, healedCounterer);
            if (healed > 0) {
              log(`${updatedTarget.name} self-healed ${healed} HP (lifesteal counter).`);
            }
          }
        }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/substats.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite to check for regressions**

Run: `npm run check`
Expected: PASS — every existing character defaults to `lifestealPercent: 5`, so any exact-HP-value existing test that deals damage and checks the attacker's or counterer's exact resulting HP afterward will now be off by 5% of the damage dealt. Search for such assertions:

Run: `grep -rn "currentHP).toBe" tests/*.test.ts`

For each hit where the asserting character is an ATTACKER (not the target) immediately after dealing damage, recompute the expected value to include `+ Math.floor(dealtDamage * 0.05)` and update the assertion. Do not touch assertions on the TARGET's HP (only the attacker/counterer gains the new lifesteal heal). If `npm run check` passes with no changes needed, that means no existing test happened to assert an attacker's exact post-attack HP — confirm by checking the grep output manually rather than assuming.

- [ ] **Step 8: Commit**

```bash
git add lib/game/combat.ts tests/substats.test.ts
git commit -m "feat: wire Lifesteal substat into attacks and counter-hits"
```

---

### Task 7: Migrate existing heal call sites to `applyHeal`/`getEffectiveHealAmount`

**Files:**
- Modify: `lib/game/combat.ts:698-711` (skill-type heal)
- Modify: `lib/game/combat.ts:831-842` (skill-level `lifesteal` mechanic)
- Modify: `lib/game/combat.ts:1099-1106` (`healLifesteal` passive, Siddiq)
- Modify: `lib/game/tick.ts:36-44` (HoT tick)
- Modify: `lib/game/lethal.ts:31-34` (lethal-survival heal)
- Test: `tests/substats.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/substats.test.ts`:

```ts
import { tickTeamBuffs } from "@/lib/game/tick";
import { trySurviveLethal } from "@/lib/game/lethal";

describe("Recovery Rate applied at existing heal call sites", () => {
  it("a heal-type skill scales by the target's recovery rate", () => {
    const healer = makeChar({ instanceId: "h" });
    const target = makeChar({
      instanceId: "t",
      currentHP: 500,
      recoveryRatePercent: 150,
    });
    const healSkill: SkillCard = {
      skillName: "Heal",
      characterId: "h",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
    };
    const result = executeSkill(
      { sourceInstanceId: "h", skill: healSkill, targetInstanceId: "t" },
      { playerTeam: [healer, target], enemyTeam: [] },
      () => {},
    );
    // base heal = healer.currentAttack (100) scaled by 150% recovery = 150
    const healedTarget = result.playerTeam.find((c) => c.instanceId === "t")!;
    expect(healedTarget.currentHP).toBe(650);
  });

  it("HoT ticks scale by the recipient's CURRENT recovery rate, recalculated live", async () => {
    const char = makeChar({ currentHP: 500, recoveryRatePercent: 100 });
    char.buffs.push({
      type: "healOverTime",
      value: 100,
      buffDuration: 2,
    });
    let [ticked] = tickTeamBuffs([char], () => {});
    // tick 1 at 100% recovery rate -> +100
    expect(ticked.currentHP).toBe(600);

    // recipient's recovery rate improves mid-duration
    ticked.recoveryRatePercent = 200;
    [ticked] = tickTeamBuffs([ticked], () => {});
    // tick 2 at 200% recovery rate -> +200 (not the original +100)
    expect(ticked.currentHP).toBe(800);
  });

  it("lethal-survival heal scales by the survivor's recovery rate", () => {
    const char = makeChar({
      currentHP: 400, // >= 30% of 1000 max HP, so the condition is met
      recoveryRatePercent: 200,
      passive: {
        name: "Nine Lives",
        trigger: "onLethalDamage",
        mechanics: [
          { type: "surviveLethal", hpConditionPercent: 30, healDamagePercent: 50 },
        ],
      },
    });
    const healAmount = trySurviveLethal(char, 1000);
    // 1000 incoming * 50% = 500 raw heal, * 200% recovery rate = 1000
    expect(healAmount).toBe(1000);
    expect(char.currentHP).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/substats.test.ts`
Expected: FAIL — none of the 3 new cases scale by recovery rate yet (heal-type skill heals for flat 100 not 150; HoT ticks flat +100 both times; lethal survival heals flat 500 not 1000).

- [ ] **Step 3: Migrate the skill-type heal in `combat.ts`**

Add the import (extending the Task 6 import line):

```ts
import { applyHeal, getEffectiveHealAmount } from "./heal";
```

Replace (currently at `combat.ts:698-711`):

```ts
      const healMech = skillMechanics.find((m) => m.type === "heal");
      const healAmount =
        healMech?.missingHpPercent != null
          ? Math.floor(
              (updatedTarget.hp - updatedTarget.currentHP) *
                (healMech.missingHpPercent / 100),
            )
          : Math.floor(baseDamage);
      healedAmount = healAmount;
      targetEvent.heal = healAmount;
      updatedTarget.currentHP = Math.min(
        updatedTarget.hp,
        updatedTarget.currentHP + healAmount,
      );
```

with:

```ts
      const healMech = skillMechanics.find((m) => m.type === "heal");
      const rawHealAmount =
        healMech?.missingHpPercent != null
          ? Math.floor(
              (updatedTarget.hp - updatedTarget.currentHP) *
                (healMech.missingHpPercent / 100),
            )
          : Math.floor(baseDamage);
      const { character: healedTarget, healed } = applyHeal(
        updatedTarget,
        rawHealAmount,
      );
      Object.assign(updatedTarget, healedTarget);
      healedAmount = healed;
      targetEvent.heal = healed;
```

- [ ] **Step 4: Migrate the skill-level `lifesteal` mechanic in `combat.ts`**

Replace (currently at `combat.ts:831-842`):

```ts
        if (mech.type === "lifesteal" && dealtDamage > 0) {
          const heal = Math.floor(
            dealtDamage * ((mech.valuePercent || mech.value || 30) / 100),
          );
          if (heal > 0) {
            updatedSource.currentHP = Math.min(
              updatedSource.hp,
              updatedSource.currentHP + heal,
            );
            targetEffects.push(`drained ${heal} HP`);
          }
        }
```

with:

```ts
        if (mech.type === "lifesteal" && dealtDamage > 0) {
          const rawHeal = Math.floor(
            dealtDamage * ((mech.valuePercent || mech.value || 30) / 100),
          );
          const { character: healedSource, healed } = applyHeal(
            updatedSource,
            rawHeal,
          );
          Object.assign(updatedSource, healedSource);
          if (healed > 0) {
            targetEffects.push(`drained ${healed} HP`);
          }
        }
```

- [ ] **Step 5: Migrate the `healLifesteal` passive in `combat.ts`**

Replace (currently at `combat.ts:1099-1106`):

```ts
      const heal = Math.floor(
        totalDamageDealt * (lifestealMech.lifestealPercent / 100),
      );
      updatedSource.currentHP = Math.min(
        updatedSource.hp,
        updatedSource.currentHP + heal,
      );
      log(`${updatedSource.name}'s Vampiric Roots restores ${heal} HP!`);
```

with:

```ts
      const rawHeal = Math.floor(
        totalDamageDealt * (lifestealMech.lifestealPercent / 100),
      );
      const { character: healedSource, healed } = applyHeal(
        updatedSource,
        rawHeal,
      );
      Object.assign(updatedSource, healedSource);
      log(`${updatedSource.name}'s Vampiric Roots restores ${healed} HP!`);
```

- [ ] **Step 6: Migrate the HoT tick in `tick.ts`**

Add the import at the top of `lib/game/tick.ts`:

```ts
import { applyHeal } from "./heal";
```

Replace (currently at `tick.ts:35-44`):

```ts
    // Apply Heal-over-Time (HoT) effects
    const hotEffects = char.buffs.filter((b) => b.type === "healOverTime");
    let totalHot = 0;
    hotEffects.forEach((hot) => {
      if (hot.value) totalHot += hot.value;
    });
    if (totalHot > 0) {
      char.currentHP = Math.min(char.hp, char.currentHP + totalHot);
      log(`[System] ${char.name} heals ${totalHot} HP from HoT.`);
    }
```

with:

```ts
    // Apply Heal-over-Time (HoT) effects — recovery rate is recalculated
    // live off the recipient's CURRENT rate every tick, not snapshotted
    // at cast time (Tanveer ruling 2026-07-24).
    const hotEffects = char.buffs.filter((b) => b.type === "healOverTime");
    let totalHot = 0;
    hotEffects.forEach((hot) => {
      if (hot.value) totalHot += hot.value;
    });
    if (totalHot > 0) {
      const { character: healedChar, healed } = applyHeal(char, totalHot);
      Object.assign(char, healedChar);
      if (healed > 0) log(`[System] ${char.name} heals ${healed} HP from HoT.`);
    }
```

- [ ] **Step 7: Migrate the lethal-survival heal in `lethal.ts`**

Add the import at the top of `lib/game/lethal.ts`:

```ts
import { getEffectiveHealAmount } from "./heal";
```

Replace (currently at `lethal.ts:31-34`):

```ts
  const healAmount = Math.floor(
    incomingDamage * ((mech.healDamagePercent ?? 50) / 100),
  );
  char.currentHP = Math.max(1, healAmount);
```

with:

```ts
  const rawHealAmount = Math.floor(
    incomingDamage * ((mech.healDamagePercent ?? 50) / 100),
  );
  const healAmount = Math.max(1, getEffectiveHealAmount(char, rawHealAmount));
  char.currentHP = healAmount;
```

(This call site SETS `currentHP` to an absolute value rather than adding to it — see the comment on `applyHeal` in `lib/game/heal.ts` explaining why it uses `getEffectiveHealAmount` directly instead of the full `applyHeal` wrapper.)

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/substats.test.ts`
Expected: PASS (all cases in the file green).

- [ ] **Step 9: Run the full suite to check for regressions**

Run: `npm run check`
Expected: PASS — every existing character defaults to `recoveryRatePercent: 100`, so `getEffectiveHealAmount`/`applyHeal` are no-ops (×1.0) for any test that doesn't set the field. If any existing heal-related test fails, read its exact assertion before changing this task's code — it likely means a heal call site was missed, not that the scaling math is wrong.

- [ ] **Step 10: Commit**

```bash
git add lib/game/combat.ts lib/game/tick.ts lib/game/lethal.ts tests/substats.test.ts
git commit -m "feat: route all heal call sites through Recovery-Rate-scaled applyHeal"
```

---

### Task 8: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS — `tsc --noEmit` clean, `eslint` clean, all Vitest tests green (251 pre-existing + the new cases added across Tasks 1-7).

- [ ] **Step 2: Manually skim the diff for stray debug code**

Run: `git diff HEAD~7 -- lib/game types/character.ts`
Expected: no leftover `console.log`, no commented-out old code, no TODO markers — every migrated heal call site should look like the exact replacement shown in its task step, nothing extra.

- [ ] **Step 3: Report done**

No further commit needed (Task 7's commit is the last code change) — this task is a verification checkpoint only. Tanveer said he'll test it in battle himself once implemented; no browser/manual playtest step is required from the implementer.
