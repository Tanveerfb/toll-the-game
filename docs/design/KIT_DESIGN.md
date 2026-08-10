# Kit Design — how Tanveer designs characters

How to draft a character kit for this game. Written 2026-08-10 from Tanveer's
own method, so a draft arrives close to his intent instead of needing rebuilding.

**Ownership.** Tanveer designs the **OG roster** himself. Claude may draft
**collab units and pop-culture-inspired units** under his direction. Either way
he owns skill names, mechanical effects, damage multipliers and final kit JSON —
`AGENTS.md` still applies: don't invent or rebalance mechanics unprompted.

**He names the character. Every time.** Don't self-select a subject and start
drafting, even after offering and hearing no objection (Tanveer, 2026-08-10). He
works from a roster plan and stays inside the reference anime he actually knows
— currently 7DS and HxH. Practice drafts are practice: they do **not** go into
`author_notes.md` or `data/characters/`.

**Scoring.** He grades a draft out of 10, and the last point is a **bonus
reserved for beating his own vision** — not a deduction. 9/10 is a clean pass;
don't chase the tenth point by adding complexity.

---

## 1. Start from the character, not from the meta

The mechanic comes out of the fiction. It is not chosen to fill a gap in the
roster.

- **Knuckle Bine** — his ability is literally a loan: [APR] accrues interest each
  turn, and once it exceeds what the target can pay it converts to [IRS] and
  bankrupts them. The whole kit is that one idea.
- **Isaac Netero** — three turns unable to act ([Suppressed]) then permanent
  [Pinnacle of Nen Mastery]. His arc, compressed into a fight.

If you can't name the scene or ability a mechanic came from, it's probably a
generic kit wearing a character's name.

## 2. Stats: lore first, band second

Numbers take a nod at the character's lore wherever one exists.

- Netero — **287 ATK** (head of the 287th Hunter Exam), **110 DEF** (his age).
- Knuckle — HP/ATK/DEF from his manga-chapter and anime-episode debut numbers.

Then sanity-check against the role bands (roster-verified 2026-08-10):

Every character is one of **three roles: damage dealer, support, or defense.**
Decide the role first — it sets the whole statline.

| Role | ATK | DEF | HP | Examples |
| --- | --- | --- | --- | --- |
| **Damage dealer** | **200+** | 70–100 | 1040–1740 | Tao 275/75/1040, Meliodas 255/100/1620, Seras 245/80/1740 |
| **Support** | **mid 100s** | 35–115 | 720–1900 | Isolde 184/77/1333, Siddiq 110/75/1315, Gabrist 117/75/1690 |
| **Defense** | **<100** | highest | largest | Mustafa 65/120/1040, Sara 34/68/2100, Yalina 30/59/1830 |

DEF and HP follow the same logic: dealers are glassier, defense units are the
wall. **200 is a soft boundary** — Gon 195, Killua 199, Lyra 195 and Chiara 191
are functionally dealers sitting just under it.

**The bands are a tendency, not a rule.** Role is decided by *what the kit does*,
and Tanveer's own assignments (2026-08-10) cut across the numbers:

- **Sara is a DPS at 34 ATK** — she deals damage as a percentage of her 2310 HP.
- **Lyra is defense at 195 ATK** — her identity is First Action: Unbreakable Ice
  (+150% DEF), not her attack stat.
- **Gabrist is defense at 117** with the roster's second-largest HP pool.

**Role comes from kit identity. The scaling stat is irrelevant to it**
(Tanveer, 2026-08-10). `statMultiplier` is a damage source — HP-scaling appears
in both DPS (Sara) and defense (Yalina) and says nothing about the role. Decide
what the kit's job is, then use the band as a starting point for the statline.
Never read the role off the numbers.

Full playable roster: **DPS** — Batra, Seras, Duke, Meliodas, Diane, Gon,
Killua, Sara, Ban, Master Tao. **Defense** — Mustafa, Lyra, Gabrist, Yalina.
**Support** — Isolde, Chiara, Siddiq, Leorio. (`storyOnly` enemies unassigned.)

## 3. Shape of a kit

- **2 skills + 1 ultimate + 1 passive.** Bosses add `phases`, an SP skill on a
  turn cycle, and may carry several passives.
- The **passive carries the character's story** and is usually a conditional
  trigger plus a stacking counter — not a flat stat bonus.
- Named effects get **bracketed names**: [APR], [IRS], [Charged], [Suppressed],
  [Pinnacle of Nen Mastery], [Flowing Ruin], [Collab].
- Collab units carry a `[Collab]` synergy; `tags` drive synergy matching.

## 4. New mechanics budget

