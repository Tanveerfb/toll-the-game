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

const CORROSION_PERCENT = 10; // % max HP per stack per turn (tick.ts default)

export function isBoss(char: { phases?: CharacterPhase[] }): boolean {
  return (char.phases?.length ?? 0) > 0;
}

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
  return passives.flatMap((p) => p.mechanics ?? []);
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
    if (!isBoss(unit) || unit.currentHP <= 0 || unit.isSub) return unit;

    const boss: BattleCharacter = {
      ...unit,
      buffs: [...unit.buffs],
      passiveState: { ...unit.passiveState },
    };
    const phaseTurn = ((boss.passiveState.phaseTurn as number) ?? 0) + 1;
    boss.passiveState.phaseTurn = phaseTurn;

    const mechs = activeBossMechanics(boss);

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
        players = applyCorrosion(players, boss, m, log);
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
    stat: "all",
    valuePercent: (mult - 1) * 100,
    uncancellable: true,
    preApplied: true,
    name: mech.name ?? "Awakening",
  });
  log(
    `${boss.name} AWAKENS — ${Math.floor((mult - 1) * 100)}% increase to all stats!`,
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

  // Delta on BASE atk keeps currentAttack consistent as the count changes.
  boss.currentAttack += Math.floor((boss.atk * (newPct - oldPct)) / 100);
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
  log: (entry: string) => void,
): BattleCharacter[] {
  const perTurn = mech.perTurn ?? 1;
  const duration = mech.duration ?? 2;
  return players.map((p) => {
    if (p.currentHP <= 0 || p.isSub) return p;
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
    const dmg = Math.floor((p.hp * percent) / 100);
    log(`${p.name} loses ${dmg} HP to ${boss.name}'s decay.`);
    return { ...p, currentHP: Math.max(0, p.currentHP - dmg) };
  });
}
