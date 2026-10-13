import { z } from "zod";
import { MECHANIC_TYPES } from "@/types/mechanic";
import { PASSIVE_TRIGGERS } from "@/types/passive";

// Runtime shape-check for data/characters/*.json — kits are hand-edited and
// act as the source of truth, so a typo should fail loudly at load time with
// the character id attached, not mid-battle. Loose objects: mechanics carry
// per-type fields (counterDamagePercentRanked, sealType, …) that stay open,
// but the `type` string itself must be a known mechanic (STATUS #7).

// PASSIVE_TRIGGERS is imported, not redeclared — see the note on the type.

const AUDIENCES = [
  "self",
  "oneAlly",
  "allies",
  "alliesExceptSelf",
  "enemies",
] as const;

const mechanicSchema = z.looseObject({
  type: z
    .enum(MECHANIC_TYPES)
    .describe(
      "One of the engine's mechanic types (types/mechanic.ts). The other fields are per type and stay open: a rank-scaled value is `valueRanked` [R1, R2, R3] (or `durationRanked`, `stacksRanked`); a flat one is `valuePercent` / `duration` / `maxStacks`; `stat` or `stats` names what a buff or debuff moves; `name` labels a stance or a stack; `conditionTags` drives a synergy. Bracketed numbers in his draft are ranked, everything else is flat (KIT_DESIGN.md).",
    ),
  /** Declared audience — absent means self (types/mechanic.ts). */
  applyTo: z
    .enum(AUDIENCES)
    .optional()
    .describe("Who it lands on. Absent means self; ally breadth is oneAlly vs allies; enemy breadth is the `aoe` mechanic."),
  applyToRanked: z
    .array(z.enum(AUDIENCES))
    .length(3)
    .optional()
    .describe("Per-rank audience, same ladder as valueRanked."),
  /** Lands after the hit, and only if it connected. */
  requiresDamage: z
    .boolean()
    .optional()
    .describe("Lands after the hit and only if it connected; a tanked or evaded hit grants nothing."),
});

const skillSchema = z.looseObject({
  skillName: z.string().min(1).describe("His name for the skill; from a theme, never from its mechanics (ruling #150)."),
  characterId: z.string().min(1).describe("The owning kit's id, repeated on every card."),
  type: z
    .string()
    .min(1)
    .describe("attack | attackDebuff | buff | debuff | heal | stance | ultimate (lib/game/skillTypeStyle.ts); fixes the card's class colour (ruling #133)."),
  statMultiplier: z.enum(["atk", "def", "hp"]).describe("The one stat the kit scales off (KIT_DESIGN.md: one scaling stat per kit, heals included)."),
  description: z
    .string()
    .optional()
    .describe("Player-facing text in the game's voice, written with the kitwords skill. Placeholders such as [stance.counterDamagePercent] resolve per rank; clauses are split by semicolons (ruling #28)."),
  damageRanked: z
    .array(z.number())
    .length(3)
    .optional()
    .describe("[R1, R2, R3] as a percentage of statMultiplier. [0, 0, 0] on a skill that deals no damage."),
  damage: z.number().optional().describe("Flat damage % for an ultimate (no ranks); the ladder is damageByUltLevel."),
  /** Ultimates only: the damage multiplier at each ult level, 1 through 6.
   *  Authored as an explicit ladder rather than a growth percentage because
   *  the curve differs per character and per ult type (Tanveer, 2026-08-14).
   *  Absent falls back to the flat `damage`, which is what every boss and NPC
   *  ultimate uses — they have no ult level to read. */
  damageByUltLevel: z
    .array(z.number())
    .length(6)
    .optional()
    .describe("Ultimates only: the damage % at ult levels 1 to 6, authored as an explicit ladder (ruling #92)."),
  mechanics: z.array(mechanicSchema).optional().describe("One entry per effect (ruling #28); order is the order they apply."),
});

/** One condition heading of a passive: its own trigger and its own mechanics
 *  (types/passive.ts). */
const passiveBlockSchema = z.looseObject({
  trigger: z.enum(PASSIVE_TRIGGERS).describe("When this block fires (types/passive.ts)."),
  heading: z.string().min(1).optional().describe("The # heading the block renders under; unconditional effects use 'Basic effects'."),
  mechanics: z.array(mechanicSchema).optional(),
});

/**
 * A passive is EITHER the single-block shorthand (`trigger` + `mechanics`,
 * what all 27 shipped kits author) or a `blocks` list. Requiring one of the
 * two is what stops a kit shipping with mechanics no trigger ever fires.
 */
const passiveSchema = z
  .looseObject({
    name: z.string().min(1).describe("His name for the passive."),
    description: z
      .string()
      .min(1)
      .describe("Markdown in the passive voice: `# When ...` headings, `- ` bullets, 👆 / 👇 for raises and lowers, (Max N) and (Uncancellable) tails. Written with the kitwords skill."),
    trigger: z.enum(PASSIVE_TRIGGERS).optional().describe("Single-block shorthand: when the mechanics below fire."),
    mechanics: z.array(mechanicSchema).optional(),
    blocks: z.array(passiveBlockSchema).min(1).optional().describe("Several condition headings, each with its own trigger and mechanics; use instead of trigger + mechanics."),
    worksFromSub: z
      .boolean()
      .optional()
      .describe("Stays active from the bench. Default false: most passives need field presence (ruling 2026-07-24)."),
  })
  .refine((p) => Boolean(p.trigger) || Boolean(p.blocks?.length), {
    message: "passive needs either a `trigger` or a non-empty `blocks` list",
  });

