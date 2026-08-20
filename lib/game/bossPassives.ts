import { passiveMechanics } from "@/lib/game/passiveBlocks";
import type { BattleCharacter, CharacterPhase } from "@/types/character";
import type { Mechanic, StatusEffect } from "@/types/mechanic";
import type { SkillCard } from "@/types/skillCard";
import type { Action } from "@/types/action";

// Boss passive engine — piece 4 of the Molvarr build. Multi-phase "hearts"
// bosses carry per-phase passives whose behavior is TIMED (every 3rd turn,
// from turn 10) or DYNAMIC (ATK per enemy debuff). The OnBattleStart queue
// (lib/game/passive.ts) registers once and can't re-register on a phase
// transition, so these are read LIVE from the boss's active phase instead:
// applyBossTurnStart at OnEnemyTurnStart, forced SP in the EnemyAction loop,
// and bossDamageMultiplierVsTarget in combat. See docs/design/BOSS_MOLVARR.md.

const CORROSION_PERCENT = 10; // % remaining HP per stack per turn (tick.ts default; max HP only on R3/ultimate applications)

export function isBoss(char: { phases?: CharacterPhase[] }): boolean {
  return (char.phases?.length ?? 0) > 0;
}

/** Mechanics `applyBossTurnStart` resolves. Despite the `boss` prefix these
 *  are encounter mechanics, not boss-exclusive ones — any enemy kit may
 *  author them (the prefix predates that and isn't worth a rename across the
 *  schema, Molvarr's kit and its tests). */
const TURN_START_MECHANICS = new Set<Mechanic["type"]>([
  "bossStatSpike",
  "bossDebuffAtk",
  "bossApplyCorrosion",
  "bossMaxHpDrain",
]);

export function activePhase(char: BattleCharacter): CharacterPhase | undefined {
  return char.phases?.[char.phaseIndex ?? 0];
}

export function activeSpSkill(char: BattleCharacter): SkillCard | undefined {
  return activePhase(char)?.spSkill;
}

/**
 * Every mechanic on the boss's ACTIVE phase passives (multi-passive: all of
 * them, not just passives[0]). Falls back to the single `passive` for a
 * non-phased unit so the helper is safe to call on anyone.
 */
export function activeBossMechanics(char: BattleCharacter): Mechanic[] {
  const phase = activePhase(char);
  const passives = phase?.passives ?? (char.passive ? [char.passive] : []);
  // Through passiveBlocks so a passive authored as blocks contributes all of
  // them, not just the shorthand pair.
  return passives.flatMap((p) => passiveMechanics({ passive: p }));
}

/** Total debuff STACKS across the opposing team's field units (each entry
 * counts its `stacks`, so 3-stack Corrosion = 3). Tanveer ruling 2026-07-19. */
export function totalDebuffStacks(units: BattleCharacter[]): number {
  return units
    .filter((u) => u.currentHP > 0 && !u.isSub)
    .reduce(
      (sum, u) => sum + u.debuffs.reduce((s, d) => s + (d.stacks ?? 1), 0),
      0,
    );
}

/** Combat hook: the boss deals +% to targets afflicted by Corrosion (P2). */
export function bossDamageMultiplierVsTarget(
  attacker: BattleCharacter,
  target: BattleCharacter,
): number {
  const mech = activeBossMechanics(attacker).find(
    (m) => m.type === "bossCorrosionBonus",
  );
  if (!mech) return 1;
  const corroded = target.debuffs.some((d) => d.type === "corrosion");
  if (!corroded) return 1;
  return 1 + (mech.percent ?? 30) / 100;
}

/** Whether THIS boss turn forces the phase's SP Skill as the final action.
 * Reads the per-phase turn counter set by applyBossTurnStart. */
export function bossForcedSpThisTurn(char: BattleCharacter): boolean {
  if (!activeSpSkill(char)) return false;
  const mech = activeBossMechanics(char).find((m) => m.type === "bossAutoSp");
  if (!mech) return false;
  const everyN = mech.everyNTurns ?? 3;
  const phaseTurn = (char.passiveState.phaseTurn as number) ?? 0;
  return phaseTurn > 0 && phaseTurn % everyN === 0;
}

/**
 * If any living field boss is due its forced SP this turn, build the Action for
 * its phase SP Skill (targets self for heal/buff/stance, else a field player).
 * The EnemyAction loop uses this in place of an AI pick for the final action.
 * SP is never in the deck, so it consumes no card. Returns null when none due.
 */
