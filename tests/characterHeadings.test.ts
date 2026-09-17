import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { characterSchema } from "@/lib/game/characterSchema";

/**
 * Headings, and the uniqueness rule that makes them worth having.
 *
 * Ruling **#141**: a unit is a heading plus a name. Every variant of a
 * character keeps the **same name** and is told apart by the heading, so
 * `id` stays the key and the heading is what a player reads.
 *
 * The rule that matters: **heading and name are unique only together.** Two
 * units may share a name (that is the point) and two may share a heading, but
 * the pair must identify one unit — otherwise the game renders two things
 * identically, which is the defect this whole field exists to fix.
 */

const DIR = "data/characters";

const kits = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    return { file: f, data: characterSchema.parse(raw) };
  });

describe("character headings", () => {
  it("finds the roster at all", () => {
    // A scan that finds nothing passes for the wrong reason.
    expect(kits.length).toBeGreaterThan(25);
  });

  /**
   * The bug this field was introduced to fix.
   *
   * `lyra` and `lyra_npc` both carry `name: "Lyra"` and, before headings,
   * rendered as plain "Lyra" everywhere — the only duplicate display name in
   * the roster, and it shipped rather than being hypothetical.
   *
   * **Falsified before being trusted** (`AGENTS.md`): removing the `heading`
   * from `data/characters/lyra_npc.json` makes this go red naming both files.
   */
  it("heading and name identify one unit together", () => {
    const seen = new Map<string, string[]>();
    for (const { file, data } of kits) {
      const label = `${data.heading ?? ""}|${data.name}`;
      seen.set(label, [...(seen.get(label) ?? []), file]);
    }
    const clashes = [...seen.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([label, files]) => `${label.replace("|", " / ")} → ${files.join(", ")}`);
    expect(
      clashes,
      "Two units render identically. Give one of each pair a heading — " +
        "see Plans/2026-09-17-character-headings.md.",
    ).toEqual([]);
  });

  /**
   * Card numbers are permanent, unique, and not derived from anything.
   *
   * The URL carries `cardNumber` because `id` is a name (`duke`, `batra`) and
   * Tanveer asked for the opposite - *"the url would show the char id, not the
   * names"* (2026-09-17). `id` could not simply be renumbered: it is what every
   * save's `roster` holds, so a change would have invalidated stored rosters.
   *
   * **A number is assigned once and never changed or reused**, because it is a
   * public URL - changing one silently breaks any link to that card. The
   * initial block was handed out in alphabetical order of `id` purely for
   * reproducibility; nothing may re-derive a number from that order, and a new
   * character takes the next free number rather than an alphabetical slot.
   */
  it("every card number is unique and in range", () => {
    const numbers = kits.map(({ data }) => data.cardNumber);
    expect(new Set(numbers).size, "two cards share a number").toBe(
      numbers.length,
    );
    for (const n of numbers) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  /**
   * A heading is a title, not a sentence.
   *
   * His correction on the first draft: *"We don't need to have their lore
   * inside… it's more like a title, a nickname — not a lore heading."* The
   * rejected drafts were biography (*"Nine Years Alone"*), and biography is
   * what runs long. Four words is where every approved heading sits, and
   * `Heir of the Zoldyck Clan` — his own wording — is the longest at five.
   */
  it("every heading reads as a title", () => {
    const tooLong = kits
      .filter(({ data }) => (data.heading?.split(/\s+/).length ?? 0) > 5)
      .map(({ file, data }) => `${file}: "${data.heading}"`);
    expect(
      tooLong,
      "A heading is a nickname, not a lore line (his correction, 2026-09-17).",
    ).toEqual([]);
  });

  /**
   * Every kit carries one - no exemptions.
   *
   * The six generic enemies were going to be exempt, on the grounds that a
   * type has no second version to be told apart from. He asked for a heading
   * on them anyway, so they share one: **Common Foe**, which is honest about
   * what they are.
   *
   * The *faction* set offered first (Checkpoint / Bandit / Raider / Wilds) was
   * dropped because it stutters against the names it sits above - "Raider"
   * over "Raider", "Bandit" over "Ford Bandit". A shared heading over
   * differing names does not, and the pair stays unique either way.
   *
   * **No exempt list on purpose.** One would be the natural place for a new
   * kit to hide from this check.
   */
  it("no character is left without one", () => {
    const missing = kits.filter(({ data }) => !data.heading).map(({ file }) => file);
    expect(missing).toEqual([]);
  });
});
