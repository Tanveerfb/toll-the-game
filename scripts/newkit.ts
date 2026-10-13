/**
 * Starts a kit from data/kit.template.json, never from another character's
 * file (his rule, 2026-10-13).
 *
 *   npm run newkit -- <id> --name "<Name>" --color <light|red|blue|green|dark> [--heading "<Heading>"]
 *
 * Writes data/characters/<id>.json with the next free card number and
 * `unreleased: true`, then prints what a session does next. Every name,
 * number and mechanic in the file is a placeholder for his draft.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { materialiseKit, nextFreeCardNumber, type NewKitOptions } from "@/lib/game/kitTemplate";

const KITS = "data/characters";
const COLORS = ["light", "red", "blue", "green", "dark"] as const;

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const id = process.argv[2];
const name = arg("--name");
const color = arg("--color") as NewKitOptions["color"] | undefined;
const heading = arg("--heading");

if (!id || !/^[a-z][a-z0-9_]*$/.test(id) || !name || !color || !COLORS.includes(color)) {
  console.error(
    'usage: npm run newkit -- <id> --name "<Name>" --color <light|red|blue|green|dark> [--heading "<Heading>"]',
  );
  process.exit(1);
}

const path = join(KITS, `${id}.json`);
if (existsSync(path)) {
  console.error(`${path} exists; a kit is edited in place, never regenerated`);
  process.exit(1);
}

const inUse = readdirSync(KITS)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(KITS, file), "utf8")) as { cardNumber?: number })
  .map((kit) => kit.cardNumber)
  .filter((n): n is number => typeof n === "number");

const template = JSON.parse(readFileSync("data/kit.template.json", "utf8")) as Record<string, unknown>;
const kit = materialiseKit(template, {
  id,
  name,
  color,
  heading,
  cardNumber: nextFreeCardNumber(inUse),
});
writeFileSync(path, `${JSON.stringify(kit, null, 2)}\n`, "utf8");

console.log(`wrote ${path} (card ${kit.cardNumber}, unreleased)`);
console.log(`
next, in this order:
  1. Replace every placeholder with his draft: stats, both skills, the ultimate, the passive.
     Bracketed numbers in his draft are ranked (valueRanked); everything else is flat.
  2. Register it: import in lib/game/characterCatalog.ts and add it to rawCharacters
     (alphabetical). tests/characterCatalogRegistration.test.ts is red until you do.
  3. Wording through the kitwords skill, then the kitcheck skill. Never change a number.
  4. Art: a SKILL_ART_ALIAS fallback in lib/game/characterArt.ts, a characterVfx.ts entry,
     and a Category E request in docs/ART_REQUESTS.md (comfypending). Keep \`unreleased\`
     until the art lands (ruling #171).
  5. npm run check, then npm run sim -- --roster ${id} and report floors, never nerfs.`);
