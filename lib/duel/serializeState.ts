import type { BattleCharacter } from "@/types/character";
import type { ActionCard } from "@/types/action";
import type { StatusEffect } from "@/types/mechanic";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import { activePhase, activeSpSkill } from "@/lib/game/bossPassives";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";

/**
 * Serialises a battle into the markdown Claude reads on its turn.
 *
 * Markdown rather than JSON on purpose — the consumer is a language model, so
 * prose costs nothing and reads better than a nested object.
 *
 * The hard rule is what's ABSENT: the player's hand and queued cards never
 * appear. Claude sees exactly what a player sees looking at the board. Leaking
 * either would mean reading Tanveer's plan instead of testing his kits, which
 * would silently invalidate every balance conclusion drawn from these games.
 * `tests/duelState.test.ts` asserts it.
 */

export interface DuelStateInput {
  /** The side Claude is playing. */
  enemyTeam: BattleCharacter[];
  /** Tanveer's side. */
  playerTeam: BattleCharacter[];
  /** Claude's hidden hand — the same 7DS GC deck the AI plays from. */
  hand: ActionCard[];
  /** 0-based turn counter from the store; displayed 1-based. */
  turn: number;
  /** How many actions Claude gets this turn (`enemyActionsForTurn`). */
  actionBudget: number;
  /** Tail of the battle log, so Claude knows what just happened to it. */
  recentEvents?: string[];
}

function pct(effect: StatusEffect): string {
  if (typeof effect.valuePercent === "number") return `${effect.valuePercent}%`;
  if (typeof effect.value === "number") return String(effect.value);
  return "";
}

function statOf(effect: StatusEffect): string {
  if (effect.stats && effect.stats.length > 0) {
    return effect.stats.map((s) => s.toUpperCase()).join("+");
  }
  return effect.stat ? effect.stat.toUpperCase() : "";
}

function describeEffect(effect: StatusEffect): string {
  const bits: string[] = [];
  const label = effect.name ?? effect.type;
  bits.push(label);
  const stat = statOf(effect);
  const amount = pct(effect);
  if (stat || amount) bits.push(`(${[stat, amount].filter(Boolean).join(" ")})`);
  const duration = effect.buffDuration ?? effect.debuffDuration;
  if (typeof duration === "number") bits.push(`${duration} turn${duration === 1 ? "" : "s"} left`);
  if (effect.stacks && effect.stacks > 1) bits.push(`${effect.stacks} stacks`);
  if (effect.uncancellable) bits.push("uncancellable");
  return bits.join(" · ");
}

function effectLines(unit: BattleCharacter): string {
  const all = [
    ...unit.buffs.map((b) => ({ e: b, kind: b.uncancellable ? "effect" : "buff" })),
    ...unit.debuffs.map((d) => ({ e: d, kind: d.uncancellable ? "effect" : "debuff" })),
  ];
  if (all.length === 0) return "  - none";
  return all.map(({ e, kind }) => `  - [${kind}] ${describeEffect(e)}`).join("\n");
}

/** The skills a unit can actually use right now — the active phase's for a
 *  multi-phase boss, otherwise its own. */
function currentSkills(unit: BattleCharacter): CharacterSkillData[] {
  const phase = activePhase(unit);
  return ((phase?.skills ?? unit.skills) ?? []) as unknown as CharacterSkillData[];
}

function kitBlock(unit: BattleCharacter): string {
  const lines: string[] = [];
  const phase = activePhase(unit);
  if (phase) {
    const index = (unit.phaseIndex ?? 0) + 1;
    lines.push(`  Phase ${index} kit:`);
  }
  currentSkills(unit).forEach((skill) => {
    // Rank 3 wording, since the description is here to explain what the skill
    // DOES; the hand lists the rank each specific card will resolve at.
    lines.push(`  - ${skill.skillName}: ${buildDescriptionForRank(skill, 2)}`);
  });
  const ult = (phase as { ultimate?: unknown })?.ultimate ?? unit.ultimate;
  if (ult) {
    const u = ult as CharacterSkillData;
    lines.push(`  - [ULT] ${u.skillName}: ${buildDescriptionForRank(u, 0)}`);
  }
  const sp = activeSpSkill(unit);
  if (sp) {
    lines.push(
      `  - [SP] ${sp.skillName} — fired automatically by the boss's own schedule, not chosen`,
    );
  }
  const passives = phase?.passives ?? (unit.passive ? [unit.passive] : []);
  passives.forEach((p) => {
    if (!p) return;
    const text = (p.description ?? "").replace(/\n/g, " ").trim();
    lines.push(`  - [PASSIVE] ${p.name}${text ? `: ${text}` : ""}`);
  });
  return lines.join("\n");
}

function passiveStateLine(unit: BattleCharacter): string {
  const entries = Object.entries(unit.passiveState ?? {}).filter(
    ([, v]) => typeof v === "number" || typeof v === "boolean",
  );
  if (entries.length === 0) return "";
  return `  Passive state: ${entries.map(([k, v]) => `${k}=${v}`).join(", ")}`;
}

function unitBlock(unit: BattleCharacter, withKit: boolean): string {
  const out: string[] = [];
  const bench = unit.isSub ? " [BENCHED — cannot act or be targeted]" : "";
  const dead = unit.currentHP <= 0 ? " [DOWN]" : "";
  out.push(`### ${unit.name} (${unit.instanceId})${bench}${dead}`);
  out.push(
    `  HP ${unit.currentHP}/${unit.hp} · ATK ${getEffectiveAttack(unit)} (base ${unit.currentAttack}) · DEF ${getEffectiveDefense(unit)} (base ${unit.currentDefense}) · ${unit.color}`,
  );
  out.push(`  Ult gauge ${unit.ultGauge}/${ultGaugeMax(unit)}`);
  const ps = passiveStateLine(unit);
  if (ps) out.push(ps);
  out.push("  Statuses:");
  out.push(effectLines(unit));
  if (withKit) {
    out.push("  Kit:");
    out.push(kitBlock(unit));
  }
  return out.join("\n");
}

