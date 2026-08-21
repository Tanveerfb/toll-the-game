/**
 * Balance simulator — the command line front end for `lib/game/simulate.ts`.
 *
 * Ruling #57: a conclusion from a duel is not a conclusion, because card
 * frequency swings 4x between 1v1 and 4v4. So the default run is the *ladder* —
 * the same matchup across all four formats — rather than one number.
 *
 *   npm run sim -- duke seras                     # duke vs seras, every format
 *   npm run sim -- duke,lyra,seras chiara,gon,ban # team vs team
 *   npm run sim -- duke seras --runs 500 --seed 7
 *   npm run sim -- --roster duke                  # duke vs the whole roster, 3v3
 *
 * Read the output as a comparison between kits under fixed conditions. The
 * limits — no card draw, AI on both sides, base stats — are documented at the
 * top of `lib/game/simulate.ts` and they matter.
 */
import {
  simulate,
  winRate,
  type SimOptions,
  type SimResult,
} from "@/lib/game/simulate";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

interface Args {
  left: string[];
  right: string[];
  runs: number;
  seed: number;
  /** Sweep one character against every playable kit instead of one matchup. */
  roster: string | null;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let runs = 200;
  let seed = 1;
  let roster: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--runs") runs = Number(argv[++i]);
    else if (arg === "--seed") seed = Number(argv[++i]);
    else if (arg === "--roster") roster = argv[++i] ?? null;
    else positional.push(arg);
  }

  return {
    left: (positional[0] ?? "").split(",").filter(Boolean),
    right: (positional[1] ?? "").split(",").filter(Boolean),
    runs,
    seed,
    roster,
  };
}

function pct(value: number | null): string {
  return value === null ? "  —  " : `${value.toFixed(1).padStart(5)}%`;
}

function line(label: string, result: SimResult): string {
  const rate = winRate(result);
  const bar =
    rate === null
      ? ""
      : "█".repeat(Math.round(rate / 5)).padEnd(20, "·");
  return [
    label.padEnd(14),
    pct(rate),
    `${String(result.wins).padStart(4)}W`,
    `${String(result.losses).padStart(4)}L`,
    `${String(result.draws).padStart(4)}D`,
    `${result.averageTurns.toFixed(1).padStart(5)}t`,
    `${result.averageSurvivors.toFixed(2)} left`,
    bar,
  ].join("  ");
}

/**
 * The four formats ruling #57 names, as (label, fieldCap, left size, right
 * size). "3v1" is the asymmetric case it calls out by name — a full team
 * against one unit, which is where a kit's frequency advantage shows up most.
 */
const LADDER: Array<{
  label: string;
  fieldCap: number;
  left: number;
  right: number;
}> = [
  { label: "1v1", fieldCap: 1, left: 1, right: 1 },
  { label: "3v1", fieldCap: 3, left: 3, right: 1 },
  { label: "3v3", fieldCap: 3, left: 3, right: 3 },
  { label: "4v4", fieldCap: 4, left: 4, right: 4 },
];

async function runLadder(
  left: string[],
  right: string[],
  base: SimOptions,
): Promise<void> {
  console.log(
    `\n${left.join(", ")}   vs   ${right.join(", ")}` +
      `   (${base.runs} runs, seed ${base.seed})\n`,
  );
  console.log("  format          win%     W     L     D  turns  survivors");

  const skipped: string[] = [];
  for (const rung of LADDER) {
    // Skipped rather than quietly run at a smaller size: labelling a
    // three-unit fight "4v4" is how a balance number becomes a lie.
    if (left.length < rung.left || right.length < rung.right) {
      skipped.push(rung.label);
      continue;
    }
    const result = await simulate(
      left.slice(0, rung.left),
      right.slice(0, rung.right),
      { ...base, fieldCap: rung.fieldCap },
    );
    console.log("  " + line(rung.label, result));
  }

  if (skipped.length > 0) {
    console.log(
      `\n  Skipped ${skipped.join(", ")} — not enough characters named for` +
        ` those formats.`,
    );
  }
  console.log("");
}

async function runRosterSweep(
  subject: string,
  base: SimOptions,
): Promise<void> {
  const roster = getPlayableCharacters().filter((c) => c.id !== subject);
  console.log(
    `\n${subject} vs the roster — 3v3, ${base.runs} runs each, seed ${base.seed}\n`,
  );
  console.log("  opponent        win%     W     L     D  turns  survivors");

  const rows: Array<{ id: string; rate: number | null; result: SimResult }> = [];
  for (const opponent of roster) {
    const result = await simulate([subject], [opponent.id], {
      ...base,
      fieldCap: 3,
    });
    rows.push({ id: opponent.id, rate: winRate(result), result });
  }

  rows.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  for (const row of rows) console.log("  " + line(row.id, row.result));

  const rated = rows.map((r) => r.rate).filter((r): r is number => r !== null);
  if (rated.length > 0) {
    const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
    console.log(
      `\n  ${subject} averages ${mean.toFixed(1)}% across ${rated.length} matchups.`,
    );
    console.log(
      "  50% is even. Read the spread, not the mean — a kit that goes 90/10\n" +
        "  against half the roster and 10/90 against the other half also averages 50.\n",
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const base: SimOptions = { runs: args.runs, seed: args.seed };

  if (args.roster) {
    await runRosterSweep(args.roster, base);
    return;
  }

  if (args.left.length === 0 || args.right.length === 0) {
    console.log(
      [
        "",
        "  npm run sim -- <left> <right> [--runs N] [--seed N]",
        "  npm run sim -- --roster <id> [--runs N]",
        "",
        "  Ids are comma-separated for a team:",
        "    npm run sim -- duke seras",
        "    npm run sim -- duke,lyra,seras chiara,gon,ban",
        "",
        "  Limits are documented in lib/game/simulate.ts and they matter:",
        "  no card draw, AI plays both sides, base stats only.",
        "",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  await runLadder(args.left, args.right, base);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
