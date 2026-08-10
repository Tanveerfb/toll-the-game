# Agent Handoff — Toll the Game

Read this first. It exists so a fresh agent can work on this project without re-deriving context.

## What This Is

Turn-based card battle webapp (Element Clash IP), heavily inspired by **Seven Deadly Sins: Grand Cross** (card/merge system) and **Dokkan Battle** (card art, story-mode structure). Solo developer: **Tanveer** (`tanveerfb@gmail.com`). The game is the only active track of the IP — a webtoon/animation track existed and was **dropped**; never plan around it.

## The One Rule That Matters

**Tanveer owns game design.** Skill names, mechanical effects, damage multipliers, character kits, balance — all his. You implement, document, and build UI. When a kit or mechanic is ambiguous, **ask him** (he explicitly welcomes kit questions) — do not invent numbers or rebalance. UI/frontend/code architecture decisions are yours to make, professionally organized, space-efficient (dokkaninfo.com is his reference for data-heavy pages).

## Orientation

| Doc | Contents |
|---|---|
| `README.md` | Stack, setup, routes, layout |
| `docs/ARCHITECTURE.md` | How the battle engine works end to end — **read before touching `lib/game/` or `hooks/`** |
| `docs/STATUS.md` | Living snapshot: what works, open issues |
| `docs/ROADMAP.md` | Phased plan with completion history |
| `docs/AUDIO.md` | Music roles, the files Tanveer supplies, and how the player behaves without them |
| `docs/ART_PIPELINE.md` | AI art generation: model, prompt template, seeds, per-character notes |
| `docs/design/SKILL_ART_PLAN.md` | Per-skill art (48 shipped) — IP-Adapter recipe, sampler fix, prompt-budget rules |
| `docs/PRODUCT_AUDIT.md` | What's missing to make this a live game (standing gap analysis) |
| `docs/TECH_AUDIT.md` | 2026-07-21 engineering pass, closed out |
| `docs/design/references/INDEX.md` | What each reference screenshot shows (7DSGC / Dokkan / "ref4") |
| `docs/superpowers/specs/` | Per-feature design specs (kit lab, battle UI, world boss, gacha, patch notes) |
| `AGENTS.md` | Condensed rules (loaded automatically by most agent harnesses) |

## Design Rulings Ledger (all from Tanveer, don't re-litigate)