function handBlock(hand: ActionCard[]): string {
  if (hand.length === 0) return "_(empty — no cards to play)_";
  return hand
    .map((card, index) => {
      const rankIndex = Math.max(0, Math.min(2, card.rank - 1));
      const desc = buildDescriptionForRank(
        card.skill as unknown as CharacterSkillData,
        rankIndex,
      );
      return `- **[${index}]** ${card.skill.skillName} · R${card.rank} · from ${card.sourceInstanceId}\n    ${desc}`;
    })
    .join("\n");
}

/**
 * Scheduled behaviour Claude should plan around rather than be surprised by.
 * These fire on the boss's own schedule and consume an action; they are not
 * Claude's to suppress (Tanveer, 2026-08-09).
 */
function scheduleBlock(enemyTeam: BattleCharacter[]): string {
  const lines: string[] = [];
  enemyTeam.forEach((unit) => {
    const phase = activePhase(unit);
    const passives = phase?.passives ?? (unit.passive ? [unit.passive] : []);
    const mechs = passives.flatMap((p) => p?.mechanics ?? []);
    const phaseTurn = (unit.passiveState.phaseTurn as number) ?? 0;

    mechs.forEach((m) => {
      if (m.type === "bossAutoSp") {
        const everyN = m.everyNTurns ?? 3;
        const untilNext = everyN - (phaseTurn % everyN);
        lines.push(
          `- ${unit.name}: SP Skill fires automatically every ${everyN} phase-turns (phase turn ${phaseTurn}; next in ${untilNext}). It takes the LAST action of that turn.`,
        );
      }
      if (m.type === "bossStatSpike") {
        const from = m.fromTurn ?? 10;
        const done = Boolean(unit.passiveState.statSpikeDone);
        lines.push(
          done
            ? `- ${unit.name}: stat spike already fired (×${m.multiplier ?? 2}).`
            : `- ${unit.name}: stats ×${m.multiplier ?? 2} once turn ${from} is reached (phase turn ${phaseTurn}).`,
        );
      }
      if (m.type === "bossMaxHpDrain") {
        lines.push(
          `- ${unit.name}: from turn ${m.fromTurn ?? 10}, drains ${m.percent ?? 10}% of each enemy's current HP per turn.`,
        );
      }
      if (m.type === "bossApplyCorrosion") {
        const everyN = Math.max(1, m.everyNTurns ?? 1);
        lines.push(
          everyN === 1
            ? `- ${unit.name}: applies Corrosion to each opposing field unit every turn.`
            : `- ${unit.name}: applies Corrosion to each opposing field unit every ${everyN} phase-turns (phase turn ${phaseTurn}; next in ${everyN - (phaseTurn % everyN)}).`,
        );
      }
    });
  });
  return lines.length > 0 ? lines.join("\n") : "_(nothing scheduled)_";
}

export function serializeDuelState(input: DuelStateInput): string {
  const { enemyTeam, playerTeam, hand, turn, actionBudget, recentEvents } = input;
  const living = (t: BattleCharacter[]) => t.filter((u) => u.currentHP > 0);

  const out: string[] = [];
  out.push(`# Your turn — turn ${turn + 1}`);
  out.push("");
  out.push(
    `You control the **enemy** side. You have **${actionBudget} action${actionBudget === 1 ? "" : "s"}** this turn.`,
  );
  out.push("");
  out.push(
    "Write your move to `.duel/move.json`. Card indices refer to YOUR HAND below. " +
      "Omit `targetInstanceId` to let the engine pick a living field target.",
  );
  out.push("");
  // The heading is 1-based for reading; the guard compares the raw counter.
  // Stating the literal value stops a correct-looking move being rejected for
  // being "one turn out" — hit on the very first duel move, 2026-08-09.
  out.push(
    `**Use \`"turn": ${turn}\` in move.json** (the heading above is 1-based; this is the raw value the validator checks).`,
  );
  out.push("");

  out.push("## Your units");
  out.push("");
  enemyTeam.forEach((u) => {
    out.push(unitBlock(u, true));
    out.push("");
  });

  out.push("## Your hand");
  out.push("");
  out.push(handBlock(hand));
  out.push("");

  out.push("## Automatic behaviour this fight");
  out.push("");
  out.push(scheduleBlock(enemyTeam));
  out.push("");

  out.push("## Opponent's field units");
  out.push("");
  // Kits included: a player can read any opponent's kit in the archive, so it
  // is public information. Their HAND and QUEUE are not, and never appear.
  living(playerTeam)
    .filter((u) => !u.isSub)
    .forEach((u) => {
      out.push(unitBlock(u, true));
      out.push("");
    });

  const benched = playerTeam.filter((u) => u.isSub && u.currentHP > 0);
  if (benched.length > 0) {
    out.push(
      `_Benched (untargetable, passives active): ${benched.map((u) => u.name).join(", ")}_`,
    );
    out.push("");
  }

  if (recentEvents && recentEvents.length > 0) {
    out.push("## Recent events");
    out.push("");
    recentEvents.slice(-12).forEach((e) => out.push(`- ${e}`));
    out.push("");
  }

  return out.join("\n");
}
