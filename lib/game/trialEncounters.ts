import type { RunnableEncounter } from "@/lib/game/stageRun";

/**
 * Ascension trial encounters — the fights behind the rank walls.
 *
 * Both trials shipped with `enemyId: null` and the board said so honestly
 * ("Encounter not authored yet"). This is the First Ascension Trial, designed
 * by Tanveer on 2026-09-16: **three fights, one HP bar** — a group, then an
 * elite, then the world boss.
 *
 * It is a `RunnableEncounter`, so it is fought by the same wave runner story
 * mode uses (`lib/game/stageRun.ts`, ruling #103): **HP carries over between
 * waves and the fallen stay down**. That attrition is the whole test. Three
 * separate fights with a full heal between them would be three easy fights.
 *
 * ## Why these levels
 *
 * His brief: *"a team of all level 20 chars would have a 4/10 difficulty feel
 * but anything lowered level team or poorly made team would struggle a lot."*
 *
 * A level-20 character is necessarily ascension 1 (that band is what unlocks
 * the level), which puts the reference team at **1.489x** base stats. Measured
 * with `simulateRun`, 200 runs across three seeds:
 *
 * | Lv20 team | clears |
 * | --- | --- |
 * | balanced — burst, a healer, a tank | **~77%**, ending wave 3 at ~26% HP |
 * | all damage, no sustain | ~41% — Molvarr kills them |
 * | mid damage, no healer, no tank | **0%** — cannot finish Molvarr at all |
 * | the same balanced team at **level 1** | **0%** — wipes to Lyra, every run |
 *
 * The simulator runs the PLAYER side on the enemy AI, which is mediocre, so a
 * real player clears more often than 77%. That is the 4/10 the brief asked
 * for; the numbers are the floor, not the expectation.
 *
 * **Known exception, and it is not fixable here.** A team stacking DEF
 * (Yalina/Mustafa/Gabrist/Lyra) clears at **100%** and finishes wave 3 at 74%
 * HP, at every enemy level tried. `lib/game/damage.ts` mitigates with
 * `Math.max(1, baseDamage - effectiveDefense)` — flat subtraction, so DEF is
 * superlinear and four high-DEF units stop taking meaningful damage. Three
 * levers were measured against it and all three failed: adding Iron's Pierce
 * to wave 1 (no effect, and it made the trial easier for everyone else),
 * fielding all four NPCs 3+1 (no effect), and an enemy ATK stage effect, where
 * **+25% took every archetype from 75/38/100% to 1/3/3%** — there is no window
 * between "the wall survives" and "nobody survives". It is a roster-wide
 * property of the damage formula, not a property of this encounter.
 */

/** The reference the levels below were tuned against. Stated so a retune can
 *  be checked against the same target instead of a remembered one. */
export const TRIAL_TUNING_REFERENCE = {
  band: 20,
  level: 20,
  ascension: 1,
  multiplier: 1.489,
} as const;

/**
 * Wave 1 fields Frost, Gale and Prism with **Iron benched as a sub**.
 *
 * Field cap is 3, so the fourth is a sub and promotes at turn start once a
 * field unit falls (`lib/game/sub.ts`). That is what makes four bodies harsher
 * than three rather than merely longer: the enemy holds 3 actions a turn well
 * past the point a trio would have dropped to 2 (`actionsForTurn`).
 *
 * The trio is a shape test, not a stat check. Prism heals **and cleanses**, so
 * a team without enough burst never finishes the wave; Frost's Frost Lance
 * lowers DEF and Gale's Gust Flurry is Weakpoint damage, which triples against
 * a debuffed target — Frost into Gale is the anti-tank line, and the enemy AI
 * does not sequence it deliberately.
 *
 * Fielding all four was Tanveer's call (2026-09-16): *"It can also be a 3+1
 * sub battle. All four npc can be present."* It also settled which of the four
 * to leave out, which was the open question — none of them.
 */
export const FIRST_ASCENSION_TRIAL: RunnableEncounter = {
  id: "trial-rank-20",
  waves: [
    {
      enemies: [
        { id: "frost", level: 15 },
        { id: "gale", level: 15 },
        { id: "prism", level: 15 },
        { id: "iron", level: 15, isSub: true },
      ],
    },
    // An elite, non-boss wall. `tier: "elite"` takes the full 3 actions a turn
    // even fighting alone (`actionEconomy.ts`), so a lone Lyra is not a lull —
    // and 10,800 base HP is the wave that an under-levelled team dies on.
    { enemies: [{ id: "lyra_npc", level: 20 }] },
    // Molvarr, both phases, fought to the end — his call over the
    // survive-to-a-threshold option `victoryAtEnemyHpPercent` offers. The
    // player arrives on whatever waves 1 and 2 left them, which is the point.
    { enemies: [{ id: "molvarr", level: 24 }] },
  ],
};

/** Encounters by event id. A trial with no entry here has none authored yet,
 *  which `eventLockReason` already reports honestly. */
export const TRIAL_ENCOUNTERS: Record<string, RunnableEncounter> = {
  [FIRST_ASCENSION_TRIAL.id]: FIRST_ASCENSION_TRIAL,
};

export function getTrialEncounter(
  eventId: string,
): RunnableEncounter | undefined {
  return TRIAL_ENCOUNTERS[eventId];
}