export function bossForcedSpAction(
  enemyTeam: BattleCharacter[],
  playerTeam: BattleCharacter[],
): Action | null {
  const boss = enemyTeam.find(
    (u) =>
      isBoss(u) && u.currentHP > 0 && !u.isSub && bossForcedSpThisTurn(u),
  );
  if (!boss) return null;
  const sp = activeSpSkill(boss);
  if (!sp) return null;

  const selfTargeted = ["heal", "buff", "stance"].includes(sp.type);
  let targetInstanceId = boss.instanceId;
  if (!selfTargeted) {
    const pool = playerTeam.filter((p) => p.currentHP > 0 && !p.isSub);
    if (pool.length === 0) return null;
    targetInstanceId = pool[0].instanceId; // combat retargets if invalidated
  }
  return { sourceInstanceId: boss.instanceId, skill: sp, targetInstanceId, rank: 1 };
}

/**
 * Run every boss's turn-start passives (OnEnemyTurnStart, before it acts):
 * increment the per-phase turn counter, then apply the one-time stat spike,
 * the dynamic debuff-count ATK recompute, per-turn Corrosion application, and
 * the turn-N max-HP drain. Pure: returns fresh teams. Effects hit on-field
 * players only (subs are untargetable). See the field for exact orderings.
 */
export function applyBossTurnStart(
  enemyTeam: BattleCharacter[],
  playerTeam: BattleCharacter[],
  log: (entry: string) => void,
): { enemyTeam: BattleCharacter[]; playerTeam: BattleCharacter[] } {
  let players = playerTeam;

  const enemies = enemyTeam.map((unit) => {
    if (unit.currentHP <= 0 || unit.isSub) return unit;

    // A phased boss always runs — `phaseTurn` has to keep counting even for a
    // boss whose only mechanic is `bossAutoSp`, since `bossForcedSpThisTurn`
    // reads that counter.
    //
    // Beyond that, an ordinary enemy runs if it carries a turn-start mechanic.
    // `activeBossMechanics` already falls back to a non-phased unit's single
    // `passive`, but that fallback was unreachable from here while the gate
    // was `isBoss` alone — so a mob could author one of these and it would
    // silently never fire. Part 1's mobs use `bossStatSpike` as an anti-stall
    // (Tanveer, 2026-08-09) and have no phases.
    const mechs = activeBossMechanics(unit);
    if (
      !isBoss(unit) &&
      !mechs.some((m) => TURN_START_MECHANICS.has(m.type))
    ) {
      return unit;
    }

    const boss: BattleCharacter = {
      ...unit,
      buffs: [...unit.buffs],
      passiveState: { ...unit.passiveState },
    };
    // For a phased boss this counts turns within the current phase; for a
    // plain enemy there is only one "phase", so it counts enemy turns since
    // the battle started — which is what "after turn N" means for them.
    const phaseTurn = ((boss.passiveState.phaseTurn as number) ?? 0) + 1;
    boss.passiveState.phaseTurn = phaseTurn;

    // 1. Stat spike first, so a same-turn debuff-ATK recompute keys off the
    //    already-doubled base ATK.
    for (const m of mechs) {
      if (m.type === "bossStatSpike") applyStatSpike(boss, m, phaseTurn, log);
    }
    // 2. Dynamic debuff-count ATK (recomputed against the enemy field).
    for (const m of mechs) {
      if (m.type === "bossDebuffAtk") recomputeDebuffAtk(boss, players, m, log);
    }
    // 3. Apply Corrosion to each field player.
    for (const m of mechs) {
      if (m.type === "bossApplyCorrosion") {
        players = applyCorrosion(players, boss, m, phaseTurn, log);
      }
    }
    // 4. Turn-N max-HP drain on each field player.
    for (const m of mechs) {
      if (m.type === "bossMaxHpDrain") {
        players = applyMaxHpDrain(players, m, phaseTurn, boss, log);
      }
    }

    return boss;
  });

  return { enemyTeam: enemies, playerTeam: players };
}

function applyStatSpike(
  boss: BattleCharacter,
  mech: Extract<Mechanic, { type: "bossStatSpike" }>,
  phaseTurn: number,
  log: (entry: string) => void,
): void {
  const fromTurn = mech.fromTurn ?? 10;
  if (phaseTurn < fromTurn || boss.passiveState.statSpikeDone) return;

  const mult = mech.multiplier ?? 2;
  boss.atk = Math.floor(boss.atk * mult);
  boss.def = Math.floor(boss.def * mult);
  boss.hp = Math.floor(boss.hp * mult);
  boss.currentAttack = Math.floor(boss.currentAttack * mult);
  boss.currentDefense = Math.floor(boss.currentDefense * mult);
  boss.currentHP = Math.floor(boss.currentHP * mult);
  boss.passiveState.statSpikeDone = true;

  boss.buffs.push({
    type: "buff",
    // Basic stats = ATK/DEF/HP, which is exactly what the spike multiplies.
    // NOT "all", which additionally covers substats (Tanveer, 2026-08-09).
    stats: ["atk", "def", "hp"],
    valuePercent: (mult - 1) * 100,
    uncancellable: true,
    preApplied: true,
    name: mech.name ?? "Awakening",
  });
  log(
    `${boss.name} AWAKENS — ${Math.floor((mult - 1) * 100)}% increase to basic stats!`,
  );
}

