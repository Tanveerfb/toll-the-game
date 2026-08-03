import type { BattleCharacter } from "@/types/character";
import type { SequencedBattleEvent } from "@/store/gameStore";
import { ultGaugeMax } from "@/lib/game/ultGauge";

export interface BattleLogReport {
  /** "victory" | "defeat" | whatever phase the battle ended in. */
  result: string;
  /** 0-based turn index; rendered as turn + 1. */
  turn: number;
  playerTurns: number;
  enemyTurns: number;
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  events: SequencedBattleEvent[];
  /** The engine's human-readable line log. Still the only place effect
   *  applications (buffs/debuffs/cleanses) are recorded, so it's kept in full
   *  as an appendix rather than dropped. */
  rawLog: string[];
  /** Passed in rather than read from the clock, so this stays pure. */
  timestamp: string;
}

function unitLine(u: BattleCharacter): string {
  const sub = u.isSub ? " _(sub)_" : "";
  const down = u.currentHP <= 0 ? " **DOWN**" : "";
  return `| ${u.name}${sub}${down} | ${Math.max(0, u.currentHP)}/${u.hp} | ${u.currentAttack} | ${u.currentDefense} | ${u.ultGauge}/${ultGaugeMax(u)} |`;
}

function teamTable(title: string, team: BattleCharacter[]): string[] {
  return [
    `### ${title}`,
    "",
    "| Unit | HP | ATK | DEF | Ult |",
    "|---|---|---|---|---|",
    ...team.map(unitLine),
    "",
  ];
}

function actionLines(
  event: Extract<SequencedBattleEvent, { kind: "action" }>,
): string[] {
  const side = event.sourceTeam === "player" ? "P" : "E";
  const tier = event.isUlt ? "ULT" : event.rank ? `R${event.rank}` : "";
  const lines = [
    `- **[${side}] ${event.sourceName}** — ${event.skillName}${tier ? ` \`${tier}\`` : ""}`,
  ];
  for (const t of event.targets) {
    const bits: string[] = [];
    if (t.evaded) bits.push("DODGED");
    if (t.damage) bits.push(`-${t.damage}`);
    if (t.heal) bits.push(`+${t.heal}`);
    if (t.crit) bits.push("CRIT");
    if (t.survivedLethal) bits.push("SURVIVED");
    if (t.killed) bits.push("DOWN");
    const hp =
      t.hpBefore !== undefined && t.hpAfter !== undefined
        ? ` _(${t.hpBefore} → ${t.hpAfter})_`
        : "";
    lines.push(`  - ${t.name}: ${bits.join(" · ") || "no effect"}${hp}`);
  }
  for (const c of event.counters) {
    lines.push(
      `  - ↩ ${c.byName} counters: -${c.damage}${c.killedAttacker ? " · DOWN" : ""}`,
    );
  }
  return lines;
}

function tickLines(
  event: Extract<SequencedBattleEvent, { kind: "tick" }>,
): string[] {
  const lines = [`- _${event.label}_`];
  for (const t of event.targets) {
    const delta = t.hpAfter - t.hpBefore;
    lines.push(
      `  - ${t.name}: ${delta < 0 ? "-" : "+"}${Math.abs(delta)} _(${t.hpBefore} → ${t.hpAfter})_`,
    );
  }
  return lines;
}

/**
 * Renders a finished battle as readable markdown for the playtest dump.
 *
 * The endpoint used to write a raw text blob whose body was the engine's line
 * log verbatim. The typed event stream carries per-target damage, crits,
 * evades, kills and exact HP snapshots, so the body is now built from that,
 * grouped by turn — with the line log kept whole as an appendix, since it
 * still records effect applications the event stream doesn't model.
 */
export function formatBattleLogMarkdown(report: BattleLogReport): string {
  const turns = [...new Set(report.events.map((e) => e.turn))].sort(
    (a, b) => a - b,
  );

  const body: string[] = [
    `# Battle log — ${report.result.toUpperCase()}`,
    "",
    `_${report.timestamp}_`,
    "",
    `Ended on turn ${report.turn + 1} · ${report.playerTurns} player / ${report.enemyTurns} enemy turns resolved.`,
    "",
    "## Final state",
    "",
    ...teamTable("Player team", report.playerTeam),
    ...teamTable("Enemy team", report.enemyTeam),
    "## Timeline",
    "",
  ];

  if (turns.length === 0) {
    body.push("_No structured events recorded._", "");
  } else {
    for (const turn of turns) {
      body.push(`### Turn ${turn + 1}`, "");
      for (const event of report.events.filter((e) => e.turn === turn)) {
        body.push(
          ...(event.kind === "action" ? actionLines(event) : tickLines(event)),
        );
      }
      body.push("");
    }
  }

  body.push(
    "## Raw event log",
    "",
    `_${report.rawLog.length} lines, verbatim from the engine — includes effect applications the structured stream doesn't model yet._`,
    "",
    "```",
    ...report.rawLog,
    "```",
    "",
  );

  return body.join("\n");
}