> **The kit JSON outranks this list.** Balance passes have changed authored
> numbers without the ledger being updated (see #5). Before you plan a fight or
> quote a value, read `data/characters/*.json`. The ledger records *intent and
> semantics*; the data records the current numbers.
>
> Engine defaults that no ruling covers but that change every fight:
> **every unit has 5% lifesteal** (`DEFAULT_LIFESTEAL_PERCENT`, `lib/game/substats.ts`)
> and **base crit/evade are 0%**. The lifesteal is easy to miss and quietly
> lengthens fights — Duke recovered a sixth of his bar from it in a 3-turn duel
> with no heal skill in his kit.

1. Card rank (R1–R3 via merging, 7DSGC style): scales `damageRanked` AND `*Ranked` mechanic values; flat values (weakpoint ×3, amplify 10%) never scale; ultimates have no ranks (ult level-up system MAY come later).
2. Ultimates are stronger than any R3 skill in power and utility.
3. Any non-heal skill with `damageRanked > 0` deals damage regardless of skill type.
4. Enemy side takes **3 actions per turn** — any living field enemy, any order, no pattern.
5. Duke's Flowing Ruin: skills AND ultimate build stacks (max 3) and can consume; empowered action = **+100% damage + 50% ATK-down** (2 turns) on **every** target hit. *(Corrected 2026-08-09 — read 50%/20% until then. The roster balance pass in `3f7d248` moved it to 100%/50% and the ledger was never updated; planning a story fight against the stale figure under-estimated Duke's burst by half. `data/characters/duke.json` is the source of truth.)*
6. Teams: any 1–4 units. Format 4v4 = all field; 3v3 = 4th member is the sub **automatically**. Lone sub auto-converts to field.
7. Subs: passive active from bench; no cards; untargetable; enter the field **only at the start of a new turn** after a teammate died.
8. Deck: loads field units' cards at battle start; **never resets**; refills one random card at a time with **auto-merge on adjacent identical cards** (+1 gauge per merge) until full; no deck interaction outside the player's turn; a gauge filled mid-refill guarantees the ult **next turn**, never the same refill.
9. UI stack is **shadcn/ui + Tailwind 4** (HeroUI removed — never reintroduce).
10. Art is **fully AI-generated** (no salvaged assets), style = Dokkan card art × 7DSGC renders. Tanveer supplies locked designs or blueprints for characters that lack one; generate from those via `docs/ART_PIPELINE.md`. Mustafa + Siddiq arts are AI-invented placeholders awaiting his designs.
11. **Type advantage** (2026-07-07): Dark > Light > Dark (mutual); Red > Green > Blue > Red. Advantage +20% damage, disadvantage −10%, neutral ±0. Applies to all attacks; CRITICAL attacks ignore it both ways.
12. **Evade** (= dodge, same thing): base 0% for **everyone**; only passives/buffs add it. An evaded attack deals no damage and applies no effects. More evade characters may come.
13. **Shock**: each application is an independent, cleansable DoT worth 30% of the damage dealt by the applying hit, 4 turns.
14. **Synergy scope**: tag-based synergies (e.g. Seras's [Powerful Opponent] +10% all stats) apply to *every* teammate carrying the tag; Seras's is flat (not per-carrier scaling like Batra's KHALSA). **Synergies target BASIC stats** (`stats: ["atk","def","hp"]`) — *only Seras's and Batra's use `stat: "all"` and therefore reach substats* (Tanveer, 2026-08-09). Ban, Diane, Gon, Killua, Leorio, Meliodas and Leorio's Kind Hearted Friend character-synergy are all basic-stat. Sara's `damageDealt` is a damage modifier, not a stat change, and Mustafa's targets DEF alone.
15. New character kits arrive via the template at the top of `newchars.md`; once implemented, the kit is removed from that file (`data/characters/*.json` becomes the source of truth).
16. **Crit** (2026-07-07): base crit chance 0% for everyone; a crit proc applies the full CRITICAL package (50% DEF ignore, type-immune, +50% damage). Currently sourced by Meliodas's Deathblow.
17. **Counters** (Full Counter): the attacked unit still takes the damage, then counters — unless the hit killed it. Counters don't chain.
18. **Extort**: per-stat mapping (stolen ATK→ATK, stolen DEF→DEF), self-gain lasts as long as the enemy debuff, recasting refreshes (never stacks). Ult Extort = 50% for 2 turns.
19. **Extort Life**: full revert — taking ANY damage (incl. DoT/counters) restores enemy max HP and zeroes the stacks; no free heal on revert (current HP keeps its clamped value).
20. **Stat buffs/debuffs are real**: effective ATK/DEF (`lib/game/stats.ts`) = current stat × percent entries + flat entries. `preApplied` entries are display badges for already-baked gains (synergy, ramps) and are skipped.
21. **Literal effect durations** (2026-07-11, replaces old tick semantics): "N turns" means exactly N procs / N blocked turns. Harmful effects (debuffs, DoT, stun, seal) tick at the END of the victim's team turn — the victim always gets their own turn to cleanse before a proc lands. Beneficial effects (buffs, stances, HoT) tick at the START of the owner's team turn — a 1-turn buff protects through the whole opposing turn. His walkthrough: "t1 player (applies debuff) -> t1 enemy -> debuff procs once -> t2 player -> t2 enemy -> debuff procs and then expires -> t3 player".
22. **Self-buff-then-hit order** (2026-07-11): a skill that raises the caster's stats and deals damage applies the buff BEFORE the damage calc — the same strike benefits (Gon's Jajanken Rock, both HxH ults).
23. **Undurationed ult stat raises are permanent** (2026-07-11): Gon/Killua ult +30% raises last the rest of the battle and stack.
24. **Kind Hearted Friend semantics** (2026-07-11): base +10% is decided once at battle start if Gon OR Killua is a team member (sub counts, survives their death); the extra +10% is dynamic — active only while both are alive on the field, drops when one dies. **The two halves target different stats** (2026-08-09): the base bond raises **basic stats**, the both-alive bonus raises **all stats** (substats included) — it's restrictive enough to earn it. `stats` / `bothAliveStat` on the mechanic; the passive wording states each half explicitly.
25. **Effect pill colors on hover keywords** (2026-07-11): red = attack-based effects, purple = debuffs (incl. attack-applied ones), green = heals + cleanses, yellow = stances, white = cancels. S1/S2 chips follow the same scheme; ULT stays yellow. Keep skill text short — mechanics stay a mystery for players to discover.
26. **Dokkan description wording** (2026-07-11): tiered words replace numbers — "raises" (<50%), "greatly raises" (50–79%), "massively raises" (80%+), same tiers for "lowers". Hovering the word shows that skill's exact values (per-rank dynamic glossary). No "own" — a raise always means the skill user. Effects are cancellable and stackable by default; exceptions are called out in the description text. Hover tooltips show the percentage ONLY (e.g. "Increases ATK by 30%") — duration and flags belong to the text.
27. **One pill per unique effect** (2026-07-11): a skill description gets exactly one hover pill per distinct effect/modifier — phrase-level keys ("cancels buffs and stances", "cancels stances") instead of pilling every word; generic words like "stance" are not glossary keys. **Pierce is a flat 50% DEF ignore for every card** — no per-card pierce values anymore.
28. **Explicit permanence + semicolon clauses** (2026-07-11, amends #26): permanent stat changes say it — "Permanently raises ATK" — instead of implying it by omitting a duration; the permanence prefix joins the pill ("Permanently raises ATK and DEF" is one pill). Semicolons separate the distinct parts of a skill description ("Permanently raises ATK; greatly raises DEF for 1 turn; then does 500% ATK damage to one enemy."). Applied roster-wide.
29. **Lethal survival catches DoT deaths; revivals cleanse everything** (2026-07-11): Nine Lives triggers on lethal DoT procs too (`trySurviveLethal` in `lib/game/lethal.ts`, shared by combat.ts and tick.ts). On ANY revival/survival trigger the unit loses ALL buffs and debuffs, uncancellable included — the rule applies to every future revival mechanic.
30. **Uncancellable entries are "effects", not buffs/debuffs** (2026-07-11, playtest): synergy bonuses, ramp stacks, and every other uncancellable entry don't count for buff/debuff-counting mechanics (Rupture, Amplify, Weakpoint), can't be cleansed, and don't trigger AI cleanse decisions. They still modify stats. UI shows them grey (◆ counter, "Effects" section) — helpers in `lib/game/effects.ts`.
31. **Cancelling stances breaks the target's taunts** (2026-07-11, playtest): cancelStances/cancelBuffs on a unit also removes every taunt redirect marker that unit authored (taunt debuffs on the opposing team with its sourceId). Yalina's Attention Drawer is a real stance now.
32. **Extort is a linked pair** (2026-07-11, playtest): the thief's self-buff lives only while at least one LIVING enemy still carries a matching Extort debuff (tagged with the thief's sourceId). Death, cleanse, or expiry of the last debuff drops the buff — `syncExtortLinks`, run after every action and every debuff tick.
33. **Deck QoL** (2026-07-11, playtest): Reset Hand button rewinds the hand to the turn start — queued actions return, selection-time merges are reversed, merge-granted ult gauge is refunded (`snapshotHand`/`resetHand`, snapshot taken as PlayerAction opens). Leftover cards auto-merge whenever queuing/unqueuing makes identical neighbors adjacent (same rule as draws). Battle screen page gets a user-friendliness overhaul in a future batch, once all mechanics work as expected.
34. **Momentum is field-only, fed by every card** (2026-07-11, playtest 2): Yalina gains a Momentum stack from EVERY card her team plays — including her own — but only while she is on the field (not benched) and alive.
35. **Tag synergies without `flatBonus` scale per carrier** (2026-07-11, playtest 2, confirms existing data): Sara's [Female] synergy is 5% damageDealt × number of Female carriers (15% with 3 Females), applied to every carrier. Synergy entries are named `[Tag] Synergy` in the UI (typed `buff`, never `amplify`).
36. **damageDealt / damageReduction stack multiplicatively** (2026-07-11, closes old STATUS #19): the damage engine consumes both — outgoing damage × ∏(1 + damageDealt%/100) from the attacker's entries, then × ∏(1 − damageReduction%/100) from the target's (`getDamageDealtMultiplier`/`getDamageReductionMultiplier` in `lib/game/stats.ts`, applied at the end of `calculateDamage`, counters included). Two 40% DRs = 64% total reduction, diminishing returns.
37. **"Permanently" implies cancel-proof** (2026-07-11, closes old STATUS #17): permanent stat raises (Gon/Killua ults) stay `uncancellable` in data — buff-cancels can't strip them, and they render as grey effects per ruling #30. Text needs no extra "(cannot be cancelled)".
38. **Extort recasts OVERWRITE, never stack** (2026-07-11, playtest 2): a new Extort strips the thief's previous Extort debuffs from every opposing unit before applying — even if the old steal was more potent. The self-buff is rebuilt from the new steal only.
39. **Enemy actions scale with living field members** (2026-07-11, playtest 2, amends #4): the enemy side takes 1 action per living field member, capped at 3 (`enemyActionsForTurn`). Subs grant no actions.
40. **Identical tag synergies stack across carriers** (2026-07-11): each carrier's [Tag] synergy is its own effect — the HxH trio's three 5% [Collab] synergies give everyone tagged +15% all, on top of Leorio's bond. Intended; rewards full collab teams.
41. **Cancel-then-hit** (2026-07-11): a cancel+damage skill strips stances/buffs BEFORE its own damage calc — cancel skills punch through defensive stances (Killua's Lightning Palm hits Yalina at full power after breaking her stance). Confirmed current behavior.
42. **Damage modifiers shape direct hits only** (2026-07-11): damageDealt/damageReduction apply to attacks and counters; DoT ticks (Shock, Bleed, Decay, Ignite) use the damage locked in at application and are NOT modified. Confirmed current behavior.
43. **Victory fizzles the remaining queue** (2026-07-11): once the last enemy dies mid-queue, the leftover queued cards are discarded — no Momentum, no ult gauge, straight to the win screen.
44. **Zero-value clauses are hidden** (2026-07-11, closes old STATUS #16): a description clause whose ranked placeholder resolves to 0 at the current rank is dropped entirely — a rank-1 Lightning Palm doesn't mention the stun; rank 2+ does (`dropZeroValueClauses` in the translator, clauses = ruling #28 semicolon segments).
45. **Story team agency is per chapter** (2026-08-09): every chapter declares `teamMode` — `canon` (exactly the authored team, no picker), `anchored` (canon leads fixed, player fills the rest), or `free` (player brings 1–4 owned units, canon team as prefill). Parts 1–2 stay `canon` as authored. Canon anchors are playable **regardless of ownership** — a fresh account is never locked out of its own story.
46. **Story reward model** (2026-08-09): a one-time `firstClear` bundle plus `repeat` drops, with the drop roll happening on every clear, first clear included. No mission-objective layer this batch.
47. **Story payout mix** (2026-08-09): repeat drops are `coin` + `training_manual` tiers; `gems` are first-clear-only; ascension materials (`sea_monster_eye`, `corroded_seaweed`) stay world-boss exclusive. Story is the levelling-fuel farm; the boss is the gacha-currency and ascension farm.
48. **Stamina gates story replays only** (2026-08-09): an uncleared chapter is free however many attempts it takes — the narrative can never be stamina-locked. Replaying a cleared chapter for drops costs `replayStamina`.
49. **Story repeat drops roll a range per entry** (2026-08-09): `{min, max}` inclusive — not fixed amounts, not a weighted table.
50. **Story environment backgrounds are deferred** (2026-08-09): scene art is the biggest lever on "scenes look cheap", and Tanveer isn't committing the art direction yet. No generated plates, no blurred-character fallback, no stylised abstract backdrops. Don't add them unprompted.
51. **Audio is music only, and Tanveer supplies it** (2026-08-09): background OST, no SFX of any kind — no battle sounds, no UI clicks, no text blips. The system shipped; `public/audio/` is empty and the game is silent by design until he adds the files listed in `docs/AUDIO.md`.
52. **DoT default durations** (2026-08-09): Ignite lasts **3 turns** and Bleed **2**, unless a kit says otherwise (`lib/game/dotDurations.ts`). Descriptions state the duration automatically — it's derived from the mechanic by the translator, never authored into the prose, so text can't drift from data. Bleed is a flat 2 at every rank roster-wide; no kit scales it any more.
53. **Ordinary story enemies are tanky, not deadly** (2026-08-09): low ATK, large HP pools, plus an anti-stall passive that triples their stats at turn 10 (`bossStatSpike`, multiplier 3) so a fight can't be stalled out. `applyBossTurnStart` runs for any enemy carrying a turn-start mechanic, not just phased bosses.
54. **Story NPC copies are for encounter tuning** (2026-08-09): a `storyOnly` NPC kit may diverge from its playable twin in stats, multipliers and ultimate damage — that's why it exists. `lyra_npc` runs far lower multipliers than playable Lyra. Passives stay in sync.
55. **Stat vocabulary is exact** (2026-08-09) — Tanveer is deliberate about these words; don't use them loosely:
    - **"basic stats"** = ATK, DEF, HP.
    - **"all stats"** = basic stats **plus substats**, excluding damage reduction and evade chance. *(The engine read this as basic-stats-only until 2026-08-09, documented in `substats.ts` as a "2026-07-24 ruling" — Tanveer's read is that it predates the substat system existing. Corrected, and the test that locked it in now asserts the reversal.)*
    - **A max-HP change is temporary if its effect is.** A durationed HP buff/debuff records what it scaled (`hpScalePercent`) and `tick.ts` unwinds it by the *inverse* when the effect expires — +50% is undone by −33.3%, not by −50%. Stacked raises compound and unwind one at a time. An undurationed (permanent) raise never unwinds. HP debuffs shrink max HP the same way, so `-30% all stats` really does cut the pool.
    - **A max-HP change scales current HP with it, preserving the ratio.** 1500/2000 (75%) raised 50% is **2250/3000**; lowered 30% it's **1050/1400** — still 75% either way (`scaleMaxHp`, `lib/game/maxHp.ts`). The engine used to add the max-HP *delta* to current HP, turning 1500/2000 into 2500/3000 (83%) — a free 250 HP on every HP buff.
    - **Basic stats are counts; substats are percentages, and modifiers behave differently.** A "+5%" to ATK/DEF/HP **scales** them (×1.05, multiplicative — ruling 2026-07-12). A "+5%" to a substat **adds five percentage points**: 10% lifesteal buffed 5% is 15%, not 10.5%. Substats clamp at 0 and never go inverse. This is what `evade.ts` already did; `substats.ts` was multiplying, which made Isolde's +10% lifesteal aura (5 × 1.1 → floor 5) and any evade buff on a 0% base into silent no-ops.
    - **"raises ATK"** = one buff on ATK. **"raises DEF"** = one buff on DEF. **"raises ATK and DEF"** = **ONE** buff covering both — not two entries, and *not* `stat: "all"` (which would sweep in HP and substats). Author it as `stats: ["atk","def"]`; the engine reads it via `entryAffectsStat` (`lib/game/stats.ts`). One effect = one entry = one pill = one thing to cleanse.
56. **Tier words and chance words are fixed scales** (2026-08-09, amends #26) — but they constrain the **wording**, not the values.
    - Magnitude going **up**: **30% "raises"**, **50% "greatly raises"**, **100% "massively raises"**.
    - Magnitude going **down**: **30% "lowers"**, **50% "greatly lowers"**, **80% "massively lowers"**. The top tier is lower on purpose — a stat can never be reduced to zero in battle, so 80% is the ceiling a "lowers" effect is written against. `tierWord` in `lib/game/descriptionTranslator.ts` treats these as thresholds so an off-tier value still picks the nearest honest word.
    - Probability (`lib/game/mechanicGlossary.ts`): **5% "very low chance"**, **10% "low chance"**, **30% "medium chance"**, **50% "high chance"**, **70% "great chance"**. No kit uses these yet.
    **Values are free.** A number that doesn't land on a tier is intentional, not a bug — Lyra's 150% DEF is just 150%. Don't audit kit numbers against this scale or infer a word from a value on your own; the standard applies only when a description actually uses one of these words (Tanveer, 2026-08-09).
57. **Judge a character across all four formats, never one** (2026-08-09). When assuming, tuning or testing anything about a character, think through:

    | Format | Hand | Their share of draws | 3-stack passive empowers | Enemy actions/turn |
    |---|---|---|---|---|
    | **1v1** — practice / solo story | 4 | 100% | every ~1.1 turns | 2 |
    | **3v1** — team vs boss | 7 | 33% | every ~3.3 turns | 3 (elite) |
    | **3v3** — team vs team (4th is the sub, ruling #6) | 7 | 33% | every ~3.3 turns | 3 |
    | **4v4** — squad vs squad | 8 | 25% | every ~4.6 turns | 3 |

    Hand capacity is `[0,4,5,7,8]` by living field count with uniform draws, so **a character's card frequency swings 4× between 1v1 and 4v4** — and with it the uptime of anything that charges off its own cards. Each format also tests a different axis: 1v1 isolates the raw kit, 3v1 makes AoE dead weight and boss mechanics dominant, 3v3 rewards AoE and tests the sub rule, 4v4 dilutes every individual kit the most.

    A conclusion from one format is not a conclusion. Duke read as overtuned from a 1v1 duel and is mid-pack in a team — see the "1v1 distortion" section of `docs/superpowers/specs/2026-08-09-claude-duel-mode-design.md` for which archetypes each format over- and under-rates.
58. **What is and isn't rank-scaled — read the notation, not the kit** (2026-08-09). Two rules, and they settle every case:
    1. **A tier word names a fixed value; the value never moves.** "raises" *is* 30%, "greatly raises" *is* 50% (roster-verified 2026-08-09 — every kit obeys this, no exceptions). You cannot write "lowers DEF" and have it mean 50; if you want 50 you write "greatly lowers".

       The vocabulary is **"raises/lowers" (30)**, **"greatly" (50)** and **"massively" (100 raising / 80 lowering, per #56 above)**. No other intensifier exists; don't coin one.

       **Correction (2026-08-10):** this ruling previously said "massively" was reserved with no value. That was wrong — #56 assigned it the day before, `tierWord` in `descriptionTranslator.ts` has always implemented it, and `mechanicGlossary.ts` spells it out ("Raises the stat by 100%"). No kit uses it yet, which is what made the mistake survive three documents. **Read #56 before quoting the tier scale.**

       **Carve-out (Tanveer, 2026-08-09):** a rank ladder MAY step *between* tier words, because the tiers themselves stay fixed. Chiara's Marked Card is the reference case — `valueRanked [30,50,50]` with `ranks:[false,true,true]`, so R1 reads "lowers DEF" (30%, 1 turn), R2 reads "greatly lowers DEF" (50%, 1 turn), R3 keeps "greatly" but extends to 2 turns via `durationRanked`. His alternative for R3 would have been "massively lowers DEF for 1 turn" — a further tier step rather than a duration step. What remains forbidden is a ladder *inside* one tier word (e.g. "lowers" meaning 30/40/50).
    2. **In Tanveer's kit drafts, only values written `x/y/z` are rank-scaled.** Everything else is flat *unless he writes a note saying otherwise.* Don't infer scaling from a skill's type, from what a similar character does, or from it "feeling like" it should ramp — author `valuePercent`, not `valueRanked`, unless the draft used slashes.

    Consequence, not a separate rule: attack skills carry tier-worded self-buffs (flat, applied before the hit per #22 — Duke's Surge +30% ATK and DEF, Gon's Rock +50% ATK, both HxH ultimates), while support skills state explicit `x/y/z` numbers so a rarer card buffs allies harder (Leorio's Member of the Zodiac, 20/30/50% for 1/1/2 turns).

    Roster verified 2026-08-09: every attack-type self-buff is flat, the only rank-scaled ATK/DEF buff is Leorio's, and `damageReduction` stances (Mustafa's Fortress, Iron Wall, Yalina's Attention Drawer) are numeric and ranked as their own family.

59. **Action economy is symmetric — living field members + 1, capped at 3** (2026-08-09, amends the enemy-only 2026-07-12 ruling). The player was pinned at a flat 3 while the enemy already scaled; Tanveer confirmed that was a testing shortcut, not a design choice. Both sides now read `actionsForTurn` in `lib/game/actionEconomy.ts`:
    - Subs and the dead grant nothing, so a side on its last unit gets **2** actions, two units get 3, and 3+ stays 3.
    - **A side with a `tier: "elite"` member always gets the full 3**, alone or not — bosses never lose tempo. This is why the elite branch exists and must survive any future refactor of this rule.
    - Consequence worth knowing before tuning: the losing side now sheds actions as it sheds units, which compounds a losing position. Same snowball as a stun landing on a side's last living unit (that one is still open — full turn denial, undecided).

60. **Debuffs are cancellable no matter what applied them** (2026-08-09). A debuff rolled by a passive, or applied by a boss passive, is an *ordinary* debuff — it carries no `uncancellable` flag and it must respect Debuff Immunity. Tanveer: "it shouldn't carry uncancellable, even from passive proc." The trap is that passive and boss-passive code applies debuffs **outside** `executeSkill`, so it never passes the immunity gate in `combat.ts` — each such site has to check `buffs.some(b => b.debuffImmune)` itself. Two sites were fixed this way (`applyCorrosion` in `bossPassives.ts`, `registerRandomTurnEffect` in `passive.ts`); **any new out-of-combat debuff applier needs the same guard.** Ally-facing *buffs* from those same helpers stay uncancellable — the rule is about debuffs only.

61. **A support ultimate does not attack** (2026-08-09). `skill.type === "ultimate"` alone never means hostile. An ultimate whose friendly, non-self mechanics carry **zero damage** (Isolde's Starbound Ward) is ally-directed: it deals no damage, targets no enemy, and reads "to all allies". Because `damage.ts` floors damage at a minimum of 1, treating one as an attack silently chipped a point off each ally it buffed. An ultimate that buffs *and* deals damage (Chiara's All In) stays hostile — the zero-damage requirement is what separates them.

62. **An after-effect on an AoE skill needs no "each"** (2026-08-10). When an effect follows the attack in a skill description, it is *always* assumed to apply to every enemy the attack hit — so "depletes 3 ultimate gauge(s)", never "depletes 3 ultimate gauge **from each**". Same for Bleed, Ignite, stat-downs, any trailing debuff. Tanveer, verbatim: "when an effect happens after the attack, it is always assumed the effect will apply to all attacked enemies." Fixed on Isolde's Severed Ledger.

    **Author with semicolons; the game prints prose.** Ruling #28's semicolon segments are what `dropZeroValueClauses` hides on, so a trailing effect must keep its own `;` clause in the JSON — Isolde's R1 has `lowerUltGauge` 0 and must read "Does damage equal to 280% ATK to all enemies." with the whole clause gone. Writing "and" into the JSON instead merges the placeholder into the damage clause and deletes the damage text with it. `joinClausesAsProse` (runs last in `buildDescriptionForRank`) renders the survivors as "A and B" / "A, B and C" — Tanveer approved prose over semicolons on 2026-08-10, noting the semicolon convention only ever existed because it confused agents drafting kits.

63. **Never restate a target the description already names** (2026-08-10). Isolde's Starbound Ward rendered "Grants all allies Debuff Immunity and raises their basic stats for 3 turns. **to all allies**" — the guard in `ensureTargetText` matched only enemy phrasings (`TARGET_PATTERN`), so it never saw the ally target sitting in the prose. Ally-facing skills state their target in prose rather than the fixed "to all X" shape, so they need the looser `ALLY_TARGET_PATTERN` (`/\ballies?\b/i`). Same principle as #62: the description says it once.

64. **Effects that share a duration share a clause** (2026-08-10). "seals Debuff skills for 2 turns; seals Attack Debuff skills for 2 turns" is one idea written twice — render it "seals Debuff and Attack Debuff skills for 2 turns". Tanveer: "since the duration for both seals is same then we can combine it. if they weren't then original version was fine." So the merge is keyed on the resolved duration and happens at **render** time, never in the JSON: Chiara's House Rules runs the two categories on different rank ladders (`[0,0,2]` and `[0,1,2]`), so R2 seals only Attack Debuff and must stay unmerged. `mergeSealClauses` in `descriptionTranslator.ts`. A final clause that already contains "and" is joined with a comma rather than a second "and".

65. **Skill-text house style** (2026-08-10, from the full description audit). Settled wordings, all confirmed by Tanveer:
    - **Attack seal**: "does damage equal to X and **attack seals for N turns**". Chiara is *not* the model here — she seals Debuff and Attack Debuff *skills*, a different mechanic. Fixed on Diane's Rush Rock ("applies 1 turn Attack Seal effect on the target") and Molvarr's Sunken Verdict.
    - **Lifesteal is a mechanic, not prose**: "**lifesteals** 30% of damage dealt". Same for "extorts".
    - **Never name an unimplemented mechanic.** Frost's Glacial Bind read "Freezes them for 1 turn" while running `stun`; [Freeze] is a *future* mechanic, so the card now says "stuns". Write what the engine does today.
    - **Tier words are not mandatory** — explicit percentages are equally legal, and are correct when the tier values (30/50) are the wrong size for the skill. Leorio's 20/30/50 stands. See `docs/design/KIT_DESIGN.md`.
    - **State every duration.** Several skills hid one that existed in the data (Ban's Snatch, Road Bandit's Sand Throw, Wild Beast's Rending Claws).
    - Passive markdown renders as bullets with a glossary footnote (`※`) and an "Uncancellable" badge in the UI — so an inline "(Uncancellable)" on a *single-line* passive is a duplicate. Removed from Isolde's Woven Blessing.
    - Duke's Flowing Ruin ATK-down is **not** "Only once" — it re-applies on every attack the passive enhances, which is what `combat.ts` already did. The description was the wrong half.

66. **Buff magnitudes are deliberately small, because buffs multiply** (2026-08-10). `effectiveStat` compounds modifiers (`mult *= 1 + valuePercent/100`), so +200% alongside +100% is **×6**, not ×4. Tanveer on seeing that arithmetic: *"ah so this is why i don't allow buff skills to buff stats by that much amount."* Working scale: a **self-only** buff ladders around **25/40/60%**, a **team-wide** buff around **20/30/50%** (Leorio) — self-buffs are more potent per point because they touch one unit. A source-material "×3 power-up" is written as a modest percentage with the multiplier left as flavour; it never becomes +200%.

67. **One scaling stat per kit** (2026-08-10). A character scales off ATK *or* HP *or* DEF — never a mix, and that includes heals. Tanveer: *"you can't mix two stat scaling into a single kit. if yalina does it then its wrong. she should be solely hp scaler."* Roster check found: **Isolde genuinely violates it** (heal `hp`, damage/ult `atk`) — Siddiq heals off ATK, so heals scaling ATK is the established form; direction of the fix is Tanveer's call and her numbers change either way. **Yalina** and **Iron** only declare a second stat on a *zero-damage* skill (taunt stance / defensive stance) where `statMultiplier` is inert — cosmetic. When drafting, pick the stat first and route every damaging skill through it; a defensive stat still earns its place through survivability and passive ramps, not through scaling one skill.

68. **Roster stat rebalance — HP moved to the 3–4k band** (2026-08-10). Benchmarked against 7DSGC statlines Tanveer supplied: their ATK scalers sit at **HP ≈ 12.2 × ATK, DEF ≈ 0.63 × ATK**; ours were at 7.1 and 0.39, i.e. ~60% of the health and defence they should carry for their ATK. Time-to-kill was **2.1 hits** — with three actions a turn, a focused unit died before acting, which is why taunts, DR, heals and cleanses rarely got to matter. New numbers put it at **~4.3 hits** (measured through `executeSkill`, not hand-rolled).

    - **ATK is the anchor and barely moved** — every skill multiplier is tuned to it. HP roughly doubled, DEF ~1.6x.
    - **Role templates, not per-character ratios.** Deriving HP from ATK gave Mustafa (65 ATK) a 910 HP "tank". Bands: DPS ~2900–3600 HP / 190–300 ATK, support ~3000–3200 / 155–205, defense ~3600–4000 / 110–175 with the highest DEF.
    - **HP scalers keep a real, below-average ATK** (Sara 190, Yalina 110). 7DSGC's HP scalers have normal statlines — the scaling stat decides what the *skill reads from*, not whether the character has stats. This also gives ATK-down and Extort something to bite; stealing 50% of Yalina's old 30 ATK was meaningless.
    - **Inflating a stat silently buffs anything that scales off it.** The companion deflation is mandatory, not optional: Sara 23/28/35 → 14/17/21 %HP (and 40 → 24), Yalina 20/25/30 → 9/12/14 (40 → 18), Mustafa's DEF-scaled 325/400/500 → 165/200/250 (450 → 225). Conversely **ATK-scaled heals had to inflate** against doubled bars: Siddiq 260/320/400 → 440/540/680, Prism 90/120/170 → 150/200/290. Isolde needed nothing — her heal is %HP, so it self-corrects, as does Molvarr's %max-HP Corrosion.
    - **DEF is flat subtraction** (`damage.ts`: `max(1, baseDamage − effectiveDefense)`), so DEF/ATK ratio parity with 7DSGC is mostly cosmetic here — against a 350% skill, even a doubled DEF removes ~18%. HP is the ratio that governs how the game feels.
    - Enemies scaled to hold encounter difficulty: trash **HP ×1.5, ATK ×1.9, DEF ×1.6** (so mobs stay trash but still threaten doubled bars); Lyra duel NPCs to 14500/265/185; **Molvarr P1 5400/285/175, P2 7200/400/230**. **Boss pacing is the untested part** — his turn-10 stat spike and max-HP drain were tuned against a shorter fight and need Tanveer's playtest.

## Working Style He Expects

- Work **batch by batch**; commit per batch with tests + lint + build green; update `docs/` in the same commit.
- **Tanveer decides where a batch ends (2026-08-09).** Don't commit or push on your own initiative — apply the change, run `npm run check`, report it, and leave it in the working tree until he says the batch is good. During a playtest loop he iterates on the same numbers, and committing each pass puts scratch work in the history (five commits in an hour, two partly undoing each other, had to be squashed).
- Use up-to-date packages; verify with context7 MCP, not training data. Firebase MCP has access to his account (project `toll-the-game`) for env/config.
- He was burned by this project before ("more headaches than progression") — don't create friction: keep the engine pure/testable, and never claim done on something you haven't checked.
- **Don't browser-verify UI work (2026-08-09).** Tanveer does the visual pass himself on his own dev server and reports issues one at a time; driving a browser to confirm what he's already looking at is wasted effort. `npm run check` (tsc + eslint + vitest) and a clean build stay mandatory — report what you actually verified rather than saying "browser-verified".
- Repo history note: the repo was once "decommissioned" (`027843f`) and resurrected (`c3040f7`). If something looks deleted, check git history before recreating it.

## Dev Loop

```bash
npm run dev     # localhost:3000 (kill stale servers on 3000 first)
npm run test    # vitest, tests/ — keep green
npm run lint    # eslint 9
npm run build   # must pass before commit
```

- Engine logic lives in `lib/game/` as pure functions — test them in `tests/`, don't bury logic in React.
- `hooks/BattleProvider.tsx` = phase machine + turn resolution; `store/gameStore.ts` = battle/deck state (Zustand, directly testable).
- Character kits = `data/characters/*.json` (source of truth; numbers belong to Tanveer).
- Art generation: start ComfyUI (`E:\Installed\ComfyUI_windows_portable\run_nvidia_gpu.bat`), follow `docs/ART_PIPELINE.md`, register new art in `lib/game/characterArt.ts`.

## Gotchas

- Windows: PowerShell 5.1 quirks; `app/archive/[id]` brackets break some tools' globbing — use `-LiteralPath`.
- CRLF warnings on commit are normal noise.
- TypeScript 6 / ESLint 10 deliberately NOT installed (Next 16 support unconfirmed at the time).
- `.env.local` (gitignored) holds `NEXT_PUBLIC_FIREBASE_*`; without it the app runs guest mode by design.

## Where Work Stops Currently

See `docs/ROADMAP.md` (the "Forward Product Roadmap" section supersedes the old Phase 0–4 list below it).

**Built and working:** battle engine, 27 kits, story Parts 1–2 (with rewards + per-chapter team modes), archive, auth + Firestore saves, battle cinematics, Molvarr world boss, leveling/ascension/stamina/inventory, gacha (summon/banners/milestone pity/dupes), `/news` MDX patch notes. `npm run check` green — **723 tests across 62 files**, clean `next build` (48 routes).

**Still missing (the whole gap):** audio, mobile layout pass, FTUE/tutorial, daily loop, analytics, deployment. `docs/PRODUCT_AUDIT.md` is the standing analysis — the fight is strong, the service layer around it is thin.

**Last completed work — story presentation overhaul + music layer (2026-08-09).** Per-word text reveal with the VN tap contract, narration separated from dialogue, portraits reframed with the previous speaker retained, AUTO/HISTORY/skip-confirm, chapter title card, VS splash, chapter context in the battle strip, CHAPTER COMPLETE on first clear, and a full music system. Detail in `docs/STATUS.md`; rulings #50–51 above; spec at `docs/superpowers/specs/2026-08-09-story-presentation-and-music-design.md`.

**The game is silent until Tanveer adds the OST.** `public/audio/` is empty on purpose; `docs/AUDIO.md` lists the five filenames and what each plays under. That is expected state, not a bug — a missing track resolves to silence with no console noise.

**Previously — story rewards + team agency (2026-08-09).** Story chapters now pay out (first-clear bundle + range-rolled repeat drops), gate replays behind stamina while leaving uncleared attempts free, and carry a per-chapter `teamMode`. Full detail in `docs/STATUS.md`; design decisions are rulings #45–49 above; spec at `docs/superpowers/specs/2026-08-09-story-rewards-and-team-agency-design.md`.

**All story reward numbers are placeholders awaiting Tanveer.** They live in `data/story/*.json` (`rewards.firstClear`, `rewards.repeat`, `rewards.replayStamina`) and were derived from the world-boss payout and summon costs, not chosen by him. Same for `teamMode`: Parts 1–2 ship `canon`, and opening a chapter up is a one-word edit.

**Previously — UX overhaul, 5 batches (2026-08-04).** From a full project audit; details per batch are in `docs/STATUS.md`, UI conventions they established are in `ARCHITECTURE.md` → "UI Layer Conventions".

1. Homepage → game hub (live player HUD, tiered mode cards, `lib/nav/routes.ts` shared with TopNav).
2. Enemy inspection in battle + `UnitDetailPanel` relaid out to fit one screen; `BattleArena.tsx` 1964 → ~1020 lines.
3. Battle log rendered from the typed `battleEvents` stream; markdown export.
4. Per-character VFX extended from 5 → all 27 kits; ult cut-ins use skill art.
5. Archive pages re-rendered as documents sharing `/news` typography.
   Plus: Growth gated to owned characters + moved to a modal, practice dummy 400 → 100k HP, and Damage Preview rebuilt as **Kit Preview** (support skills, passives, and multi-phase kits were all missing or wrong).

**Kit data stays JSON** — settled 2026-08-04. It's runtime data `combat.ts`, `descriptionTranslator`, `damagePreview`, the Zod schema, Kit Lab and ~20 test files all depend on. MDX is for prose (`content/news/`), not for kits.

**Known follow-ups, deliberately not done:**
- The battle log can't show *which buffs/debuffs an action applied* — the event stream doesn't model effect application. Needs an emit change in `combat.ts`, the most ruling-dense file in the repo.
- No shared `CharacterGrid` across `CharacterBrowser` / TeamSelect's roster overlay / the gacha pool. They differ in *interaction* (browse vs multi-select-with-order vs read-only rates), so one grid would need a prop per difference. The genuinely shared unit is the character tile.