function recomputeDebuffAtk(
  boss: BattleCharacter,
  players: BattleCharacter[],
  mech: Extract<Mechanic, { type: "bossDebuffAtk" }>,
  log: (entry: string) => void,
): void {
  const badgeName = mech.name ?? "Malice";
  const percentPer = mech.percentPerDebuff ?? 10;
  const newPct = totalDebuffStacks(players) * percentPer;

  const idx = boss.buffs.findIndex((b) => b.name === badgeName);
  const oldPct = idx >= 0 ? (boss.buffs[idx].valuePercent ?? 0) : 0;
  if (newPct === oldPct) return;

  // Rebuild from base rather than nudging by a delta.
  //
  // This applied `floor(atk * (new - old) / 100)`, and `Math.floor` rounds a
  // NEGATIVE delta away from zero — at 285 base, +5% added 14 while the
  // matching -5% subtracted 15. Every debuff that appeared and expired cost the
  // boss 1 ATK permanently, so its attack decayed across a long fight
  // (285 -> 299 -> 284 -> 298 -> 283 in a traced P1 run). Recomputing the whole
  // bonus off `boss.atk` cannot drift: the same count always yields the same
  // number, whichever direction it was reached from.
  const oldBonus = Math.floor((boss.atk * oldPct) / 100);
  const newBonus = Math.floor((boss.atk * newPct) / 100);
  boss.currentAttack += newBonus - oldBonus;
  const badge: StatusEffect = {
    type: "buff",
    stat: "atk",
    valuePercent: newPct,
    uncancellable: true,
    preApplied: true,
    name: badgeName,
  };
  if (idx >= 0) boss.buffs[idx] = badge;
  else boss.buffs.push(badge);

  log(`${boss.name}'s ${badgeName}: ATK +${newPct}% (enemy debuffs).`);
}

function applyCorrosion(
  players: BattleCharacter[],
  boss: BattleCharacter,
  mech: Extract<Mechanic, { type: "bossApplyCorrosion" }>,
  phaseTurn: number,
  log: (entry: string) => void,
): BattleCharacter[] {
  // Default 1 = every turn, which is how this shipped. Molvarr P2 now runs on
  // 3: each stack also feeds Growing Malice's ATK-per-debuff, so applying
  // four stacks a turn to three players was compounding into a four-figure
  // ultimate by mid-fight (Tanveer, 2026-08-13).
  const everyN = Math.max(1, mech.everyNTurns ?? 1);
  if (phaseTurn % everyN !== 0) return players;
  const perTurn = mech.perTurn ?? 1;
  const duration = mech.duration ?? 2;
  return players.map((p) => {
    if (p.currentHP <= 0 || p.isSub) return p;
    // Debuff Immunity (Isolde's Starbound Ward) blocks this too. Boss passives
    // apply debuffs outside the skill path, so they skipped the gate in
    // combat.ts entirely and corroded immune units (Tanveer, 2026-08-09).
    if (p.buffs.some((b) => b.debuffImmune)) {
      log(`${p.name} resists ${boss.name}'s corrosion (Debuff Immunity).`);
      return p;
    }
    const debuffs = [...p.debuffs];
    for (let i = 0; i < perTurn; i++) {
      debuffs.push({
        type: "corrosion",
        name: "Corrosion",
        valuePercent: CORROSION_PERCENT,
        stacks: 1,
        debuffDuration: duration,
      });
    }
    log(`${boss.name}'s corrosion spreads to ${p.name}.`);
    return { ...p, debuffs };
  });
}

function applyMaxHpDrain(
  players: BattleCharacter[],
  mech: Extract<Mechanic, { type: "bossMaxHpDrain" }>,
  phaseTurn: number,
  boss: BattleCharacter,
  log: (entry: string) => void,
): BattleCharacter[] {
  const fromTurn = mech.fromTurn ?? 10;
  if (phaseTurn < fromTurn) return players;
  const percent = mech.percent ?? 10;
  return players.map((p) => {
    if (p.currentHP <= 0 || p.isSub) return p;
    const dmg = Math.floor((p.currentHP * percent) / 100);
    log(`${p.name} loses ${dmg} HP to ${boss.name}'s decay.`);
    return { ...p, currentHP: Math.max(0, p.currentHP - dmg) };
  });
}
