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
31. **Cancelling stances breaks the target's taunts** (2026-07-11, playtest; **structural since #131 and narrowed by #132, both 2026-09-16** — the taunt lives on the taunter now, so the cross-team sweep this entry describes is gone, and **`cancelBuffs` no longer breaks a taunt at all**; only `cancelStances` does): cancelStances/cancelBuffs on a unit also removes every taunt redirect marker that unit authored (taunt debuffs on the opposing team with its sourceId). Yalina's Attention Drawer is a real stance now.
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
58. **What is and isn't rank-scaled — read the notation, not the kit** (2026-08-09; tier-word half amended by **#109**, and the ladder carve-out below **retired by #130 (2026-09-16)**). Two rules, and they settle every case:
    1. **A tier word names a fixed value; the value never moves.** "raises" *is* 30%, "greatly raises" *is* 50% (roster-verified 2026-08-09 — every kit obeys this, no exceptions). You cannot write "lowers DEF" and have it mean 50; if you want 50 you write "greatly lowers".

       The vocabulary is **"raises/lowers" (30)**, **"greatly" (50)** and **"massively" (100 raising / 80 lowering, per #56 above)**. No other intensifier exists; don't coin one.

       **Correction (2026-08-10):** this ruling previously said "massively" was reserved with no value. That was wrong — #56 assigned it the day before, `tierWord` in `descriptionTranslator.ts` has always implemented it, and `mechanicGlossary.ts` spells it out ("Raises the stat by 100%"). No kit uses it yet, which is what made the mistake survive three documents. **Read #56 before quoting the tier scale.**

       **Carve-out (Tanveer, 2026-08-09) — RETIRED by #130 (2026-09-16), which rules that a rank-scaled value carries no tier word at all. Kept because it explains why Chiara's Marked Card looked the way it did for five weeks.** a rank ladder MAY step *between* tier words, because the tiers themselves stay fixed. Chiara's Marked Card is the reference case — `valueRanked [30,50,50]` with `ranks:[false,true,true]`, so R1 reads "lowers DEF" (30%, 1 turn), R2 reads "greatly lowers DEF" (50%, 1 turn), R3 keeps "greatly" but extends to 2 turns via `durationRanked`. His alternative for R3 would have been "massively lowers DEF for 1 turn" — a further tier step rather than a duration step. What remains forbidden is a ladder *inside* one tier word (e.g. "lowers" meaning 30/40/50).
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

    Also settled the same day: `lib/game/balance.ts` (**deleted 2026-09-17**, audit finding M3 — the Kit Lab it served no longer exists)'s ultimate check was wrong twice over and disagreed with five of the eighteen shipped kits. It counted a **heal's** percentage as a damage skill to beat (Siddiq's 680% heal), and ignored **ruling #22** — an ultimate that self-buffs before it strikes benefits on the same hit, which is why Chiara's 333% out-damages her 400% card and Mustafa's 225% out-damages his 250%. Both false positives are gone; the three real ones remain.

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

103. **HP persistence across tiles was decided, then became moot** (2026-08-17). He ruled HP **persists** between tiles, HP only, with a downed unit out for the rest of the run and a wipe restarting the route — and that ruling stands. But with **one fight per board** nothing survives between tiles, so `BattleProvider` was never touched and the surviving-HP handoff was never built. Recorded because the plan's riskiest item disappearing is exactly the kind of thing a future session would otherwise rebuild: it is needed the moment a board carries a second fight, and not before. **Built 2026-08-18** for story multi-wave stages, and **generalised beyond story by #136** (2026-09-16), which fights an ascension trial on the same runner.

104. **The chapter ribbon is a real reward, not a mission counter** (2026-08-17). The reference shows `COMPLETE!` / `19/20` per stage — a per-chapter mission count. We have no objective system, and inventing one costs a `storyStore` migration whose merge rule doesn't generalise (`completed` merges as a union of booleans; counts don't). He delegated the call; the slot is bound to **Bureau Orders that name a chapter** instead — `◈ LYRA` on `part2/p2c2`, `◈ 125 Gems` on `part4/p4c3` — dimmed once claimed, absent where there is nothing. Beyond parity this fixed a live gap: the free Lyra was invisible from story mode, reachable only through a nav modal. The slot stays mission-counter-shaped so real objectives drop in later without a layout change.

105. **Story content adaptation is workflow part 2** (2026-08-17). *"first was story UI UX overhaul. 2nd is story content adaption for game."* Trimmed 2026-08-19 — the counted facts behind it (19 of 37 chapters without a battle, parts with no fight at all) described the Part/Chapter structure deleted by #108, and the no-invented-battles rule it fought was lifted by the same ruling.

    **What survives, and still blocks work:** **`storyOnly` enemy stat bands are unassigned** at `docs/design/KIT_DESIGN.md:83`, and every new filler enemy kit waits on them — chapter 1's `wild_beast` included. That is his to fill in. The third blocker, a story canon/voice doc, is now answered by the `FillerAssist` skill reading `Master_Context.md` directly.

106. **Mockups are HTML files, and art requests need no permission** (2026-08-17). **Extended by #144 (2026-09-17), which adds when to draw one and how many.** Two working-style rulings. *"next time, you can open that mockup in the browser or html file okay?"* — design proposals go in a self-contained HTML file rendered in the game's real palette and fonts, not an inline chat widget, because he does the visual judging and a file survives the conversation. And: *"if you think we can use a custom asset (image asset) for something then you don't have to ask me to call comfypending skill to put the requested item into the list"* — append to `docs/ART_REQUESTS.md` directly whenever art would help, mentioning it in the reply rather than asking first.

107. **Mobile first, desktop second — project-wide** (2026-08-18). *"must be mobile first and desktop second. most of the player who are willing to try out my game would play on mobile so keep that in mind."* Said while approving the story-mode rebuild, and deliberately recorded as a **global** rule rather than a story-mode preference, which is why it also sits in `AGENTS.md` where every session inherits it.

    The operative parts: design canvas **390×844**; desktop is the same column centred at a capped width with adornment around it, **not** a re-laid-out wide variant; **`dvh` never `vh`** (Tailwind 4 compiles `screen` to `100vh`, the largest viewport — this already made every story document taller than the visible area with browser chrome showing); touch targets **≥44px** with primaries in the thumb-reachable lower third; nothing important behind a hover; one vertical scroll per screen. **Phone width is verified first** — a break at 390px is a blocker, one at 1440px is a bug.

    What it does *not* claim: the game is not mobile-first today. Battle, gacha, archive and the hub were built desktop-first and this ruling turns that into **named debt**, not a fix. The 2026-08-17 story pass at 9:16 was the first down-payment; story mode v2 is the first surface built the right way round from the start.

    **Pinned 2026-08-19** by `tests/viewportUnits.test.ts`. Verified against the installed toolchain rather than assumed: Tailwind 4.3.2 compiles `min-h-screen` to `min-height: 100vh`. The fifteen occurrences across eleven files were swapped to `min-h-dvh` the same day.

108. **Parked by #152 (2026-09-26): story mode was removed from the game, v2 included.** This entry and every story ruling stand as the design to return to, not as live code.

    **Story mode is Chapter → Stage, and v1 was deleted rather than refactored** (2026-08-18). One day after the carousel/board rebuild shipped, Tanveer: *"assume our existing story mode doesn't exist at all. i am not planning to recycle anything. its trash for me. it hurts me but that's the truth."* So this ruling replaces the v1 story structure. **Corrected 2026-08-19:** it originally claimed to supersede **#94** and **#98–#105** *wholesale*, and that range was too wide — four of those rulings govern code that survived the rebuild and a session discarding them would be wrong. What it actually retires is **#94, #98, #101, #102** (and #96, from the same design), now tombstoned. **Still live:** **#99** (a chapter appears only once the previous one is clear — reworded from parts to chapters, pinned by `tests/storyCatalog.test.ts`), **#100** (every attempt costs stamina), **#103** (HP persists between waves — this rebuild is where it finally got built, pinned by `tests/stageRun.test.ts`), **#104** (a Bureau Order naming a stage still renders on it — `ordersForStage`, read at `app/story/page.tsx:459`), and the surviving half of **#105**. What follows is the shape he specified, with the decisions he made when asked.

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
    - ~~**Battle UI's own mobile pass is a separate dedicated session**, his call, and is not part of story work (`docs/ROADMAP.md`).~~ **Superseded by #118 (2026-08-21)** — he folded battle into the general mobile-first pass. This bullet only; the rest of #108 stands.

    **What survived from v1, because it was generic rather than story-shaped:** `storyTeam.ts`'s trial-vs-owned rules (#93), `storyRewards`'s payout roller, the VN reader internals, `VersusSplash`, `ChapterTitleCard`, `StoryStage`, `stageEffects`, `victoryAtEnemyHpPercent`. **`SnapCarousel` did not** — a list heading toward 24 chapters is scanned, and centring one item hides its neighbours behind a fling. That reverses part of #98 and is flagged for him.

    **Filler is now allowed, under approval.** He lifted the no-invented-content rule recorded at `lib/game/storyCatalog.ts:36` (ruling #105's first blocker): Claude may draft filler stages, scenes and NPCs, but **nothing enters the game unapproved**, and **NPC kit numbers stay his** — the draft states role, personality and combat concept and asks. The record lives in `Filler/Drafts.md` and `Filler/Approved_chapter_N.md`, and a **`FillerAssist` skill** will carry the workflow; it must be able to write `data/story/chapter-N.json` itself, not just the docs. Chapter 1's three fights are drafted and awaiting that pass. One canon call already made and worth keeping: **the village raid is not a playable fight** — canon says Duke was away when it happened, so `1-2` is a wilderness fight instead.

109. **A tier word names one exact value — it is never a threshold** (2026-08-19, amends #26, #56 and #58; **the wording of the off-scale form is superseded by #130 (2026-09-16)** — the verb no longer changes, only the number is added). Shown that Chiara's ultimate raised evade by 33% under the word "Raises", Tanveer: *"that's the problem. 'raises' MUST be 30%. it can't fluctuate, even by 1%. If i allow it, next time you would propose 'greatly raises' to accept even 55%. Nope."*

    **The scale, as exact values:** raising **30 / 50 / 100**, lowering **30 / 50 / 80**. Nothing in between wears the word.

    **Off-scale values are not forbidden — they are written differently.** **Superseded by #130:** they keep the same verb and state the number — "raises ATK by 33%". What this paragraph describes was the rule until 2026-09-16. His wording at the time: *"we can use the wording 'increases/decreases by' when dealing with non tier worded numbers."* So "Increases ATK and evade chance by 33% for 3 turns" states the number in the text. This is the form Leorio's support ladder already used (20/30/50, "increases their ATK and DEF by `[buff.value]`%"), now the general rule rather than one skill's exception.

    **A consequence worth knowing: the explicit form gets no hover pill.** A pill exists to reveal a number the tier word hides (#26). Nothing is hidden, so `tierWord` returns undefined off-scale and `buildSkillKeywordGlossary` skips the entry.

    **This subsumes #58's ladder rule.** A ladder cannot step inside one tier word if every tier-worded value must be exact. **#130 goes further and retires the carve-out entirely:** a ladder carries no tier word at all.

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

118. **The battle screen's mobile pass is part of the general one** (2026-08-21, supersedes the last bullet of #108). Shown the 390px audit — End Turn at 28px, hand cards squeezed to 43px, the control rail taking 14% of the screen width — and offered three scopes: report only and touch nothing, cheap target fixes only, or fold it in. He chose **fold it in**: *"treat battle as just another screen in this pass and rework it now."*

    **That phrasing is an option label he selected, not prose he wrote** — recorded as a selection so a later session doesn't read it as a quotation. The decision itself is his and unambiguous.

    What it retires is #108's closing bullet, *"Battle UI's own mobile pass is a separate dedicated session, his call, and is not part of story work"*, and the matching `docs/ROADMAP.md` Phase 2 line. Everything else in #108 stands.

    **The mechanical half shipped the same day** — every control in `BattleArena`, `Deck`, `UnitDetailPanel`, `BattleCoach` and `EffectsList` is at 44px, and the status strip stopped hiding its progress bar below `sm`. The **layout** half went to him as an HTML file first, per **#106**: `docs/design/mockups/battle-mobile.html`, three renderings at true 390×844 size. **He answered the same day and it is all built** — so the mockup is now a record of the decision, not an open question.

    **His four calls, and what each became:**

    - **Controls → a sheet.** The 56px rail is gone and the field is the full width. Only the two time-critical controls stay in the open — **Skip**, which exists for the seconds an animation is playing, and **Speed**. Log, Foe, Team and Exit sit behind **Controls**, which opens a bottom-anchored sheet rather than a centred modal, because everything in it is something a thumb has to reach. He asked for exactly this: *"i want the options to hide in a modal behind a button click."* `RailButton` became `ControlButton` in the same pass — a component named after a thing that no longer exists is the same failure as a skill outliving its subject.
    - **Cards floor at 56px** (`min-w-14`) and the row finally scrolls. It was always `overflow-x-auto`; with `flex-1 min-w-0` nothing ever overflowed, so eight cards divided 390px into 43px slivers instead. Centring is now done with auto margins on the end children — plain `justify-center` makes the *first* card unreachable once the content overflows, which it now does.
    - **Merge arms from the card's own button**, then you tap the partner. With **one** partner it commits immediately, because there is nothing to choose and `mergeDeckCard` would pick the same card anyway; arming only earns its second tap when there are two, and then it matters — a merge grants +1 ult gauge to the **eaten** card's owner. Drag still works and is still the faster desktop path.
    - **The tile keeps focus-fire and loses the effect strip's tap.** The strip was a 16px button nested inside the tile, which is itself a button to the same detail panel — two targets, one unhittable, one destination. It is a readout now. Focus-fire moved off the readout row onto the portrait's top-right corner at a real 44px.

    **Also cut, his call: the event ticker.** *"if someone needs to know what happened then they can just check the log."* It was one line restating the last action, holding a 44px band in the tightest vertical space on the screen; the log drawer has the full history. Its slot is where the control bar sits now.

    **And a gap he found that the audit had not:** *"on mobile, there is usually no way to see what skills or ults do when they are in deck."* True and worse than it sounds — the card preview was hover-only, so **on a phone there was no way to read a skill in battle at all**, and you played cards from memory. Press-and-hold now opens the card's full description in a modal (`CardDetail`, shared with the desktop preview so the two cannot disagree). That freed the hold gesture from its old job of lighting merge partners, which is what made the arming flow above possible — the two changes are one decision, not two.

    **The hold is a timed commitment, not a threshold** (his follow-up, same day): *"it has to play a 3 sec commitment type progression circle that fills before the modal opens."* A ring appears once the press outlasts a tap and fills over the remaining time; the modal opens when it completes. `HOLD_DETAIL_MS` in `Hand.tsx` is the single source for both — the ring's CSS duration is derived from it, so the animation cannot promise a different length than the timer enforces.

    **The duration is 1500ms, not the 3000 first asked for.** Built at 3s, flagged in the same breath as confirmation-length — the pacing of "delete this permanently", not of "what does this card do" — and he cut it within the hour: *"3s sure is long. maybe try 1.5sec?"* The ring only has to prove the press was deliberate, and 1.5s does that. **The number is one constant** and moving it moves the animation with it, so this is a tuning knob, not a rebuild.

    **The middle outcome is the one that mattered to get right.** One gesture now has three endings: a release under `TAP_MAX_MS` plays the card, a completed hold opens the details, and **an abandoned hold does nothing at all**. That last case is deliberate — falling through to "play the card" would spend an action at the exact moment the player decided against something, which is the worst available reading of letting go.

    Two things the timed hold forced, neither of them cosmetic. The card takes `-webkit-touch-callout: none` — iOS raises its own long-press menu well inside the hold window, on top of the ring the player is being asked to watch. And the hand row went from `touch-none` to `touch-pan-x`: `touch-none` was harmless while cards squeezed and the row never overflowed, and became a trap the moment they stopped, leaving the off-screen cards unreachable by any input a phone has. The cost, accepted: **drag-to-reorder no longer works by touch**, since the same swipe now scrolls the row. Mouse drag is unaffected and merging by touch goes through the button.

    **Unit tiles deliberately did not get the ring.** On a card the hold competes with a tap that costs you an action, so it has to be deliberate. On a tile, tapping already opens the details and nothing else claims the gesture — a timed hold there would only make inspecting an enemy slower.

    **One control stayed deliberately under 44px:** the on-card **Merge** button, opted out with `min-h-0` and a comment. It sits *on* a 56px card; a 44px control would cover the name and cost underneath it. #119 permits the opt-out with a stated reason, and this is the reason.

119. **The 44px floor lives in the primitives, not in the screens** (2026-08-21, sharpens #107). Asked whether to fix `Button`'s 28px `sm` size in the primitive or at the call sites, he chose the primitive: *"give sm a min-h-11 floor so every current and future caller is touch-safe."* Again an option label he picked, not his own sentence.

    **The audit that prompted it:** `components/ui/button.tsx` shipped nine sizes and **five sat under 44px** — `xs` 24, `sm` 28, `default` **36**, `icon` 36, `icon-sm` 28. 20 of the 51 `<Button>` call sites take `default` without naming a size at all. Which is why per-screen fixes never held: `components/game/story/`, built mobile-first as this rule's own calibration set, still shipped two 36px buttons, because it asked for the default and the default was wrong.

    So the floor is enforced where it can't be forgotten. `button`, `input`, `select` and `slider` all carry it; `slider` keeps a 12px *visible* thumb over a 44px hit area, because a 44px block on a 4px track is not the same request. The four `icon-*` sizes collapsed to one — with a floor, `icon-xs` and `icon-sm` were `icon` under another name, and a scale that offers sizes it can't deliver lies to its callers.

    **Pinned** by `tests/touchTargets.test.ts`, which also fails on a size added later that never gets listed. An individual control may still opt out with `min-h-0`, and must say why in a comment; there is exactly one today.

120. **Nothing explanatory may be reachable only by hover** (2026-08-21, sharpens #107). The audit found every mechanic keyword in the game was a radix `Tooltip` wrapped around a bare `<span>` — hover and focus only, and a `<span>` offers a phone neither. So the entire mechanic glossary, the nav's resource labels and the progression panel's "why is this button dead" message were **invisible on the device most players use**, while looking exactly like text that meant something. Offered three fixes, he chose tap-to-open: *"swap the trigger to a real focusable button and back it with a Popover."*

    `components/ui/Hint.tsx` is that component: a `Popover`, which is click-driven and therefore works on touch by construction, with hover layered back on for `pointerType === "mouse"` so the desktop feel is unchanged. **The trigger is always a real `<button>`** — that is the load-bearing half, not the popover.

    Two consequences worth knowing. A `Hint` trigger **cannot contain a link or another button**, which is why the nav's rank chip lost its tooltip entirely and shows its progress bar at every width instead — the tooltip only restated the bar. And an **inline** keyword inside a sentence is the one control that cannot be 44px without wrecking its paragraph; those take `py-1 -my-1`, which buys 8px from the line box, and that is as far as it goes.

    **Pinned** by `tests/touchTargets.test.ts`: no file outside the primitive may mention `TooltipTrigger`.

121. **An SFX system exists** (2026-08-21, reverses the SFX half of the 2026-08-09 audio decision). Asked to survey tooling that could improve the game and then told to install all six findings: *"okay then, install and wire in - 1, 2, 3, 4, 5, 6."* Item 4 was the sound-effect bus.

    What it reverses is a standing note, not a numbered ruling: `docs/AUDIO.md` and `lib/audio/tracks.ts` both said *"there is no SFX system and none is planned"* (his call, 2026-08-09). Both now say otherwise, and `tracks.ts`'s instruction that a future bus *"belongs beside this module, not inside it"* was followed exactly.

    **The bus is silent and that is the shipped state.** `public/audio/sfx/` is empty like `public/audio/` before it; a cue with no file resolves to silence, recorded once and never retried. `lib/audio/cues.ts` names ten **moments** — card play, merge, hit, critical, evade, ultimate, defeat, turn end, victory, defeat screen — because naming the moments is engineering. **What each one sounds like is his**, along with whether ten is the right ten.

    Two things worth knowing before the files arrive. Cues fire on the **animated** beat inside `useBattleSequencer`, not at engine resolve — playback runs up to a second behind, and a hit you hear before you see it reads as a bug. And each cue carries a `throttleMs`, because one AoE can request `hit` eight times inside a frame, which without it is one loud click rather than eight hits.

    **Howler for effects, hand-rolled `HTMLAudioElement` for music**, deliberately. An `HTMLAudioElement` restarts rather than layers when asked to play something already playing, which is fatal for overlapping effects and irrelevant for one long looping track.

122. **The tooling batch — what was installed, and the two things it immediately caught** (2026-08-21). Six items, all his call, all wired the same day.

    | # | What | Where it lives |
    |---|---|---|
    | 1 | Full `jsx-a11y` ruleset | `eslint.config.mjs`, `lib/a11y.ts`, `hooks/useEscapeKey.ts` |
    | 2 | Balance simulator | `lib/game/simulate.ts`, `scripts/sim.ts`, `npm run sim` |
    | 3 | Component tests in real Chromium | `vitest.config.ts` projects, `npm run test:browser` |
    | 4 | SFX bus (ruling #121) | `lib/audio/cues.ts`, `lib/audio/sfx.ts` |
    | 5 | PWA | `app/manifest.ts`, `app/icon.tsx`, `public/sw.js` |
    | 6 | Telemetry | `@vercel/analytics`, `@vercel/speed-insights`, `lib/sentry.ts` |

    **The a11y ruleset found 23 real problems on its first run**, in nine files — and the three rules that found most of them (`no-static-element-interactions`, `click-events-have-key-events`, `interactive-supports-focus`) were the ones `eslint-config-next` leaves off. It ships six of roughly thirty-five, all about malformed ARIA and none about behaviour. Everything was fixed rather than suppressed; **zero suppressions were added**, and the three I wrote defensively turned out unnecessary and were deleted. The sharpest find: the story reader, the chapter title card and the versus splash all carried `role="button"`, `tabIndex={0}` and an `aria-label` with **no key handler** — focusable, announced as buttons, and inert when pressed.

    **The first browser test found a bug in code written the same morning.** `Hint` opened on focus *and* toggled on click; a mouse fires focus first, so clicking a keyword opened the popover and then immediately closed it. Whether it broke depended on where the pointer had been, so it was not even consistently broken. Nothing in the markup was wrong, which is the entire argument for testing in a browser rather than a simulated DOM. Fixed by dropping hover-to-open: **one interaction everywhere — click, tap or keyboard** — at the cost of a small desktop regression, recorded in the component.

    **Two corrections to what the survey claimed.** `@serwist/next` does *not* support Turbopack, despite what its own docs imply — it printed a warning and silently produced no service worker. Its configurator mode does, at the price of three more dependencies and rewriting both `build` and `dev`; `build` is what Vercel runs on every push and `dev` is his server, so neither was worth touching to cache an app shell. `public/sw.js` is hand-written instead: no build step, no dependency, and everything it does is visible in one file. Separately, Vitest 4.1 takes a provider *factory* from `@vitest/browser-playwright`, not the `"playwright"` string every current guide still shows.

    **What is deliberately not finished:** Sentry is wired but **inert without `NEXT_PUBLIC_SENTRY_DSN`**, matching how `lib/firebase.ts` treats its own env — and `withSentryConfig` is *not* applied, so stack traces will be minified until someone with the account adds an auth token. `tracesSampleRate` is 0 on purpose: performance tracing burns a free tier fastest and Speed Insights already reports Core Web Vitals.

    **The eleven npm advisories are pre-existing and untouched.** All transitive under the `shadcn` CLI — a dev tool that never ships — and `npm audit fix` on its dependency chain risks breaking the CLI for no runtime gain.

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

123. **Navigation moves to a bottom tab bar on a phone** (2026-09-01, sharpens #107). Shown a browser audit of the live build at 390×844 — the route strip was a **234px scroller holding 332px**, so News and Profile never rendered at rest, beside a second scroller holding the resource chips with Bureau Orders clipped — and offered two fixes in `docs/design/mockups/shell-mobile.html`: un-hide the short labels, or move navigation to a bottom tab bar. He chose the tab bar: *"Option B — bottom tabs (recommended)."* **That phrasing is an option label he selected, not prose he wrote.**

    **Amended by #152 (2026-09-26): four destinations** — Story went with story mode. What fills the fifth slot, if anything, is his call.

    Five destinations below `sm` — Menu · Story · Events · Gacha · You. Archive, Practice and News keep their hub tiles instead of a slot; Coin leaves the bar (it is a spend-screen figure, not a live one) and the resource chips that remain fold into row 1. Desktop is untouched: above `sm` the route strip and the two-row nav render exactly as before.

    Two things this cost, both found in a browser and neither visible to any test:

    - The bar rendered **at the top of the screen**. `position: fixed` resolves against the nearest ancestor that establishes a containing block, and the nav carries `backdrop-blur-sm` — a `backdrop-filter` does exactly that. `bottom-0` put the tab bar over the nav it replaced. It is portalled to `<body>` now. (Sticky positioning alone would not have done this; it creates a stacking context, not a containing block.)
    - Gating it on the nav's row count **removed navigation entirely** from any screen reached by walking away from a battle without exiting. `battlePhase` outlives the screen by design — a battle survives a reload — so "the store knows about a battle" and "a battle is in front of the player" are different questions. The arena publishes `data-battle-active` now and the bar reads that.

    Heights compose through `--tabbar-h` in `styles/globals.css`, 0 wherever the bar does not render, so `.screen-below-nav` is one expression at every width. Pinned by `tests/navHeight.test.ts`.

124. **The archive's filters live in a sheet** (2026-09-01, sharpens #107). Measured on the live build: the first character card started at **y = 553 on an 844px screen** — 65% of the phone was filter furniture, nine controls in the open with three of them wrapping to a row of their own. Offered a sheet or a collapsing toolbar, he chose the sheet: *"Option A — one Filters sheet (recommended)."* **Also an option label, not his sentence.**

    Search plus one Filters button; element, sort, show-locked, tags and mechanics all move into a bottom sheet — the same pattern battle's controls became under #118, so this is reuse. The button's badge counts everything the sheet hides, element and sort included, or the grid filters with the button reading zero. First card now starts at **218px**. The page's descriptive blurb went with it (it explained a rule the sheet's own *Show locked* row states better) and the heading steps down at 390 so NPC Index sits beside it rather than wrapping.

    The sheet is portalled, which `tests/overlayStacking.test.ts` required and was right to: that guard exists because the Growth modal once rendered *behind* the kit document, trapped by an `lg:sticky` ancestor.

125. **Nothing explanatory may sit in a `title` attribute either** (2026-09-01, extends #120). #120 killed the hover-only `Tooltip`; the browser audit found the same failure arriving through the other door. A `title=` on a plain HTML element is a browser tooltip — hover only, no tap, no focus. **Ten sites**, including the summon banner's twelve featured tiles, whose character *names* lived nowhere else on the page: on a phone the monetisation screen was selling twelve anonymous squares.

    The 2026-08-21 sweep's own grep listed `title=` and still missed them, because `title` is also a prop name on half the modals here, so the greps drowned. `tests/touchTargets.test.ts` now scans for `title=` on **lowercase** JSX tags only, which is the discriminator that separates a DOM attribute from a component prop.

    A caution worth keeping: that guard shipped green and wrong first. A literal `0x08` byte had landed where `\b` belonged, so the regex matched nothing and the test passed having scanned 83 files and found none of the nine offenders. Only running the same logic standalone caught it — the exact vacuous-pass failure `tests/stubs/browser-setup.ts` warns about.


126. **The nav carries only what a player needs mid-screen** (2026-09-01, follows #123). With navigation gone to the bottom bar, he cleared the top row of two more things: *"the 'claude' button can also be moved to dev only area on profile page. the music slider can also be moved to profile page."*

    - **`DuelToggle`** — the dev-only "Claude" switch that let Claude play the enemy side — moved into `DevGrantPanel` on `/profile`. It is developer tooling and it was holding permanent width in a 390px bar. The setting stays global, so one placement still covers practice, story and the world boss; only the control moved. It renders `null` outside development as before, and `/profile` redirects a signed-out visitor, so in dev it is reachable only while signed in.
    - **Music volume** moved to a `Sound` section on `/profile` (`components/game/SoundSettings.tsx`). **Mute did not.** Offered three shapes, he chose mute-stays: *"Mute stays, slider moves."* **An option label he selected, not his sentence.** The reason it was offered at all is written into `AudioControl`'s own header — `/profile` redirects guests to `/login` and guest mode is supported, so a control living only there is a control a guest does not have. Silencing the game is the urgent audio action (a quiet room, or a track starting on the autoplay gate's first interaction); volume is a set-once preference. So the nav keeps a single 44px mute button and the popover is gone.

    **A pre-existing bug surfaced doing this, and was fixed.** `HomeMenu` renders the arena inline when a battle is in progress, but rendered `<BattleArena />` *alone* — no `Deck`, which is the hand and End Turn. A battle resumed from `/` could be read and exited and not **played**. Reachable before through the TOLL wordmark on every screen; #123's Menu tab turned it into a one tap route, which is how it was found. `HomeMenu` now uses the same `main` + `BattleArena` + `Deck` composition as `/practice`.


127. **Every event answers two questions: may it be seen, and may it be entered** (2026-09-01). The board asked only the second. His rules, given as one message: *"Molvarr unlocks and appears only after clearing the relevant story chapter. First ascension unlcoks when account level is 20 but visibility stays there from level 1 onwards. The second ascension will show up if both of the following conditions are met : Account level 21+ and first ascension cleared. It unlocks only at next level cap (40) ofc."*

    So the three shapes are all different, and none of them is the old behaviour:

    - **Parked by #152 (2026-09-26):** the chapter-9 gate below was removed with story mode. It was inert (chapter 9 was never adapted), so nothing on screen changed; it returns with story.
    - **Molvarr** — visibility *and* unlock both gated on a story chapter clear. Asked which chapter: *"Its chapter 9. so molvarr unlocks after completing chapter 9."* Authored as `visibleWhen: { clearedChapter: "c9" }`. **Chapter 9 is not adapted — one of twelve is — so the gate is inert today and begins biting the day `c9` lands in `data/story/`.** That is a deliberate property of the mechanism, not a deferral: a chapter absent from the story catalog cannot gate anything, because "clear a chapter that does not exist" is unsatisfiable and would hide the event *permanently* rather than until the chapter ships. Molvarr is the game's only repeatable fight and the source of half of Bureau Orders, so writing the real id and letting it activate itself is the only shape that is both faithful to the ruling and shippable.
    - **First Ascension Trial** — visible from rank 1, locked until rank 20. The *only* event whose visibility is deliberately wider than its unlock, and the reason both trials were authored at all: the rank 20 wall is otherwise invisible, and a player simply stops gaining ranks with no explanation anywhere in the game.
    - **Second Ascension Trial** — withheld until **rank 21+ and the first trial cleared**; unlocks at 40. Both clauses, not either.

    Implemented as `GameEvent.visibleWhen` plus `isEventVisible` (`lib/game/events.ts`), a declarative record rather than a predicate so the next event's author can read the rule and copy it correctly. `eventLockReason` is untouched — it still answers the second question alone. Pinned by `tests/eventVisibility.test.ts`, including a guard that no authored event is unreachable by *any* player state, which is the one failure this mechanism can produce silently.

    **The procedural half, and the reason this is in `AGENTS.md` too:** *"For the future events, i will make sure to mention this information too. you can also log that in so that you would ask me about the information if i happen to miss or forget it when creating new events."* A new event without both answers is not ready to author — ask.

128. **Merge All is a button, not an auto-merge toggle** (2026-09-01). Asked whether to add a toggle that auto-merged the hand at turn start, with the rule *"only 1 card merges with 1 identical card. so in a case where there are 3 identical cards, 2 merge to form one higher rank and 1 other remains."* Offered the trade and he took the button: *"go with the merge all button."*

    **Two things were already true and are worth writing down, because both were nearly rebuilt.** Auto-merge has always existed and always run — `applyAdjacentMerges` fires on every draw and every play. And his pairing rule was already the behaviour: `canCardsAutoMerge` requires **equal rank**, so a fresh R2 stops matching the R1 beside it and the third card is left alone. Neither needed inventing.

    What Merge All actually adds is **non-adjacency**. The automatic pass only ever collides neighbours — correct, because silently reordering a hand the player arranged would be worse than leaving two matches apart — so settling a separated pair meant the per-card Merge button, once per pair.

    **Why a button and not a setting.** Merging is not free, in three ways that are invisible if it fires on its own: two cards become one, so the hand shrinks; every merge banks +1 ult gauge, so ultimates re-time; and rank scales `damageRanked` against an R3 cap, so merging early spends two cards reaching a ceiling. A toggle makes all three happen unwatched. `applyAllMerges` + `hasMergeablePair` (`lib/game/deck.ts`), `mergeAllCards` (`store/gameStore.ts`), 15 tests across `tests/mergeAll.test.ts` and `tests/mergeAllStore.test.ts`.

    **Open, found while building it:** the per-card Merge button's *arming* step stages a choice the engine discards. `mergeDeckCard` takes only the base card id and eats the **first** match it finds, and since `canCardsAutoMerge` requires the same owner, skill and rank, every candidate partner is interchangeable anyway. The code comment justifying the second tap ("a merge grants +1 ult gauge to the *eaten* card's owner") is wrong — both cards share an owner by definition. Not changed unprompted: it is a gesture ruling #118 describes.

129. **The battle screen's bottom row, and what the controls sheet is for** (2026-09-01, extends #118). Three changes to the same corner of the screen, all his.

    - **The control row moved to the bottom**, below the hand, and the **team-bar dots were deleted** to make room. The dots restated the HP bar already on every unit tile and spent the row a thumb reaches most easily. The row still lives in `BattleArena` — it reads the sequencer bound to `arenaRef`, and its sheet needs the roster panels, log drawer and exit confirm — so it **portals into a slot `Deck` renders**, which is how a child of the arena can paint below its own sibling. A missing slot falls back to rendering in place: `BattleArena` has been rendered without `Deck` before, and losing Exit to a layout change is not a trade worth taking.
    - **The controls sheet gets filled rather than shrunk.** Measured: 149px of buttons under **695px of empty scrim**, 82% of the screen dimmed for four controls. Offered three ways out — drop the sheet and inline the four controls, shrink it to a popover, or keep it full-screen and give it something to hold — he chose **fill it**. *That phrasing is an option label he selected, not prose he wrote.*

    What fills it is deliberately not invented: it is what the status strip shows on a wide screen and **hides on a phone**, plus the two things never on it at all. The strip is one line competing for ~390px and ranks what it keeps, so the fight's context (`hidden sm:`) and the resolved counts (`hidden md:`) never render on the device the game is built for. The sheet now carries turn and phase, the fight's context label, duel mode, **actions available this turn**, resolved counts, **field and bench occupancy** (the sub rule turns on the bench, and nothing said how many were on it), and **stage effects** — which `StageBrief` shows before a fight and nothing showed during one, despite them modifying the battle in front of you. Sheet is 286px / 34% of the screen and scrolls past `85dvh`.

    Conditional rows render only when they apply, so an ordinary practice fight does not get empty boxes — which also means the context, duel and stage-effect rows are **built and typechecked but not seen**: reaching them needs a story battle with authored stage effects.

130. **The explicit percentage is a first-class form of the same verb** (2026-09-16, amends #109, retires #58's ladder carve-out). #109 settled that an off-scale value is written differently; it chose a different **verb** for it ("Increases ATK by 33%"). Tanveer collapsed the two vocabularies into one: the verb is always *raises*/*lowers*, and the adverb is shorthand for a number that may instead be stated outright.

    *"if raises there is no by x percent after raises, then it just means the normal 30%. Obviously, greatly would mean 50%, massively would mean 100%. That's gonna be the same thing, but it should also support custom values."*

    | written | means |
    |---|---|
    | `raises ATK` | 30% |
    | `greatly raises ATK` | 50% |
    | `massively raises ATK` | 100% |
    | `raises ATK by 33%` | 33% |

    **The adverb and the number are alternatives, never both.** He settled this mid-sentence, correcting himself while giving an example: *"greatly raises defense by, yeah, actually, uh, not greatly, just raises defense by 59%."* A word meaning 50 cannot stand in front of a 59. Pinned by a test; lowering values keep their own ceiling of 80 (#56).

    **Rank ladders and tier words are disjoint.** His words: *"The rank sclaed numbers don't follow tier based words. And vice versa."* A `valueRanked` ladder spells its number at every rank; a tier word means one flat value. **This retires #58's carve-out** permitting a ladder to step *between* words — and its reference case, Chiara's Marked Card, was the only skill in the game still doing it. Its description was a `[debuff? greatly lowers : lowers]` conditional driven by a hand-maintained `ranks:[false,true,true]` mirror of the ladder. Both are gone. That closed a bug nobody had reported: the engine gates on `ranks` for `aoeRanked` alone (`combat.ts`), so R1 applied its DEF debuff, while `damagePreview.ts` read the same array as *"inactive at this rank"* and showed the player nothing.

    **The author writes the number; the translator does not derive it.** Offered a derived form (kit JSON keeps writing a bare `raises`, the translator appends `by 33%` when the value is off-scale) against an authored one, he chose **author types it** — the kit JSON writes `raises ATK by [buff.value]%`. **That phrasing is an option label he selected, not prose he wrote.** So the placeholder machinery is the contract: `[buff.value]` reaches the first mechanic of a type, and two buffs on one skill need the positional `[x-ranked.value]` / `[y-ranked.value]` refs.

    **#109's no-pill consequence survives and is now enforced in the matcher.** `mechanicGlossary` carries a **global** `raises: "Raises the stat by 30%"`, merged beneath every per-skill glossary, and both `KeyworkHighlighter` and `extractKeywordFootnotes` match it as a bare word — so without a guard, "raises DEF by 59%" renders a pill asserting 30% directly above a sentence saying 59. `keywordStatesItsOwnValue` suppresses a tier verb followed, **inside its own clause**, by a `by N%`. The clause bound matters: in "raises ATK for 2 turns; lowers DEF by 30%" the first verb keeps its pill.

    **Six kits migrated** off the older `Increases/Decreases … by X%` wording, on his call: *"migrate them to the new form"* — **also an option label, not his sentence.** Chiara (All In, Marked Card), Leorio, Isolde, and the two checkpoint NPCs. Deliberately **not** migrated: `toll_collector`'s *"reduces damage taken by 35%"*, which is a stance on damage taken rather than a raise or lower of a stat, so no tier verb applies to it.

    **A caution this ruling earned.** Its own migration was caught by `tests/kitDescriptionRules.test.ts` — but only after discovering that **three of that file's four guards had never run**. `/\braises\b|\blowers\b/` had been authored through a heredoc that turned each `\b` into a literal `0x08`, and #65's two checks used `` new RegExp(`\b${word}\b`) ``, where a template literal turns `\b` into a backspace at runtime. All three matched nothing and passed green from the day they were written. Repaired here; the roster was clean apart from this ruling's own four hits.

131. **A stance is a named group of effects, and a taunt belongs to the taunter** (2026-09-16, absorbs #31, supersedes the taunt model of #31/#32's era). Two halves, both his, from one conversation about stances not doing the idea justice.

    **Display.** A stance is one thing the player put up, and its parts are listed apart under its name rather than collapsed into a row reading "Stance": *"these would be displayed separately on the character. Like it won't say one stance effect. It will say three separate effects."* His examples were Meliodas — the stance itself, plus the counter — and Yalina — the taunt, plus the damage reduction. Offered a flat list, a named group, or grouping only at two-or-more, he chose the **named group**. *That phrasing is an option label he selected, not prose he wrote.* Carried by `StatusEffect.groupId` / `groupName`; `blocksFor` in `EffectsList.tsx` renders it. **Scoped to stances** — a plain self-buff stays one ungrouped row, because heading every buff with its skill name restyles the whole panel for nothing.

    **Engine.** Taunt changes sides: *"Taunt shouldn't be a debuff on enemies in the first place. It could be either a buff on self or a stance effect — enemies will just be forced to attack the character with a taunt effect or buff."* So the marker now lives in the taunter's own `buffs`, and the redirect reads the defending team instead of the attacker's debuffs.

    Four consequences, none of them cosmetic:

    - **Ruling #31 becomes structural.** "Cancelling stances breaks the target's taunts" needed `clearTauntsAuthoredByTarget` to walk both teams hunting markers tagged with the cancelled unit's id. The taunt is simply *there* now, so the existing cancel filters take it and that sweep is deleted. `cancelStances` had to learn one word: it strips `taunt` alongside `stance`.
    - **A taunt reaches every enemy.** It used to be applied per target, so `toll_collector`'s State Your Business — which has no `aoe` — pulled only the one enemy it struck. Asked whether to keep single-target taunts possible, he chose **all enemies**, which is what `mechanicGlossary` has claimed since it was written: *"Direct all single target enemy attacks to self."* The code and the glossary disagreed; this picks the glossary. *Option label, not his sentence.* It is a buff to a `storyOnly` NPC and touches no playable kit.
    - **Debuff Immunity no longer blocks a taunt.** The old marker was a debuff, so an immune enemy was untauntable. It is not a debuff any more, so there is nothing to resist. Follows from his own framing and is pinned by a test rather than left to be rediscovered.
    - **Precedence needed a new field.** Most-recently-applied still wins (his pick, preserving the old behaviour), but that used to fall out of array position on the victim, and there is no shared array once each taunter holds its own entry. `StatusEffect.appliedSeq` carries it, derived from the current maximum on the field so `executeSkill` stays pure.

    **Two display defects found while doing it, both shipped and neither reported.** Meliodas's Full Counter rendered a **blank** row for its whole duration — `effectDescription` had no branch for `counterDamagePercent`, which is where a counter stance keeps its number, so the 250/300/400% counter was never stated while it was up. And a damage-reduction stance printed **"+25% damage taken"**, the exact opposite of what it does: `damageReduction` reads as "damage taken" in his battle-log vocabulary (2026-08-13), which inverts the sign. The word stays his; the sign is corrected to "−25%".

    **Not done, deliberately.** He floated damage reduction as a possible third effect on Full Counter and then ruled it out for now — *"don't touch it — display only"* (*option label*). Full Counter keeps exactly the mechanics it had.

132. **A stance and a buff are different things, and each cancel reaches exactly one** (2026-09-16, follows #131, narrows #31). Tanveer, giving the interaction matrix unprompted:

    | on the target | `cancelBuffs` | `cancelStances` |
    |---|---|---|
    | a stance, and everything it carries | survives | **removed** |
    | a free-standing buff | **removed** | survives |

    His example is a skill that *"applies taunt that … raises defense for two turns"*: cancelling the stance takes the DEF raise too, *"but cancelled buffs will not affect it"* — while *"if there is a skill which just says raises defense by 30% then this would be affected by cancel buffs but it will not be affected by cancel stances. So there is a difference between a stance effect and a buff."*

    **Before this the engine drew no such line.** `cancelBuffs` filtered on `uncancellable` alone, so it swept stances as well and a stance had no defence against either mechanic. The two names existed; only one behaviour did.

    **Membership is by GROUP, not by entry type.** A stance's DEF raise is its own entry, and what marks it as part of the stance is #131's `groupId`. Grouping is therefore decided per *skill*: every self entry a stance skill applies joins its group whatever its own `type`, so a raise authored as a plain `buff` mechanic cannot survive a cancel that killed the rest of its own stance.

    **Three shipped skills would have been silently nerfed.** Leorio's Remote Punch, Meliodas's Evil Spirit and Siddiq's Wrath of the Wild all read **"Cancels buffs and stances"** while authoring only `cancelBuffs` — correct only because `cancelBuffs` used to sweep everything. `cancelStances` was added to all three, which preserves exactly what they did before; the alternative was three cards quietly ceasing to do what they say. `tests/cancelMatrix.test.ts` now checks both directions of that promise across the roster, so the next one is caught at the source.

    **And a dead mechanic came to light.** The two cancels were `if` / `else if`, so `cancelStances` never ran on a skill that also carried `cancelBuffs` — which is `toll_collector`'s Settle the Account, the one skill in the game authoring both. Invisible while `cancelBuffs` removed stances anyway, and a silent no-op the moment it stopped. They are independent now.

    **Ruling #31 narrows.** "cancelStances/cancelBuffs on a unit also removes every taunt redirect marker" is now **cancelStances only** — a taunt is part of a stance (#131), so `cancelBuffs` leaves it alone by the same rule that leaves the rest of the stance alone.

    The glossary pills were rewritten to match: "cancels buffs" had promised *"stances included"*.

133. **Colour classifies — one taxonomy for effects, and one for skills** (2026-09-16, follows #131/#132, supersedes the per-screen colour maps). Two tables, both his, given in one message.

    **What is active on a unit.** The colour is #132's cancel rule made visible:

    | class | colour | what it means |
    |---|---|---|
    | buff | blue | a free-standing raise — `cancelBuffs` takes it |
    | **stance** | **yellow** | a stance and every part of it — `cancelStances` takes it |
    | debuff | red | hostile |
    | effect | grey | uncancellable, *"not affected by any cancel buffs or any cleanses … they are just effects"* (#30) |

    A stance rendered **blue, beside ordinary buffs**, until this — the exact distinction #132 had just spent an engine change drawing. It is its own coloured section and its own token in the count strip, because it answers a different question from a buff and is the one a turn gets decided on. Classification reuses `isStanceEntry`, the same predicate the cancel step uses, so the colour can never promise a removal that would not happen.

    **What a skill does.** Red attack, **purple attack-debuff**, green heal/cleanse, blue buff, yellow stance. His line for the split: Chiara's skill that lowers DEF after damage is an attack-debuff, while one that only cancels is *"just a normal attack skill … as long as they don't apply debuff on the enemy from their skill."* So `cancelBuffs`/`cancelStances` are **not** debuff mechanics here — removing something the target had is not afflicting it with something new.

    **Where the colour goes on a card.** Not the border: that is the merge-rank ladder, and rank is what you scan while merging. Offered the glyph, an edge stripe, or taking the border outright, he chose the **glyph** — the card already carried a skill-type icon with this exact taxonomy, uncoloured on the old reasoning that *"the screen already carries five element hues"*. *Option label, not his sentence.* Shape and colour now say the same thing, so a class survives greyscale.

    **The ultimate gave up gold.** It was a solid `el-light` border — the hue stances now take — and two things cannot read the same. Offered a ramp, a sixth colour, or sharing the hue, he chose the **rainbow gradient** across all five element hues, which is a tier of its own rather than a sixth colour competing with the five that mean something. *Option label.* He believed this already existed; it did not. `.frame-ultimate` in `globals.css`, since a gradient border needs two backgrounds and two clip boxes.

    **Three maps became one.** `Hand.tsx` had the categories but used glyphs only, while `KitDetails.tsx` and `SkillDocument.tsx` each carried their own colour map in which **a buff was GREEN and a debuff PURPLE** — so one skill read as two different colours depending on the screen. Asked whether the archive should follow, he chose **one taxonomy everywhere**. *Option label.* It lives in `lib/game/skillTypeStyle.ts`, and a test fails if a screen grows its own again.

    **Two classification bugs found on the way, both shipped.** A **stance mechanic now beats a disagreeing `skill.type`** — Mustafa's *Earth Stance: Fortress* is typed `buff` and Yalina's *Attention Drawer* is typed `debuff`, so both read as something other than the stance they put up. And an **ultimate is classified by what it does**, not by being an ultimate: the old branch fell through to damage unconditionally, so Isolde's Starbound Ward, a pure team buff, carried a sword.

    **Not done:** the SP skill has no class. He ruled it out — it is Molvarr-only and no playable character has one.

134. **A stance card leads with the stance and its duration** (2026-09-16, follows #131–#133; wording rule, so it also lands in `kitwords`). Tanveer gave two 7DS screenshots as the reference and approved the shape read off them.

    **Theirs:** *"Assumes a Stance for 1 turn(s) which Taunts enemies and inflicts Quell damage equal to 360% of Attack when taking damage."* The stance and its duration lead; the parts follow and inherit it.

    **How that was arrived at, since it took two passes.** It was first read off ONE screenshot and stated as their rule. Nine more showed **five leading with the duration and four trailing it**, and the obvious conclusion — that the reference is simply inconsistent — was wrong too. Tanveer supplied what actually separates them: *"7ds is a old game now. The newer units have a better record of being consistent with description as compared to earlier units. Like you mentioned, gilthunder and allioni are very old units, hence their issue."* The leading form is their **current** standard; the trailing cards are legacy text that predates it and was never rewritten.

    So the form is right twice over: it matches the reference's current practice, and it stands on its own merit, since a trailing duration reads as governing only the last clause.

    **The transferable lesson, which is why this is written down at all:** when a reference contradicts itself, check whether the contradiction is **chronological** before concluding there is no rule. A live game's older content is its own archaeology. Sampling one card gave a rule that was too strong; sampling nine and averaging gave "no rule", which was worse — it threw away a real convention because the sample mixed two eras. Recorded in the `kitwords` skill beside the cards themselves.

    **Ours trailed the duration** — *"Takes a stance: taunts all enemies and gains 25% damage reduction **for 1 turn**"* — which reads as though the turn count governed only the last clause rather than the whole stance. All five stance skills now open `Assumes a stance for [stance.duration] turns: …`.

    | kit | now reads |
    |---|---|
    | Yalina, Attention Drawer | Assumes a stance for 2 turns: taunts all enemies and gains 60% damage reduction. |
    | Mustafa, Earth Stance: Fortress | Assumes a stance for 2 turns: grants allies 60% damage reduction. |
    | Iron, Iron Wall | Assumes a **defensive** stance for 2 turns: reduces damage taken by 40%. |
    | Meliodas, Full Counter | Assumes a stance for 2 turns: counters attackers for 400% of ATK when taking damage. |
    | Toll Collector, State Your Business | Assumes a stance for 1 turn: taunts **all enemies** and reduces damage taken by 60%. |

    **The same pass fixed two older defects.** Full Counter was three sentences and **named its own caster** — *"Meliodas counters with damage equal to … of **his** ATK"* — the only card in the game that did, against #26's "no 'own'". And State Your Business said a bare *"Taunts"*, which was one enemy under the old engine and became **all** of them under #131: its own text was the one description that ruling actually invalidated.

    **The panel follows the same rule.** A stance states its duration once, on the group, and its parts show none — `memberDurationToShow`. Repeating the number on every row read as several independent timers on one thing. A part whose duration genuinely differs still shows its own.

    **The unit tile keeps counts, not icons.** 7DS shows one icon per effect; Tanveer confirmed counts and said why: *"all icons being visible … looks very congested on small screens such as phone. Unless we decrease the size which wouldn't work in our case as we have cards, not 3d models."* This upholds his 2026-08-13 call and settles it against the reference rather than despite it. Stances are their own token in that strip (#133), so the class is still visible: `↑2 ◆2 ↓1`.

    **Still open, offered and not taken:** `skill.type` is wrong on two of these — Fortress is typed `buff` and Attention Drawer `debuff`, though both put up stances. Measured: changing either to `"stance"` is **behaviourally inert**, and Yalina's now-redundant `aoe` mechanic is inert too (the taunt needed it before #131). Mustafa's `aoe` is **not** — removing it stops the stance reaching anyone.

135. **One vocabulary per mechanic** (2026-09-16, follows #134). Shown three wording splits the stance pass had exposed and asked to pick; he took all three: *"Go with all 3. I like all the options."*

    **Damage reduction reads "reduces … damage taken by N%".** Two kits said *"gains/grants N% damage reduction"* and two said *"reduces damage taken by N%"*. Both phrases are glossary keys and they mean **different things** — "damage reduction" is the effect, "damage taken" is the stat — and three rules independently pick the second: the audience rule says a self effect **names no audience**, so "gains" is a word that should not be there; the effects panel prints "−25% damage taken", so card and panel now share one vocabulary; and "reduces" is a verb, matching `lifesteals` / `extorts` / `seals`. Ally-facing keeps its audience because it must — *"reduces allies' damage taken by N%"*.

    **Counter damage uses the corpus's damage shape** — *"counters attackers for damage equal to N% ATK"*. Every other skill in the game states damage as "damage equal to N% ATK"; Full Counter was the only one phrasing it otherwise. Its trailing *"when taking damage"* went because **"counters" already says when**; a trigger is written inline only when it adds something, the way *"when an ally is attacked"* would.

    **A cancel clause ends in a semicolon, not "and".** Two kits wrote *"Cancels buffs and does damage…"* against seven writing *"Cancels buffs; does damage…"*. **Both render identically** — `joinClausesAsProse` prints the "and" either way — which is exactly why it survived. The semicolon is the *authored* unit and it is what `dropZeroValueClauses` hides (#44); neither skill had a droppable clause, so nothing was broken, but adding one later would have taken the damage text down with it.

    **A caution the guard itself earned.** Its first version flagged **four innocent skills**: the "and" in *"cancels buffs **and** stances"* joins two objects inside one clause and is correct. The check now requires the "and" to follow the object list and be followed by something that is not another object, and the false-positive case is pinned deliberately so a later tightening cannot quietly reintroduce it.

    Confirmed lines and their rejected alternatives are in `.claude/skills/kitwords/EXAMPLES.md`; the roster guards are in `tests/kitDescriptionRules.test.ts`. One consequence: **`"damage reduction"` is now dead glossary vocabulary**, matched by nothing. Left in place for a future kit that wants the noun form.

136. **An ascension trial is a battle road — several fights on one HP bar** (2026-09-16, applies #103 outside story, fills the encounter #127's board left empty). **PROVISIONAL — the structure is still his.** Same day, after the first build: *"I guess this needs more of a personal touch from me so let me think about it and we'll make a structure."* The quotes below are real and the code shipped against them, but he is reconsidering the shape, so **do not treat this entry as settled and do not build on it** until he says. It is recorded rather than dropped because the engine work it drove — the wave runner leaving story, the cancel of the boss reward path for trials — stands whatever structure he lands on. The rank walls have had trials declared since the rank system shipped and **no encounter behind either of them**. Tanveer designed the first one:

    > *"Now i would like it to be a series of fights against groups of enemies. I was thinking 3 fights. Starting with a group of 3 npc enemies. 2nd fight would be against a elite enemy but non-boss enemy, lyra? 3rd fight would be against molvarr."*

    Then, from a Dokkan Super/Extreme Battle Road screenshot: *"Clearing one fight will lead to next one. The hp of chars stay. And there is no heal in between."* That rule already existed as **#103** and was built for story waves; this is the first use of it outside story, and it is why `lib/game/stageRun.ts` is no longer story-shaped — it takes a `RunnableEncounter` (an id and a list of waves), which `StoryStage` satisfies structurally. Authoring the trial as a fake story stage would have dragged scenes, missions, chapter rewards and an origin tag behind it.

    **Wave 1 fields four NPCs, 3+1.** His call: *"It can also be a 3+1 sub battle. All four npc can be present."* Frost, Gale and Prism on the field with Iron benched; the sub promotes when a field unit falls, which holds the enemy at 3 actions a turn past the point a trio would drop to 2. It also answered the open question of which of the four to leave out — none.

    **The difficulty target is a player band, not a number.** *"we have to tune the difficulty so that a team of all level 20 chars would have a 4/10 difficulty feel but anything lowered level team or poorly made team would struggle a lot."* Level 20 is necessarily ascension 1, so the reference team is **1.489x** base. Levels are authored per enemy per wave, so the dial never touches a kit. Measured values and the method live in `lib/game/trialEncounters.ts`; do not re-derive them from this entry, which deliberately states no figures (see this ledger's own header).

    **A trial pays no loot.** The lifted cap is the reward, and `clearRankWall` cashes out the XP banked against the wall. The events board previously ran every victory through the world-boss reward table regardless of event kind, so a cleared trial would have paid ascension materials and unlocked Auto Clear on a one-off fight.

137. **Stage, fight, wave and phase are four different things** (2026-09-17, sharpens #103 and #136, supersedes the code's use of "wave"). Correcting an assumption Claude had made — that "wave" was simply the code's word for a separate fight. Tanveer:

    > *"I think wave is still different than a separate fight or a phase… wave is basically a group of enemies, a new set of enemies appearing. Phase is just a single enemy transitioning to a new state."*

    **CORRECTED the same day — he restated the whole vocabulary unprompted, and this is the version that stands:**

    | term | means |
    |---|---|
    | **Event** | **a folder.** A group of stages — *"Ascension Quests (Event), and then it would show Ascension Trial 1 (Stage), Ascension Trial 2 (another stage)."* |
    | **Stage** | **an entry** to a particular fight or story panel. Story stages, event stages, the Molvarr boss stage. |
    | **Fight** | player vs any number of enemies. **Starting one resets everything** — *"it doesn't sustain anything from prior fights."* May hold more than one phase. |
    | **Phase** | **any transition to a new state inside one fight.** A new set of enemies, or the **same** enemy back with a stronger or different kit, or one enemy changing form. **A fight is not won until every phase is cleared.** |
    | **Stage map node** | a place on a stage map a player can land on — item drops, fights, jump points, an end point. Movement comes from a **"stage navigator roll"**. Nothing like it exists in the code. |

    **"Wave" is retired as a term.** What the first version of this entry called a wave is now simply a **phase**; the distinction it drew — *"a wave changes how many enemies there are, a phase changes what one enemy is"* — **was wrong**, and is recorded here because it was briefly in the ledger.

    **Two worked examples, his:** the **Molvarr fight is one fight with two phases**; the **First Ascension Trial is three fights in one stage, not phases**. And what a phase contains is his call — *"three minions and then the main guy, or the same guy who gets stronger in the next phase. That's my choice."*

    **So `CharacterPhase` does not collide.** An enemy changing form is one *kind* of phase, not a different concept sharing the word, and nothing about it needs renaming.

    **What "resets" means, and it is a reading rather than his words:** *"everything goes to initial values"* covers **in-fight** state — turn count, buffs, debuffs, ult gauge, passive state — while **HP and death are stage-level** and carry across a stage's fights. Both of his rules only hold together this way, and it is what `startCustomBattle` already does (everything resets except `carryHp`). Flagged to him as an inference.

    **Consequence — the code is misnamed, and the corrected table does not change the target.** `StoryWave`, `waveIndex`, `waveEnemies`, `waveTeam`, `applyWaveOutcome`, `WaveBreak` and `foldWaveFromBattle` all mean **fight**. The player-facing strings already say "Fight N of M"; the code is the odd one out. The name is now actively dangerous rather than untidy, because `wave` is occupied by the concept one level up and a future reader of `waveEnemies` would reasonably expect reinforcements. Rename before more content is authored against it.

    **Two stage shapes named the same day:** a **world boss** is one stage with one fight, that fight usually carrying phases, and it is a *category* rather than a description of Molvarr — *"any other boss, I consider that a world boss battle."* An **ascension trial** is several fights in one stage; his word for the feel is *"marathon fights"*. Molvarr is the category's only member today.

138. **A dominant strategy is a missing counter, not a defect** (2026-09-17, governs how balance findings are reported; also in `AGENTS.md`). Tanveer, on being shown that a defence-stacked team beats content outright:

    > *"My whole game is based around this rock paper scissors mechanic… I may introduce characters who have stances that let them have the damage reduction effect, but then characters with cancel stances would be in meta to counter such units… There will never be a problem that will interfere in the game for too long. We will always have a solution in some shape or form."*

    So the answer to a dominant strategy is **the next mechanic**, not a nerf to the existing one. A measurement showing something dominating is reported as *"X currently has no counter"*, with the interaction named — never as a defect, never with a proposed nerf, and never by tuning an encounter to route around a kit he can change himself. Naming an unanswered strategy is doing him a favour: it says where the next mechanic goes.

    Compatible with **#56** (*"Values are free. A number that doesn't land on a tier is intentional, not a bug"*) and with his own worked example the same day — Lyra's first-action DEF passive was **tripled** from its original value on purpose, to reward a niche playstyle.

    **The layer already exists in code.** `cancelBuffs` and `cancelStances` reach different things (#132), so the counters were authored before the units that will need countering.

139. **What is his and what is Claude's, stated precisely** (2026-09-17, sharpens the Design Ownership section of `AGENTS.md`; also recorded there). He set out the split, then narrowed it when Claude read "design" too widely:

    > *"I manage the thinking process of the story side. You handle the code side and the design side… you are my co-assistant — you are doing the coding stuff and I am doing the thinking stuff. But our vision should also match."*

    > *"When I said design, it's mostly the site structure, data types, that kind of design. I'm not talking about UI, UX — obviously that is my domain mostly, but then I do let you know what I need and how I need it, then you can code it out. That also comes under programming."*

    | Claude | Tanveer |
    |---|---|
    | Site structure, data types, schemas, naming, what is measurable | **UI and UX direction** |
    | Implementing his UX direction — that is programming, not design | Story, mechanics, kits, numbers, characters |
    | Measuring, and describing the shape of a dial | Choosing every value on it |

    **Claude does not originate UX direction.** The mobile rules (#107, #118–#125) are the *record of his direction*, not licence to invent more; surfacing a screen that breaks one is measurement and is welcome.

    **One invitation-only carve-out:** he may ask for **names or kits for low-significance characters** — *"NPCs, or people who I don't feel like writing for… then I can ask for your suggestions."* By request only. It does not loosen #65, and never reaches a character who matters to the story.

    **And his three engineering values, in his order:** *"consistency, modularization, and QOL."* **"It works" is not the bar** — a change adding a seventh variant of an existing button is a regression against consistency, and a fix landing in one screen rather than the shared primitive is a regression against modularization. **QOL** is specifically the affordances that make a feature usable rather than merely functional: *"when you create a new table — without QOL you don't add any search field, you don't add any filters, sort options, animations."* `components/game/CharacterBrowser.tsx` is the benchmark.

140. **A transformation shares an archive entry; a version gets its own** (2026-09-17, follows #137's vocabulary, governs `app/archive/[id]`). Asked how a multi-phase boss should appear once phases move from the character to the fight, he drew the line by example:

    > *"We'll keep only one entry to check what Molvarr does. By default it will show the phase one details, but there will be another section that can let the users click on it, and then it will show them phase two details. Technically it will be two separate kits, but it will show on the same page.*
    >
    > *Right now we have a Red Lyra, then we can have a Green Lyra. **Those will not be on the same pages, those will have their own dedicated archive entries.** But if a boss, or even a single playable unit, has multi phases or multi transformations, then it will be on a same single entry."*

    So the test is **what the thing is to the player**, not how the data is stored: forms of *one* unit that it moves between — boss phases, a transformation — are one entry with a switcher, even though each form is technically its own kit. **Separate versions of a character** — a re-coloured or re-imagined alternate — are separate entries, because they are separate units a player owns and fields independently.

    **The component already exists**: `components/game/KitPhases.tsx`, built 2026-07-20 and explicitly *"reusable for playable-character transformations later"*. Tabs per phase, a plain kit when there is only one. Only its data source is affected by the phase work in `Plans/2026-09-17-fight-phases.md`.

141. **A unit is a heading plus a name** (2026-09-17, follows #140, adopted from Dokkan). Every variant of a character keeps the **same character name** and is told apart by a **heading** above it:

    > *"That game usually has two names for a single unit — a heading and then the name. So it could be like 'An Unyielding Foe' as the highlight, and then it would be 'Frieza Final Form Full Power'. Red Lyra might have some line and then it would be Lyra, and the green Lyra would have a different heading but the character name would be the same — Lyra.*
    >
    > *How would that help us in the boss fights? The story version will have a different heading but obviously the same name, and the proper strong fight one will have a different heading. And obviously different kit. And in terms of coding, it would mean a different character ID."*

    **The shape:** `id` is unique per variant (already true), `name` is the character and is **shared** across variants, and a new **heading** distinguishes them. So Red Lyra and Green Lyra are both *Lyra*; the story Lyra and the farmable Lyra are both *Lyra*; the heading carries which one.

    **This fixes something already broken.** `lyra` and `lyra_npc` **both display as "Lyra"** today, in all 57 places a character name renders, with nothing to tell them apart — the only duplicate display name in the roster, and it exists now rather than in some future banner.

    **It also tidies #140's naming.** Molvarr's second phase was going to be called *"Molvarr (Roused)"*; with a heading it is simply heading **Roused**, name **Molvarr** — the parenthetical was the absence of this field.

    **Not the same axis as #140.** That ruling decides how many **archive entries** exist (transformations share one, versions get their own); this decides how a unit is **labelled** wherever it appears. A phase and a version both get a heading; only one of them gets its own page.

    **Evidence: his description plus four DokkanDB screenshots** he supplied the same day (transcribed in `Plans/2026-09-16-pve-structure.md` point 22). The decisive one: searching "Ultimate Gohan" returns six cards, and **two of them are both Super AGL and both UR** — colour and rarity do not separate them, so the heading is the *only* label that does. A heading is an identifier a player reads, not flavour.

    One rule follows from that: **heading and name are unique only together**. `id` remains the key; this is a display-uniqueness rule, worth a guard once headings exist. **Nothing else should be read off those screenshots** — they are a third-party fan database, and its typography, search and layout are that site's choices, not Dokkan's and not his (*"I'm just giving you information on how another game does it — everything else doesn't matter"*).

    Field name, schema shape and the display-site migration are Claude's (site structure and data types, #139). **Every heading's text is his**, like any other name.

142. **The stage map is a gameplay mechanic, not a difficulty mechanic** (2026-09-17, closes point 23 of `Plans/2026-09-16-pve-structure.md`, governs how any board work is scoped). Claude had spent the whole research pass treating the branching board as a decision layer — routing as resource management, a "mastery loop", a self-set difficulty dial. Tanveer cut all of it:

    > *"Don't get the wrong idea. Mastering the map is not the hard part — it doesn't even add to difficulty in any shape or form. The actual fight is what matters… we can have a small board, it would still feature the Molvarr fight; we can have a big board, it might still feature only the Molvarr fight. The map has nothing to do with the difficulty. It is just a gameplay mechanic, and it really does not contribute much to difficulty in any shape or form."*

    **Difficulty is authored entirely in the fights** — enemy levels, kits, phases. That is where it already lives in code: `lib/game/trialEncounters.ts` sets a level per enemy per fight, and point 6's "4/10 for an all-Lv20 team" target was hit by moving those numbers. **A board never tunes a stage.** So when a stage plays too easy or too hard, the fix is in the encounter, never in the map.

    **Three independent axes, and none predicts another:** board **shape** (structural — Claude builds, he picks per stage), **farmability** (entirely his, per stage — he states it, it is never inferred), and **difficulty** (entirely in the fights). His own test case is the same Molvarr fight sitting on a small board or a big one at identical difficulty.

    **Same failure shape as the farmability correction earlier the same day** — *"You are assuming that every stage can be farmable. That's not the case."* Both times a single described example was generalised into a rule about a whole board category. Point 23 records both corrections in place, with the superseded framing named rather than deleted.

    **What this changes in practice:** board work is scoped as presentation and pacing, sized accordingly, and **never used to justify or explain a difficulty number**. It does not change what is built — nothing board-related is built yet — it changes what a spec for it may claim.

143. **A character is identified by a card number in public, by `id` in code** (2026-09-17, implements #141's display half, governs `app/archive/character/[cardNumber]`). Asked where headings should appear, he answered that and then added a routing rule:

    > *"Headings wouldn't appear in battle UI. But on archive entry pages? Yes. The url would show the char id. Not the names. E.g. archive/character/134557."*

    **The finding that shaped the fix: `id` IS a name.** Every kit's `id` is a slug like `duke` or `batra`, so the old `/archive/duke` was exactly the URL he was ruling out — and `id` could not simply be renumbered, because it is the key every save's `roster` array holds (`CLOUD_FIELDS`, synced to Firestore), plus what `data/story/*.json` and the banners reference. Renumbering it would have invalidated stored rosters.

    **So there are two identifiers, deliberately.** `id` stays the internal key and never appears in a URL; **`cardNumber`** is a second, immutable integer that exists purely to be shown — the same split Dokkan's own `/cards/<number>` URLs use. All 31 kits carry one (100001–100031), the archive entry page prints `No. <number>` where it used to print `id`, and `archiveHref()` is the single place the path is spelled.

    **A card number is assigned once and never changed or reused.** It is a public URL, so changing one silently breaks any link to that card. The initial block was handed out in alphabetical order of `id` purely for reproducibility — **that order carries no meaning, nothing may re-derive a number from it, and a new character takes the next free number rather than an alphabetical slot.** `tests/characterHeadings.test.ts` pins uniqueness and range.

    **Where headings appear:** archive entry pages **yes**, battle UI **no** — which matches the constraint that battle density is his and a 47px hand card has no room for a title above a name. He then asked for the remaining surfaces too, so `CharacterBrowser`, `TeamPicker`'s roster tiles and the gacha reveal all carry one; the last two are tight and are flagged for his visual pass.

    **The six generic enemies share `Common Foe`** — he asked for a heading on them rather than none. The faction set offered first (Checkpoint / Bandit / Raider / Wilds) was dropped because it stutters against the names it sits above: *Raider* over **Raider**, *Bandit* over **Ford Bandit**. All 31 kits now carry a heading and `tests/characterHeadings.test.ts` has no exempt list.

144. **A redesign starts with mockups — several, so he can pick** (2026-09-17, extends #106 from a file-format rule into a workflow; also in `AGENTS.md`). #106 settled that a mockup is an HTML file rather than a chat widget. This settles **when one is drawn and how many**:

    > *"If you want to go with the new workflow — while we are working on the website and I ask you to redesign something, what you can always do is draw mockups, and then I have a look and then I can tell you which of the mockups is the best one."*

    **So: asked to redesign a screen, draw options first and build nothing.** Not one proposal to approve or reject — **several to choose between**, because choosing is faster for him than critiquing, and the comparison is what surfaces the trade-off. Options that differ only in decoration are not options; each one has to take a different position on the actual problem.

    **This is the shape #139 asks for.** UI and UX direction are his and Claude does not originate them — but drawing candidates is not originating, it is *presenting a choice*, and measurement (what is slow, what is inconsistent, what is 190 taps) is squarely Claude's. The mockup is where those two meet: Claude measures and draws, he decides.

    Mockups live in `docs/design/mockups/`, self-contained, in the game's real palette and fonts, drawn at **390px** (#107). The first one under this ruling is `growth-modal.html`.

    **Existing work this changes:** nothing already built. It changes what happens *before* the next redesign — the layout system, the events decomposition and the Kit Numbers rework were all built directly from measurement this session, and under this ruling the visual half of each would have been drawn first.

145. **Players are conservative with resources — never design as if they spend freely** (2026-09-17, corrects a framing in the growth-modal mockups, governs any "spend it all" affordance). Option B of `growth-modal.html` was drawn as *"the inverse, and closer to how a player actually thinks: I have these manuals, dump them."* He rejected the option and, more usefully, the premise:

    > *"Spend first is not good — I don't want people spending all of them. 'Closer to how a player actually thinks: I have these manuals, dump them' — not really. A lot of people play it conservatively, so that they are very conservative with their resources. So it's not always the truth. Someone like me who just wants to level up characters as soon as possible, yes sure — but not for all of them."*

    **The design consequence:** an affordance whose default is *spend everything* is wrong even when it is convenient, because it serves one play style and quietly punishes the other. A hoarder must never have to undo a default. **Claude's own habit of playing fast is not the player model**, and neither is his — he named himself as the impatient case and still ruled against designing for it.

    **The reasoning error is the familiar one**, in a new place: one plausible player was generalised into *"how a player actually thinks"*. Same shape as the farmability and difficulty corrections earlier the same day (#142), and as ruling #134 — a single case promoted to a rule. See the session memory `one-example-is-not-a-rule`.

    **What was chosen instead:** **option C**, which offers targets *and* per-stack control with nothing hidden, so neither play style has to fight a default. The auto-solve therefore spends **cheapest tier first** — it burns the common manuals and preserves the rare ones, which is the conservative instinct — and any row can be pinned to override it.

146. **A mockup he cannot click cannot answer how it flows** (2026-09-17, sharpens #144). Reviewing the growth mockups:

    > *"Target first — look, it is very good, it looks good. But I'm not sure how the ascension and ultimate tabs would flow like. I can't click on them."*

    Static mockups answered *what does it look like* and left *what happens when I use it* unanswered — on a design whose whole subject was tabs. **Draw mockups with the interaction live**: tabs switch, targets select, costs recompute. It is a few lines of vanilla JS in a file that is already self-contained, and it is the difference between him judging a picture and judging the design. Recorded in `AGENTS.md` beside #144.

147. **The news page answers "what changed while I was away"** (2026-09-18, first design chosen under the #144 mockup workflow). Offered three positions — a tightened flat feed, a "since you last played" split, and a searchable changelog — he chose the second: **"go with B"**. **That phrasing is an option label he selected, not prose he wrote.**

    **The shape:** posts newer than your last visit sit in their own block at the top; everything else is an archive below it, with search, the kind filter and pagination attached to the archive rather than the page.

    **It needed no new persisted field**, which is why it was buildable straight away. `markNewsViewed` already stores **one date**, and *"new since your last visit"* is exactly what one date means — so the heading states the model rather than implying per-post tracking. Opening the page still marks everything seen, including posts you did not open. **Per-post read tracking remains undecided and unbuilt**; it would be a new `playerStore` field and would need a cloud-sync decision.

    **Two features on that page had never rendered**, and the rebuild kept both while making their conditions honest: the kind filter requires both kinds to exist and there are **zero notices** (`notices/` holds only `_placeholder.mdx`, which `posts.ts` excludes), and pagination requires more than `NEWS_PAGE_SIZE = 15` posts against **nine**. Both now belong to the archive, which is the half that grows.

    **Search was the genuine gap** — `AGENTS.md` names `CharacterBrowser` as the QOL benchmark and news met none of it. `searchFeed` is pure and tested; it reads title and summary only, because a hit on text that is not on screen reads as a bug.

**Kit data stays JSON** — settled 2026-08-04. It's runtime data `combat.ts`, `descriptionTranslator`, `damagePreview`, the Zod schema, Kit Lab and ~20 test files all depend on. MDX is for prose (`content/news/`), not for kits.

**Known follow-ups, deliberately not done:**
- ~~The battle log can't show *which buffs/debuffs an action applied*~~ — **done 2026-09-01.** `BattleActionEvent.effects` and `BattleTickEvent.effects`, captured as a before/after diff (`lib/game/effectDiff.ts`) rather than emitted at each of `combat.ts`'s ~24 push sites. See Open Issue #22 in `docs/STATUS.md`.
- No shared `CharacterGrid` across `CharacterBrowser` / TeamSelect's roster overlay / the gacha pool. They differ in *interaction* (browse vs multi-select-with-order vs read-only rates), so one grid would need a prop per difference. The genuinely shared unit is the character tile.

148. **A fight in a run ends on the road, not on a card; the run ends on its own
   recap** (2026-09-20, second design chosen under the #144 mockup workflow,
   governs `components/game/events/TrialRail.tsx` and `ClearSummary.tsx`).
   He played the First Ascension Trial for the first time and reported what the
   screen did: *"when I complete each fight in the trial, it does show me claim
   rewards button, which doesn't apply here technically because there are no
   rewards to be claimed … so that screen doesn't matter."* His direction for
   what should replace it: *"when they finish the fight, it could just be like a
   maybe a summary of the battle and then next fight continue or something"*, and
   at the end *"congratulations on beating the ascension trial … account levels
   21 to 40 or whatever is unlocked."*

   Offered three positions on the mid-run screen and two on completion
   (`docs/design/mockups/trial-run-flow.html`), he chose **C** and **E**.
   **Those letters are selections from options Claude drew, not prose he wrote**
   — the sentences describing them are Claude's. What is his is the report above
   and the direction in it.

   - **C** — no victory card mid-run. The win is announced *on top of* the
     battle road, which the player was going to see anyway, so the fight's
     numbers and the route ahead are read in one movement and one tap.
   - **E** — the completion screen recaps the run fight by fight before naming
     what opened. A trial is a three-fight commitment on one HP bar (#103), so
     the recap is what makes the attrition legible in hindsight.

   **The defect under it was two branches for three flows.** `BattleArena` chose
   its victory and defeat labels with `story ? … : …`, so the trial — which
   passes the `worldBoss` prop — inherited the boss's words: CLAIM REWARDS on a
   run that pays no loot table, and, on a loss nobody had hit yet, BACK TO WORLD
   BOSS. A caller now names its own labels (`continueLabel`, `quitLabel`) instead
   of the arena inferring them from which prop was used.

   **The ceiling figure is data, not prose:** `RANK_WALLS` in
   `lib/game/accountRank.ts` is what makes this trial read 20 → 40.


149. **The villain is spelled Seris; `seras` stays as her code id** (2026-09-20,
   applies #143's split to a name rather than a URL). The kit JSON read
   `"name": "Seras"` while `Master_Context.md` and the Chapter 17 and 19 dialogue
   tags read **SERIS**. Asked which was canon:

   > *"One and same. I sometimes spell her either way. Seris is canon name tho."*

   So the **display name** is now `Seris` (`data/characters/seras.json`), and the
   two news posts that named her in prose were corrected with it — there is no
   player base yet (see the STATUS note), so consistency beat preserving the
   wording of a shipped patch note.

   **The `id` deliberately did NOT change.** `seras` is the key every save's
   `roster` holds, exactly as #143 found for `duke` and `batra`, so renaming it
   would invalidate stored rosters to fix a spelling nobody sees. The filename,
   the art path `public/characters/seras.png`, `tests/seras.test.ts` and the
   engine comments keep the old spelling for the same reason: **the id is code,
   the name is content.** A future session that finds this mismatch should read
   it as deliberate rather than tidy it up.

   **She has two appearances, and that is an art constraint, not trivia.** Her
   official Ledger form (silver-white hair, black coat) is what
   `public/characters/seras.png` shows. Her civilian form is a separate
   appearance known to almost nobody, glimpsed in Ch10, and the beat sheet
   requires it to stay **unidentifiable** — so it is a second portrait whose job
   is to not read as the same person.


150. **A character's skills are named from a theme, not from their mechanics**
   (2026-09-20, corrects how every existing kit was named, governs
   `data/characters/*.json`). Asked to re-name Lyra's skills from canon, he
   explained why the shipped ones were wrong — they had been derived backwards
   from what each skill *does*:

   > *"I didn't fix these names myself. It was actually done by you, well, not
   > this version of you … he based the attack names around what they do. So
   > like, this skill does decay debuff, then yeah this would be the name. But
   > no, that's not how it needs to go."*

   **The model he gave is JoJo and Dragon Ball:** *"some authors tie in certain
   elements or certain themes with their character attacks — for example how
   JoJo stands were first based on tarot cards and then bands and singers, same
   with Dragon Ball Z where Saiyan names are basically vegetables."*

   **This is not a Lyra-only rule.** *"We don't have to do it with just one
   character, we can do it with all of the characters, or most of them if not
   all."*

   **Lyra's theme is temperature science** — melting point, flash point, thermal
   shock, supercooling, latent heat, absolute zero. It was chosen because it is
   thematically true rather than a wink: her whole character is a phase
   transition she cannot control yet (`Master_Context.md`: *"freeze-to-burn
   transition currently reactive, not on command — controlling it deliberately
   is her untapped ceiling"*).

   **What this means in practice.** The shipped names read as a fire character
   — *Volcanic Frost*, *Magma Shaft*, *Absolute Zero Ignition* — when her
   element is **Ice (mutated red)** and the heat is only what happens when the
   ice breaks. That inversion is the tell of mechanic-first naming, and it is
   what to look for when auditing the rest of the roster.

   **Renaming a skill breaks its art.** `getSkillArt` keys on
   `<id>__<slug(skillName)>`, so the moment a name changes the card silently
   falls back to the character portrait. Rename the files in the same commit.

   Theme assignment for every other character is **his**, one at a time, and
   nothing is renamed without him — #65 is untouched by this.


151. **A weapon is its own asset; character art does not carry it** (2026-09-21,
   adopted from Genshin after comparing it against Dokkan, governs
   `docs/ART_PIPELINE.md` and every future character render). Researching how
   other games handle a weapon on a character card, he settled the route:

   > *"Since we are not professional artists and can't really spend too much
   > time, I think the Genshin route is the best one for our game for now,
   > simply because we don't have to do a lot of manual work."*

   **What the reference actually showed** (HoYoWiki, read 2026-09-21). A Genshin
   weapon ships as **two** assets, not one:

   - a **source**: the whole weapon *inside* the frame, plain flat ground, no
     effects, no gradient — and
   - a **card**: that same art cropped, rotated onto a diagonal, **breaking the
     frame**, on a rarity-tinted radial gradient.

   One master, one derived presentation. The same principle the Dokkan layering
   already gave us (#see the character-layer pipeline), arrived at independently.

   **Most bow users' character art shows no bow at all** — Gorou is the
   exception, not the rule.

   **Why this is the right call for us and not just the cheap one.** The
   hand-on-prop relationship is this project's hardest recurring failure: Lyra's
   original portrait has no hand on the bow and a string attached to nothing, and
   ControlNet's hand keypoints are too coarse to fix it. Taking the weapon out of
   the character render **deletes that failure mode** rather than fighting it.

   **Claude's caveat, recorded because it is a real cost:** a bow-less card
   weakens an archer's identity. The resolution is that **skill artworks still
   show the weapon** — Shatterburn and Flash Point are meaningless without it —
   while the neutral character layer does not.

   **A weapon design is LOCKED once approved.** His words: *"once we decide on
   something then it is official, and then we have to make sure any future
   generations of said weapon will be consistent."* Lyra's bow is **drawn, not
   generated** (`scratchpad` script, to be promoted into the repo), which makes
   that guarantee free: the same script always produces the same bow, at any
   angle, with the string exactly attached. A generated weapon could not promise
   it.

   **Amended the same day:** her mid-tier bow covers **all of Arc One**, not just
   chapters 1–17. The signature bow is **Arc Two** — *"maybe not in arc one, but
   in arc two"* — so it is not an asset anyone should be planning for yet. Bow
   approved and shipped: `public/props/lyra_bow.png`, drawn by
   `scripts/draw_lyra_bow.py`.

152. **Story mode is removed from the game, for now** (2026-09-26, parks #108 and
   every story ruling; amends #123 and #127). After an audit found story's
   scene-only stages ending on a blank screen that soft-locked chapter 1:

   > *"I would rather focus on the game build on it build the PvE content build
   > characters build mechanics before we try to implement the story so get rid
   > of the story that's one first thing"*

   **What went:**
   - `/story` and its screens, the scene reader, `data/story/`,
     `storyStore`, and the story catalog, rewards, missions, team modes and
     backgrounds (18 plates in `public/backgrounds/`).
   - Story's music roles, `Filler/`, the `FillerAssist` skill, the story
     design drafts, specs, mockups and reference images.
   - The home screen's story hero card and the Story nav tab. The bottom bar
     is four tabs now; what fills the fifth slot, if anything, is his call.

   **All of it is restorable from commit `2f6b016`.**

   **What stayed, because it is PvE engine rather than story:**
   - The multi-fight runner, renamed `lib/game/fightRun.ts`, since "stage"
     was story vocabulary. Trials use it.
   - Stage effects and the win-at-HP-threshold condition.
   - `storyOnly` kits: they are characters, and the flag is kit schema.

   **Bureau Orders**, two selections (option labels he picked, not his words):
   - He picked **"Delete story ones"**: the four story orders
     (`first-chapter`, `lyra-joins`, `s2-story-five`, `s2-part-four`) and the
     `stagesCleared` / `stageCleared` goal types went.
   - The two preset orders now point at Events.
   - **Each step is eight orders now, not ten** — his own "keep it with 10
     missions" rule, left open for him.
   - Lyra stays obtainable from the debut banner.

   He also picked **"Delete, note the commit"** for the non-code material.

   **Parked, not overruled:** Molvarr's chapter-9 visibility gate (#127)
   returns with story. So does the filler approval process (#108's
   companion rules): its canon source, `E:\Toll - Web toon`, is untouched.

   **In `AGENTS.md`:** do not rebuild story or add story hooks to new work
   until he says it is back.

153. **A battle cannot be walked away from; it is finished or forfeited** (2026-09-26).
   The audit found a battle outliving its screen. A reload came back on the
   events board with the fight still live in the store, and `/practice`
   rendered any live battle it found, so a world boss won there paid nothing.
   His rule, dictated:

   > *"it should not happen if a uh, reload happens or if uh, or if the page
   > tries to navigate to another page"* … *"the battle should just continue"*
   > … *"they should not be allowed to go anywhere else and ignore the battle"*

   **Built:**
   - Every battle carries a `BattleOwner` (`types/battleOwner.ts`): the
     screen that started it, plus enough to rebuild that screen (the boss and
     its difficulty, or a trial's whole run). It is persisted with the battle.
   - `BattleLock` (root layout) sends any other route back to the owner.
     The rule itself is `battleLockRoute` (`lib/game/battleLock.ts`, tested).
   - The top nav's links and wordmark stand down during a fight. The bottom
     tab bar already did.
   - A reload resumes the fight on its own screen.
   - A finished boss or trial fight resumes **on its victory card**, because
     the rewards are paid from that card's button. Resetting it to nothing,
     as the store used to, walked away from them.
   - Practice and the hub no longer render other screens' battles.

   **"Unresolved" is Claude's reading, flagged as one:** the lock holds from
   the first turn until the owning screen resets the battle, so it covers
   the victory and defeat cards too. Forfeit is the existing Exit Battle
   control.

   **Not covered, and open:** the break between two trial fights is not a
   battle, so a reload there still loses the run.
