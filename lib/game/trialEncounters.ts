import type { RunnableEncounter } from "@/lib/game/stageRun";

/**
 * Ascension trial encounters — the fights behind the rank walls.
 *
 * Both trials shipped with `enemyId: null` and the board said so honestly
 * ("Encounter not authored yet"). This is the First Ascension Trial, designed
 * by Tanveer on 2026-09-16: **three fights, one HP bar** — a group, then an
 * elite, then the world boss.
 *
 * It is a `RunnableEncounter`, so it is fought by the same fight runner story
 * mode uses (`lib/game/stageRun.ts`, ruling #103): **HP carries over between
 * fights and the fallen stay down**. That attrition is the whole test. Three
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
 * | balanced — burst, a healer, a tank | **~77%**, ending fight 3 at ~26% HP |
 * | all damage, no sustain | ~41% — Molvarr kills them |
 * | mid damage, no healer, no tank | **0%** — cannot finish Molvarr at all |
 * | the same balanced team at **level 1** | **0%** — wipes to Lyra, every run |
 *
 * The simulator runs the PLAYER side on the enemy AI, which is mediocre, so a
 * real player clears more often than 77%. That is the 4/10 the brief asked
 * for; the numbers are the floor, not the expectation.
 *
 * **Known exception, and it is not fixable here.** A team stacking DEF
 * (Yalina/Mustafa/Gabrist/Lyra) clears at **100%** and finishes fight 3 at 74%
 * HP, at every enemy level tried.
 *
 * The cause is **not** raw DEF — at base stats that is worth only ~12% less
 * damage per hit. It is that **DEF buffs stack multiplicatively**
 * (`lib/game/stats.ts`) while `lib/game/damage.ts` **subtracts**
 * (`Math.max(1, baseDamage - effectiveDefense)`), so a buffed unit can pass the
 * raw hit and take the 1-damage floor. Lyra at Lv20 beside Mustafa (+50%),
 * Gabrist (+20%) and Ban (+5%), with her own +150% first-action passive,
 * reaches **1,479 DEF against an 1,188 hit — 1 damage**.
 *
 * So no ATK or level dial can reach it: +25% enemy ATK moves that hit to 1,485,
 * taking her from 1 damage to 6 while killing every other archetype — measured
 * at **75/38/100% -> 1/3/3%**. Two other levers failed for the same reason:
 * Iron's Pierce in fight 1 (too small, and it made the trial easier overall) and
 * fielding all four NPCs 3+1. What works against it is multiplicative DEF
 * reduction — Pierce, Critical, DEF-down — not bigger numbers.
 *
 * Part of it is also **deliberate**: Lyra's passive was raised from 50% to 150%
 * on purpose, to reward playing her first-action gimmick (Tanveer, 2026-09-16).
 * The open problem is that a whole team of such characters compounds into
 * immunity, which is a roster-wide question and not this encounter's.
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
 * Fight 1 fields Frost, Gale and Prism with **Iron benched as a sub**.
 *
 * Field cap is 3, so the fourth is a sub and promotes at turn start once a
 * field unit falls (`lib/game/sub.ts`). That is what makes four bodies harsher
 * than three rather than merely longer: the enemy holds 3 actions a turn well
 * past the point a trio would have dropped to 2 (`actionsForTurn`).
 *
 * The trio is a shape test, not a stat check. Prism heals **and cleanses**, so
 * a team without enough burst never finishes the fight; Frost's Frost Lance
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
  fights: [
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
    // and 10,800 base HP is the fight that an under-levelled team dies on.
    { enemies: [{ id: "lyra_npc", level: 20 }] },
    // Molvarr, both phases, fought to the end — his call over the
    // survive-to-a-threshold option `victoryAtEnemyHpPercent` offers. The
    // player arrives on whatever fights 1 and 2 left them, which is the point.
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