**One or two new mechanics per batch**, given to at least one character in a
batch of 2–3. Everyone else reuses the existing vocabulary (Pierce, Weakpoint,
Rupture, Detonate, Concentrate, Amplify, Critical, Shock, Bleed, Ignite, Decay,
Corrosion, Extort, Lifesteal, taunt, seal, stun…).

A batch where every character invents something is over budget.

## 5. Wording rules — he is exact about these

See `docs/HANDOFF.md` rulings #55–58 for the full statements.

- **Tier words name fixed values**: plain "raises/lowers" = **30**, "greatly" =
  **50**. `"massively"` is **reserved with no value assigned — do not invent
  one.** No other intensifier exists; don't coin one.
- **Tier words and explicit percentages are both legal** (Tanveer, 2026-08-10 —
  "don't see everything via one lens"). A tier word is not required, and forcing
  one can wreck a skill: Leorio's Member of the Zodiac is 20/30/50% because
  "raises/greatly raises ATK and DEF for 1/1/2 turns" reads badly *and* 30/50
  are too large for a rank-1 team-wide buff. Pick whichever states the effect
  honestly. Explicit numbers are the escape hatch when the tier values are the
  wrong size for the skill.
- A rank ladder may step **between** tier words (Chiara's Marked Card: R1
  "lowers" 30, R2/R3 "greatly lowers" 50). A ladder **inside** one tier word is
  forbidden.
- **Only values written `x/y/z` are rank-scaled.** Everything else is flat unless
  he says otherwise. Ultimates never rank.
- **"basic stats"** = ATK, DEF, HP. **"all stats"** = basic + substats, excluding
  damage reduction and evade. Substats are percentages and modifiers add points.
- Probability words ("low chance", "high chance", "great chance") are equally
  precise — ask rather than assume.
- **No "each" on an AoE after-effect** (ruling #62). An effect written after the
  attack already applies to every enemy hit: "depletes 3 ultimate gauge(s)",
  never "depletes 3 ultimate gauge from each." Holds for Bleed, Ignite,
  stat-downs — any trailing effect. Keep the **semicolon** before it in the
  JSON; that clause boundary is what hides the effect at a rank where its value
  is 0. The game renders the survivors as prose ("A and B", "A, B and C"), so
  the semicolon is an authoring device the player never sees.

## 6. Balance it across all four formats

Ruling #57: judge every character in **1v1, 3v1 (team vs boss), 3v3 and 4v4**.
A kit that looks strong solo can starve for cards in a team — the deck is shared.

**Price pacing at R1, not R3.** R3 is the rarest card; a mechanic evaluated on it
will read far faster than it plays. Roster convention is **R1 ≈ 65%, R2 ≈ 80%**
of the R3 value (Chiara 260/320/400, Killua 230/280/350, Gon 195/240/300).

Don't hand-roll damage to check a claim — run it through `executeSkill`. Hand
maths reliably misses type advantage (±20%/−10%), universal 5% lifesteal, and
mid-turn DEF changes.

## 7. Engine facts a draft must respect

- A skill that raises a stat **and** attacks applies the buff **first** (#22).
- **An after-effect does not proc on a target the hit killed** (Tanveer,
  2026-08-10). Stated twice independently — Netero's follow-up attack doesn't
  fire if the parent hit was lethal, and a "damage then Freeze" ultimate doesn't
  freeze a corpse. Write "does X damage, then applies Y" as strictly ordered:
  Y is skipped on a kill.
- Any non-heal skill with `damageRanked > 0` deals damage regardless of type.
- A **support ultimate must be authored with zero damage**, or the engine treats
  it as an attack (#61).
- **Debuffs are cancellable and respect Debuff Immunity** — including ones
  applied by passives, which must check `debuffImmune` themselves (#60).
  Deliberate exceptions exist but must be stated (Knuckle's [APR]).
- `aoe` on a support skill means the caster's own team, not the enemy.
- Synergies naming `"all"` reach substats — use `stats: ["atk","def","hp"]` for
  basic stats only.
- Max-HP changes scale current HP proportionally and unwind on expiry.

## 8. Draft checklist

1. Name the scene/ability the mechanic comes from.
2. Pick the role — damage dealer, support or defense — then pick stats from lore
   where possible and check them against that role's band.
3. 2 skills + ultimate + passive; passive carries the story.
4. Reuse existing mechanics unless this is the batch's new-mechanic slot.
5. Write tier words at their fixed values; mark rank ladders as `x/y/z`.
6. State durations, and whether each effect is cancellable.
7. Sanity-check R1 pacing in all four formats.
8. List every open question **before** writing JSON — Tanveer answers fast and
   the answers change the shape (see `author_notes.md` for Knuckle/Netero).