export const characterSchema = z.looseObject({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe("The internal key: lowercase, underscores, never changed. What every save's roster holds."),
  name: z.string().min(1).describe("The display name. Variants share it and differ by heading (ruling #141)."),
  /**
   * The title above the name (ruling #141).
   *
   * Every variant of a character keeps the SAME `name` and is told apart by
   * this. Red Lyra and Green Lyra are both *Lyra*; the story Lyra and the
   * playable one are both *Lyra*; the heading carries which one you are
   * looking at. `id` remains the key - a heading is display only, and nothing
   * in `combat.ts` reads it.
   *
   * Optional on purpose: a generic enemy is a type rather than an individual,
   * so it has no other version to be told apart from.
   */
  /**
   * The card's public number - what appears in an archive URL.
   *
   * `id` is the internal key and always will be: it is what `roster` holds in
   * every save, what `data/story/*.json` and the banners reference, and what
   * the catalog is indexed by. It is ALSO a name (`duke`, `batra`), which is
   * why it cannot be the public handle: Tanveer, 2026-09-17 - *"the url would
   * show the char id, not the names"*.
   *
   * So the number is a second, immutable identifier that exists purely to be
   * shown, the way Dokkan's own card URLs work. Renumbering `id` instead would
   * have invalidated every stored roster.
   *
   * **Assigned once and never changed or reused.** The initial block was
   * handed out in alphabetical order of `id` for reproducibility; that order
   * carries no meaning and nothing may re-derive a number from it. A new
   * character takes the next free number, not an alphabetical slot.
   */
  cardNumber: z
    .number()
    .int()
    .min(100000)
    .max(999999)
    .describe("The public card number shown in archive URLs. Assigned once (the next free number; `npm run newkit` does it), never changed or reused. 999xxx is the sim-placeholder range."),
  heading: z.string().min(1).optional().describe("The title above the name; what tells one variant from another (ruling #141). No commas (ruling #170)."),
  color: z.enum(["light", "red", "blue", "green", "dark"]).describe("The element. Also names the art folder, <color>_<id>."),
  atk: z.number().positive().describe("Base ATK. Bands and what a stat silently scales are in docs/design/KIT_DESIGN.md."),
  def: z.number().positive().describe("Base DEF (ruling #68 bands)."),
  hp: z.number().positive().describe("Base HP, 2900 to 4000 for a playable since ruling #68."),
  tags: z.array(z.string()).optional().describe("Free strings that synergies match on: Human, Female, Khalsa, Male, Giant, Demon. Rendered in brackets."),
  lore: z.string().optional().describe("One or two sentences for the archive."),
  storyOnly: z.boolean().optional().describe("An enemy or NPC: out of the practice roster and the archive, reachable at /archive/npc."),
  /** Game-ready, not live: shown in local development only (catalog). */
  unreleased: z.boolean().optional().describe("Game-ready, not live: visible under next dev, hidden on the deployed site (ruling #171). Delete the flag to release."),
  permanentPool: z.boolean().optional().describe("In the Permanent banner's evergreen pool. Flipped by hand per character, never automatically."),
  tier: z.enum(["elite"]).optional().describe("Enemy action economy: an elite always acts three times a turn, even alone (lib/game/actionEconomy.ts)."),
  ultGaugeMax: z.number().positive().optional().describe("Ult-gauge capacity; default 5 (lib/game/ultGauge.ts)."),
  ccImmune: z.boolean().optional().describe("Immune to stun and freeze."),
  boss: z.boolean().optional().describe("Surfaced in the practice Boss Battle picker."),
  /** Crit damage bonus %, base 50 if absent (lib/game/substats.ts). */
  critDamagePercent: z.number().nonnegative().optional(),
  /** Heal-scaling multiplier %, base 100 if absent. */
  recoveryRatePercent: z.number().nonnegative().optional(),
  /** % of damage dealt returned as self-heal on every hit, base 5 if absent. */
  lifestealPercent: z.number().nonnegative().optional(),
  /** Reduces incoming crit chance by this %, base 10 if absent. */
  critResistPercent: z.number().nonnegative().optional(),
  skills: z.array(skillSchema).length(2).describe("Exactly two skills; both enter the deck as cards."),
  ultimate: skillSchema.optional().describe("The ultimate: no ranks, a six-step damageByUltLevel ladder."),
  passive: passiveSchema.optional().describe("One passive per kit; most have one, an NPC may have none."),
  // Multi-phase boss: each phase is its own stat block + (any-count) skills +
  // (multiple) passives. Only bosses carry this.
  phases: z
    .array(
      z.looseObject({
        hp: z.number().positive(),
        atk: z.number().positive(),
        def: z.number().positive(),
        skills: z.array(skillSchema),
        spSkill: skillSchema.optional(),
        ultimate: skillSchema.optional(),
        passives: z.array(passiveSchema).optional(),
      }),
    )
    .optional()
    .describe("Multi-phase boss only: each phase is its own stat block, skills, optional spSkill, ultimate and passives."),
})
  .meta({
    title: "Character kit",
    description:
      "One playable, NPC or boss kit, data/characters/<id>.json. Hand-edited and the source of truth; the catalog rejects a file that fails this shape. Tanveer owns every name, number and mechanic (AGENTS.md). Start a new kit with `npm run newkit -- <id> --name <Name> --color <element>`, which copies data/kit.template.json. Wording: the kitwords skill. Audit: the kitcheck skill. Design rules and stat bands: docs/design/KIT_DESIGN.md.",
  });

export function validateCharacters(characters: unknown[]): void {
  const problems: string[] = [];

  for (const character of characters) {
    const result = characterSchema.safeParse(character);
    if (!result.success) {
      const id =
        typeof character === "object" &&
        character !== null &&
        "id" in character
          ? String((character as { id: unknown }).id)
          : "<missing id>";
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ");
      problems.push(`${id} — ${issues}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Malformed character kit(s):\n${problems.join("\n")}`);
  }
}
