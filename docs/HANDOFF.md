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
4. ~~Enemy side takes 3 actions per turn.~~ **Retired 2026-08-19 — superseded by #59.** The flat 3 was a testing shortcut; actions are living field members + 1, capped at 3, on *both* sides. #39 then #59 carry the surviving rule, including "any living unit, any order, no pattern".

5. Duke's Flowing Ruin: skills AND ultimate build stacks (max 3) and can consume; empowered action = **+100% damage + 50% ATK-down** (2 turns) on **every** target hit. *(Corrected 2026-08-09 — read 50%/20% until then. The roster balance pass in `3f7d248` moved it to 100%/50% and the ledger was never updated; planning a story fight against the stale figure under-estimated Duke's burst by half. `data/characters/duke.json` is the source of truth.)*
6. Teams: any 1–4 units. Format 4v4 = all field; 3v3 = 4th member is the sub **automatically**. Lone sub auto-converts to field.
7. Subs: passive active from bench; no cards; untargetable; enter the field **only at the start of a new turn** after a teammate died.
8. Deck: loads field units' cards at battle start; **never resets**; refills one random card at a time with **auto-merge on adjacent identical cards** (+1 gauge per merge) until full; no deck interaction outside the player's turn; a gauge filled mid-refill guarantees the ult **next turn**, never the same refill.
9. UI stack is **shadcn/ui + Tailwind 4**. Primitives live in `components/ui/` and default to the Combat Terminal look (#84); add new ones with `npx shadcn@latest add`.

    *The HeroUI ban was retired 2026-08-19.* It read "never reintroduce" for a year after the 2026-07-06 migration finished. Tanveer: *"moved from heroui to shadcn long ago. useless so end it."* Nothing imports it, nothing is tempted to, and a standing prohibition against a library nobody remembers is noise in a ledger that has to stay trustworthy.

10. Art is **fully AI-generated** (no salvaged assets), style = Dokkan card art × 7DSGC renders. Tanveer supplies locked designs or blueprints for characters that lack one; generate from those via `docs/ART_PIPELINE.md`. Mustafa + Siddiq arts are AI-invented placeholders awaiting his designs.
11. **Type advantage** (2026-07-07): Dark > Light > Dark (mutual); Red > Green > Blue > Red. Advantage +20% damage, disadvantage −10%, neutral ±0. Applies to all attacks; CRITICAL attacks ignore it both ways.
12. **Evade** (= dodge, same thing): base 0% for **everyone**; only passives/buffs add it. An evaded attack deals no damage and applies no effects. More evade characters may come.
13. **Shock**: each application is an independent, cleansable DoT worth 30% of the damage dealt by the applying hit, 4 turns.
14. **Synergy scope** (2026-08-09): tag-based synergies (e.g. Seras's [Powerful Opponent] +10% all stats) apply to *every* teammate carrying the tag; Seras's is flat (not per-carrier scaling like Batra's KHALSA). Sara's `damageDealt` is a damage modifier, not a stat change, and Mustafa's targets DEF alone.

    **The Seras-and-Batra-only restriction on `stat: "all"` was retired 2026-08-19.** It described the roster as it happened to be, not a design rule — Tanveer: *"this rule doesn't need to exist tbh in any case. mainly because i may add more chara in the future who may have passives or buffs targeting 'all stats'."* Any kit may target all stats when the design calls for it.

    **What remains binding is the vocabulary, not the roster count** — see **#55**: "basic stats" is ATK/DEF/HP, "all stats" adds substats. The distinction is load-bearing because the engine treats them differently; which characters use which is his call, kit by kit. The wording predates substats existing, which is why older data says plain "stats".

15. New character kits arrive via the template at the top of `newchars.md`; once implemented, the kit is removed from that file (`data/characters/*.json` becomes the source of truth).
16. **Crit** (2026-07-07): base crit chance 0% for everyone; a crit proc applies the full CRITICAL package (50% DEF ignore, type-immune, +50% damage).

    **Skills and ultimates raise crit chance too, not only passives** (Tanveer, 2026-08-19): *"skills or ults can also increase crit chance, just like how chiara increases her evade chance."* This entry used to end "currently sourced by Meliodas's Deathblow", which described the roster rather than the rule — and `getCritChance` had been written to match it, summing the Deathblow passive and returning. **Any authored crit-chance buff was therefore inert**: it would sit in the data, render on the card, and never reach the roll. Now routed through `effectiveSubstat`, the same path crit damage, lifesteal and recovery rate already used, so buffs and debuffs both count, `stats` arrays are honoured and the value clamps at 0. Crit chance is inside "all stats"; evade is not (#55). Pinned by `tests/substats.test.ts`.
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

    **Pinned 2026-08-19** by `tests/kitDescriptionRules.test.ts`, which renders every shipped description at all three ranks and asserts no keyword surfaces twice and no phrase surfaces alongside its own substring.

28. **Explicit permanence + semicolon clauses** (2026-07-11, amends #26; **the permanence half is reversed by #110**): permanent stat changes say it — "Permanently raises ATK" — instead of implying it by omitting a duration; the permanence prefix joins the pill ("Permanently raises ATK and DEF" is one pill). Semicolons separate the distinct parts of a skill description ("Permanently raises ATK; greatly raises DEF for 1 turn; then does 500% ATK damage to one enemy."). Applied roster-wide.
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
46. ~~Story reward model: a one-time `firstClear` bundle plus `repeat` drops, no mission layer.~~ **Retired 2026-08-19 — superseded by #80 and #108.** The two-list split survives in #80 (first-clear fixed, farm rolled); missions exist as of #108.

47. **Story payout mix** (2026-08-09): repeat drops are `coin` + `training_manual` tiers; `gems` are first-clear-only; ascension materials (`sea_monster_eye`, `corroded_seaweed`) stay world-boss exclusive. Story is the levelling-fuel farm; the boss is the gacha-currency and ascension farm.
48. ~~Stamina gates story replays only; an uncleared chapter is free.~~ **Retired 2026-08-19 — superseded by #100**, which carries his reversal verbatim: every attempt costs stamina, first try included.

49. **Story repeat drops roll a range per entry** (2026-08-09): `{min, max}` inclusive — not fixed amounts, not a weighted table.
50. **Story environment backgrounds are deferred** (2026-08-09). *Reversed 2026-08-18 by the story mode v2 build (#108) — kept because the reason still constrains the art.* The original: scene art is the biggest lever on "scenes look cheap", and he was not committing the art direction yet — no generated plates, no blurred-character fallback, no stylised abstract backdrops, don't add them unprompted.

    **What is true now:** `StoryScene` carries a `backgroundId`, and `lib/game/storyBackgrounds.ts` maps 14 locale slugs to a tinted gradient. **Updated 2026-08-21:** 18 plates are drawn and wired, covering chapters 1-3; the registry's other slugs still resolve to their gradient. Three of the original 14 slugs were retired as non-canon once the beat sheets were read (`gamblers_table`, `the_bridge`, `overseer_dining`). The gradient remains a real fallback, not a placeholder to be raced - a slug nobody has drawn still renders. The look of the drawn plates is his to accept or reject; nothing stylised gets invented beyond what the chapters describe.

51. **Audio is music only, and Tanveer supplies it** (2026-08-09): background OST, no SFX of any kind — no battle sounds, no UI clicks, no text blips. The system shipped; `public/audio/` is empty and the game is silent by design until he adds the files listed in `docs/AUDIO.md`.
52. **DoT default durations** (2026-08-09): Ignite lasts **3 turns** and Bleed **2**, unless a kit says otherwise (`lib/game/dotDurations.ts`). Descriptions state the duration automatically — it's derived from the mechanic by the translator, never authored into the prose, so text can't drift from data. Bleed is a flat 2 at every rank roster-wide; no kit scales it any more.

    **Amended 2026-08-21.** The last sentence was enforced as "every Bleed on every kit resolves to 2", which is stricter than this ruling's own "unless a kit says otherwise" and than `dotDurations.ts`. Tanveer authored the Checkpoint Enforcer's Bleed at **1 turn** and confirmed it when the conflict was raised. So: **2 is the default a Bleed gets when it says nothing**, and a kit may author its own duration. `tests/dotDurations.test.ts` now asserts that shape rather than the blanket 2.
53. **Ordinary story enemies are tanky, not deadly** (2026-08-09): low ATK, large HP pools, plus an anti-stall passive that triples their stats at turn 10 (`bossStatSpike`, multiplier 3) so a fight can't be stalled out. `applyBossTurnStart` runs for any enemy carrying a turn-start mechanic, not just phased bosses.
54. **A story NPC is a separate character that happens to share art** (2026-08-09, **reversed and widened 2026-08-19**). The original said a `storyOnly` kit may diverge in stats, multipliers and ultimate damage, but that *passives stay in sync*. That half is gone. Tanveer: *"story versions of chars may have same visual elements (artwork) but their kit could be completely different and that includes the element color too. future proof and scalable this way."*

    **Corrected 2026-08-20 — the entry above overstated him.** It read "*shares nothing with its playable twin except, optionally, the artwork*", which turned a permission into a mandate. His clarification: *"I said 'story char MIGHT not share all the details with playable chars' meaning it can share some. i would have tags shared at the very least."*

    So the rule is: **a `storyOnly` kit MAY diverge from its playable twin in any respect** — stats, multipliers, ultimate, passives, element colour — and that freedom is the point, for future-proofing and scale. It is not obliged to. **Tags are shared by convention**, and a story version should carry its playable twin's tags unless there is a reason not to; kits keyed on a target's tags depend on that (`Plans/2026-08-20-passive-structure.md`).

    Two things that still hold: never "fix" an NPC kit toward its playable version just because they differ, and never assume one *reads* from the other — nothing in the code derives NPC data from a playable kit, so every shared value is shared because someone authored it that way.

55. **Stat vocabulary is exact** (2026-08-09) — Tanveer is deliberate about these words; don't use them loosely:
    - **"basic stats"** = ATK, DEF, HP.
    - **"all stats"** = basic stats **plus substats**, excluding damage reduction and evade chance. *(The engine read this as basic-stats-only until 2026-08-09, documented in `substats.ts` as a "2026-07-24 ruling" — Tanveer's read is that it predates the substat system existing. Corrected, and the test that locked it in now asserts the reversal.)*
    - **A max-HP change is temporary if its effect is.** A durationed HP buff/debuff records what it scaled (`hpScalePercent`) and `tick.ts` unwinds it by the *inverse* when the effect expires — +50% is undone by −33.3%, not by −50%. Stacked raises compound and unwind one at a time. An undurationed (permanent) raise never unwinds. HP debuffs shrink max HP the same way, so `-30% all stats` really does cut the pool.
    - **A max-HP change scales current HP with it, preserving the ratio.** 1500/2000 (75%) raised 50% is **2250/3000**; lowered 30% it's **1050/1400** — still 75% either way (`scaleMaxHp`, `lib/game/maxHp.ts`). The engine used to add the max-HP *delta* to current HP, turning 1500/2000 into 2500/3000 (83%) — a free 250 HP on every HP buff.
    - **Basic stats are counts; substats are percentages, and modifiers behave differently.** A "+5%" to ATK/DEF/HP **scales** them (×1.05, multiplicative — ruling 2026-07-12). A "+5%" to a substat **adds five percentage points**: 10% lifesteal buffed 5% is 15%, not 10.5%. Substats clamp at 0 and never go inverse. This is what `evade.ts` already did; `substats.ts` was multiplying, which made Isolde's +10% lifesteal aura (5 × 1.1 → floor 5) and any evade buff on a 0% base into silent no-ops.
    - **"raises ATK"** = one buff on ATK. **"raises DEF"** = one buff on DEF. **"raises ATK and DEF"** = **ONE** buff covering both — not two entries, and *not* `stat: "all"` (which would sweep in HP and substats). Author it as `stats: ["atk","def"]`; the engine reads it via `entryAffectsStat` (`lib/game/stats.ts`). One effect = one entry = one pill = one thing to cleanse.
    **A substat entry can be authored as a `stats` array, and three readers missed it** (2026-08-19). "Raises ATK and evade chance" is **one** buff — one entry, one pill, one thing to cleanse — so it carries `stats: ["atk","evade"]` and no `stat` field at all. Three places matched on the bare `stat` and silently dropped the whole entry:

    - **`evade.ts`** — found when Chiara's ultimate was merged into a single entry on 2026-08-19 and her dodge went to **zero** while the card still advertised it. Fixed by matching `stats` too, deliberately **without** using `entryAffectsStat`, because that honours `stat: "all"` and this ruling puts evade chance out of "all stats" reach.
    - **`getCritChance`** — see #16.
    - **`damagePreview.ts`** — self-buffs authored as arrays were left out of the estimate, so **Duke's Surge and Killua's ultimate had been understating their own damage** for as long as they have existed. Ruling #22 applies the self-buff before the damage calc, so a preview that omits it misreports the hit.

    This is the same failure family this ruling was written for: an entry that sits in the data, renders on the card, and does nothing. **When adding a reader for a stat, match `stat` *and* `stats`** — and decide explicitly whether `"all"` should reach it. The trap is structural rather than careless: the one-effect-one-entry rule actively pushes authors toward `stats` arrays, so every new reader is exposed by default and the failure is always silent.

    **Two more readers found 2026-08-20 and left unfixed because nothing reaches them yet:** `getDamageDealtMultiplier` and `getDamageReductionMultiplier` (`lib/game/stats.ts:129`, `:144`). Specced in `Plans/2026-08-20-substat-stats-arrays.md`, together with a separate asymmetry — the damage-reduction reader consumes buffs only, while its damage-dealt twin reads debuffs too.

56. **Tier words and chance words are fixed scales** (2026-08-09, amends #26; **the threshold reading is corrected by #109**) — but they constrain the **wording**, not the values.
    - Magnitude going **up**: **30% "raises"**, **50% "greatly raises"**, **100% "massively raises"**.
    - Magnitude going **down**: **30% "lowers"**, **50% "greatly lowers"**, **80% "massively lowers"**. The top tier is lower on purpose — a stat can never be reduced to zero in battle, so 80% is the ceiling a "lowers" effect is written against. ~~`tierWord` treats these as thresholds so an off-tier value still picks the nearest honest word.~~ **Corrected by #109 (2026-08-19): they are exact values, not floors.** An off-scale value gets no tier word and no pill — it is written "Increases/Decreases X by N%" with the number visible.
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
58. **What is and isn't rank-scaled — read the notation, not the kit** (2026-08-09; tier-word half amended by **#109**). Two rules, and they settle every case:
    1. **A tier word names a fixed value; the value never moves.** "raises" *is* 30%, "greatly raises" *is* 50% (roster-verified 2026-08-09 — every kit obeys this, no exceptions). You cannot write "lowers DEF" and have it mean 50; if you want 50 you write "greatly lowers".

       The vocabulary is **"raises/lowers" (30)**, **"greatly" (50)** and **"massively" (100 raising / 80 lowering, per #56 above)**. No other intensifier exists; don't coin one.

       **Correction (2026-08-10):** this ruling previously said "massively" was reserved with no value. That was wrong — #56 assigned it the day before, `tierWord` in `descriptionTranslator.ts` has always implemented it, and `mechanicGlossary.ts` spells it out ("Raises the stat by 100%"). No kit uses it yet, which is what made the mistake survive three documents. **Read #56 before quoting the tier scale.**

       **Carve-out (Tanveer, 2026-08-09):** a rank ladder MAY step *between* tier words, because the tiers themselves stay fixed. Chiara's Marked Card is the reference case — `valueRanked [30,50,50]` with `ranks:[false,true,true]`, so R1 reads "lowers DEF" (30%, 1 turn), R2 reads "greatly lowers DEF" (50%, 1 turn), R3 keeps "greatly" but extends to 2 turns via `durationRanked`. His alternative for R3 would have been "massively lowers DEF for 1 turn" — a further tier step rather than a duration step. What remains forbidden is a ladder *inside* one tier word (e.g. "lowers" meaning 30/40/50).
    2. **In Tanveer's kit drafts, only values written `x/y/z` are rank-scaled.** Everything else is flat *unless he writes a note saying otherwise.* Don't infer scaling from a skill's type, from what a similar character does, or from it "feeling like" it should ramp — author `valuePercent`, not `valueRanked`, unless the draft used slashes.

    Consequence, not a separate rule: attack skills carry tier-worded self-buffs (flat, applied before the hit per #22 — Duke's Surge +30% ATK and DEF, Gon's Rock +50% ATK, both HxH ultimates), while support skills state explicit `x/y/z` numbers so a rarer card buffs allies harder (Leorio's Member of the Zodiac, 20/30/50% for 1/1/2 turns).

    Roster verified 2026-08-09: every attack-type self-buff is flat, the only rank-scaled ATK/DEF buff is Leorio's, and `damageReduction` stances (Mustafa's Fortress, Iron Wall, Yalina's Attention Drawer) are numeric and ranked as their own family.

    **Pinned 2026-08-19** by `tests/kitDescriptionRules.test.ts`: for any ranked buff or debuff whose description spends a tier word, no two ranks may render the *same* word while carrying different values — the ladder-inside-one-tier-word case. **A tier word is a function of the number alone, never of which stat it targets** (Tanveer, 2026-08-19); `tierWord` reads thresholds and nothing else, so an off-tier value picks the nearest honest word and is not a defect (#56: *"values are free"*). Chiara's All In raising ATK 30 and evade 33 under one "Raises" is correct. Skills stating explicit percentages spend no tier word and are exempt (Leorio's 20/30/50).

59. **Action economy is symmetric — living field members + 1, capped at 3** (2026-08-09, amends the enemy-only 2026-07-12 ruling). The player was pinned at a flat 3 while the enemy already scaled; Tanveer confirmed that was a testing shortcut, not a design choice. Both sides now read `actionsForTurn` in `lib/game/actionEconomy.ts`:
    - Subs and the dead grant nothing, so a side on its last unit gets **2** actions, two units get 3, and 3+ stays 3.
    - **A side with a `tier: "elite"` member always gets the full 3**, alone or not — bosses never lose tempo. This is why the elite branch exists and must survive any future refactor of this rule.
    - Consequence worth knowing before tuning: the losing side now sheds actions as it sheds units, which compounds a losing position. Same snowball as a stun landing on a side's last living unit (that one is still open — full turn denial, undecided).

60. **Debuffs are cancellable no matter what applied them** (2026-08-09). A debuff rolled by a passive, or applied by a boss passive, is an *ordinary* debuff — it carries no `uncancellable` flag and it must respect Debuff Immunity. Tanveer: "it shouldn't carry uncancellable, even from passive proc." The trap is that passive and boss-passive code applies debuffs **outside** `executeSkill`, so it never passes the immunity gate in `combat.ts` — each such site has to check `buffs.some(b => b.debuffImmune)` itself. Two sites were fixed this way (`applyCorrosion` in `bossPassives.ts`, `registerRandomTurnEffect` in `passive.ts`); **any new out-of-combat debuff applier needs the same guard.** Ally-facing *buffs* from those same helpers stay uncancellable — the rule is about debuffs only.

    **Pinned 2026-08-19** by `tests/debuffImmunity.test.ts`: behaviourally for the skill path and the boss-passive path, plus a structural check that the set of files appending to a `debuffs` array is exactly the three known appliers and each references `debuffImmune`. Tanveer restated the rule with no exceptions — *"No new debuffs can be put on the char if the debuffimmune buff or effect is active on said target character."*

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

    **Pinned 2026-08-19** by `tests/kitDescriptionRules.test.ts`, which holds a list of mechanics that have been *named* but not built (freeze and its family) and asserts no description or glossary key uses one. His reason for wanting it mechanised: *"don't want you inventing names and mechanics on your own. consulting me first is a must."* A word leaves that list the day the mechanic is built, not the day it is discussed. Lore prose is not checked — Lyra's Red Ice may freeze enemies in her bio.

66. **Buff magnitudes are deliberately small, because buffs multiply** (2026-08-10). `effectiveStat` compounds modifiers (`mult *= 1 + valuePercent/100`), so +200% alongside +100% is **×6**, not ×4. Tanveer on seeing that arithmetic: *"ah so this is why i don't allow buff skills to buff stats by that much amount."* Working scale: a **self-only** buff ladders around **25/40/60%**, a **team-wide** buff around **20/30/50%** (Leorio) — self-buffs are more potent per point because they touch one unit. A source-material "×3 power-up" is written as a modest percentage with the multiplier left as flavour; it never becomes +200%.

67. **One scaling stat per kit** (2026-08-10). A character scales off ATK *or* HP *or* DEF — never a mix, and that includes heals. Tanveer: *"you can't mix two stat scaling into a single kit. if yalina does it then its wrong. she should be solely hp scaler."* Roster check found: **Isolde genuinely violates it** (heal `hp`, damage/ult `atk`) — Siddiq heals off ATK, so heals scaling ATK is the established form; direction of the fix is Tanveer's call and her numbers change either way. **Yalina** and **Iron** only declare a second stat on a *zero-damage* skill (taunt stance / defensive stance) where `statMultiplier` is inert — cosmetic. When drafting, pick the stat first and route every damaging skill through it; a defensive stat still earns its place through survivability and passive ramps, not through scaling one skill.

68. **Roster stat rebalance — HP moved to the 3–4k band** (2026-08-10). Benchmarked against 7DSGC statlines Tanveer supplied: their ATK scalers sit at **HP ≈ 12.2 × ATK, DEF ≈ 0.63 × ATK**; ours were at 7.1 and 0.39, i.e. ~60% of the health and defence they should carry for their ATK. Time-to-kill was **2.1 hits** — with three actions a turn, a focused unit died before acting, which is why taunts, DR, heals and cleanses rarely got to matter. New numbers put it at **~4.3 hits** (measured through `executeSkill`, not hand-rolled).

    - **ATK is the anchor and barely moved** — every skill multiplier is tuned to it. HP roughly doubled, DEF ~1.6x.
    - **Role templates, not per-character ratios.** Deriving HP from ATK gave Mustafa (65 ATK) a 910 HP "tank". Bands: DPS ~2900–3600 HP / 190–300 ATK, support ~3000–3200 / 155–205, defense ~3600–4000 / 110–175 with the highest DEF.
    - **HP scalers keep a real, below-average ATK** (Sara 190, Yalina 110). 7DSGC's HP scalers have normal statlines — the scaling stat decides what the *skill reads from*, not whether the character has stats. This also gives ATK-down and Extort something to bite; stealing 50% of Yalina's old 30 ATK was meaningless.
    - **Inflating a stat silently buffs anything that scales off it.** The companion deflation is mandatory, not optional: Sara 23/28/35 → 14/17/21 %HP (and 40 → 24), Yalina 20/25/30 → 9/12/14 (40 → 18), Mustafa's DEF-scaled 325/400/500 → 165/200/250 (450 → 225). Conversely **ATK-scaled heals had to inflate** against doubled bars: Siddiq 260/320/400 → 440/540/680, Prism 90/120/170 → 150/200/290. Isolde needed nothing — her heal is %HP, so it self-corrects, as does Molvarr's %max-HP Corrosion.
    - **DEF is flat subtraction** (`damage.ts`: `max(1, baseDamage − effectiveDefense)`), so DEF/ATK ratio parity with 7DSGC is mostly cosmetic here — against a 350% skill, even a doubled DEF removes ~18%. HP is the ratio that governs how the game feels.
    - Enemies scaled to hold encounter difficulty: trash **HP ×1.5, ATK ×1.9, DEF ×1.6** (so mobs stay trash but still threaten doubled bars); Lyra duel NPCs to 14500/265/185; **Molvarr P1 5400/285/175, P2 7200/400/230** *(HP superseded 2026-08-14 — P1 8500, P2 10000, ruling #91; ATK and DEF unchanged)*. **Boss pacing is the untested part** — his turn-10 stat spike and max-HP drain were tuned against a shorter fight and need Tanveer's playtest.

69. **Stage effects — encounter difficulty lives on the stage, not in the kit** (2026-08-10). Per-battle modifiers authored in the chapter JSON (`types/stageEffects.ts`, `lib/game/stageEffects.ts`), targeting `player`, `enemy` or `both`. Two effect types so far: `bonusActions` (**respects the hard cap of 3** — it lifts a side that is under the cap, never raises the ceiling) and `statBoost` (`all`/`atk`/`def`/`hp`, **baked into base stats at battle start**, not applied as a buff, so `cancelBuffs` can't strip the arena and Rupture doesn't count it as a buff to punish). Absent or empty means a standard fight, which is the default everywhere — Tanveer names which fights get effects.

    Born from Part 2 Chapter 2: a canon solo team gets `1 + 1 = 2` actions while the boss's `tier: "elite"` grants a flat 3, so the player faced a permanent 50% action deficit. The stage grants the player +1. It also **deleted `lyra_npc_2`** — a byte-identical copy of `lyra_npc` whose only difference was a passive granting "All stats 5% up". That duplicate had already drifted (never registered for art, so the 2-2 boss rendered blank); the 5% is now a stage effect and the kit is gone. **The brief shows three sections — enemy / both / player** — in the roster's arrow idiom.

70. **Story bosses are meant to be lost a few times** (2026-08-10). Tanveer on the Part 2 Lyra fight: *"i am expecting players to lose a couple of times before they can clear it. good way to learn the battle system too."* Verified balance — Duke wins on turn 4 with **428/3150 HP (13.6%)**, dealing ~2,960/turn against her ~1,490 by turn 3; she would have killed him on turn 5. The variance is deliberate and lives in **which card Duke's 3rd Flowing Ruin stack lands on** (the +100% proc gave 4,332 across two casts — 38% of her bar), so the fight demands the combo rather than being a stat check. NPC Lyra is **3x the playable version's HP** (10800 vs 3600) by Tanveer's rule. **Do not nerf this fight** because attempts fail; uncleared chapters cost no stamina, so a loss costs only time.

71. **A nulled hit is "Tanked", and its scaled after-effects don't proc** (2026-08-13). Flat DEF can reduce a card to **0 damage** — Volcanic Frost against ~400 DEF in the 08-13 run — and any effect whose value scales off that damage lands at 0 with it, which is how `applied decay (0/turn) for 2 turns` happened. Tanveer's ruling: *"if damage based DoT are nulled to 0 due to high defense then they wouldn't proc. so the card will only do its damage (if 0 then it would say 'Tanked') and no other text if the after action effects are nulled to 0 too."* So a fully-nulled card reads **"Tanked"** and nothing else — no zero-value effect text, no zero-value effect applied. Known damage-scaled after-effects affected: **bleed, decay, shock**. The card is still spent; this is about not reporting or applying effects that amount to nothing.

72. **The battle log is player-facing, not just an analysis artefact** (2026-08-13). Saved battle *reports* are JSON written for machine analysis (`lib/game/battleReport.ts`) and Tanveer never reads them — but the in-battle log drawer is part of the battle UI: *"if a player needs to read it, it should be readable."* The two have different audiences and must not be collapsed into one format.

73. **Molvarr Phase 2 was tuned down; the corrosion cadence was the real lever** (2026-08-13). After five playtest runs (4W/1L) Tanveer called P2 "a bit unfair", with the phase-2 ultimate reaching ~4k in one fight and ~800 even after the nerf. His four changes: P1 Crushing Maw R3 350 → 300 (R1/R2 rescaled to 225/255), P2 Abyssal Pierce **[Pierce] → [Concentrate]**, P2 SP Iron Carapace 50% → 30% on both stats ("greatly raises" → "raises" — the translator picks the adverb off the percentage, so the wording followed automatically), and P2's Corrosive Tide from *every turn* to *every 3rd turn*. That last one carries most of the nerf: every corrosion stack also feeds **Growing Malice** (+5% ATK per enemy debuff), so applying a stack per player per turn compounded the boss's own ATK into the four-figure ultimate. `bossApplyCorrosion` gained an `everyNTurns` field for it (absent = every turn, unchanged for anyone else). Note the knock-on: Concentrate scales *up* as your team shrinks (×1.1 at 3 targets, ×1.5 at 1), so P2's AoE now punishes a losing board harder than it used to even though its average is lower.

74. **A boss SP Skill has to be visible in the kit** (2026-08-13). `getCharacterKit` returned skills/ultimate/passives but dropped `spSkill`, so Molvarr's auto-fired special was unreadable in both the archive and the in-battle info panel despite firing every 3rd turn. It is an action the boss takes at you; not showing it is hiding information the player needs. It renders in the SP slot with **no rank table** — SP never enters the deck, has no rank, and its `damageRanked: [0,0,0]` placeholder would otherwise print the same row three times.

75. **A tanked hit carries none of its consequences, and the rule is read off the description's clause order** (2026-08-13, extends ruling #71). Tanveer's test: *"if the attack lands, will the following effect(s) land too? would it make sense?"* For *"Cancels buffs, does damage equal to 375% ATK to all enemies, greatly lowers ATK and DEF for 2 turns"*, the cancel precedes the damage clause and still fires; the ATK/DEF drop follows it and does not. So the gate is **position relative to the damage step**, not a list of mechanic types — later widenings admit more mechanics through the same door instead of rewriting it. **Covers DoTs (bleed/decay/shock/corrosion/ignite), `lowerUltGauge` and `stun`.** Stun was deferred for a few hours and then ruled in the same day — *"null them if the damage resulted in null"* — and **freeze inherits it unbuilt**: he confirmed it is a stun variant in every respect, so it joins `NULLED_BY_TANKED_HIT` the day it exists rather than being re-litigated. The plain stat debuffs are still out, unruled, and pinned by a test. Per target: an AoE nulling on one unit still applies everything to the others. A skill that never intended damage (Draw Fire) is not a null and must not read "Tanked". Evade needed no change — it returns before the mechanics loop and has always skipped them.

76. **The turn-resolution guard belongs in the store, not in a React ref** (2026-08-13, closes Open Issue #24). `resolvingRef` was per component *instance*, and BattleProvider is deliberately built to survive a remount (page reload, dev HMR). A remount handed the new instance a fresh `false` while the old instance's `runPlayerActions` loop was still awaiting playback and still saw `battlePhase === "PlayerAction"` in the shared store — so both loops resolved the same action queue. Symptoms: seven logged Lyra actions against a 3-action cap, and a report header reading **16 player turns in a 15-turn battle**. The claim is now `activeResolution` / `finishedResolutions` in `gameStore`, keyed by turn so re-entry is refused even after the first run finishes, with an ownership re-check after every await so a zombie loop stops committing. Not persisted: a reload has no live loop, and a surviving lock would deadlock the fight. The `dedupeConsecutive` mitigation in `buildBattleReport` is **kept as a regression detector** — its anomaly now reads "REGRESSION" and should be zero in every future report.

77. **Buff and debuff counts, not a chip per effect** (2026-08-13). The strip under the ult gauge reads `↑4 ↓3`. A side with zero renders **nothing at all** — no zero, no dimmed arrow — so `↓2` alone is a unit carrying only debuffs. Grey uncancellable entries never appear and never count (ruling #30 says they aren't buffs or debuffs). Counts entries, not stacks, so three Corrosion stacks stay one debuff, matching the chips this replaced. Both the tile and the info panel use it: same information, same encoding. The names moved into a **modal** behind "Detail" — buff and debuff tables plus a grey-effects toggle — because the old inline disclosure expanded a list of unbounded length inside the panel's own scroll zone ("its not good UI").

78. **Auto Clear instead of auto-battle** (2026-08-13). Auto-battle was proposed and rejected for a concrete reason: *"it would also mean designing a auto battle ai too and that's a big work."* A player-side AI has to handle 27 kits, ally targeting, ult timing and merges, and would be judged against how he plays. **Auto Clear** simulates nothing — it pays a fight's cost and grants its reward, for a fight already beaten. His rules: **1 ticket = 1 fight**, **full stamina per skipped run**, **full reward roll**, **manual clear required first**, **Molvarr only for now**, tickets from Bureau Orders and **5 per account rank gained**, **no cap** on banked tickets. The load-bearing property is the stamina cost: it keeps stamina the only throughput gate, so a ticket buys *time, never resources* — which is what makes full rewards safe rather than exploitable. Spec: `docs/superpowers/specs/2026-08-13-auto-clear-design.md`.

79. **Bureau Orders are stepped, ten to a step** (2026-08-13). *"the exisiting batch of orders are from step 1. once completed all of step 1, step 2 is unlocked and there are new missions. for each step, keep it with 10 missions... the steps can be tabs."* A step opens when every order in the previous one is **claimed**, not merely met — the same rule `requires` uses, and it stops a step unlocking while its last reward is still sitting uncollected. Progress toward a locked step's orders still accrues; only collection waits. One data file per step (`data/orders/step-N.json`), a `step` field on every order, and the ten-per-step rule asserted by test rather than thrown at load, so authoring a step doesn't break the app mid-edit.

80. **Every fight pays two separate reward lists: first-time-only, and farmable** (2026-08-13). *"from this point onwards, every fight will have two types of rewards payout — first time only and farmable. both will be different."* A first clear pays **both together**; every clear after it pays the farmable list alone. The first-clear bundle is **fixed amounts, never rolled** — his correction: *"first clear rewards aren't supposed to be chance based with amounts."* This is the shape story chapters already used (`firstClear` fixed / `repeat` ranges); the world boss had one roll table doing both jobs, which is how it ended up paying summoning gems on every clear at ~7 runs a day.

    **Molvarr's bundle (his numbers):** 50 gems · 3 eyes · 10 seaweed · 50,000 coin · 50 account XP · 15/10/5 training manuals by tier · 1 Permanent Ticket.
    **Molvarr's farm:** eyes, seaweed, coin, basic manuals and account XP at the existing rates — and *nothing else*. **No gems, no Permanent Ticket, no higher-tier manuals.** Both summon currencies are therefore first-clear only, which also closed the Permanent Ticket leak flagged earlier the same day without needing a separate ruling.

    `rollWorldBossRewards`'s `firstClear` defaults to **false**, so a new call site that forgets it under-pays rather than reprinting the bundle every run. Auto Clear passes `AUTO_CLEAR_IS_NEVER_FIRST_CLEAR` — safe by its own gate, since a manual clear must already have happened.

81. **Difficulty is content, not a coefficient** (2026-08-13, replaces the world-boss reward multiplier entirely). A multi-difficulty fight is **several fights**, one per world level. Each has its own world-level requirement to attempt, its own first-clear bundle paid once, and its own farmable table. *"grindable stuff wouldn't multiply the rewards by world level or anything but higher difficult fights will just give higher quality rewards in general."* And: *"first clear doesn't need to scale with world level"* — every bundle is authored at the value it should pay, never scaled by anything.

    **Clearing a tier is what unlocks grinding it.** `clearedEvents` keys per tier (`molvarr@3`, see `tierKey`), so beating world level 1 cannot open auto clear on world level 4 — the exploit a reward multiplier would have left wide open, and the reason this model is better than the one it replaces.

    Background: `rewardMultiplierForDifficulty` was **displayed on the boss brief and never applied** — the picker advertised ×1.00/×1.35/×1.70/×2.05 while `rollWorldBossRewards` never received it. The 2026-08-11 notes did specify "reward multiplier applies to the whole payout including account XP", but only the story path ever implemented it, and `tests/accountRank.test.ts` only checked the function's arithmetic, never that a caller used it. Rather than wire it up, Tanveer replaced the model. **The multiplier still applies to story chapters** (`storyRewards.ts`), which is a separate system and untouched.

    **Tiers 2–4 of Molvarr are PLACEHOLDER numbers.** He authored tier 1; the rest follow his stated shape (higher tiers add advanced and premium manuals to the farm — "higher quality", not just "more"). `tests/worldBossRewards.test.ts` asserts each tier strictly improves on the one below and that no tier's farm ever contains gems or a Permanent Ticket, so his final numbers can drop in without re-deriving the rules.

82. **The reward multiplier is deleted, not deprecated** (2026-08-13). Told it was flagged for later removal while nothing actually used it: *"bruh if nothing's changed then flag is useless lol. if ifs not much to remove then do it right now."* Correct — a `@deprecated` tag on code with no callers is a comment pretending to be a plan. Removed in full: `REWARD_BONUS_PER_DIFFICULTY`, `rewardMultiplierForDifficulty` (`lib/game/worldLevel.ts`), `scalePayout` and `rollStoryRewards`'s `rewardMultiplier` parameter (`lib/game/storyRewards.ts`). Zero references remain.

    **Story is unaffected** — it never passed a multiplier, so it was already running at base difficulty, which is where he wants it for now. `lib/game/worldLevel.ts` now answers one question, *how hard is the fight*; what a difficulty **pays** lives with the content, per ruling #81. The "harder must pay better" rule moved from a coefficient to `tests/worldBossRewards.test.ts`'s tier-progression assertion.

    Left alone deliberately: `effectiveDifficulty` and `baseDifficultyForPart` have no callers either, but they are the story's *base difficulty* scaffolding, which he explicitly wants kept.

83. **Don't deprecate what you can delete** (2026-08-13). Offered a `@deprecated` flag on four symbols with zero callers: *"bruh if nothing's changed then flag is useless lol. if ifs not much to remove then do it right now."* A deprecation marker is a migration plan for code someone still depends on. On dead code it is a comment pretending to be a plan, and it leaves the next reader to re-derive that it was safe to remove. **If removal is cheap and nothing calls it, remove it in the same breath as noticing it.**

84. **The primitives speak Combat Terminal; usages don't re-say it** (2026-08-13). `components/ui/` shipped shadcn's greyscale defaults while the game paints from the Combat Terminal tokens, so every `<Button>` set `variant="outline"` on one line and contradicted it on the next — 16 of 36 usages carried a className restating radius, border, background, font, tracking and colour. The primitives now default to the game's look, and **a className on a primitive should add something the variant cannot know** — a width, a chamfer, a grid position, a type size. If you find yourself writing `rounded-none border-edge font-heading` at a usage, the variant is wrong, not the usage.

    Corollary, learned the same day: **an override that looks complete can still leak.** Four result-screen buttons and the Ascend button rendered near-white for weeks because their classNames set text and border but not background, so shadcn's `bg-primary` showed through. Nobody reported it; it was invisible in review.

    Also settled: **the app has no genuine `<Select>` candidates.** The difficulty picker is a segmented control with per-tile state, the archive filters are multi-select chips plus a tri-state sort, and the team preset chips carry member portraits. Don't convert any of them — see `docs/superpowers/specs/2026-08-13-shadcn-and-ui-cleanup-design.md`.

85. **Ascension requires the level, not just the materials** (2026-08-13). Ascending was cost-only, so a Lv1 character with a full bag could be taken from ascension 1 to 4 without being levelled once: *"to ascend, they need to reach the min base level of that band first."* Ascension N+1 now requires level ≥ the cap of band N (Lv20 → asc 2, Lv30 → asc 3, Lv40 → asc 4); ascension 1 requires Lv1, so a fresh unit is never blocked from its first.

    The general shape worth carrying: **a cap in one direction is not a gate in the other.** `maxLevelForAscension` had existed since the system shipped and was correct — it stopped you levelling past a band. Nobody wrote the mirror rule, and the missing half was invisible because the existing half looked like the whole thing.

    Both the store and the panel now call one `ascensionBlocker()`, so an enabled button can never mean something different from what the action will do.

86. **Be frugal; more content is coming** (2026-08-13). After the economy audit: *"i will add more events in the future to daily grind out coin, manuals and other stuff... there will be more bosses, more PVE content in general later... you don't have to 'donate' resources right now across current content. a frugal dev and dev helper (you) is good to have right now."* When a resource looks short, the default answer is **future content**, not a bigger number on existing content. Every payout retuned this session was moved *down* or bumped only partially.

    Settled at the same time:
    - **The story is 24 parts**, twelve of which exist. Total gem budget **3,000**, ramped in six tiers of four parts (70/95/120/140/155/170 each). `docs/design/ECONOMY_AUDIT.md` carries the table — **author future parts against it.** The first twelve were improvised and reached 6,430 before anyone summed them.
    - **Lv40 is the hard grinder ceiling** and *"i don't want anyone to grind all of their characters to lvl 40 easily."* A team of four to Lv40 is ~72 days; that is the intent, not a problem. Do not "fix" it — specifically, do not add Advanced Manuals to the tier-1 farm or flatten the XP curve, which are the two levers that would.
    - **Permanent Tickets are parked, not orphaned.** They buy nothing today and accrue on purpose; a **shop** is planned and reclaims them. Don't repurpose them or stop granting them.

87. **The difficulty dial tracks progression, one world level per ascension band** (2026-08-14). `ENEMY_LEVEL_PER_DIFFICULTY` 8 → **25**. At 8 the dial covered 41% growth (WL1 1.000x → WL4 1.407x) while a player covers 116% (Lv1/asc0 1.000x → Lv40/asc3 2.159x), so **the hardest setting in the game was relatively easier for a maxed account than WL1 is for a fresh one** — and the constant's own comment claimed WL4 was "roughly a fully-ascended Lv40 roster's match", wrong by 53%. Now WL2 1.424x / WL3 1.847x / WL4 2.000x against player bands of 1.490 / 1.824 / 2.159.

    **WL4 clamps and that is fine.** It asks for enemy level 76; `levelMultiplier` stops paying at `LEVEL_CAP` 60, so a maxed roster still sits 8% above the hardest setting. Closing that needs enemies to carry an **ascension** term, not a bigger step here — deliberately not built. Pinned by `tests/accountRank.test.ts`.

    Note what this does *not* touch: **story has no difficulty scaling at all** and is not getting any. Tanveer, 2026-08-14: story fights get harder as the story progresses, authored at base 1x — *"so maybe in the future, everything would just scale easier if we happen to add difficulty multipliers in the story."* `effectiveDifficulty` and `baseDifficultyForPart` stay as unwired scaffolding for that future, exactly as before.

88. **Gacha manual tiers are weighted 60/30/10, and the economy audit had a hole** (2026-08-14). The summon miss table (`rollLimitedPull`) resolves 95% of pulls into thirds — coin, a levelling manual, a specialty material — and the manual third was a **uniform** split across all three tiers. `docs/design/ECONOMY_AUDIT.md` sized the entire levelling grind without ever opening `lib/gacha/pull.ts`, so the game's largest manual and coin faucet was missing from every total in it.

    Measured: a pull was worth a mean 500 XP per manual roll, so the **220 pulls a starter's 1,000 gems buy paid ~34,800 XP — more than every one-time source in the game combined** (23,700), and a lifetime's 660 pulls paid 104,500 XP, *more than a whole character's Lv1→Lv40 climb*. Premium Manuals (1,000 XP, the biggest XP item in the game) had the miss table as their only source at a 1-in-3 miss.

    At 60/30/10 a manual roll averages 280 XP: starter 19,500, lifetime 58,500. The headline finding survives — 780 manuals to Lv40 still dwarfs any single source and the Lv40 wall is intact — but the **first ascension band is much softer than the audit implied**, because summoning pays for it. Read this before quoting ruling #86's "don't put Advanced Manuals in the tier-1 farm" as keeping the high tiers scarce; the summon table is already their main door.

89. **Parked, not orphaned — four things the next audit must not re-flag** (2026-08-14). All confirmed by Tanveer as future work with a home already chosen:
    - **The six Collab kits** (Ban, Diane, Meliodas, Gon, Killua, Leorio) have no acquisition path and appear in zero story content — two of them measure top-3 in damage. Coming via **a dedicated limited gacha banner plus a special story part**. Do not flag them onto the gem banner or the `permanentPool` in the meantime.
    - **The four local specialty materials** (Riverstone Fragment, Scorched Ember, Bramble Thorn, Prism Dust) are a third of every summon miss and are consumed by **nothing**. They belong to the **shop update**, same as Permanent Tickets (#86).
    - **No fight in the game has more than 2 enemies** — 15 of 18 have exactly one, and none has 3+ — which leaves ~10 authored enemy-facing AoE payloads with almost nothing to hit (Diane's ultimate goes 1,776 → 5,328 across three targets). More PVE content is in progress; the gap closes with content, not with kit changes.
    - **Three ultimates deal less than their own rank-3 card at a single target**: Gabrist (350 vs 455), Master Tao (635 vs 635), Siddiq (445 vs 600), measured through `executeSkill` against Molvarr P1. All three trade damage for spread or utility. Pinned as a known list by `tests/balance.test.ts` — **a kit JOINING that list is a new ruling-#2 break and wants a decision before it ships.**

    Also settled the same day: `lib/game/balance.ts`'s ultimate check was wrong twice over and disagreed with five of the eighteen shipped kits. It counted a **heal's** percentage as a damage skill to beat (Siddiq's 680% heal), and ignored **ruling #22** — an ultimate that self-buffs before it strikes benefits on the same hit, which is why Chiara's 333% out-damages her 400% card and Mustafa's 225% out-damages his 250%. Both false positives are gone; the three real ones remain.

90. **Molvarr audit — what the fight is, and one correction to #73** (2026-08-14). Measured with a faithful turn loop (real enemy deck with merges, correct tick order, buff expiry, AI playing from a hand), not by multiplying numbers on paper.

    **Ruling #73's stated mechanism does not exist in the data.** It records the P2 corrosion nerf as *"every corrosion stack also feeds Growing Malice, so applying a stack per player per turn compounded the boss's own ATK into the four-figure ultimate."* **Growing Malice is a P1 passive; Corrosive Tide is a P2 passive.** They are never active at the same time — P2's ATK sits flat at 400 for the whole phase. The nerf still landed, but not for that reason, and it cut the phase's *smallest* damage source. What actually built the four-figure ultimate is **Iron Carapace**: the SP's +30% ATK and Tidal Cataclysm's gauge cycle drift in and out of sync, and an ult on a buffed turn rides 520 ATK instead of 400. Tanveer, told this: Iron Carapace is fine as it stands — it used to read "greatly raises" (50%) and 30% is the already-nerfed version.

    **Corrosion is Phase 1's damage, not Phase 2's.** Full-fight damage composition, DoT + passive as a share of total: **P1 vs Lv40 48%**, P2 vs Lv40 13%, P1 vs Lv1 23%, P2 vs Lv1 2%. Corrosive Surge at R3 flips the tick to a max-HP basis, so it is the one mechanic in the fight that gets *better* as the player invests. Tanveer's own read, before seeing the numbers: *"the only thing to worry about is the Corrosive Surge and his passive synergy."*

    **Confirmed as intended, no change:**
    - **The turn-10 passives are a stall fail-safe.** Sunken Awakening and Drowning Depths count `phaseTurn`, so P2 would need ten turns of its own and never gets them. *"They are meant to punish players who stall the fight unnecessarily. its like a fail safe if you will. its fine if it doesn't fire even during testing."* Do not lower the threshold or switch them to global turns.
    - **Concentrate on Abyssal Convergence** (×1.1 at 3 targets, ×1.5 at 1) is deliberate: *"this encourages the players to survive P1 with a full team rather than barely clinging on with 1 or 2 units."*
    - **Corrosive Surge applies exactly 1 Corrosion instance at every rank** — only the *duration* ranks up (`[1,1,2]`), plus the R3 switch from current-HP to max-HP basis. Verified: the mechanic authors no `stacks`, and `maxHpBasis = rankIndex === 2 || ultimate`.
    - **Growing Malice counts independent debuff instances across the enemy team**, same nature or not — 3 players × 2 debuffs = +30% ATK. Latent gap worth knowing: `totalDebuffStacks` sums each entry's `stacks` field, so a *single* entry carrying `stacks: 3` would count as 3. Nothing that can land on the player team does that today, and ruling #77's UI counter counts entries, so the two would disagree if one ever did.

    **Fixed:** Growing Malice leaked ATK. `recomputeDebuffAtk` adjusted by `floor(atk * (new - old) / 100)`, and `Math.floor` rounds a negative away from zero — at 285 base, +5% added 14 while −5% subtracted 15, so every debuff that appeared and expired cost the boss 1 ATK permanently (a traced P1 run decayed 285 → 299 → 284 → 298 → 283). Now rebuilt from base, so a given debuff count always yields the same ATK whichever direction it was reached from. Pinned by two tests in `tests/bossPassives.test.ts` — both verified to fail against the old arithmetic.

91. **Molvarr P1 8500 / P2 10000, SP every 2nd turn** (2026-08-14, supersedes the HP figures in #68). The problem was never difficulty — it was that **the boss never got to use its kit**. At WL1 a Lv20+ team broke P1 on turn 2, so Ancient Rhythm (every 3rd turn) and Sunken Verdict never fired; a player's first several clears showed them almost none of the fight. Raising HP alone could not fix it — the break turn plateaued at 2.9 even at 13,000 HP, because the player ramps as the fight runs (merges raise card ranks, ults come online). The cadence was the lever.

    Measured after: P1's SP fires in **10/10** runs for every team except a maxed trio (which still breaks P1 on turn 2 at WL1 and sees it at WL2 instead). Costs: a Lv1 trio's WL1 win rate fell 7/10 → 4/10, and farm runs are ~40% longer. **Both phases** run every-2 — Tanveer's call, knowing P2's SP is a self-buff and therefore a straight boss buff where P1's is a heal.

    Story part 9 fights the same kit and inherits all of it, since story has no difficulty scaling.

92. **Dupes pay coins; ultimates carry an authored six-value ladder** (2026-08-14). Two halves of one system, replacing the old "a dupe silently bumps `ultLevel`, capped at 6, and a 7th copy evaporates" behaviour.
    - **Coins are character-exclusive**, `{color}_{id}_coin`. *"only a char's duplicate copy aka their exclusive coins can be used to level up the ultimate too. can't just use any other char's coin."* One coin per level, **five to max** — six copies including the one that unlocked them. Excess banks for the shop. Colour is in the id on purpose: *"in the future i may add color variant of existing characters so it would be good this way."*
    - **Ult levels behave like skill ranks.** Tanveer: *"assume ult levels work in a similar fashion to skill ranks. only difference being that ult level are increased via growth system and only one of 6 values comes to the battle based on that."* So `damageByUltLevel` is indexed exactly as `damageRanked` is, and mechanics gained matching `*ByUltLevel` ladders plus `minUltLevel`.
    - **He re-authored every ultimate's base value at the same time**, knowing it re-balances the roster: *"i had OG ult numbers not factoring ult dupe system... Also i am aware some characters will get a buff or nerf."* Level 1 is deliberately **below** the old flat figure (Duke 500 → 350→575, Meliodas 700 → 450→700).
    - **Consequence for ruling #2:** an ultimate is no longer stronger than a rank-3 card *at ult level 1*. Ruling #2 is now read at the **top** of the ladder, and `balance.ts` compares there. On that basis only **Gabrist** still fails — his ult maxes at 450 and his rank-3 Masterpiece Unveiled is also 450, so it never overtakes his own card. Open question, not a defect.
    - **Isolde is the reason mechanics ladder at all.** Her ultimate deals 0 damage (ruling #61), so a damage ladder is worthless to her; her ult levels move the buff instead — Debuff Immunity from UL3, and a basic-stat ladder. *(The figures once quoted here were re-authored 2026-08-19 and are deliberately not restated: `data/characters/isolde.json` is the source of truth, per this ledger's own header and ruling #5. The description was static until that date and rendered none of the ladder — it also promised Debuff Immunity at UL1–2, where `minUltLevel` grants none. Now conditional; see `.claude/skills/kitwords/EXAMPLES.md`.)* Note this also moved her from `stat: "all"` to basic stats, which is a **nerf that arrived as a side effect** of the rewrite rather than as its own decision — her data and description had disagreed since before this session.
    - **Why level 1 is weak is the point**, per Tanveer: *"the initial ult weakness is a necessary problem to have for a gacha game... makes players summon more to max out their fav character or just general overall account power growth."*
    - Migration v8 → v9 resets every ult level to 1 and refunds one coin per banked level, on both the local and the cloud path.

93. **A story lead the player owns must never be worse than the loaner** (2026-08-14). `trialLevel` applied only to units outside the roster, so pulling a story lead made their chapter *harder* — part 9 handed a non-owner a levelled Duke while an owner who hadn't levelled him fought at 1.000x and lost every run. Tanveer: *"most of the other similar games also do provide 'trial' versions for the character for required story or PVE content. we are just doing the same thing here."* Owned anchors are now toggleable on the brief and **default to whichever version is stronger**.

    **A trial level needs a trial ascension.** `maxLevelForAscension` caps ascension 0 at level 1, so `trialLevel: 20` alone describes a unit nobody could own — 1.322x against a real Lv20's 1.489x. Author `trialAscension` alongside it whenever a chapter means "hand them a proper Lv N character". Part 9 is **Lv20 / asc1**.

94. ~~Story stages are going node-based, Dokkan-style.~~ **Retired 2026-08-19 — superseded by #108.** The direction was abandoned before it stabilised; boards and tiles no longer exist in any form.

95. **Story interstitials: timers on anticipation, manual on arrival** (2026-08-16). The three cards between the index and the rewards had three different ways out — the title card auto-advanced at 1400ms, the versus splash at 1600ms, and the complete card had a button and nothing else. Unified so **all three accept a tap anywhere**, while only title and versus keep their timer. The asymmetry is the ruling, not an oversight: those two are *anticipation* — the player is waiting for something to start, so moving them along is a courtesy — while the complete card is *arrival*, with a reward behind it, and rushing the beat the player just earned is the one place a timer would be rude. Cost of the alternative (manual everywhere) was one extra tap per farm run, since a farm run sets `skipScenes` and never renders the title card at all.

96. ~~The chapter brief's fact strip carries the team rule, not the scene count.~~ **Retired 2026-08-19 — the screen it governs was deleted (#108).** `StageBrief` replaced it and has no fact strip.

97. **A cleared chapter must offer somewhere to go** (2026-08-16). Two dead ends closed. **Rewards** used to return to the index unconditionally, so clearing chapter 3 meant finding chapter 4 yourself — every clear paid that tax. It now names the next chapter, but **only after a first clear**: `buildStoryIndexView(completed).current` tracks the player's furthest point, so offering it after a *replay* would advertise a jump to wherever they actually are, which reads as a bug rather than a shortcut. Replays keep the plain return, mirroring how `finishChapter` already gives first clears the completion beat and sends replays straight to rewards. **Defeat** could only retry with the identical team; losing *because* the team was wrong cost a four-step detour through the index. `BattleEndHandlers` gained an optional `onChangeTeam`, absent on the world-boss route, which has no pre-fight screen to return to.

98. ~~Story mode is five screens, mobile-first at 9:16.~~ **Retired 2026-08-19 — superseded by #108**, which also reversed the `SnapCarousel` half. The 9:16 instruction survives, generalised project-wide, as #107.

99. **A part appears only once the previous part is complete** (2026-08-17). *"you can't see Part 2 if Part 1 isn't complete yet."* Already what `isPartUnlocked` computes, so it cost a filter rather than new arithmetic: `visibleParts()` is `buildStoryIndex` minus sealed, newest first. **Sealed parts are withheld, not redacted** — the carousel renders one full banner per entry, and a `StoryIndexPart` carries a real title, tagline and `coverCharacterId` even when sealed (part 9's cover is `molvarr`), so the list itself has to be the spoiler boundary. Chapter *rows* keep the old fixed-width redaction, which still applies inside a visible part.

100. **Every story attempt costs stamina** (2026-08-17, **retires the 2026-08-09 ruling**). *"we are charging sta for story now. all of them. first try and reattempts all cost sta."* The older rule kept uncleared chapters free however many times they were retried, so the narrative could never be stamina-locked; it can be now, and he confirmed that after it was flagged. `storyAttemptCost(rewards)` lost its `cleared` argument. A chapter authored at `replayStamina: 0` is still free.

101. ~~A chapter is a route walked with three orbs.~~ **Retired 2026-08-19 — superseded by #108.** Orbs, tiles, STOP nodes and restart-on-defeat all went with the board. Waves replaced them as the run structure.

102. ~~Board shape is geography, not difficulty.~~ **Retired 2026-08-19 — superseded by #108.** Boards no longer exist. His framing (*"length based on what the story needs"*) survives in spirit as stage count per chapter, which #108 deliberately leaves unfixed for the same reason.

103. **HP persistence across tiles was decided, then became moot** (2026-08-17). He ruled HP **persists** between tiles, HP only, with a downed unit out for the rest of the run and a wipe restarting the route — and that ruling stands. But with **one fight per board** nothing survives between tiles, so `BattleProvider` was never touched and the surviving-HP handoff was never built. Recorded because the plan's riskiest item disappearing is exactly the kind of thing a future session would otherwise rebuild: it is needed the moment a board carries a second fight, and not before.

104. **The chapter ribbon is a real reward, not a mission counter** (2026-08-17). The reference shows `COMPLETE!` / `19/20` per stage — a per-chapter mission count. We have no objective system, and inventing one costs a `storyStore` migration whose merge rule doesn't generalise (`completed` merges as a union of booleans; counts don't). He delegated the call; the slot is bound to **Bureau Orders that name a chapter** instead — `◈ LYRA` on `part2/p2c2`, `◈ 125 Gems` on `part4/p4c3` — dimmed once claimed, absent where there is nothing. Beyond parity this fixed a live gap: the free Lyra was invisible from story mode, reachable only through a nav modal. The slot stays mission-counter-shaped so real objectives drop in later without a layout change.

105. **Story content adaptation is workflow part 2** (2026-08-17). *"first was story UI UX overhaul. 2nd is story content adaption for game."* Trimmed 2026-08-19 — the counted facts behind it (19 of 37 chapters without a battle, parts with no fight at all) described the Part/Chapter structure deleted by #108, and the no-invented-battles rule it fought was lifted by the same ruling.

    **What survives, and still blocks work:** **`storyOnly` enemy stat bands are unassigned** at `docs/design/KIT_DESIGN.md:83`, and every new filler enemy kit waits on them — chapter 1's `wild_beast` included. That is his to fill in. The third blocker, a story canon/voice doc, is now answered by the `FillerAssist` skill reading `Master_Context.md` directly.

106. **Mockups are HTML files, and art requests need no permission** (2026-08-17). Two working-style rulings. *"next time, you can open that mockup in the browser or html file okay?"* — design proposals go in a self-contained HTML file rendered in the game's real palette and fonts, not an inline chat widget, because he does the visual judging and a file survives the conversation. And: *"if you think we can use a custom asset (image asset) for something then you don't have to ask me to call comfypending skill to put the requested item into the list"* — append to `docs/ART_REQUESTS.md` directly whenever art would help, mentioning it in the reply rather than asking first.

107. **Mobile first, desktop second — project-wide** (2026-08-18). *"must be mobile first and desktop second. most of the player who are willing to try out my game would play on mobile so keep that in mind."* Said while approving the story-mode rebuild, and deliberately recorded as a **global** rule rather than a story-mode preference, which is why it also sits in `AGENTS.md` where every session inherits it.

    The operative parts: design canvas **390×844**; desktop is the same column centred at a capped width with adornment around it, **not** a re-laid-out wide variant; **`dvh` never `vh`** (Tailwind 4 compiles `screen` to `100vh`, the largest viewport — this already made every story document taller than the visible area with browser chrome showing); touch targets **≥44px** with primaries in the thumb-reachable lower third; nothing important behind a hover; one vertical scroll per screen. **Phone width is verified first** — a break at 390px is a blocker, one at 1440px is a bug.

    What it does *not* claim: the game is not mobile-first today. Battle, gacha, archive and the hub were built desktop-first and this ruling turns that into **named debt**, not a fix. The 2026-08-17 story pass at 9:16 was the first down-payment; story mode v2 is the first surface built the right way round from the start.

    **Pinned 2026-08-19** by `tests/viewportUnits.test.ts`. Verified against the installed toolchain rather than assumed: Tailwind 4.3.2 compiles `min-h-screen` to `min-height: 100vh`. The fifteen occurrences across eleven files were swapped to `min-h-dvh` the same day.

108. **Story mode is Chapter → Stage, and v1 was deleted rather than refactored** (2026-08-18). One day after the carousel/board rebuild shipped, Tanveer: *"assume our existing story mode doesn't exist at all. i am not planning to recycle anything. its trash for me. it hurts me but that's the truth."* So this ruling replaces the v1 story structure. **Corrected 2026-08-19:** it originally claimed to supersede **#94** and **#98–#105** *wholesale*, and that range was too wide — four of those rulings govern code that survived the rebuild and a session discarding them would be wrong. What it actually retires is **#94, #98, #101, #102** (and #96, from the same design), now tombstoned. **Still live:** **#99** (a chapter appears only once the previous one is clear — reworded from parts to chapters, pinned by `tests/storyCatalog.test.ts`), **#100** (every attempt costs stamina), **#103** (HP persists between waves — this rebuild is where it finally got built, pinned by `tests/stageRun.test.ts`), **#104** (a Bureau Order naming a stage still renders on it — `ordersForStage`, read at `app/story/page.tsx:459`), and the surviving half of **#105**. What follows is the shape he specified, with the decisions he made when asked.

    - **Chapter = one webtoon chapter** (1:1 with `Chapter N.md`), **Stage = one playable unit** inside it (`1-1`, `1-2`, …). The Part → Chapter naming is gone: it made the unit a player calls a chapter into a *beat*, so nothing on screen matched the source.
    - **Stage count per chapter is not fixed** — *"depends on story and filler content"*. The schema enforces contiguous numbering only.
    - **Waves.** A battle stage runs 1–3 consecutive fights where **HP carries over and the fallen stay down** — which is ruling **#103** finally built, after it evaporated under the one-fight-per-board design. This is the mode's decision layer, and it is what makes heals, DR, cleanses and the sub slot matter.
    - **No board, no orbs, no dice.** Movement was fake agency: a single path, one resolving tile, 1–6 rolls across empty ground.
    - **Missions**: up to 3 per stage, optional, one-time, paying a fixed bundle. Seven goal types (`noLosses`, `withinTurns`, `fieldCharacter`, `fieldTag`, `useUltimates`, `firstAttempt`, `allWaves`). He assigns them **chapter by chapter** in a FillerAssist session. **An unmet mission is never lost** — it reads STILL OPEN and stays claimable forever, so no stage becomes content a player can no longer finish.
    - **Rewards** keep ruling #80's split: fixed first-clear bundle, plus a deliberately thin farm table (*"very low farmable stuff"*) of coin and basic manuals. The farm shape has no field for gems or Permanent Tickets, so rulings #47/#80 are enforced structurally rather than by a test someone has to remember.
    - **No Auto Clear for story, at all.** His words. A test asserts no `autoClearEligible` event names a story chapter or stage, so generalising the ticket later can't quietly include story.
    - **`origin: "canon" | "filler"` on every stage and scene.** Filler is tagged in the data, not tracked in a doc: what's invented stays auditable, a canon retcon can strip it mechanically, and his approval pass has something to read.
    - **Old story progress is dropped**, his call — *"yeah drop the old story progress. no issues."* The old keys named beats of a structure that no longer exists, so mapping them forward would be inventing a correspondence. Cost, flagged before he agreed: first-clear bundles become claimable again on an existing save.
    - **`challenge` stages: not built.** *"don't build yet. we will think about it later."* Deliberately absent from the union rather than present and unused (ruling #83).
    - **The existing team and preset picker are reused as-is**, his instruction — `TeamPicker` + `teamPresets` are untouched by the rebuild.
    - **Battle UI's own mobile pass is a separate dedicated session**, his call, and is not part of story work (`docs/ROADMAP.md`).

    **What survived from v1, because it was generic rather than story-shaped:** `storyTeam.ts`'s trial-vs-owned rules (#93), `storyRewards`'s payout roller, the VN reader internals, `VersusSplash`, `ChapterTitleCard`, `StoryStage`, `stageEffects`, `victoryAtEnemyHpPercent`. **`SnapCarousel` did not** — a list heading toward 24 chapters is scanned, and centring one item hides its neighbours behind a fling. That reverses part of #98 and is flagged for him.

    **Filler is now allowed, under approval.** He lifted the no-invented-content rule recorded at `lib/game/storyCatalog.ts:36` (ruling #105's first blocker): Claude may draft filler stages, scenes and NPCs, but **nothing enters the game unapproved**, and **NPC kit numbers stay his** — the draft states role, personality and combat concept and asks. The record lives in `Filler/Drafts.md` and `Filler/Approved_chapter_N.md`, and a **`FillerAssist` skill** will carry the workflow; it must be able to write `data/story/chapter-N.json` itself, not just the docs. Chapter 1's three fights are drafted and awaiting that pass. One canon call already made and worth keeping: **the village raid is not a playable fight** — canon says Duke was away when it happened, so `1-2` is a wilderness fight instead.

109. **A tier word names one exact value — it is never a threshold** (2026-08-19, amends #26, #56 and #58). Shown that Chiara's ultimate raised evade by 33% under the word "Raises", Tanveer: *"that's the problem. 'raises' MUST be 30%. it can't fluctuate, even by 1%. If i allow it, next time you would propose 'greatly raises' to accept even 55%. Nope."*

    **The scale, as exact values:** raising **30 / 50 / 100**, lowering **30 / 50 / 80**. Nothing in between wears the word.

    **Off-scale values are not forbidden — they are written differently.** His wording: *"we can use the wording 'increases/decreases by' when dealing with non tier worded numbers."* So "Increases ATK and evade chance by 33% for 3 turns" states the number in the text. This is the form Leorio's support ladder already used (20/30/50, "increases their ATK and DEF by `[buff.value]`%"), now the general rule rather than one skill's exception.

    **A consequence worth knowing: the explicit form gets no hover pill.** A pill exists to reveal a number the tier word hides (#26). Nothing is hidden, so `tierWord` returns undefined off-scale and `buildSkillKeywordGlossary` skips the entry.

    **This subsumes #58's ladder rule.** A ladder cannot step inside one tier word if every tier-worded value must be exact.

    **Roster audit at the time of the ruling:** 27 kits, and **Chiara's evade 33 was the only off-scale value in the game** — every other buff and debuff already sat exactly on 30/50/100/80. The rule codified what the roster already did.

    **Chiara's All In, resolved.** He had intended both ATK and evade at 33%; the ATK entry entered the repo as 30 in the kit's very first commit (`f864af9`) and was never 33. The original description stated both numbers explicitly and the mismatch was visible; `dcd1700` converted it to a tier word, and one "Raises" swallowed two different values — which is why it went unfixed for months. **Explicit percentages are self-checking; tier words are not.** Now one entry, `stats: ["atk","evade"]` at 33, reading "Increases ATK and evade chance by `[buff.value]`% for `[buff.duration]` turns". Merging is sound because `substats.ts` and `stats.ts` share `entryAffectsStat`, so a single entry multiplies the basic stat and adds points to the substat, each correctly (#55).

    **Pinned** by `tests/kitDescriptionRules.test.ts` (roster-wide: no value under a tier word is off-scale) and `tests/descriptionTranslator.test.ts` (the renderer builds no pill for an off-scale value). The translator test previously asserted that 85% up rendered "greatly raises" — the exact drift this ruling exists to stop.

    **Also fixed the same day:** `STAT_LABELS` in the translator was missing every substat, so a pill covering one read "EVADE" instead of "evade chance" and its combined key could never match the sentence it was built for. It is deliberately still separate from `STAT_WORD` in `stats.ts`, which is battle-log voice and calls `damageReduction` "damage taken".

110. **"No comma, no perma" — permanence is shown by scope, not stated** (2026-08-19, reverses the permanence half of #28). Shown Gon's ultimate rendering *"Permanently raises ATK, greatly raises DEF for 1 turn…"*, Tanveer: *"we don't need 'permanently' in the description. it should be how i typed in the examples earlier. players will notice this on their own."*

    **The mechanism.** Clauses are authored with semicolons and rendered as prose by `joinClausesAsProse` — two clauses become "A and B", three or more become "A, B and C". **So a comma in the rendered text is a clause boundary**, and a duration binds only the clause it sits in. A stat change whose clause carries no duration is permanent, and cancel-proof (#37).

    **What the mnemonic warns about.** If one stat is meant to be permanent and another durationed, they must be **separate clauses** — which is what puts the comma there. Join them with "and" inside one clause and the trailing duration swallows both, silently turning a permanent buff into a one-turn one. His two examples:

    - *"Greatly raises ATK, greatly raises DEF for 1 turn and does X damage"* — **two** effects. ATK is permanent; the 1 turn reaches DEF only.
    - *"Greatly raises ATK and DEF for 1 turn and does X damage"* — **one** effect, `stats: ["atk","def"]`, both expiring together.

    **The mnemonic only bites when a duration is present.** Killua's ultimate reads "Raises ATK and DEF and then does damage" — no comma, and still permanent, because there is no duration anywhere in the clause to swallow it. Absence of a duration is the signal; the comma is what protects one clause from another's.

    **Roster check at the time of the ruling:** the only undurationed stat changes in the game are Gon's ATK and Killua's ATK+DEF. Both now read without the word.

    **Permanence is a buff-side rule only** (2026-08-20). Asked whether an undurationed *debuff* reads as permanent the same way — two Dokkan cards end "and lowers DEF" with no duration — Tanveer chose the opposite: **a debuff must always state a duration**, enforced at load rather than defaulted. So there is no such thing as a permanent debuff, and an old source omitting the turn count is era convention, not intent. Zero shipped kits are affected; every debuff in the game already carries one, so this is a guard against a future author rather than a migration.

    **The word is gone from the pill keys too, and had to be.** `buildSkillKeywordGlossary` prefixed an undurationed entry's key with `permanently `, so stripping the word from the description alone would have left every permanent buff with a key that no longer matched its own text — losing the hover pill entirely. Keys are now the bare tier word. Gon's ultimate yields exactly two pills, "raises atk" → *Increases ATK by 30%* and "greatly raises def" → *Increases DEF by 50%*, with **no duration in either** — his instruction, and consistent with #26: the tooltip shows the percentage, the text owns the duration.

    Note the pills now share a substring ("raises" inside "greatly raises") where before they did not. That is fine and must not be "fixed": they sit at different positions, and `extractKeywordFootnotes` matches longest-first without overlapping, so one span can never produce two pills.

    Recorded with the worked examples in `.claude/skills/kitwords/EXAMPLES.md`.

111. **[Guard] and [Effective] are a paired type-matchup override** (2026-08-20). Designed on 2026-08-20 — *"we don't have to add that in our db yet"* — and **built 2026-08-20** as `resolveTypeModifier` (`lib/game/typeAdvantage.ts`), read by `damage.ts`. **No kit authors either word yet**, which is the half of his instruction that still holds: the capability exists, the roster does not use it, and putting it on a card is his call.

    Two mirrored mechanics that overrule the type chart (#11) without touching colours:

    - **Guard**, on the **defender**: *"a char with 'guards all attacks' always takes less damage as if it (defender) is type advantaged to the attacker, regardless of char's element color."* So the attacker's multiplier is forced to the disadvantaged value.
    - **Effective**, on the **attacker**: *"'attacks effective against all types' meaning it (attacker) will do type neutral damage as worst, never disadvantage. still will do type advantage damage to disadvantaged elements."* So the multiplier is floored at neutral, and a real advantage still pays.

    **They cancel.** *"Unless said disadvantaged element char has guard. in that case, it would be type neutral for it too."*

    | Attacker has Effective | Defender has Guard | Type multiplier |
    |---|---|---|
    | no | no | the chart: **1.2 / 1.0 / 0.9** |
    | no | yes | **0.9**, whatever the colours |
    | yes | no | **max(chart, 1.0)** — never 0.9, still 1.2 where earned |
    | yes | yes | **1.0** |

    **Effective is not `critical`** — his correction, and worth keeping because the two look similar from the outside. `critical` *ignores* the matchup in both directions and carries a whole package with it (50% DEF ignore, crit damage, #16). Effective **keeps** the matchup and only removes its downside.

    **Where it lives:** `resolveTypeModifier` in `lib/game/typeAdvantage.ts`, called from the `!criticalMechanic` branch of `damage.ts` — which is what makes "critical bypasses both" fall out for free rather than needing a guard of its own. `getTypeModifier` stays the raw chart lookup, because #11 quotes it as the plain matchup.

    **Guard is no protection against a crit.** Deliberate, not an oversight — say so in whatever UI copy explains Guard, or players will read it as a bug.

    **Open:** do two sources of Guard stack, or is it a fixed floor? Built as a fixed floor (a second source changes nothing), because the effect is a floor rather than a magnitude. Unconfirmed by him.

112. **A mechanic declares who it hits, and silence means self** (2026-08-20). *"you will need to factor in caster and its team alongside target enemy during skill or ult uses. so that buffs or debuffs hit specific parties rather than mix n match."*

    Every mechanic may carry `applyTo` — `self`, `oneAlly`, `allies`, `alliesExceptSelf`, `enemies` — or `applyToRanked` for an audience that widens with rank. **Absent means self**: *"it wouldn't say allies if the default is self only."* That **inverts** the old fallback, where a friendly mechanic without `targetSelf` inherited whoever the skill targeted, so the six kits that leaned on inference now declare it in their JSON (isolde ×4, leorio, mustafa, prism, siddiq; iron's Iron Wall becomes the self stance it was meant to be).

    How it reads on the card: *"if it targets allies including the caster then only 'allies' otherwise 'allies (excluding self)'."* Ally breadth lives in the value (`oneAlly` vs `allies`); enemy breadth stays in `aoe`, which means *"all present enemies on the field. (sub enemy who's not on field yet wouldn't count)"*.

    Leorio's ladders by rank — *"a chosen ally at R1 yes. then friendly AOE or 'allies' (not allies (excluding himself)) at R2+"* — as `applyToRanked: ["oneAlly", "allies", "allies"]`.

    **Deferred, and stated so it is not mistaken for an oversight:** `aoe` does **not** yet narrow to enemies-only on support skills. A heal skill's targets still come from `aoe` + skill type, because the heal amount has no audience of its own; narrowing `aoe` first would leave every ally heal aimed at the enemy team. `aoeRanked` likewise stays on Leorio and Siddiq rather than retiring.

113. **"Damage first, then the buff" is a real order, not phrasing** (2026-08-20). *"damage needs to be done to enemy first before the self buff activates. it is different than buff first and then do damage."*

    Default stays #22 — a self buff applies before the damage calc and the same strike benefits. A mechanic declaring `requiresDamage: true` moves after the hit **and becomes conditional on connecting**: *"the nulled or evasion from enemy will not activate the self buff for the caster."* A tanked hit (#71) and an evaded one grant nothing; a hit that kills still counts.

    On an AoE it arms once and applies once: *"as long as atleast 1 enemy is hit, the self buff would activate. but multiple instances of enemy hit by same attack wouldn't cause multiple self buffs activating."*

    It matters wherever the skill scales off the stat being raised — a DEF-scaled attack with a self-DEF buff boosts its own damage. Mustafa's Tea Time Tremor is exactly that shape, ships unflagged, and is unchanged.

114. **One passive, made of blocks** (2026-08-20). *"Keep it the dokkan way. it basically is a single but possibly long passive. this means molvarr passives can be combined into one per phase too."*

    A passive is a list of blocks, each with its own trigger, mechanics and `#` heading, so "ATK up always, plus more when attacking a [Demon]" is one passive rather than two. The single-trigger shorthand (`trigger` + `mechanics`) is one block and stays valid — every shipped kit authors it that way. Registration is per block, so a passive can now fire at two different phases.

    - **`worksFromSub` stays per passive**, not per block — *"stays per passive."*
    - **Unconditional effects are headed `# Basic effects`** — *"'always' block can be renamed to 'basic effects' block i guess. much more generalized but simple."* (The UI previously printed "Basic effect(s)".)

115. **Light and dark are premium** (2026-08-21). *"light and dark are premium and don't try to fill them up unless i request it."*

    Generic story enemies take **red, blue or green**. A gap in the type chart is not a reason to spend a premium colour — the chapter-1 checkpoint kits were originally proposed with a light-coloured leader to close the light hole and were rebuilt red. `tests/checkpointKits.test.ts` asserts it for that set. Existing dark-coloured mobs (`road_bandit`, `iron`) predate the ruling and stay.

116. **The enemy side only ever plays Rank 1** (2026-08-21, engine fact he pushed back into the open). *"you are assuming all things activating at R3, aka worst case possible."*

    `initializeEnemyDeck` builds the enemy hand with `initialCardsFor` — one R1 card per skill — and the AI never merges. The only rank-up path in the codebase is `rankUpOwnDeck` (Chiara). So **R1 is the only rank an enemy kit actually ships**; R2/R3 exist in the JSON for completeness and are unreachable without a stage effect that ranks enemies up.

    Two consequences worth holding onto:

    - **Cost an enemy kit at R1**, not at its top row. A balance read taken off the R3 sheet is a read of a card that cannot be dealt.
    - **Three enemies share three actions**, not three each (`actionsForTurn`, capped at 3 both sides). A wave that wants to buff twice and attack has spent its whole turn.

117. **A dying unit can pay its team** (2026-08-21). The `onDefeat` passive trigger, added for the Checkpoint Bruiser's *"when this character is defeated, heal all allies."*

    Applies to the owner's **own team only** — a legacy, not a revenge strike; a dying unit that hurts its killer would be a different trigger. Runs as a post-pass over both teams from `executeSkill` and from the DoT tick, because a unit can die in more than one place and wiring the same effect into each is how one of them ends up missing it. Fires once per unit, guarded by `passiveState`, since a corpse stays on the field until turn-start cleanup.
    - **Conditions may read the target's tags.** *"just assume it would target a tag such as 'Powerful Opponent' or something instead of extreme class enemy."* Keyed on an authored tag, never derived from `tier: "elite"` — *"'tier' or 'elite' is not a tag. its an enemy type I guess."* Symmetric by construction, so *"what if an enemy does extra damage against 'human' characters?"* needs no extra code.
    - **No collision on a shared tag string**, because a tag is a property of the character: *"Human Fairy Hybrid Female Powerful Opponent tags. her npc version would also carry those. simple."* Seras's synergy reads her teammates' tags; a boss-facing condition reads the target's. Both readings are true at once (amends #54).

    **Not built, and on his roadmap rather than a gap** — *"this mechanic will definitely come in the future. just our game isn't complex at this point. baby steps."* The highest-value missing piece is **counting the character's own attacks**: `statShiftAfterAttacks` and `chargedStacks` count attacks *received*, `momentumStacks` counts cards the *team* plays, and nothing counts what this character did.

    **CRITICAL bypasses both** (his answer, 2026-08-20): *"critical is seperate mechanic. it ignores all types and does bonus damage based on critdamage. bypasses guard too."* So `critical` stays exactly as `damage.ts:84` has it — the matchup, Guard and Effective are all skipped, and crit damage applies instead. **Guard therefore offers no protection against a crit**, which is a deliberate consequence, not an oversight.

    **The cancellation rule holds in every combination** — 1.0 whenever both are present, including where the attacker was already disadvantaged. Confirmed, but *lightly*: his answer was "uh yes. i guess." Treat it as settled enough to build and worth re-asking if it ever feels wrong in play, rather than as a conviction like #109.

    Full spec: `Plans/2026-08-20-guard-and-effective.md`.

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

**Built and working:** battle engine, 27 kits, **story mode v2** (Chapter → Stage with waves, missions and split rewards — chapter 1 authored, the rest to come one at a time), archive, auth + Firestore saves, battle cinematics, Molvarr world boss, ult levels + character coins, leveling/ascension/stamina/inventory, gacha (summon/banners/milestone pity/dupes), Bureau Orders + Auto Clear (world boss only), `/news` MDX patch notes. `npm run check` green — **1218 tests across 95 files**, clean `next build` (48 routes). *(This line read "723 tests across 62 files" and "story Parts 1–2" until 2026-08-18 — four sessions of work had landed without it being touched. Verify counts by running `npm run check` rather than quoting this line.)*

**Still missing (the whole gap):** audio, mobile layout pass, FTUE/tutorial, daily loop, analytics, deployment. `docs/PRODUCT_AUDIT.md` is the standing analysis — the fight is strong, the service layer around it is thin.

**Last completed work — story mode v2, rebuilt from scratch (2026-08-18).** Chapter → Stage, waves with carried HP, per-stage missions, first-clear/farm reward split, no Auto Clear, `origin`-tagged filler, mobile-first at 390×844. Rulings **#107–#108**; full account in `docs/STATUS.md` (top section). Chapter 1's three fights are drafted filler awaiting his approval; the `FillerAssist` skill and `Filler/Drafts.md` are the next batch.

**Previously — story presentation overhaul + music layer (2026-08-09).** Per-word text reveal with the VN tap contract, narration separated from dialogue, portraits reframed with the previous speaker retained, AUTO/HISTORY/skip-confirm, chapter title card, VS splash, chapter context in the battle strip, CHAPTER COMPLETE on first clear, and a full music system. Detail in `docs/STATUS.md`; rulings #50–51 above; spec at `docs/superpowers/specs/2026-08-09-story-presentation-and-music-design.md`.

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
