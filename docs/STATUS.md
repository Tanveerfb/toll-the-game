# Status — 2026-08-22

Living snapshot. Session history is folded to
[`docs/archive/STATUS-2026-08.md`](archive/STATUS-2026-08.md); the resurrection
audit is in git (`docs/STATUS.md` @ `c3040f7`).

## Start here

**State:** The game is mobile-first everywhere, battle included, and has an app
icon and a PWA. Six pieces of tooling landed in one batch — a11y linting, a
balance simulator, browser component tests, an SFX bus, the PWA, telemetry.
Suite **1,327 unit tests / 105 files** plus **12 browser tests**, build clean.
Rulings **#118–#122**.

**Next:** His visual pass. Nothing from 2026-08-21/22 has been seen in a
browser — the whole mobile sweep, the rebuilt battle screen, the hold gesture
and the new icon are all static-analysis-verified only.

**Blocked on:** Nothing. Two things wait on *him*, not on work: the OST and SFX
files (`docs/AUDIO.md` lists them; both buses are silent by design until they
exist), and a Sentry DSN.

**Don't trust:** Any claim about how something *looks* or *feels*. Specifically
untested by anything: the service worker (dev-disabled, needs a production
origin), the PWA install flow, and Sentry (inert without a DSN, and
`withSentryConfig` deliberately not applied, so traces stay minified). The 1.5s
hold could still read as sluggish in a real fight.

## Working (implemented, tested, browser-verified)

- **All five `Plans/` specs built (2026-08-20)** — one session, no new features, five engine capabilities. Verified after the doc edits: `npm run check` green at the time (**1,270 tests / 101 files**; 1,327 / 105 as of 2026-08-22, same 3 pre-existing eslint warnings in `tests/duel.test.ts`), clean `NEXT_DIST_DIR=.next-verify next build`, `.next-verify` removed. **Not browser-verified.** Rulings **#112–#114** added; **#111** amended from "designed, not built" to built.

  ### Substat readers that missed `stats` arrays — closed
  `entryTouchesStat(entry, stat, { allCounts })` in `lib/game/stats.ts` replaces three near-copies of the same match. The `allCounts` flag is deliberately explicit: ruling #55 puts **damage reduction and evade chance outside "all stats"** and #36 makes `damageDealt` a damage modifier, so those three must be reachable by exact name and by a `stats` array but never by `"all"` — a reader added later has to state which side of #55 its stat sits on instead of inheriting an answer it never considered. `getDamageDealtMultiplier` and `getDamageReductionMultiplier` now read arrays; **evade and damage reduction now read debuffs**, which they never did (*"we do have to fix evade and DR parts too"*). A DR debuff can strip reduction to zero and no further — making a target take *extra* damage is the attacker's `damageDealt` job, not a negative DR.

  ### Placeholders can name a field positionally
  `[x-ranked.duration]` — `resolveByMechanicIndex` forwards a field to `resolveMechanicField`, which already accepted one. That makes **two mechanics of the same type** both addressable; before, `[buff.duration]` resolved the first buff and bare `[x-ranked]` printed the stat percentage where a duration belonged, silently. `dropZeroValueClauses` learned the same form, so a zero-duration clause authored positionally still hides (#44). `kitwords` no longer tells the author to write those durations literally.

  ### [Guard] and [Effective] (#111) — built, unused
  `resolveTypeModifier` in `lib/game/typeAdvantage.ts`; `getTypeModifier` stays the raw chart lookup because #11 quotes it as the plain matchup. Both live inside `damage.ts`'s `!criticalMechanic` branch, which is what makes **"critical bypasses both"** fall out with no code of its own. **Guard is no protection against a crit** — deliberate, and it needs saying in UI copy or it reads as a bug. **Guard stacking was built as a fixed floor** (a second source changes nothing); that was the one open detail in the spec and is still unconfirmed. **No kit authors either word** — putting them on a card is his call.

  ### Mechanic audiences (#112) — the riskiest change here
  A mechanic declares `applyTo` (`self` / `oneAlly` / `allies` / `alliesExceptSelf` / `enemies`) or `applyToRanked`. **Absent means self**, which *inverts* the old fallback where a friendly mechanic without `targetSelf` inherited whoever the skill targeted. Six kits leaned on that inference and now declare it: `isolde` (cleanse + healOverTime + ult buff + ult debuffImmunity), `leorio` (`applyToRanked: ["oneAlly","allies","allies"]`), `mustafa`, `prism`, `siddiq`. `iron`'s Iron Wall becomes the self stance it was always meant to be, with nothing to author.

  The spec's own migration table listed **four** kits; auditing the roster found **six** — it missed Isolde's skill and Prism's/Siddiq's aoe cleanses. That gap is why the audience check is a `kitcheck` row now.

  **Deliberately not built: A4d, `aoe` narrowing to enemies-only.** A heal skill's targets still come from `aoe` plus the skill type, because a heal *amount* has no audience of its own — narrowing `aoe` first would aim every ally heal at the enemy team, and the spec doesn't define a skill-level audience for heals. `aoeRanked` stays on Leorio and Siddiq for the same reason. Recorded in #112 and in `Plans/README.md`.

  ### Damage-then-buff (#113)
  `requiresDamage: true` moves a self buff after the hit **and** makes it conditional on connecting — a tanked (#71) or evaded hit grants nothing, a hit that kills counts, and an AoE arms it once however many enemies were struck. `totalDamageDealt` was already the "did anything connect" flag, so this is a loop split rather than new plumbing. Default is unflagged, so #22 and all 27 kits are untouched.

  ### One passive, made of blocks (#114)
  `PassiveBlock` in `types/passive.ts`, with `lib/game/passiveBlocks.ts` as the **only** reader — a site keeping the old `char.passive?.trigger` + `.mechanics` pair sees just the first block and drops the rest without erroring, and both forms still typecheck, so `tests/passiveBlocks.test.ts` scans `lib/`, `hooks/`, `components/`, `app/` and `store/` for it. Registration is per block, so a passive can fire at two phases; a single-block passive keeps its historic queue id because callers look items up by it. Also `targetTagBonus` — an attacker's passive reading the *target's* tags, symmetric so *"what if an enemy does extra damage against 'human' characters?"* needs no extra code.

  **Molvarr's phase-passive array was left as authored.** It flattens identically through the block reader; converting it is authoring cosmetics with real transcription risk and buys nothing.

  ### Two stale claims corrected in passing
  `characterCatalog.ts` documented the elite bosses as *"Tao/Seras/Lyra_npc"* — only `lyra_npc` and `molvarr` carry `tier: "elite"`, and Master Tao and Seras are playable kits with no tier at all (same drift family as #5). And `kitcheck` still told the reader permanence is stated with the word "Permanently", which #110 had reversed the same day.

  ### Skill edits
  `kitwords` — positional placeholders with fields (replacing the write-it-literally workaround), declared audiences and the self-default warning, `requiresDamage` clause order, `# Basic effects` as the heading for unconditional blocks. `kitcheck` — four new audit rows and the #110 correction above.

- **Engine correctness pass + five project skills (2026-08-20, `6f077d5`)** — no feature work; the session was skills, bug fixes and specs. Verified at checkpoint time: `npm run check` green (**1,235 tests / 98 files**, same 3 pre-existing eslint warnings in `tests/duel.test.ts`), clean `NEXT_DIST_DIR=.next-verify next build` (48/48 static pages), `tsconfig.json` churn reverted, `.next-verify` removed. **Not browser-verified.**

  ### Three live engine bugs, all one family
  A mechanic covering several stats is authored `stats: ["atk","evade"]` with no `stat` field — the shape ruling #55 actively encourages. Every reader matching on `entry.stat` alone silently dropped the whole entry.
  - **`evade.ts`** — a regression I introduced the same day: merging Chiara's ultimate into one entry took her dodge to **0** while the card still advertised 33%. The suite stayed green because nothing tested her evade end to end.
  - **`getCritChance`** (`combat.ts`) — never called `effectiveSubstat` at all, so **every crit-chance buff was inert**. Fixed on his ruling that skills and ults raise crit chance, not just passives (#16).
  - **`damagePreview.ts`** — array-authored self-buffs were left out of the estimate, so **Duke's Surge and Killua's ultimate had been understating their own damage since they were written** (#22 applies the self-buff before the damage calc, so the preview must include it).

  **Two more found and left unfixed** because nothing reaches them yet: `getDamageDealtMultiplier` and `getDamageReductionMultiplier` (`stats.ts:129`, `:144`). Specced in `Plans/2026-08-20-substat-stats-arrays.md`, together with his decision that evade and damage reduction must also read **debuffs** — both consume buffs only today.

  ### Rulings
  **#109** tier words are exact values, never thresholds — *"'raises' MUST be 30%. it can't fluctuate, even by 1%."* Off-scale values use "Increases X by N%" and get no hover pill. **#110** "no comma, no perma" — permanence is shown by clause scope, not by the word "Permanently", which is now gone from descriptions *and* from pill keys (a prefixed key would no longer match its own text). Extended 2026-08-20: **a debuff must always state a duration**; permanence is buff-side only. **#111** [Guard] and [Effective], a paired type-matchup override — designed, deliberately not built.

  Corrections to existing entries: **#16** (crit is buffable), **#28** (permanence half reversed by #110), **#54** (I had overstated him — a story kit *may* diverge, is not obliged to, and **tags are shared by convention**), **#55** (the `stats`-array reader family), **#56** (threshold reading corrected), **#58** (tier-word half amended), **#92** (Isolde's ladder figures removed rather than updated — the JSON owns them, per this ledger's own header).

  ### Kits
  **Chiara's All In** — his numbers were always 33/33; the ATK entry entered the repo as 30 in the kit's **first commit** and was never right. The original text stated both numbers and the mismatch was visible; converting it to a tier word buried it for months. Now one entry, `stats:["atk","evade"]` at 33. **Isolde's Starbound Ward** — the ult-level ladder from #92 existed in data and rendered nowhere; the card promised Debuff Immunity at UL1–2 where `minUltLevel: 3` grants none. Now conditional, with his re-authored values. **Gon and Killua** lost the word "Permanently" per #110.

  ### Five project skills
  `.claude/skills/` — **`kitwords`** (writes card text; carries the description grammar and a growing `EXAMPLES.md` of lines he has ruled on), **`kitcheck`** (audits kits, never touches a number), **`mobilecheck`** (ruling #107 made mechanical), **`ruling`** (ledger discipline), **`FillerAssist`** (story authoring under his approval). **`latticePlan` deleted** — it taught `lib/game/route.ts`, deleted a day earlier. `AGENTS.md` now carries the rule that a skill names the files it owns and dies with them.

  ### Mobile
  All **15** `min-h-screen` occurrences across 11 files swapped to `min-h-dvh`, verified against the installed toolchain rather than assumed: Tailwind 4.3.2 compiles `min-h-screen` to `min-height: 100vh`, the largest viewport, so each page carried a dead scroll the height of the browser chrome. `tests/viewportUnits.test.ts` stops it returning.

- **Story mode v2 — rebuilt from scratch as Chapter → Stage with waves (2026-08-18, `8b56767`)** — rulings **#107–#108**. Verified after the last edit: `npm run check` green (**1218 tests / 95 files**, same 3 pre-existing eslint warnings in `tests/duel.test.ts`), clean `NEXT_DIST_DIR=.next-verify next build` (48 routes), `tsconfig.json` build churn reverted, `.next-verify` removed. **Not browser-verified** — he does the visual pass.

  ### Why it was scrapped rather than fixed
  Tanveer on v1, one day after it shipped: *"assume our existing story mode doesn't exist at all. i am not planning to recycle anything. its trash for me. it hurts me but that's the truth."* The diagnosis behind that, from reading the canon source and the implementation together:
  1. **The taxonomy fought the source.** A webtoon chapter became a *Part* and its beats became *chapters*, so the unit a player called a chapter was a beat and nothing on screen matched `Chapter N.md`.
  2. **The board was starved, not wrong.** One fight per board, 10–20 tiles, everything else empty ground. Three orbs of 1–6 across a single path with one resolving tile is not a decision.
  3. **Every scene played over the same void** — `StoryScene` had four fields and no background.
  4. **Nothing to re-enter for**, and the fight you would farm wasn't addressable without re-walking a board.

  ### The shape now
  - **Chapter = one webtoon chapter** (`c1`, 1:1 with `Chapter 1.md`); **Stage = one playable unit** (`1-1 … 1-5`), addressed directly from the stage list. Stage count per chapter is deliberately uncapped — his call, it depends on what the story and filler need.
  - **Waves are the mechanic**: a battle stage runs 1–3 consecutive fights where **HP carries over and the fallen stay down** — his ruling #103, decided before v1 and never built because one fight per board meant nothing survived. It's what makes heals, DR, cleanses and the sub slot matter, and it closes the parked "no fight has more than 2 enemies" AoE gap (ruling #89) with content instead of kit changes.
  - **Missions**: up to 3 optional objectives per stage, seven goal types (`noLosses`, `withinTurns`, `fieldCharacter`, `fieldTag`, `useUltimates`, `firstAttempt`, `allWaves`), each paying a fixed one-time bundle. **Never lost** — an unmet mission reads STILL OPEN and stays claimable forever.
  - **Rewards** split two ways per ruling #80: a fixed first-clear bundle and a thin farm table (coin + basic manuals only; the farm shape has no field for gems or tickets, so the ban is structural). Missions are a third, independent one-time payout.
  - **No auto clear**, his call — and `tests/storyCatalog.test.ts` asserts no `autoClearEligible` event names a story chapter or stage, so a future generalisation of the ticket can't quietly include story.
  - **`origin: "canon" | "filler"` on every stage and scene.** The most important field in the schema: what's invented is auditable, a canon retcon can strip it mechanically, and filler review has something to read.
  - **Backgrounds** are authored per scene as slugs against `docs/ART_REQUESTS.md` Category A, resolving to a locale-tinted gradient until the plates exist (`lib/game/storyBackgrounds.ts` — an art session fills in one `image` field per slug).

  ### Five screens, mobile-first at 390×844
  Mockup he approved first: `docs/design/mockups/story-v2.html`. Chapter list → stage list → stage brief → play (scene reader / versus / battle / wave break) → stage result. The stage list is the farming surface; the brief leads with the wave rail; the wave break shows what the last fight cost before the next one starts.

  ### Deleted, not migrated
  `lib/game/route.ts`, `RouteBoard`, `PartSelect`, `PartBannerCard`, `EntryCard`, the v1 `ChapterSelect`/`ChapterBrief`/`StoryRewardsScreen`/`ChapterCompleteCard`, `SnapCarousel`, all twelve `data/story/part*.json`, `activeRoute` in `storyStore`, and **six** v1 test suites (`route`, `storyRoute`, `storyIndex`, `storyCatalogIntegrity`, `storyTeam`, `storyTrial`) — with `storySchema` and `storyRewards` rewritten in place rather than deleted. **Old progress is dropped** by the v3 migration (his call — the old keys named beats of a structure that no longer exists, so mapping them would be fiction); first-clear bundles become claimable again on an existing save.

  `SnapCarousel` went with them: a chapter list that grows toward 24 entries is scanned, and a carousel that centres one item hides its neighbours behind a fling. Flagged rather than assumed — it was his approved Dokkan idiom on 2026-08-17.

  ### Reused deliberately
  `TeamPicker` **and `teamPresets`** (his instruction: the existing team and preset picker are used as they are), `storyTeam.ts`'s trial-vs-owned rules (ruling #93), the VN reader internals, `VersusSplash`, `ChapterTitleCard`, `StoryStage`, `stageEffects`, `victoryAtEnemyHpPercent`.

  ### Engine surface touched, minimally
  One option on `startCustomBattle`: `carryHp` (player HP per character id, clamped to max). Everything else about the wave loop lives in `lib/game/stageRun.ts` as pure functions — survivors, the fallen, turn and ultimate totals, the run summary — so `combat.ts` is untouched by the wave model. **Battle UI's own mobile pass is explicitly out of scope** and gets its own dedicated session (his call, in `docs/ROADMAP.md`).

  ### Bureau Orders had to move with it
  `chapterCleared {partId, chapterId}` → `stageCleared {chapterId, stageId}` and `chaptersCleared` → `stagesCleared`, with `OrderContext.completedChapters` → `clearedStages`. `lyra-joins` now points at `c1:s5` so step 1 stays completable today; `s2-part-four` still names chapter 4, which doesn't exist yet — an order may name an unadapted chapter and simply stay unmet, which is what keeps his authored intent intact while chapters land one at a time (asserted by test).

  ### Chapter 1 content is provisional
  Five stages: two canon scene stages (`1-1`, `1-4`), three filler battle stages (`1-2`, `1-3`, `1-5`). Chapter 1 has **no canon fight at all**, so every fight in it is drafted and awaits his approval in the FillerAssist pass. One canon call already made: the mockup's "The Village, Burning" was **dropped** — canon says Duke was away when the raid happened, so `1-2` is a wilderness fight instead and the raid stays untouched. Gems total 70 across the chapter (50 first-clear + 20 missions), on budget against `docs/design/ECONOMY_AUDIT.md`'s tier-1 figure.

  ### Confidence and gaps
  - **Verified:** `tsc`, `eslint`, `vitest` (1218 passing across 95 files) and a full `next build`, all after the final edit. New pure logic is covered directly by **five** suites: `storySchema` (rejections — numbering, wave/team/farm-table shape, boss-last, mission ids, unknown ids), `stageMissions` (every goal type, plus the clear gate that stops a lost run satisfying `noLosses`), `stageRun` (HP carried, deaths permanent across waves, wipes, summary, HUD bars), `storyRewards` (bundle never rolled, replay pays farm only, missions pay independently, zero rolls dropped), and `storyCatalog` (sequential unlock, one `current` stage, sealed chapters withheld, `stageAfter`, and the Auto-Clear-never-targets-story guard).
  - **Assumed, not verified:** every visual and interaction claim. Nothing has been rendered — the wave break, the stage rows, the brief's rail and the result screen have never met a browser.
  - **The bet this design makes** and the one thing tests can't check: that 2–3 waves *feel* like a run rather than a slog. If wave 2 reads as padding, the fix is fewer waves per stage, not more content.
  - **Known thin:** filler fights in chapter 1 use existing trash kits (`wild_beast`, `road_bandit`, `raider`) because `storyOnly` enemy stat bands are still unassigned (`docs/design/KIT_DESIGN.md:83`) — that blocks new enemy kits from chapter 2 onward.
  - **Not built from the plan:** the `FillerAssist` skill and `Filler/Drafts.md`, deliberately left until chapter 1's content pass has taught the workflow. `challenge` stages are not in the union at all (his call: don't build yet).
  - **What I'd check first coming back cold:** open `/story` at 390×693, clear `1-2` (two waves) and watch whether the wave break reads as tension or as a speed bump.
  - **Re-verified at checkpoint time** (2026-08-18, after these doc edits): `npm run check` green — 1218 tests / 95 files, 3 pre-existing `duel.test.ts` warnings — and `NEXT_DIST_DIR=.next-verify next build` compiled with 48/48 static pages. Two numbers in this section were wrong when first written and were corrected against the repo: it said *eight* v1 test suites were deleted (six were; `storySchema` and `storyRewards` were rewritten in place) and *four* new suites (five). Chapter 1's gem total was checked by summing the JSON: 50 first-clear + 20 mission = 70.

- **RETIRED 2026-08-18 — everything in this section was deleted a day after it shipped.** Tanveer: *"assume our existing story mode doesn't exist at all… its trash for me."* Read it as history and as the reasoning that produced story mode v2 (the section above), not as a description of the game: `SnapCarousel`, `PartSelect`, `ChapterSelect`, `EntryCard`, `RouteBoard`, `lib/game/route.ts`, `activeRoute`, the three orbs, the generated boards, `ROUTE_STEPS_BY_PART` and all twelve `part*.json` are **gone**. Rulings **#94** and **#98–#105** are superseded by **#108**; the ones that survived in substance are named there. **Story mode rebuilt end to end: carousels, a node board, and a results screen (2026-08-17)** — rulings **#98–#105**. Verified after the last edit: `npm run check` green (**1305 tests / 98 files**, same 3 pre-existing eslint warnings in `tests/duel.test.ts`), clean `NEXT_DIST_DIR=.next-verify next build`, `tsconfig.json` churn reverted, `.next-verify` removed. **Not browser-verified** — Tanveer does the visual pass, and this is the largest single batch of unverified UI in the project's history.

  ### What the session was
  He opened wanting the story UI/UX overhauled and fed me Dokkan reference screens **section by section**, with the standing instruction *"you don't have to copy everything. you are looking for how UI and layout is optimized in dokkan"* and a target of **9:16 portrait** — which makes this a down-payment on the open `Mobile layout pass` (`docs/ROADMAP.md:67`). Plan approved before any code: `C:\Users\Tanve\.claude\plans\recursive-swinging-noodle.md` (local, not in the repo — copy it here if it needs to outlive his machine).

  The flow went from `index → brief → title → intro → versus → battle → outro → complete → rewards` to **part select → chapter select → brief → title → board → scene/fight tiles → clear summary**.

  ### Shipped
  - **`SnapCarousel`** — the repo's **first scroll-snap**. CSS `snap-y snap-mandatory` + the existing `hud-scroll` idiom, focus from an `IntersectionObserver` inset to a 10% band across the middle, arrow-key paging handled on the container (the items are buttons, so their keydown bubbles — no window listener, no ref indirection), `usePrefersReducedMotion()` gating smooth scroll. **Not** a framer-motion drag: `MotionProvider` loads `domAnimation`, which excludes `drag`, and the standing ruling against pulling in `domMax` for one screen (`battle/Hand.tsx:26-30`) holds. Native snap also gives correct touch momentum free.
  - **Part select** (`PartSelect` + `PartBannerCard`), replacing `StoryIndex` entirely. `visibleParts()` in `storyCatalog.ts` is `buildStoryIndex` filtered to `!sealed` and reversed. Sealed parts **do not render at all** — which is stronger than the redaction the old index used, because a `StoryIndexPart` carries a real title, tagline and cover even when sealed, and part 9's cover is `molvarr`.
  - **Chapter select** (`ChapterSelect` + `EntryCard`), replacing `ChapterSelectModal`. Hero panel over a snapped list of reward cards — status banner, numbered title, `STA`, and a Clear/Farmable reward pair, which is the "preview of farmable stuff" he pointed at. Opens on the chapter you're up to, not chapter one.
  - **The ribbon is a real reward, not a mission counter.** `ordersForChapter()` + `describeOrderReward()` surface the Bureau Order a chapter satisfies — `◈ LYRA` on `part2/p2c2`, `◈ 125 Gems` on `part4/p4c3` — dimmed once claimed. The free Lyra was previously invisible from story mode, buried in a nav modal.
  - **The node board** (`RouteBoard` + `lib/game/route.ts`). Three orbs, each an independent 1–6; spending one re-rolls that orb alone; only the landing tile resolves; the boss is a **STOP** immediately before the finish that no roll can pass; a defeat restarts the whole route and charges again. Movement is animated tile by tile via `walkPath`, because watching the token cross tiles that *don't* resolve is the only thing that makes that rule legible.
  - **Boards are generated, not authored** — `buildRoute()` with `ROUTE_STEPS_BY_PART` (part 1: 10, part 2: 5, part 3: 20, part 4: 15, else 10), placement seeded off the chapter id so a board is stable across visits and differs between chapters. `route?` on `StoryChapter` overrides it per chapter. 37 hand-written graphs would have been churn nobody could keep consistent.
  - **`activeRoute`** on `storyStore` (position, orbs, resolved tiles, banked loot) with a **v1 → v2 migration** to `null`. Persisted because a route spans several taps and phones close tabs; deliberately *not* cloud-synced, since merging two devices' positions has no correct answer.
  - **Clear summary** — account rank panel with the XP bar, a `BONUS`-badged item grid, an unlock line, `ATTEMPT AGAIN`. No clear time, on his instruction, and nothing tracks one anyway.
  - **Two project skills**: `/comfypending` (append art requests) and `/latticePlan` (a consultant for board shapes, carrying the arithmetic — average roll 3.5, so a board takes ~N/3.5 moves to cross).
  - **`docs/ART_REQUESTS.md` Category C** — every iconless inventory item. 19 assets cover it, including the leverage case: **5 coin frames rather than 18 coin icons**, since `characterCoinId()` mints one per playable character and per-character icons are a treadmill.
  - **`min-h-screen` → `min-h-dvh`** on `StoryStage`'s page variant. Tailwind 4 compiles `screen` to `100vh`, the *largest* viewport, so every story document screen was taller than the visible area with browser chrome showing.

  ### Bugs found and fixed while building
  - **Banked loot could leak between chapters.** `finishChapter` read whatever route sat in the store without checking it belonged to the chapter being finished, so an abandoned route's loot would pay out on a different chapter. Now matched on `partId`/`chapterId`.
  - **A defeat restarted only the fight**, not the route — which would have made the board free to re-roll: keep the banked loot, take another swing at the boss for nothing.
  - **The token snapped to its destination** on any mid-walk re-render. `react-hooks/set-state-in-effect` caught it; the position is now derived (`walkTo ?? at`) rather than mirrored in an effect.
  - **A test asserted the retired free-retry rule.** I claimed no test did, from a truncated grep, and was wrong — `tests/storyRewards.test.ts` had it.

  ### Deliberately not done
  - **No `BattleProvider` change.** The plan called for a surviving-HP handoff so damage would carry between tiles — the riskiest item in it. **It evaporated:** one fight per board means nothing survives between tiles. It comes back the moment a board gets a second fight, and only then.
  - **Chapter search across parts is gone** with `ChapterSelectModal`. `searchChapters()` is still exported and still tested, so the affordance can return; a per-part screen had nowhere honest to put a cross-part search box.
  - **No filler fights.** See the gap below — this is the whole of workflow part 2.

  ### The gap that matters: 19 of 37 chapters have no battle
  Counted from `data/story/part*.json`, not inferred. **Parts 3, 4, 6, 11 and 12 contain no fight at all** — every chapter in them is scenes, and part 12 is the finale. The worst case was self-inflicted: part 3 has the longest boards (20 tiles) and zero fights, so I generated twenty tiles of empty ground three times.

  Mitigated rather than solved: **a chapter with no battle now gets no board** and plays as the scene reader it always was. The board therefore exists for 18 chapters. Tanveer's read: *"we don't have filler fights to cover the content. this is where 2nd part of our workflow starts."*

  Workflow part 2 (story content adaptation) is blocked on three things, two of them his:
  1. **An explicit reversal** of the ruling recorded at `lib/game/storyCatalog.ts:36` — *battles exist only where the source has a fight; Tanveer ruled against inventing any*.
  2. **`storyOnly` enemy stat bands**, which `docs/design/KIT_DESIGN.md:83` still marks **unassigned**. Kit ownership is his and this blocks everything downstream.
  3. **A story canon/voice doc**, the same gap that deferred the story agent (charter: draft filler, integrate official plus approved filler, design NPCs). Order recorded then and still right: docs → skill → agent.

  ### Confidence and gaps
  - **Verified:** `tsc`, `eslint`, `vitest` (1305 passing across 98 files) and a full `next build`, all after the final edit. New pure logic is covered directly — 43 tests on `route.ts` (orb bounds, per-orb re-roll, the STOP guarantee fired at every roll 1–6, `walkPath` agreeing with `landingsFrom`, all 37 chapters producing walkable boards), 8 on `activeRoute`, 5 on `visibleParts` looping every progress point, plus `ordersForChapter` and `describeRewards`.
  - **Assumed, not verified:** **every visual and interaction claim.** Nothing has been rendered. The snap carousel's proportional sizing (`h-[42%]` items, `h-[29%]` spacers) is arithmetic that has never met a browser; the 155ms-per-tile walk and the 260ms arrival beat are guesses at feel; the board's zig-zag has never been seen at 20 rows on a phone.
  - **Known thin:** part 2's five-tile board crosses in one or two moves, so the orbs barely matter there — flagged to him twice, unresolved. Generated boards place loot identically for a given chapter, so a farmed route pays predictably.
  - **Untouched balance debt:** none, as it happens — the attrition retune I flagged earlier is moot for the same reason the HP handoff is.
  - **Doc staleness I did not sweep:** this file is 2,636 lines and I read only its head. Earlier sections still reference `StoryIndex`, `ChapterSelectModal` and `ChapterRow` as live components; all three are deleted. Treat any pre-2026-08-17 mention of them as history.
  - **What I'd check first coming back cold:** open `/story` at 390×693, walk part 1 chapter 1 end to end, and watch whether the token's walk reads as travel or as jitter.

- **Story flow and screens pass, plus two planning artefacts (2026-08-16)** — rulings **#94–#97**. Verified: `npm run check` green (**1236 tests / 96 files**, same 3 pre-existing eslint warnings in `tests/duel.test.ts`), clean `next build` (48 routes), `tsconfig.json` build churn reverted. **Not browser-verified** — Tanveer does the visual pass.

  ### What this session was, and what it deliberately wasn't
  He opened wanting to overhaul story UI/UX *and* story content, and asked whether a project-scoped story agent was worth building. Audit of the existing surface found the story UI is **not** in bad shape — the components carry his own prior rulings (portrait-slot fix 2026-07-20, index collapsed to one page 2026-08-11, word-fade reveal replacing character-by-character slicing) — so the answer was to leave the designed parts alone. The real gap is **schema-level**: `StoryScene` has four fields (`speaker`, `portraitId`, `side`, `text`) and no background, which is why `part1.json` writes *"A small rural village. Remote, quiet, self-contained."* as narration and why all 12 parts render over the same void. He picked **flow and screens** for this pass and **background-per-scene** for the later one, ruling out expressions, per-scene audio and camera effects.

  ### Shipped
  - **`StoryStage`** (`components/game/story/StoryStage.tsx`) — one frame, two variants. `page.tsx` had **three** distinct `<main>` shells across eight branches; rewards was the only viewport-locked-then-scrolling odd one out, which is why the complete card → rewards transition changed viewport treatment mid-beat. The 36px grid overlay stays exactly where it was (battle, scene reader) rather than being normalised, since that would be an unapproved visual change.
  - **Next chapter from rewards, first clear only** (ruling #97). No new catalog code — `completed` has already taken the chapter by the time rewards renders, so the index view's `current` *is* the next chapter.
  - **Change team on defeat** (ruling #97). Optional `onChangeTeam` on the shared `BattleEndHandlers`, so the world-boss route is unaffected rather than growing a dead button.
  - **Interstitial contract unified** (ruling #95) — complete card gained tap-anywhere; its inner button stops propagation so one click doesn't fire the handler twice.
  - **Brief fact strip** (ruling #96) — scene count out, team rule in; back button renamed `← Story index` because it lands on the index, not the chapter-select modal it used to name.
  - **`bounceToIndex`** — the four copies of "chapter didn't resolve, reset during render" folded into one documented helper.

  ### Planning artefacts, no code
  - **`docs/ART_REQUESTS.md`** — the standing ComfyUI queue, created at his request so sessions **append and keep building** instead of stalling on missing art. Carries the entry format, and for scene backgrounds a table of the four ways they *override* `ART_PIPELINE.md` (16:9 not 1024², background removal **never**, no characters in frame, composition must survive portraits at both bottom corners) — that doc is entirely portrait-oriented and following it blindly yields unusable assets. A one-line pointer went into `AGENTS.md` so a fresh clone inherits the rule.
  - **Story agent deferred, charter recorded.** He wants one eventually — draft/plan filler story content, integrate official plus approved filler, suggest and design NPCs with ComfyUI asset generation. Deferred because two of the three docs it would boot into don't exist (no story canon/voice/schema guide; `KIT_DESIGN.md:83` marks `storyOnly` enemy stat bands **unassigned**) and because ruling #94 is about to change the format anyway. Order when it happens: docs → skill → thin agent over the skill.

  ### Tried and abandoned
  - **Proposing an agent first.** The instinct was to build `.claude/agents/story.md`; wrong primitive and wrong order. A skill composes better (loads in the main thread *and* inside any agent), and either is only as good as the docs it reads — which is the actual missing piece.
  - **A layout-first reading of "overhaul the story UI".** The first pass looked for screens to redesign. The screens are fine; the schema is what's thin. Recorded so a future session doesn't re-propose a visual rework of components that already had design passes.

  ### Confidence and gaps
  - **Verified:** `tsc`, `eslint`, `vitest` (1236 passing) and a full `next build` all run *after* the last edit. The working tree was checked clean of build churn.
  - **Assumed, not verified:** every visual claim. The unified shells, the two-button rewards end state, the tap-anywhere complete card and the new `Team` cell have never been rendered.
  - **A judgement call worth his eye:** ruling #96 **deleted** the team-mode sentence rather than relocating it. Defensible — the picker shows the rule — but a first-time player loses the explanation, and it goes back as helper text if the screen reads thin.
  - **Unverified in the new doc:** `ART_REQUESTS.md`'s 14 background locations were inferred from part titles, taglines and part 1's narration, **not** a scene-by-scene read of all 12 parts. The file says so. Correct the list before generating anything, or the GPU time goes on images no scene references.
  - **What I'd check first coming back cold:** clear a chapter and confirm the next-chapter button names the right one, then lose a fight and walk Change team → brief → restart.

- **Ult level-up system, Molvarr rework, and a balance/economy audit (2026-08-14)** — one long session that started as a read-only audit and turned into four shipped changes. Rulings **#87–#92**. Verified at the end: `npm run check` green (**1236 tests / 96 files**, 3 pre-existing eslint warnings in `tests/duel.test.ts`, unrelated), clean `next build` (48 routes). **Not browser-verified** — Tanveer does the visual pass.

  ### The audit that started it
  Read-only pass over kits and balance against the two PVE tracks (story + Molvarr). Measured through `executeSkill` with throwaway harnesses, never hand-rolled. What it found, and what came of each:
  - **The difficulty dial was far weaker than the player's growth.** `ENEMY_LEVEL_PER_DIFFICULTY` was 8, so WL4 reached 1.407x base stats while a Lv40/asc3 roster reaches 2.159x — the hardest content was *relatively* easier for a maxed account than WL1 is for a fresh one, and the constant's own comment claimed the opposite. Now **25** (ruling #87).
  - **`ECONOMY_AUDIT.md` had a hole in it.** It sized the whole levelling grind without ever opening `lib/gacha/pull.ts`, so the 95% "miss" side of the summon table — the game's largest manual and coin faucet — was in none of its totals. Recounted; manual tiers reweighted 60/30/10 (ruling #88).
  - **`balance.ts`'s ult check disagreed with five of eighteen shipped kits**, for two reasons: it counted a heal's percentage as a damage skill to beat, and it ignored ruling #22 (a pre-hit self-buff lands on the same strike). Both fixed, and a roster-level test now runs the linter over the live catalog — nothing had ever pointed it at real kits, which is how it drifted.
  - **Content the audit flagged but did NOT change** — see "Parked" below and ruling #89.

  ### Molvarr
  - **P1 8500 / P2 10000, SP cadence every 2nd turn** (was 5400/7200, every 3rd). The problem wasn't difficulty, it was that **the boss never got to use its kit**: at WL1 a Lv20+ team broke P1 on turn 2, so Ancient Rhythm (turn 3) and the ultimate never fired. Measured after: P1's SP fires in 10/10 runs for every team except a maxed trio. Ruling #91.
  - **Ruling #73's stated mechanism does not exist in the data.** It records the P2 corrosion nerf as "every corrosion stack also feeds Growing Malice" — but **Growing Malice is a P1 passive and Corrosive Tide is a P2 passive**, so they are never active together. The four-figure ultimate was Iron Carapace's +30% ATK lining up with the gauge cycle. Recorded in ruling #90; the nerf itself stands.
  - **Corrosion is Phase 1's damage, not Phase 2's.** DoT share of total: P1 vs Lv40 **48%**, P2 vs Lv40 13%. Corrosive Surge at R3 flips to a max-HP basis, so it is the one mechanic that scales *up* as the player invests.
  - **Fixed a real ATK leak in Growing Malice.** `recomputeDebuffAtk` adjusted by a floored delta, and `Math.floor` rounds a negative away from zero — at 285 base, +5% added 14 but −5% subtracted 15, so the boss lost 1 ATK per debuff on/off cycle (traced: 285 → 299 → 284 → 298 → 283). Now rebuilt from base. Two regression tests, **both verified to fail against the old arithmetic** before being kept.

  ### Ult levels and character coins
  The headline feature. Previously a duplicate pull silently bumped `ultLevel` (capped at 6) and a 7th copy evaporated; the multiplier was a uniform +60% for everyone.
  - **Dupes now pay a character-exclusive coin** — `{color}_{id}_coin`, e.g. `blue_duke_coin`. Ids and labels are generated from the catalog in `lib/game/materials.ts`, so a new character cannot ship with an inventory key no screen can name. Colour is in the id deliberately: Tanveer plans colour variants of existing characters, and renaming ids already in save files would mean a migration.
  - **1 coin per level, 5 to max** — six copies including the one that unlocked the character. `levelUpUltimate` is all-or-nothing and forward-only (a slider dragged backwards must not refund).
  - **Every playable ultimate authors its own six-value ladder** (`damageByUltLevel`), replacing the uniform curve. The curve differs per kit — Mustafa climbs 200→500 (+150%), Meliodas 450→700 (+56%) — because a small flat multiplier and a large one shouldn't grow at the same rate. Bosses and NPCs have no ult level and fall back to flat `damage`.
  - **Mechanics can ladder too.** Isolde's ultimate deals 0 damage, so a damage ladder does nothing for her; mechanics gained `valuePercentByUltLevel` / `durationByUltLevel` / `minUltLevel`, mirroring the existing `*Ranked` fields. Her Debuff Immunity is `minUltLevel: 3` and is **dropped entirely** below that, not applied at zero — it doesn't render in the description either.
  - **Save migration v8 → v9**: every ult level resets to 1 and the player gets back **one coin per level they had banked**, so the change costs them nothing. Tested for idempotency. **This runs on the cloud path too** — `AuthProvider` calls `migratePlayerState(data, data.version ?? 2)` on login, and `inventory`/`characters` are both already in `CLOUD_FIELDS`, so coins and ult levels sync without any change to the sync layer.
  - **UI**: growth modal gained a slider (1→6) clamped to what the player can afford, with the ladder rendered as chips. The archive detail page renders all six levels as a table with the player's current level highlighted — that needed a small client wrapper (`UltimateDocument`), since the archive page is a server component and can't read the store.

  ### Story
  - **Trial-vs-owned picker.** `trialLevel` only ever applied to units the player did *not* own, so **owning a story lead made the chapter harder** — a player who pulled Duke and hadn't levelled him fought part 9 at 1.000x while a player who never pulled him got the loaner. Owned anchors are now toggleable on the chapter brief, defaulting to whichever version is stronger, so acquiring a character can never cost a fight.
  - **`trialAscension` added.** A level alone under-describes a unit: `maxLevelForAscension` caps ascension 0 at level 1, so a bare `trialLevel: 20` loaner is 1.322x where a real Lv20 is 1.489x. Part 9 authors **Lv20 / asc1**.
  - **Part 9 rewards**: ascension materials are first-clear only, **1 eye + 5 seaweed** across the part (half the world boss's bundle), with no farmable ascension drops. Closes the ruling #47 conflict — the world boss is again the only repeatable source.

  ### Parked by decision, not oversight (ruling #89)
  Do not re-flag these: the six Collab kits have no acquisition path (coming via a dedicated limited banner plus a special story part); the four specialty materials are consumed by nothing (shop update); no fight has more than 2 enemies, leaving ~10 AoE payloads with little to hit (more PVE content is in progress); story has no difficulty scaling and is not getting any — it gets harder through authored content.

  ### Tried and abandoned
  - **Raising P1's HP alone to make the SP fire.** Swept 5,400 → 13,000. The break turn plateaued at 2.9 because the player's damage ramps with the fight; a maxed trio never saw the SP at any value tested. The cadence change did in one field what +141% HP could not.
  - **Setting part 9's loaners to a bare `trialLevel: 20`.** That is *lower* than the 22 it replaced (1.322x vs 1.356x) and measured 2/12 wins — it would have made the fight harder while trying to make it easier. Ascension is what a level implies; hence `trialAscension`.
  - **Rewriting kit JSON via `JSON.parse`/`stringify`.** The repo has **mixed** JSON formatting — collab kits keep arrays expanded one-per-line, the rest keep them inline — so a round-trip reformats whichever half it disagrees with. A first pass produced a 2,099-line diff for ~114 lines of real change; redone as text-level edits that leave each file's style untouched. Note also that the working copy is **CRLF** (git autocrlf), so multi-line patterns need the file's own line ending.
  - **Wiring story difficulty** (`effectiveDifficulty` / `baseDifficultyForPart`, still uncalled). Proposed and declined — see ruling #89.

  ### Confidence and gaps
  - **Verified by running it:** all damage figures, hits-to-kill, phase-break turns, SP/ult proc counts and win rates in this section came from throwaway harnesses driving the real engine (`executeSkill`, `applyBossTurnStart`, the real enemy deck with merges, correct tick order). The ATK-leak fix was verified by reverting it and watching the new tests fail. `npm run check` and `next build` were re-run *after* the JSON rewrite, not before.
  - **Assumed, not verified:** that the retuned Molvarr and the Lv20/asc1 part 9 *feel* right. Every win rate here comes from `getAIMove` driving the **player** side, and that AI was written for the enemy — it does not merge deliberately or time ultimates, so a human will clear faster than these numbers and the boss's kit will fire *less* than measured. Treat the turn counts as an upper bound on how long the boss survives.
  - **Not verified at all:** anything visual. The growth slider, the ladder chips, the archive ult table and the trial-vs-owned toggle have never been rendered — Tanveer does the visual pass.
  - **What I'd check first coming back cold:** play one Molvarr run at WL1 with a Lv20-ish team and confirm the SP actually fires and the fight doesn't drag; then pull a dupe and walk the coin → slider → archive-marker loop end to end, since that path crosses the store, the migration and two UI surfaces and has only been tested in pieces.

- **Substat semantics corrected + Lyra's second fight (2026-08-09)** — two shipped no-ops fixed by getting Tanveer's stat vocabulary exactly right.
  - **Substats are percentages, so modifiers add points, not scale.** `effectiveSubstat` was multiplying: Isolde's `+10% lifesteal` aura computed `5 × 1.1 = 5.5` and floored back to **5 — the aura did nothing in every shipped battle**, and any evade buff on the 0% base was likewise a no-op. Now additive (clamped at 0), matching what `evade.ts` already did. Basic stats (ATK/DEF/HP) stay multiplicative.
  - **Kind Hearted Friend's halves split.** The base bond raises basic stats; the both-alive bonus raises all stats, reaching substats — Tanveer's call, on the grounds that requiring both Gon and Killua alive on the field is restrictive enough to earn it. Passive wording updated to say which half does what, and every retargeted kit's description moved from "all stats" to "basic stats" so text and mechanic agree.
  - **Synergies retargeted to basic stats.** With `"all"` reaching substats, every `stat: "all"` synergy would have handed out its full percentage in lifesteal/crit/recovery points — Ban, Diane, Gon, Killua, Meliodas and Leorio's Kind Hearted Friend now name `stats: ["atk","def","hp"]` instead. **Only Seras's and Batra's are meant to reach substats** and keep `"all"` (Tanveer, 2026-08-09). Sara's `damageDealt` and Mustafa's `def` were already right. `synergy`, `aura` and `characterSynergy` all learned the combined `stats` array to express it.
  - **`stat: "all"` now reaches substats.** It didn't, per a "2026-07-24 ruling" recorded in `substats.ts` and locked by a test; Tanveer's read is that decision predates the substat system. Reversed, with the test rewritten to state the reversal rather than deleted. Affects Seras/Diane/Gon `[Tag]` synergies and Isolde's aura, which now also move crit damage, recovery rate, lifesteal and crit resist.
  - **Max-HP changes are now temporary when their effect is, and HP debuffs work at all.** A durationed HP buff/debuff records `hpScalePercent` and `tick.ts` unwinds it by the inverse on expiry — Isolde's `+30% all stats for 3 turns` used to leave the HP raise behind permanently. The generic debuff path never touched max HP at all, so `-30% all stats` left the pool untouched; it now shrinks it, built ahead of any kit authoring such a debuff (Tanveer: "account for scalability").
  - **Max-HP changes now scale current HP with them** (`lib/game/maxHp.ts`), preserving the ratio: 1500/2000 raised 50% is 2250/3000, not the 2500/3000 the old code produced by adding the max-HP delta to both numbers. Four sites shared that bug (three in `passive.ts`, one in `combat.ts`).
  - **`aura` with `stat: "all"` never raised HP** — it only baked HP for a literal `"hp"` aura, so an all-stats aura silently gave ATK/DEF alone. Fixed.
  - **`lyra_npc_2`** — chapter 2's second Lyra fight, byte-identical to the first except for one extra passive mechanic (`aura`, all stats +5%), per Tanveer: difficulty from a passive, not hardcoded stats. Effective 8400 HP / 147 ATK / 120 DEF. Registered in the catalog and VFX registry; the `boss` flag is dropped so the practice picker doesn't list Lyra twice.

- **Duel mode — Claude plays the enemy side (2026-08-09, dev only)** — Tanveer's idea: neither of us can learn how the kits really behave without an opponent that plans, so a dev build can hand the enemy side to Claude. **It is a swap of who decides the enemy's actions and nothing else** — rewards, stamina, first-clear, story progress, drops, boss phases and the enemy's hidden hand all behave exactly as before, so winning a story chapter against Claude pays out normally. Spec: `docs/superpowers/specs/2026-08-09-claude-duel-mode-design.md`.
  - **One branch, at the single `getAIMove` call** (`BattleProvider.tsx`). Claude submits a whole turn at once, so the enemy turn awaits once rather than per action. `forcedSp` already took precedence over the AI, so **Molvarr's SP schedule and phase transitions stay automatic for free** — they're boss mechanics, not decisions, and suppressing them would mean piloting a boss Tanveer didn't design.
  - **Files are the interface.** `.duel/` (gitignored): `state.md` is written when it becomes Claude's turn, `move.json` is what Claude writes back, `duel-log.md` is an append-only record of every state, move and rationale — the training artefact. `/api/dev/duel` is only a bridge (the browser can't read the filesystem); it 404s outside development, checked server-side on every verb.
  - **`state.md` carries the full kit, not just stats** (Tanveer's ask) — every skill's resolved description, the ultimate, passives, the active phase for a boss, and the *scheduled* behaviour to plan around (when the SP next fires, when a stat spike lands, current phase turn). Piloting a unit means knowing what it can do.
  - **The player's hand and queue never appear.** A test asserts it. Seeing them would mean reading Tanveer's plan rather than testing his kits, which would silently invalidate every balance conclusion drawn from these games. Opponent *kits* are included — a player can read those in the archive, so they're public.
  - **Escape hatch is the load-bearing requirement.** `DuelWaitingOverlay` carries an always-available "Let AI play" button, plus a 10-minute timeout, and every failure path (abort, timeout, network error, invalid move) returns null so the scripted AI takes the turn. A battle can never hang because a session ended — including a story battle mid-run. Rejected moves are logged with their reason rather than swallowed.
  - `parseDuelMove` is defensive by design: stale turn, unknown card, card played twice, dead/benched/unknown target, stunned or downed owner, over-budget turn, malformed JSON — each is a rejection, never a throw. 19 tests.
  - **First session played 2026-08-09 (Claude lost).** Two gaps it exposed, both fixed: the state file printed a 1-based turn while the validator checks the raw counter, and there was **no end-of-battle signal at all** — a finished fight writes no state, so the watcher waited forever and Claude simply went quiet. `result.md` now carries the outcome and final standings.
  - **Second session (2026-08-09): Duke won on turn 4 with 215/1500 left** — the Part 2 duel now runs its full four turns and stays live to the final card, against a turn-2 collapse before. Lyra's ATK-down immunity fired correctly against Flowing Ruin's own code path (`resisted atk down (immune)`), which is the path that needed its own guard.
  - **Hand-rolled damage maths is unreliable; drive the engine instead.** Every by-hand estimate across two sessions was wrong in the same direction, omitting type advantage (Duke blue vs Lyra red = +20%/−10%, a 30% swing), the universal 5% lifesteal, and mid-turn DEF changes from a defender's own buffs. The Surge retune was `executeSkill`-computed and landed exactly; Lyra's HP/multiplier tuning was hand-computed and needed two corrections. See the spec's "Project damage by running the engine" section.
  - **A 1v1 duel is not a balance sample.** Duke looked dominant and the conclusion drawn — "Flowing Ruin is overtuned" — was wrong; Tanveer caught it. Hand capacity is 4/5/7/8 cards for 1/2/3/4 field units with uniform draws, so his cards are ~100% of a 1v1 hand and ~25% of a 4v4 one: simulated empowerment goes from every **1.1 turns** to every **4.6 turns**, a 4× swing in the uptime of the passive that defines him. He is a 1v1 specialist, mid-pack in a team. The spec now records which archetypes each format distorts.

- **Combined-stat effects + Duke's S2 rework (2026-08-09, Tanveer playtesting)** — a stat effect covering more than one stat is now **one entry**, not several. `stats: ["atk","def"]` on buff/debuff/stance mechanics and on `StatusEffect`, read through a single helper `entryAffectsStat` (`lib/game/stats.ts`) so no call site compares `.stat` directly and a combined entry can't silently stop applying to one of its own stats. Distinct from `stat: "all"`, which means literally every stat — the distinction is Tanveer's vocabulary (ruling #55): *basic stats* = ATK/DEF/HP, *all stats* = basic + substats minus damage reduction and evade.
  - **Three kits were authoring one effect as two.** Killua's ult ("Permanently raises ATK and DEF", two entries at the same 30%) and Leorio's Member of the Zodiac, both merged. Gon's ult deliberately stays two entries — his ATK is permanent at 30% and his DEF is 1-turn at 50%, genuinely different effects. Two engine badges were also mislabelled `"all"`: `bossStatSpike` moves ATK/DEF/HP (basic stats) and `statShiftAfterAttacks` moves ATK/DEF only.
  - **Duke's S2 reworked** — his passive already applies a 50% ATK-down, so the skill's own ATK-down was redundant. *Fist of Flowing Ruin : Weaken* → **Surge**, now an attack skill that raises ATK and DEF by a flat 30% for 1 turn before striking (ruling #22 order, uncancellable, stackable). Multipliers retuned `[260,320,400]` → `[220,270,335]` so an empowered R3 lands **1850** against Lyra's buffed DEF — comparable to the old Weaken's measured 1671, and back under his own ultimate per ruling #2 (at 400% it hit 2276 and beat a bare ult). Leorio's Zodiac bumped to 20/30/50% for 1/1/2 turns.
  - **Tier words are asymmetric** (ruling #56): *massively* is 100%+ raising but 80%+ lowering, since a stat can never be reduced to zero. `tierWord` updated; no shipped description changed.
  - **Roster-wide plural fix** — kits hedged with `"turn(s)"` because a `[duration]` placeholder resolving to 1 read as "1 turns". A post-pass collapses the hedge then singularises, so prose can just write "turns". Killua's *"stuns for 1 turn(s)"* was the last offender; a sweep of every generated description is clean.
  - **Rulings #52–57 added**, including the vocabulary Tanveer is exact about and the notation rule for reading his kit drafts (only `x/y/z` values are rank-scaled; tier words never are). Duke's design sheet gained a **Fighting Style** section — Silver Fang's *Water Stream Rock Smashing Fist* — which was undocumented and is why kit work kept missing the intent behind his skill names.

- **Part 1 & 2 playtest rebalance (2026-08-09, Tanveer playing)** — his shape for ordinary story enemies: *don't hit hard, carry large HP pools, and can't be stalled out*. Part 1 mobs roughly tripled (raider 850→2400, wild_beast 700→2000, road_bandit 800→2300) — Duke deals ~1700/turn against chapter 1's old 1700 total, so fights ended on turn 1–2, before the ult gauge (+1/card, 3 cards/turn, cap 5) could ever fill. Each gained **Cornered** (`bossStatSpike`, turn 10, ×3, once). ATK untouched: these fights are longer, not more dangerous.
  - **Two engine bugs surfaced, both silent.** `applyBossTurnStart` gated the whole turn-start pass on `isBoss`, so a non-phased enemy's passive never fired — `activeBossMechanics` already had the fallback for a single `passive`, it was just unreachable. Now gated on *is a phased boss OR carries a turn-start mechanic*; bosses must still run unconditionally or `phaseTurn` stops incrementing and Molvarr's forced SP breaks (an existing test caught exactly that). And **Lyra's DEF passive applied 50% while both her kits authored 150** — `combat.ts` hardcoded `valuePercent: 50` and never read `passive.mechanics`, so no amount of editing the JSON could fix it. It now reads the kit (stat/percent/duration/flags), which corrects the playable Lyra too.
  - **DoT durations are stated and defaulted** (ruling #52) — `lib/game/dotDurations.ts`; the translator derives "for N turns" from the mechanic rather than it being authored into prose, so it can't drift and covers every future proc. Bleed's application default moved 1→2 and is now a flat 2 at every rank roster-wide (Leorio's `[1,1,2]` flattened). Authored durations still win; `raider` (2) and `batra` (2) keep theirs.
  - **Lyra duel retuned to ~4 turns** (8 was dropped as too ambitious). With her passive actually working her effective DEF is 287, not 115. `lyra_npc`: HP 3300→4800, ATK 250→140 (the ordinary-NPC band), multipliers cut to near-mob level (Frost [230,280,350]→[110,135,170], Shaft [200,275,400]→[95,130,190]), ultimate 600→260 so it spikes without executing. The fight is decided by debuffing: holding Weaken's ATK-down keeps Duke alive ~5.6 turns against her ~4.2; ignoring it drops him to ~3.5 and he loses the race. Playable Lyra is untouched (ruling #54).
  - **Not verified in-browser** — Tanveer does the visual/playtest pass himself now (see Working Style in HANDOFF). Verified: types, lint, 665 tests, clean build.

- **Story presentation overhaul + music layer (2026-08-09, Tanveer's verdict was "it's not good right now")** — he confirmed three of four candidate problems: *scenes look cheap*, *no pacing or weight*, *battle handoff is flat*. He dismissed the fourth (too many list screens), so navigation is unchanged. Two rulings gate the work: **backgrounds are deferred** (environment art is an art-direction commitment he isn't making yet — so "cheap" had to be fixed through framing, typography and motion alone), and **audio is music only, supplied by him** (no SFX of any kind). Spec: `docs/superpowers/specs/2026-08-09-story-presentation-and-music-design.md`.
  - **Scene reader.** Text reveals **per word over final layout** with the standard VN contract — tap settles the line, tap again advances (`lib/game/storyScene.ts`, pure). This replaced a character-by-character typewriter within the same day: Tanveer played it and reported *"I have to wait for it to complete to start reading"*, which is structural rather than a speed problem — slicing the string reflows the paragraph on every wrap and leaves the eye on half-words, so no ms/char value fixes it. Now the full line is laid out from the first frame and only opacity animates, word by word, so it can be read *ahead of* the animation; the stagger is capped at 650ms so a ~300-char narration block reveals no slower than a one-line reply (it took 4.2s at 14ms/char, 8s at the first-guess 28ms). The stagger is CSS (`.story-word` + inline `animation-delay`), so a 60-word paragraph costs one React render rather than sixty, and a single timer marks completion instead of a per-character ticker. Reduced motion renders every line complete. Added AUTO (dwell scales with length), HISTORY (a mis-tap used to lose a line permanently) and a skip **confirmation** for chapters never cleared (one stray tap on a top-right control destroyed unseen intros). **Narration is now visually distinct from dialogue** — centred, letterboxed, no name plate — and `isNarration` deliberately treats an explicit `"speaker": "Narrator"` as narration, because Part 1 authors most of its prose that way and rendering it in a character box with a NARRATOR plate treats the camera as a cast member. Portraits reframed 3:4, larger, hard border replaced by a bottom fade, **and the previous speaker is retained on the opposite side, dimmed** — only the active side used to be mounted, so a two-hander was one portrait popping between two empty slots. The two-independent-slots structure is kept verbatim (it exists because a shared container flashed the wrong character mid-exit — Tanveer 2026-07-20). 
  - **Battle handoff.** `ChapterTitleCard` opens a chapter; `VersusSplash` stands the resolved player team against the enemy team before the arena (the missing stakes moment — fights used to simply materialise); `BattleArena` gained an optional `contextLabel` rendered in the status strip so a canon fight doesn't look byte-identical to practice; `ChapterCompleteCard` marks a **first clear only** — a fanfare on the fortieth farm run is noise. Flow is now `chapters → brief → title → intro → versus → battle → outro → complete → rewards`, with the skip path bypassing title/intro/outro/complete but **keeping versus**, which is short and covers the battle's start-up.
  - **Music layer.** `lib/audio/` — a role-keyed manifest (`menu`/`story`/`storyScene`/`battle`/`victory`) plus a two-deck crossfading controller; screens ask via `useScreenMusic(role)`. Two `HTMLAudioElement`s rather than a Web Audio graph (no AudioContext lifecycle, gapless looping stays the browser's problem). Three states are normal rather than errors and each is tested: **no user gesture yet** (the role is held and starts on the first tap — browsers block autoplay), **the file doesn't exist** (resolves to silence, recorded once so it can't be retried on every screen change), and **the same role requested again** (a no-op, so parts → chapters → brief is one continuous track). Volume/mute persist in `settingsStore` and are exposed through a ♪ popover in `TopNav` — not `/profile`, which redirects guests to `/login`, and guest mode is supported. `public/audio/` ships empty on purpose; `docs/AUDIO.md` lists the exact filenames. **The game is silent until Tanveer adds the OST**, by design.
  - Browser-verified end to end on the running dev server: typewriter, narration treatment, skip confirmation, VS splash, chapter label in the battle strip, CHAPTER COMPLETE on first clear and its absence on a replay, the ♪ popover, `TopNav` still exactly 44px at 375px (the battle shell measures `100dvh - 2.875rem` against it), no horizontal overflow, and a clean console **despite zero audio files present**.
  - **Deliberately NOT done:** environment backgrounds (Tanveer's call), any SFX, and a per-chapter music override — roles cover every screen this batch touches, and an override is one optional schema field whenever he wants a specific track for a specific fight.

- **Story rewards + team agency (2026-08-09, Tanveer's picks)** — story was sealed off from every economy system shipped after it: a chapter cost nothing, paid nothing, and locked the team, so a player who pulled a character on `/gacha` had nowhere in the narrative to use them. Five rulings settled it (see HANDOFF #45–49) and the batch implements them. **Rewards** — each chapter authors a one-time `firstClear` bundle (fixed amounts) plus `repeat` drops (per-entry `{min,max}` ranges, rolled every clear including the first) in `data/story/*.json`; `lib/game/storyRewards.ts` is pure with an injectable `rng`, mirroring `worldBossRewards.ts`. Payout split is deliberate: repeat drops are coin + `training_manual`, gems are first-clear-only, and ascension materials stay world-boss exclusive so each mode keeps a distinct reason to exist. Placeholder numbers (Part 1: 50 gems / 1500 coin / 2 manuals first clear, 300–800 coin + 0–2 manuals repeat, 5 stamina; Part 2 richer) are derived from the world-boss and summon anchors and are **Tanveer's to tune** — all live in JSON, no code change. **Stamina** — `storyAttemptCost` charges only a cleared chapter's replay; an uncleared chapter is free however many attempts it takes, so the narrative can never be stamina-locked. **Team agency** — `teamMode` per chapter (`canon` / `anchored` / `free`); `lib/game/storyTeam.ts` resolves anchors + player picks, de-duplicates a pick that repeats an anchor, caps at 4, and falls back to the canon team when a `free` chapter gets no picks. **Anchors bypass ownership** — a fresh account plays Duke's story without having pulled Duke. Parts 1–2 ship as `canon`; flipping one chapter is a one-word JSON edit. **Flow** — two new view states, `brief` (opposition, payout preview, stamina cost, team) and `rewards`; a cleared chapter's brief offers **SKIP STORY**, which goes brief → battle → rewards with no VN panels, because farming through eight panels per run would be unusable. Rewards are rolled, granted and the chapter marked cleared inside the *transition callback*, never an effect — that makes double-granting impossible by construction and lets "was this a first clear" be read before `markChapterComplete` flips it. **Schema** — `teamMode` and `rewards` are required (a chapter that silently defaults is one someone forgot to finish); `min <= max`, `replayStamina` within `[0, STAMINA_CAP]`, and material ids checked against a new canonical registry (`lib/game/materials.ts`, which also absorbed the label map that lived inside `app/profile/page.tsx` — the profile now shows the gacha's specialty materials it was quietly hiding). **Components** — `app/story/page.tsx` keeps only the view machine and battle shell; `StoryPartSelect` / `StoryChapterList` / `ChapterBrief` / `StoryRewardsScreen` moved to `components/game/story/`. `WorldBossTeamSelect` generalised to `OwnedTeamSelect` (locked `anchors` + explicit `openSlots`) rather than writing a third near-identical picker. 33 new tests. Browser-verified end to end on a live dev server: first clear granted exactly +50 gems / +1500 coin / +2 manuals plus a 513-coin drop with stamina untouched at 120; the replay charged 5 (120 → 115), paid drops only, skipped both scene readers, and granted no second bundle; world boss unchanged; no horizontal overflow at 375px; clean console.
  - **Deliberately NOT done:** the mission-objective layer (3 per-chapter objectives paying gems), difficulty tiers, the node-path stage map and multi-wave stages with persistent HP. Each is its own batch — see `docs/ROADMAP.md`.

- **Firebase lazy-loaded + kit-registration guard (2026-08-04)** — Firebase initialised at module scope and exported `auth`/`db` as values, so importing `lib/firebase.ts` anywhere pulled **~555 KB of `@firebase`** into the shared client chunk; `AuthProvider` sits in the root layout, so **every route paid for it**, including a practice battle that never touches auth. Now `loadFirebase()` dynamic-imports app/auth/firestore on first use and memoises the promise (concurrent callers share one `initializeApp`), returning a `FirebaseBundle` that carries the initialised services **plus both SDK namespaces** — consumers take their API functions off `authApi`/`dbApi` rather than importing `firebase/*`, since one value import anywhere puts the SDK back in the shared chunk. `firebaseEnabled` stays a plain env read with no SDK import, so `/login`'s guest-mode branch costs nothing. Verified: Firebase now occupies its own 572 KB chunk that **no page references in its initial HTML**, loading after mount instead of blocking it; `/practice`, `/login`, `/profile`, `/story` all render with a clean console. Guest mode (no `.env.local`) is unchanged — `loadFirebase()` returns null exactly where `auth`/`db` used to be null.
  - **Kit registration guard** — `characterCatalog.ts` needs an import line *and* a `rawCharacters` entry per kit; miss either and the character silently doesn't exist (no build error, no type error). `import.meta.glob` would have removed the hand-maintenance, but **Turbopack compiles it and then throws `.glob is not a function` at runtime**, failing the prerender (measured; Vitest supports it, Turbopack doesn't). Registration therefore stays explicit, guarded by `tests/characterCatalogRegistration.test.ts` — kit-on-disk-not-registered, registered-with-no-JSON, and `id` matching filename. Verified by planting an unregistered kit and watching it fail.
  - **Not done, deliberately:** per-battle kit loading. All 27 kits are **9.5 KB gzipped combined** against a ~2.4 MB bundle — lazy-loading them saves ~7 KB while adding an async gate before every fight and a mid-battle re-fetch on resume.

- **Damage Preview → Kit Preview (2026-08-04, Tanveer's ask)** — audited `buildCharacterDamagePreview` across all 27 kits; it was a *damage* table that fell silent on everything else. Five real defects, all fixed and regression-tested (`tests/kitPreview.test.ts`, 16 tests):
  1. **Non-damage skills reported "1 damage"** — the engine's `max(1, base − def)` floor leaking into rows for skills that deal none. Mustafa's Fortress (a team damage-reduction stance) and Leorio's Member of the Zodiac (a team ATK/DEF buff) both read `1 damage` with *empty notes*. New `summarizeSupportEffects` describes buff/debuff/stance/cleanse/immunity/taunt/gauge effects; those rows now read "Damage taken −60% (2 turns)" and "ATK · DEF +40% (2 turns)". Sibling stat changes sharing an amount and duration merge into one line.
  2. **Multi-phase kits truncated to phase 1** — Molvarr's entire second phase (Abyssal Pierce, Devouring Bite, Tidal Cataclysm) never appeared, on a page that showed his phase switcher directly above. Phases are now walked explicitly; rows carry a `phaseLabel` and the archive renders one table per phase. Molvarr: **7 → 21 rows**.
  3. **Passives absent entirely.** Every character now gets a passive row. Summarising from `mechanics[]` alone produced "See kit" for most of the roster (passive mechanic types are conditional/stateful), so it reads the *authored* description instead — the structured `#`/`-` format even splits condition (→ Scenario column) from effect (→ Result). Literal 👆/👇 become ↑/↓ since this table is plain text.
  4. **Rank-gated and zero-valued effects reported anyway** — rows read "No seal at this rank. Seals skills." on one line, and "−0 enemy ult gauge".
  5. **Seals: only the first was read, and `sealType` was ignored.** Chiara's House Rules carries two seals with different rank gates, so R2 claimed "No seal at this rank" while the skill's own description one section above listed one. All seals are now reported, each naming which skills it locks.
  Also de-duplicates self-buffs already folded into the damage number ("Self DEF buff included (+30%). DEF +30% (2 turns)."), while keeping buffs on stats the damage number *doesn't* fold in (Chiara's ult Evade). Section renamed **Kit Preview** — it is no longer only about damage.

- **Archive detail page as a document (UX Batch 5, 2026-08-04)** — kit info rendered as nested bordered cards (`Section` → `SkillBlock` → rank rows): every skill looked like every other skill, and telling R1 from R3 meant diffing three prose paragraphs by eye. `/news` reads well because it's a *document*; the archive now uses the same typography. **`components/ui/prose.tsx` (new)** holds the heading/paragraph/list/table styles that previously lived only in `mdx-components.tsx` — both consume it, which is what makes the two pages genuinely match rather than approximately match; it also exports `ProseSection` (amber-ruled heading + optional right-aligned note) and `ProseTable`. **`components/game/SkillDocument.tsx` (new)** renders one skill as ruled heading + metadata line (type · mechanics, deduped — a debuff skill with a `debuff` mechanic used to read "Debuff · Debuff") + a **rank table**: Rank / Mult / Effect. The multiplier column is real data (`damageRanked[i]`, no string parsing), so the rank delta is visible at a glance while the description keeps its full keyword-highlighted wording. **Kit data stays in `data/characters/*.json`** — it's runtime data the engine, tests, Zod and Kit Lab all depend on; this batch is rendering only. The duplicate `SkillBlock` in `app/archive/[id]/page.tsx` is deleted (`KitDetails.tsx` keeps the compact in-battle variant); `KitPhases` gained a `variant` prop (`compact` for battle overlays, `document` for the archive) so multi-phase bosses don't render as cards on a page where everyone else renders as a document. Damage Preview restyled to match. Browser-verified: `/archive/duke` (single-phase), `/archive/molvarr` (2 phases, 3 passives), 1440px and 390px, no horizontal overflow.
  - **Deliberately NOT done:** the planned `CharacterGrid` extraction across `CharacterBrowser` / TeamSelect's roster overlay / the gacha pool. The three differ in *interaction*, not just layout — browse-and-navigate vs multi-select-with-pick-order vs read-only rates — so one shared grid would need a prop for each and serve none of them well. The genuinely shared unit is the character *tile*, not the grid; revisit at that scope.

- **Per-character VFX across the roster (UX Batch 4, 2026-08-04)** — `characterVfx.ts` covered **5 of 27** characters; the other 22 fell back to a generic element-colored ring. Now **all 27** (playable + story-only + boss) carry a tint and shape. Five new shapes joined ring/ripple/shard/flicker/blot: `bolt` (Killua/Seras), `slash` (Gon/Leorio/Yalina), `bloom` (Siddiq/Chiara/Isolde), `paw` (Sara/wild_beast), `quake` (Diane/Mustafa/iron) — each a `clip-path` + accent pair, same cost as the existing ones. Power themes follow `docs/design/SKILL_ART_PLAN.md`'s per-character table, so a character's VFX and their generated skill art describe the same power. The arena's burst renderer had `shape === "ripple"` / `shape === "flicker"` branches inline; accents are now resolved from the registry via `getVfxAccent` (`second-ring` / `inner-pop` / `core` / `wave`), so **a new flavor is a data edit, not a JSX edit**. **Ult cut-ins switched to skill art** — `getSkillArt(characterId, skillName) ?? getCharacterArt(...)`; all 48 playable/boss ultimates already have their own art, so every ultimate's cut-in now reads distinctly at zero asset cost (they previously all showed the same portrait). Rank escalation was **already** implemented (`lib/game/revealTier.ts`: basic/R1/R2/R3/ultimate driving projectile size, burst strength, shake, flash, wind-up, beam sweep, cutscene) — nothing to add. 5 new tests (`tests/characterVfx.test.ts`) lock the invariants that actually matter: full catalog coverage, and **every tint at least 60 channel-units away from its own element tint** (a flavor landing on its own hue renders as no flavor at all). Arena layout deliberately unchanged — the open spacing between team rows is Tanveer's intentional fix for v1's congestion.

- **Structured battle log (UX Batch 3, 2026-08-04)** — the log was `string[]`, filtered with `entry.startsWith("[Action] ")` and printed one flat `<p>` per line, while the identical actions were *already* available as typed `battleEvents` (per-target damage, crit, evade, kill, exact `hpBefore`/`hpAfter`) driving the cinematics. `components/game/battle/BattleLogDrawer.tsx` (new) renders that stream instead: grouped by turn (newest turn first, events inside a turn kept in resolution order so cause precedes effect), collapsible per turn, with portrait chips, ally/enemy color coding, rank/ULT tags, and per-target damage/heal/CRIT/DODGED/SURVIVED/DOWN markers; `tick` events (DoT, Corrosion, Regeneration, Decay) render with their label and HP delta. **No engine change** — `turn` and `phase` are stamped onto events in `gameStore.addBattleEvent`, since both are presentation context the engine has no reason to know. The raw string log stays behind a **Raw** toggle: it is still the only record of *which buffs/debuffs an action applied*, which the event stream doesn't model — emitting those from `combat.ts` is the natural follow-up. SAVE BATTLE LOG now writes **markdown** (`formatBattleLogMarkdown` in `lib/game/battleLogMarkdown.ts`, pure and unit-tested; endpoint writes `.md`): heading, final-state tables per team, a per-turn timeline, and the raw engine log verbatim as an appendix. 8 new tests (`tests/battleLogView.test.ts`) cover turn grouping order and every markdown branch (see the Tests entry for the running total). `BattleArena.tsx` 1081 → 1021 lines.

- **Growth gating + practice-dummy HP (Tanveer's playtest, 2026-08-04)** — `CharacterProgressionPanel` was an always-expanded card eating most of the archive sidebar, rendered for **every** character including unowned ones and story-only NPC/boss kits, offering to level things the player has no claim to. Now a single **Growth** button opening the controls in the shared `DetailOverlay` modal, gated three ways: `storyOnly` kits render nothing, unowned playables get a one-line "Not owned — summon to level up", owned characters get the button. Ownership reads `playerStore.roster` behind `hasHydrated` (same pattern `CharacterBrowser` already uses) so server and first client render agree. The practice dummy went **400 HP → 100,000** (`PRACTICE_DUMMY_HP`): 400 was chosen so a Preview battle "resolved quickly", which is backwards — Preview exists to try a kit's whole rank ladder and ultimate, and a dying dummy cuts that short. Nothing in the roster can drop it (biggest ultimate is well under 10k/hit). `.remember/**` added to the eslint ignore list — plugin scratch files were the only warning left in `npm run check`.

- **Enemy inspection + info-panel relayout (UX Batch 2, 2026-08-04)** — **enemies can finally be inspected.** `UnitDetailPanel` always handled enemy units correctly (`unit.team === "player" ? playerTeam : enemyTeam`), but nothing on the battle screen could open it for them: the only route in was the bottom-right TEAM button, whose list was hardcoded to `playerTeam`. Fixed by unifying tile interaction — **tap = inspect on both rows**, with focus-fire moved to its own ◎ reticle button on the enemy tile (previously one gesture meant "mark a target" on enemies and nothing at all on allies). `TeamDetailsList` now takes `team` + `title`, and a matching ENEMY roster button sits top-right (at `top-14`, clearing the status strip's Speed/Log/Exit cluster). The panel's ◀ ▶ nav then walks whichever side it was opened on, free — it was already keyed off `unit.team`. **Relayout:** stats moved from flanking a 40×56 thumbnail to overlaid on a full-bleed portrait band (two scrims: sideways for the stat columns, upward for the HP/ult block); reordered to decision priority (threat state → live stats → kit); the kit became a **tab strip** (S1 / S2 / ULT / Passive) using the 48 existing skill arts as thumbnails, so a 2-skill kit and an 8-skill boss phase cost the same height. Measured: **531/531px, no scroll at 900px** (was ~35% visible). `EffectsQuickPanel` deleted — it was a second overlay answering the same question as the panel's effects section; its `EffectsList`/`categorizeEffects` helpers moved to `components/game/battle/EffectsList.tsx`. Detail state is now id-based and resolves the live unit each render (the panel leads with HP and effects, so a captured snapshot would freeze mid-battle). **`BattleArena.tsx` 1964 → 1081 lines**, with `TeamUnitTile`/`TeamDetailsList`/`UnitDetailPanel`/`EffectsList` extracted to `components/game/battle/`; `FLASH_TINTS` + `getUnitBorderClass` moved to `lib/game/elementSwatch.ts`. HP numerals now render on the tile itself. Browser-verified in a live 3v2 practice fight: ally panel, enemy panel, cross-row nav, focus-fire toggle, clean console.

- **Home hub + unified navigation (UX Batch 1, 2026-08-04)** — the main menu was 7 identically-shaped outline buttons with no state; it's now a game hub. `components/game/PlayerHud.tsx` (new) shows identity + the three gating resources (stamina with a fill bar, gems, coin), read from `playerStore` and gated on `hasHydrated` plus a `useSyncExternalStore` wall clock (snapshot floored to a 30s bucket so repeated reads are stable — a raw `Date.now()` snapshot re-renders forever). `HomeMenu.tsx` rewritten into three visual tiers — primary MAIN STORY (art-backed, subtitled with the first unlocked-but-uncleared chapter via `findNextChapter`), secondary WORLD BOSS / GACHA (live boss + active banner name), tertiary ARCHIVE / PRACTICE / NEWS / LOGIN. Card art is `object-cover` on wide short cards, so `artPosition` is tuned per card rather than globally guessed; the primary card carries `priority` (it's the LCP element everywhere). **`lib/nav/routes.ts` (new) is now the single source of truth for what modes exist** — `TopNav` and `HomeMenu` both render from `GAME_ROUTES`, closing a real bug where World Boss, Gacha and News were unreachable from every page except home. The nav row scrolls horizontally rather than wrapping, preserving the fixed `h-11` the battle shell measures `100dvh` against. Browser-verified at 1440×900 and 390×844: no horizontal overflow, no hydration mismatch, clean console.

- **Battle engine** — full phase state machine, 3-actions-per-turn enemy AI (random living field enemy each action, decisions from live state), win/loss detection.
- **Rank system** — card rank drives damage multiplier, `*Ranked` mechanic values, and `aoeRanked` activation; flat mechanic values stay flat; ultimates rank-immune.
- **Deck (7DS GC rules)** — hand never resets; pure-random one-at-a-time refill with auto-merge on adjacent identical cards (+1 ult gauge per merge); ult guaranteed only if gauge was full BEFORE the refill; deck locked outside `PlayerAction`; empty-hand auto-pass.
- **Enemy hidden deck (2026-07-18)** — the enemy side now runs the same 7DS GC deck as the player, headless: a shared enemy hand seeded at battle start, RNG-refilled to the same capacity (`[0,4,5,7,8]` by field count) each enemy turn, auto-merging adjacent identical cards up a rank (each merge grants that enemy +1 ult gauge). The AI plays ONLY from this hand (`getAIMove(..., hand)`) by the existing priority tiers, so enemy skills finally use their merged **rank** and enemy ults come through the gauge/deck — RNG-fair like the player. Merge/refill logic extracted to `lib/game/deck.ts` and shared by both sides (player `gameStore` refactored onto it, behavior unchanged). Telegraph ("NEXT" cards above enemies) deferred to the battle-arena polish pass. `Action.cardId` lets the loop consume the played card.
- **Molvarr boss engine (COMPLETE 2026-07-19)** — the first multi-phase world boss, fully built. Foundation: per-character ult-gauge cap (`ultGaugeMax`, default 5 / Molvarr 10; `lib/game/ultGauge.ts`); **Corrosion** (uncapped-stacking DoT = % of target MAX HP per stack/turn; `combat.ts`+`tick.ts`); **phase system** (`lib/game/phases.ts`) — transitions at HP 0 (fresh bar; boss buffs/debuffs/gauge/per-phase-state reset, player state + global turn counter + Corrosion-on-players persist); **CC-immunity** (`ccImmune`). **Boss passive engine** (`lib/game/bossPassives.ts`): reads the boss's ACTIVE phase passives LIVE each turn (all of them — no re-registration on transition), via six typed boss mechanics — `bossAutoSp` (force phase `spSkill` every 3rd phase-turn), `bossStatSpike` (turn-10 ×2 ATK/DEF/maxHP, once), `bossMaxHpDrain` (turn-10 10%-current-HP damage/turn), `bossDebuffAtk` (ATK = enemy debuff **stacks** ×10%, recomputed each turn), `bossApplyCorrosion` (P2: 1 Corrosion/2-turn per enemy at turn start), `bossCorrosionBonus` (P2: +30% vs Corroded) — plus `HealMechanic.missingHpPercent` (SP heal = 30% of missing HP) and ult self-refill (P2 ult +3 gauge). Wired at OnEnemyTurnStart (`applyBossTurnStart`) + the EnemyAction loop (forced SP) + `combat.ts`. **Kit shipped:** `data/characters/molvarr.json` (2 phases, elite, ult cap 10, ccImmune; art `public/npc/molvarr.png`). Full spec: `docs/design/BOSS_MOLVARR.md`.
- **Kit Lab — RETIRED.** The dev-only `/kit-lab` route no longer exists: it was repointed into the player-facing Kit Preview in `7c53ff5`. This entry claimed it was live until 2026-08-09. Design spec `docs/superpowers/specs/2026-07-18-kit-lab-design.md` is history, not current behaviour.
- **Sub units** — battle format 4v4 (all field) or 3v3 (4th member auto-sub); sub passive active from bench, no cards, untargetable; promoted at new-turn start after a teammate dies; lone subs auto-convert to field.
- **Character kits** — 27 JSON kits: **18 playable** (ban, batra, chiara, diane, duke, gabrist, gon, isolde, killua, leorio, lyra, master_tao, meliodas, mustafa, sara, seras, siddiq, yalina) + **9 `storyOnly`** hidden from team select and the archive (frost, gale, iron, prism, raider, road_bandit, wild_beast, lyra_npc, molvarr). Includes Duke's full Flowing Ruin, Seras (Shock/CRITICAL/Charged), the 7DS collab trio: Meliodas (Deathblow crit ramp, Full Counter stance, stance/buff-cancelling ult), Ban (Lifesteal, Extort stat-steal, Extort Life max-HP shred), Diane (Rupture, rank-gated Attack Seal, Giant's Will ATK ramp), and the HxH collab trio: Gon (buff-before-hit Rock, self ult-gauge fill, Rookie Hunter stat flip), Killua (stance-cancel + rank-gated stun, Detonate), Leorio (rank-scaling team buff, Pierce + Bleed, Kind Hearted Friend character synergy). Tanveer's roster-wide stat rebalance (2026-07-11) is live.
- **Literal durations (ruling #21)** — buffs tick at owner turn start, debuffs/DoT/stun at victim turn end; N turns = N procs / N blocked turns.
- **Type advantage** — Dark<>Light mutual, Red>Green>Blue>Red; +20%/−10%/0; CRITICAL ignores it.
- **Evade system** — base 0% for everyone; Charged stacks grant +5% each; evaded attacks deal nothing but still feed Charged.
- **Crit system** — base 0%; a proc applies the CRITICAL package. **Effective stats** — percent/flat buff-debuff entries now actually change dealt/received damage (`lib/game/stats.ts`); previously they were cosmetic.
- **UI (shadcn/ui + Tailwind 4)** — main menu, team select (format toggle, 1–4 units, art slots), battle arena (compact unit cards, sub badges, victory/defeat overlay with rematch), deck dock with hover previews and rank-aware descriptions, archive tile grid + Dokkan-style detail pages, login/profile (Firebase optional → guest mode).
- **Character art** — full roster AI-generated (ComfyUI + Animagine XL 4.0, Dokkan × 7DSGC style); pipeline in `docs/ART_PIPELINE.md`.
- **Archive UX** — colored effect pills on keyword hover (red attack fx / purple debuffs / green heals+buffs / yellow stances / white cancels), skill chips colored by type, mechanic-driven damage preview scenarios for all kits (incl. per-counter damage rows for counter stances), sticky topnav on every page.
- **Dokkan wording (rulings #26–28)** — descriptions drop numbers ("raises" <50%, "greatly" 50–79%, "massively" 80%+; same for lowers); pills span the stat ("Raises ATK") and hover shows that skill's exact percentages per rank. One pill per unique effect — cancel effects are phrase-level keys. No "own"; cancellable/stackable is the unmentioned default. Permanent stat changes are explicit ("Permanently raises ATK" — its own pill tier); semicolons separate description clauses, applied roster-wide.
- **Single-ally targeting** — single-target ally buffs/heals (Leorio's rank-1 Member of the Zodiac) require marking an ally on the arena (emerald Target badge); rank-gated aoe needs no selection.
- **Pierce** — flat 50% DEF ignore for every card; per-card pierce values removed.
- **Lethal survival (ruling #29)** — Nine Lives catches direct hits AND lethal DoT procs (`lib/game/lethal.ts`, shared by combat + ticks); any revival strips all buffs and debuffs, uncancellable included.
- **Battle QoL** — 1×/2× speed toggle (scales phase auto-advance + enemy resolve delays), battle-log filter (Actions only / All events incl. DoT ticks + passive procs), hover tooltips on unit ▲/▼ effect counters. **Superseded 2026-08-21:** the effect strip is a readout now, not a control, and no tooltip in the game opens on hover any more (rulings #118, #120).
- **Kit validation** — Zod schema (`lib/game/characterSchema.ts`) parses every character JSON at load; malformed kits fail with the character id and field named. `npm run check` = tsc + eslint + vitest.
- **Effects vs buffs/debuffs (ruling #30)** — uncancellable entries (synergy bonuses, ramps) are grey "effects": excluded from Rupture/Amplify/Weakpoint counting, cleanse, AI cleanse decisions, and the ▲/▼ counters (grey ◆ counter + "Effects" section instead). Their stat modifiers still apply.
- **Taunt-stance link (ruling #31)** — cancelling a unit's stances/buffs also breaks the taunts it authored; Yalina's Attention Drawer is a real stance now.
- **Extort links (ruling #32)** — the thief's Extort buff dies when no living enemy carries a linked Extort debuff (death/cleanse/expiry); synced after every action and debuff tick.
- **Deck QoL (ruling #33)** — Reset Hand rewinds queue + selection merges + merge-granted gauge to turn start; leftover cards auto-merge when queuing/unqueuing exposes identical neighbors.
- **Momentum gating (ruling #34)** — Yalina gains a stack from every card her team plays incl. her own, only while fielded and alive; benched/dead Yalina gains nothing.
- **Damage-modifier stats (ruling #36)** — `damageDealt` and `damageReduction` are consumed by the damage engine, multiplicative stacking (attacker's damageDealt raises, target's damageReduction shrinks, counters included). Mustafa's Fortress and Yalina's Attention Drawer actually reduce damage now; Sara's [Female] synergy actually raises it.
- **Extort overwrite (ruling #38)** — recasting Extort strips the thief's previous Extort debuffs from all enemies before applying; victim debuffs never stack.
- **Synergy display** — tag synergies render as `[Tag] Synergy` (typed buff, never "amplify"); per-carrier scaling confirmed as designed (ruling #35).
- **Enemy action economy (ruling 2026-07-12, amends #39)** — counting living field enemies (subs grant none): a low-mid team gets its member count **+1** (solo mob acts twice, two mobs act three times); a team with any living **elite** (`tier: "elite"` — named bosses) always takes the full 3. Both capped at 3, so a 5-enemy pack still gets 3. `lib/game/ai.ts` `enemyActionsForTurn`.
- **Multiplicative stat stacking (ruling 2026-07-12)** — ATK/DEF percent buffs AND debuffs compound as factors (`effectiveStat` in `lib/game/stats.ts`): +10% stacks 100→110→121; −25%,−50%,−25% → ×0.28 (approaches but never reaches 0, so a fully-weakened unit still deals chip damage — fixes stacked Weaken zeroing a unit's skills and ult). A single ≥100% debuff still floors to 0. `damageDealt`/`damageReduction` were already multiplicative; the whole stat system is now uniform.
- **Story-battle NPC boss copies (2026-07-12)** — official characters used as story enemies get a dedicated `storyOnly` NPC kit (own `/archive/npc` entry, reuses the playable art) with tweakable stats: `lyra_npc` (3300 HP, elite tier, Tanveer's stat bump) replaces the raw `lyra` reference in Part 2. Add a `tier`/`storyOnly` field per kit; both validated in the Zod schema.
- **Story progress on the player profile (2026-07-12)** — story completion now writes to `users/{uid}.storyProgress.completed` (the doc the Firestore rules already grant the owner) instead of a separate `storyProgress/{uid}` collection that the catch-all denied — so signed-in progress actually syncs to the cloud/profile. Cleared chapters stay replayable (tap re-enters intro→battle→outro), with a `✓ Cleared · Replay ▸` affordance in the chapter list.
- **Decay status readout fix (2026-07-12)** — decay carries its per-turn hit in `capturedDamage`; the status tooltip (`describeEffect`) and battle log now surface it as `decay (N/turn)` instead of "no numeric value".
- **KHF extra fades after death (ruling #24 fix)** — queue items can set `runWhenDead` so cleanup-style rechecks still run for a dead source; Kind Hearted Friend's +10% extra now fades from survivors when the trio dies (found in Tanveer's saved battle log).
- **Victory fizzles the queue (ruling #43)** — leftover queued cards are discarded the moment the last enemy dies; no Momentum or gauge from post-win cards.
- **Zero-value clauses hidden (ruling #44)** — rank-1 Lightning Palm doesn't mention its stun, rank-1 Rush Rock doesn't mention Attack Seal; the clause appears at the rank where the value is real.
- **Confirmed by Tanveer 2026-07-11** — identical tag synergies stack per carrier (ruling #40); cancel-then-hit order (ruling #41); DoT ticks unaffected by damage modifiers (ruling #42).
- **Battle log dump** — SAVE BATTLE LOG on the victory/defeat overlay writes teams + the full event log to `<project>/battle-log/` via `app/api/battle-log` (gitignored, playtest debugging).
- **Type-safe mechanics (STATUS #7 closed)** — `Mechanic` is a discriminated union of **53** per-type interfaces (`types/mechanic.ts`, canonical list = `MECHANIC_TYPES`); narrowing on `type` exposes exactly that mechanic's fields. `Character.passive` is a typed `Passive` with a `PassiveTrigger` union (`types/passive.ts`); runtime buff/debuff entries are `StatusEffect`. Zero `any` left in lib/hooks/store/components/app. The Zod schema now rejects unknown mechanic types AND unknown passive triggers at load — a typo'd kit fails with the character id and path before a battle ever starts. One documented boundary cast where validated kit JSON becomes typed data (BattleProvider).
- **Battle HUD redesign (STATUS #20, first pass — Tanveer's picks 2026-07-12)** — single-viewport layout, no page scroll: slim status strip (turn/phase/progress/speed/log), enemy row + player row of portrait-first unit tiles (art fills tile; overlaid HP bar, 5-segment ULT pips, ▲/▼/◆ counters with tooltip, Sub/Target/×N badges, DOWN stamp), event ticker above an always-visible deck dock (collapse toggle removed) — **the ticker was cut 2026-08-21** (#118), and the strip's speed/log controls moved into a bottom sheet in the same pass, queue rendered as compact chips beside Reset Hand, full log in a slide-over drawer (Actions only / All events filter). TopNav pinned to h-11 so the battle shell sizes to `100dvh - 2.875rem`; BattleArena root must NOT set a z-index (it would trap the fixed drawer/modals under the sticky TopNav's z-50).
- **Battle cinematics (STATUS #20, Tanveer's Tier-3 pick 2026-07-12)** — engine emits structured `BattleActionEvent`s (`types/battleEvent.ts`; per-target damage/heal/evade/crit/kill + exact hpBefore/hpAfter, counters) via an optional `emit` param on `executeSkill`; UI never parses log strings. `useBattleSequencer` replays them ~700ms/action (÷ battle speed): attacker ghost lunges to target, color-tinted impact flash + tile shake, damage/heal/evade/counter floaters, HP bars drain at the impact moment via display-HP overrides (store state is already final underneath). Ultimates get a full-width cut-in banner (character art + skill name, ~900ms) before the hit. Skip button jumps to final state; victory/defeat overlay is held until playback ends (covers the overkill-skip ask). Action lines removed from the toast overlay (sequencer + ticker own them); DoT/passive toasts remain. `prefers-reduced-motion` disables shake/dodge keyframes.
- **Story mode (Dokkan-style, Parts 1–2 playable — Tanveer's picks 2026-07-12)** — `/story`: part banners (cover art, tagline, cleared count; Parts 3–6 listed as coming soon) → chapter list → VN scene reader (`components/game/StorySceneReader.tsx`: portrait left/right, name plate, tap/Enter/Space to advance, Skip) → canon-locked battle (reuses `startCustomBattle` + the practice battle shell) → outro → next chapter unlocks. Chapter flow: intro scenes → battle → outro scenes; strict sequential unlock (first chapter free, each next needs the previous, next part needs the previous part's last chapter). Data: `data/story/part1.json` (Rawspent and Ledger, 4 chapters, Duke solo vs raiders/wild beasts/road bandits) + `part2.json` (Lyra, 2-stage Duke-vs-Lyra canon fight), adapted from the Arc One beat sheets; validated at load by `lib/game/storySchema.ts` (Zod; unknown character/portrait ids fail with part+chapter id). Progress: `store/storyStore.ts`, zustand persist to localStorage + best-effort Firestore mirror (`storyProgress/{uid}`, union merge) for signed-in users. Battle result screen swaps to CONTINUE STORY / RETRY BATTLE / BACK TO CHAPTERS via BattleArena's optional `story` prop; practice overlay unchanged. Enemy-only kits (`raider`, `road_bandit`, `wild_beast`, approved by Tanveer) carry `storyOnly: true` and are hidden from team select + archive via `getPlayableCharacters()`. MAIN STORY menu button enabled; Story link added to TopNav. Gotcha: the scene reader root is a div, not a `<button>` — the Skip button nests inside (button-in-button = hydration error), and `onFinish` must not fire inside a `setIndex` updater (setState-during-render). **Playtest adjustments (2026-07-12):** scene panels vertically centered (was bottom); the three story-only enemies now have ComfyUI art (v6) and a hidden URL-only roster at `/archive/npc` (`getAllCharacters().filter(storyOnly)`, no UI link).
- **Team select overlay (2026-07-12)** — the always-visible roster is gone; tapping any team slot (player or enemy, filled or empty) opens a fullscreen `RosterOverlay` with tap-to-toggle add/remove (✓+index badge on picked, max 4) and a DONE button to close. `components/game/TeamSelect.tsx`.
- **Optional enemy targeting (ruling 2026-07-12)** — single-target player attacks no longer require marking an enemy: unmarked attacks pick a random living field enemy at execution (`combat.ts` resolves `targetInstanceId` when absent for attack/debuff/disable/ultimate); marking still focus-fires. AoE unaffected; single-chosen-ally skills still require a marked ally. Arena enemy label updated accordingly.
- **Battle info panel redesign (2026-07-12)** — tapping a unit's Info opens a full panel: live ATK/DEF as effective value + green/red delta since battle start, HP cur/max delta, ULT n/5; Buffs | Debuffs | Effects in three columns; full kit (skills+ult+passive) via a shared `KitDetails.tsx` that also backs the archive detail page. No art in the panel. Decay tooltips/log now read `decay (N/turn)` (was "no numeric value").
- **Passive status icons (2026-07-29)** — `lib/game/passiveStacks.ts`'s per-character readout rewritten from plain `[current/max]` text to 7 icon-based display shapes covering the full roster (was 6 of ~19 passives); passive *description* authoring is being migrated character-by-character to a structured `#`/`-`/`--` heading/bullet/comment format with literal 👇/👆 becoming colored arrow icons (`lib/game/passiveMarkup.ts`, 4/18 converted: Ban, Batra, Chiara, Diane). Full spec: `docs/superpowers/specs/2026-07-29-passive-status-icons-design.md`.
- **Ally-target chooser (2026-07-13)** — single-target ally skills open a living-ally modal on select (`pendingAllyCardId` → `confirmAllyTarget`/`cancelAllyTarget`); re-picks after Reset Hand. Removed the arena ally marker + deck "Pick Target" prompt. Enemy focus-fire marking unchanged.
- **Turn flow (2026-07-13)** — End Turn button resolves the queue with any number of real actions (≥1); tap an empty action slot to queue a plain pass (no card/effect/gauge, `queuedNullCount`, counts toward the 3-slot cap), tap a Pass to take it back. Every played card already grants its owner +1 ult gauge.
- **Enemy AI priority (ruling 2026-07-13)** — `getAIMove` picks across the whole acting pool by priority: ultimate (gauge full) → new buff (max 1/turn) or heal (ally <50%) → stance (max 1/turn, not already held) → debuff/disable (max 1/turn) → attack → other. Caps hold across the turn via a shared `AITurnContext` (`freshAITurnContext`/`noteAIAction`).
- **Fixes (2026-07-12/13)** — Mustafa's Earth Stance: Fortress is a team-wide (aoe) DR stance, no ally pick; single-target attacks retarget to a living enemy when their marked target died mid-queue (focus-fire no longer wastes cards on a corpse).
- **Tests** — **723 across 62 files** (`npx vitest run`, ~3s). Coverage spans battle event emission, combat rank, Flowing Ruin, AI, debuff skills, damage formula, ticks, subs, deck flow, Seras, 7DS kits, HxH kits, description placeholders, ally targeting, optional enemy targeting (unmarked = random), enemy action economy (low-mid +1 / elite always 3), multiplicative buff+debuff stacking, lethal survival, effects/links, playtest-2 regressions, kit schema validation, story schema + sequential unlock + reward/teamMode validation, story reward rolls (range bounds, first-clear vs replay, stamina cost), story team resolution (canon/anchored/free, anchor-bypasses-ownership), scene-reader pacing (word splitting, capped stagger, delay monotonicity, tap contract, auto dwell, narration classification, portrait-side memory) and the music controller (role no-op, crossfade, autoplay gate, missing-file tolerance, volume/mute), boss mechanics/passives + phase transitions, leveling/ascension/stamina, substats, gacha (banners, pull, dupes, milestone, materials), playerStore actions + migration, news sorting/read-tracking, passive markup + readouts, card frame + reveal tiers, battle-log grouping + markdown export, per-character VFX registry invariants, kit-preview coverage/correctness, character-catalog registration, duel-mode move validation + state serialisation (kit visibility, hidden-information guard).

## Session log — 2026-08-21/22: mobile-first everywhere, six tools, and an app icon

One long session in five movements. Started with 21 uncommitted files from the
art-wiring work and ended with 93.

### 1. Art wiring finished (carried in from before the compact)

`components/game/ItemIcon.tsx` — one component turning a material/currency/coin
id into a picture, with the lucide glyph as fallback. Twelve surfaces draw icons
now. Story backdrops reached the brief, stage list, title card, versus splash,
wave break and result via a new `stageBackgroundId()` that derives a stage's
plate from its scenes rather than asking for a second authoring pass. Fixed
`ChapterList` computing its tint from `getStoryBackground(undefined)` under a
comment claiming it used the chapter's locale — the comment was right and the
call was not.

### 2. The mobile-first audit, and the sweep that followed

Audited all **84** `.tsx` files. **The roadmap's debt list was wrong in both
directions.** Gacha and archive were already close to phone-safe; the two real
problems were not on the list at all:

- `components/ui/button.tsx` had **five of nine sizes under 44px**, `default`
  worst at 36px — taken implicitly by 20 of 51 `<Button>` call sites. This is
  why per-screen fixes never held: `components/game/story/`, built mobile-first
  as ruling #107's own calibration set, still shipped two 36px buttons.
- **Every mechanic keyword in the game was a radix `Tooltip` on a bare
  `<span>`** — hover and focus only, and a span offers a phone neither. The
  entire glossary, the nav's resource labels and the progression panel's
  disabled-reason message did not exist on mobile.

Fixed in the primitives (**#119**) and via a new `components/ui/Hint.tsx`
(**#120**). Then the sweep: nav, hub, gacha, archive, orders, world boss, team
select, and battle's controls. Two hand-rolled range inputs at 4px and 6px moved
onto `Slider`. Safe-area handling added.

The widened `viewportUnits` test **found two static-`vh` shells the audit had
missed** — `PullReveal` and `UnitDetailPanel`, both `max-h-[92vh]`. Four modal
shells total had survived the 2026-08-19 sweep because its regex only matched
`100vh`.

### 3. The battle screen, rebuilt (#118)

He folded battle into the general pass rather than keeping it a separate
session, then answered four layout calls from an HTML mockup
(`docs/design/mockups/battle-mobile.html`, now a record rather than a question):

- **Controls into a bottom sheet.** The `w-14` rail was 14% of a 390px screen,
  permanently, out of thumb reach. Skip and Speed stay out; the rest sit behind
  Controls. `RailButton` became `ControlButton` in the same pass.
- **Hand cards floor at 56px** (`min-w-14`). They were `flex-1 min-w-0` inside
  an `overflow-x-auto` row, so eight cards divided 390px into 43px slivers and
  nothing ever overflowed, meaning the row never scrolled either. Centring had
  to change with it: plain `justify-center` makes the *first* card unreachable
  once content overflows.
- **Merge arms from the card's own button**, committing immediately when there
  is only one partner (nothing to choose) and asking when there are two — which
  matters, because a merge grants +1 ult gauge to the *eaten* card's owner.
- **The tile keeps focus-fire, loses the effect strip's tap.** The strip was a
  16px button nested inside the tile, which is itself a button to the same
  panel. Focus-fire moved onto the portrait at a real 44px.

**The event ticker was cut**, his call — *"if someone needs to know what
happened then they can just check the log."*

**And a gap he found that the audit had not:** the card preview was hover-only,
so **on a phone there was no way to read a skill in battle at all**.
Press-and-hold now opens it (`CardDetail`, shared with the desktop preview). He
then asked for a hold *ring* — built at 3000ms, flagged as confirmation-length,
cut to **1500ms** within the hour. One gesture, three endings, and the middle one
matters most: an **abandoned** hold does nothing, because falling through to
"play the card" would spend an action at the exact moment the player decided
against it.

### 4. Six tools, installed and wired (#121, #122)

He asked what tooling could help, then took all six findings.

| # | What | Where |
|---|---|---|
| 1 | Full `jsx-a11y` ruleset | `eslint.config.mjs`, `lib/a11y.ts`, `hooks/useEscapeKey.ts` |
| 2 | Balance simulator | `lib/game/simulate.ts`, `scripts/sim.ts`, `npm run sim` |
| 3 | Browser component tests | `vitest.config.ts` projects, `npm run test:browser` |
| 4 | SFX bus | `lib/audio/cues.ts`, `lib/audio/sfx.ts`, `hooks/useSfx.ts` |
| 5 | PWA | `app/manifest.ts`, `app/icon.png`, `public/sw.js` |
| 6 | Telemetry | `@vercel/analytics`, `@vercel/speed-insights`, `lib/sentry.ts` |

**Two of them found real bugs immediately, which is the whole argument for
them.** The a11y ruleset found **23 problems across 9 files** on first run — and
the three rules that caught most of them are exactly the ones
`eslint-config-next` leaves off (it ships 6 of ~35, all about malformed ARIA,
none about behaviour). Everything was fixed rather than suppressed; **zero
suppressions were added**, and three written defensively turned out unnecessary
and were deleted. Sharpest find: the story reader, chapter title card and versus
splash all carried `role="button"`, `tabIndex={0}` and an `aria-label` with **no
key handler** — focusable, announced as buttons, inert when pressed.

The **first browser test found a bug in code written that morning**: `Hint`
opened on focus *and* toggled on click, and a mouse focuses before it clicks, so
clicking a keyword opened the popover then closed it again. Whether it broke
depended on where the pointer had been. Nothing in the markup was wrong.

The simulator needed the passive queue, which lived inside a React context —
extracted to `lib/game/mechanicQueue.ts`, because a simulator that skipped
passives would report win rates for a game nobody plays. Side benefit:
`lib/game/passive.ts` was importing types *from a hook*, and that arrow now
points the right way.

### 5. The app icon

Drawn, not generated, and the reasoning is in `ART_PIPELINE.md` under "Logos and
marks". Animagine returns an **item sheet** for "emblem", "badge", "medallion"
and "crest" — eight images, every one a scatter of ~20 objects. Flux and all
five vector LoRAs turned out **unusable on this install**: the checkpoint is
UNet-only and there are no Flux text encoders or VAE.

Two things did fix Animagine and are worth reusing for any object render:
**`no humans` as a positive booru tag**, and **never a colour list** (a list of
five colours draws five separate objects). The resulting arch was good art and
still lost — an illustration dies at 48px.

So five candidates were drawn in `scripts/logo_candidates.py`, he picked the
coin, and it took two revisions that are only visible small: two concentric
rings moiréd at 48px, and the gate was originally cut *out* of a cyan face,
making the dark shape the figure so the whole mark read as a **padlock**.

### What was tried and abandoned

- **`@serwist/next` for the PWA.** It does not support Turbopack despite what
  its docs imply — it printed a warning and **silently produced no service
  worker**. Its configurator mode does, at the cost of three more dependencies
  and rewriting both `build` and `dev`; `build` is what Vercel runs on every
  push and `dev` is his server. Backed out entirely; `public/sw.js` is
  hand-written.
- **Hover-to-open on `Hint`.** Built, then removed the same day — see above.
  Cost: a small desktop regression, recorded in the component.
- **`settings.controlComponents` for jsx-a11y.** Did not apply; the rule needed
  it as an option, not a setting.
- **Three `eslint-disable` directives** on modal scrims. Unnecessary once the
  scrims carried `role="dialog"` and the inner `stopPropagation` was replaced by
  a target check — deleted rather than left as stale suppressions.
- **Two malformed tool calls** leaked the literal word "PARAMETER" into a
  ComfyUI prompt. Those images are in the output folder.

### What is deliberately unfinished

- **Sentry is inert** without `NEXT_PUBLIC_SENTRY_DSN`, and `withSentryConfig`
  is **not** applied, so stack traces stay minified until someone with the
  account adds an auth token. `tracesSampleRate` is 0 on purpose.
- **Both audio buses are silent.** `public/audio/` and `public/audio/sfx/` are
  empty; `docs/AUDIO.md` lists what to drop in. Which sounds these are is his.
- **The on-card Merge button stays under 44px**, opted out with `min-h-0` and a
  comment. It sits on a 56px card; sizing it would cover the name underneath.
- **Unit tiles did not get the hold ring.** On a card the hold competes with a
  tap that costs an action; on a tile, tapping already opens details.
- **The 11 npm advisories are pre-existing**, all transitive under the `shadcn`
  CLI, which never ships.

### Confidence and gaps

**Verified this session, by running it:** `npm run check` gives 105 files /
1,327 tests, 3 pre-existing `duel.test.ts` warnings, 0 errors.
`npm run test:browser` gives 2 files / 12 tests in real Chromium.
`NEXT_DIST_DIR=.next-verify next build` compiled successfully. `npm run sim`
produces a ladder.

**Assumed, not verified:** every visual claim. The 44px floor changes vertical
density on ~7 screens and nobody has looked at them. The controls sheet, the
56px cards, the reticle's placement over "Ult Ready", and whether 1.5s reads as
deliberate or broken are all unseen.

**Never exercised at all:** the service worker (disabled in dev by design, needs
a production origin), the PWA install prompt, Sentry, and every SFX cue.

**What I would check first coming back cold:** open `/practice` on a phone. The
battle screen changed more than anything else and is the only one whose layout
was rebuilt rather than adjusted.

### Operational note

**ComfyUI was started by this session** (the portable install on `E:`, port
8188) and left running. It is not started automatically.

## Session log - 2026-08-21: the road checkpoint, and 37 art assets

Landed as `afd66a4`.

**Verified at close:** `npm run check` green - **1,286 tests / 102 files**, the
same 3 pre-existing `no-unused-vars` warnings in `tests/duel.test.ts` and no
errors. `NEXT_DIST_DIR=.next-verify next build` compiled successfully;
`.next-verify` removed and `tsconfig.json` churn reverted.

### Art: 37 assets, and a map of what this checkpoint can compose

19 inventory icons (`public/items/`, 612KB) and 18 scene backgrounds
(`public/backgrounds/`, 1.8MB), all **WebP** - 18.4MB of PNG became 2.2MB at
lossy q90, with `alpha_quality=100` on the icons so cutout edges stay lossless at
the 24px they render down to. Registries: `lib/game/materialArt.ts` (new) and
`lib/game/storyBackgrounds.ts`.

The durable output is not the assets, it is `ART_PIPELINE.md`'s new section on
what Animagine will and will not compose. **It renders streets,
interiors-with-furniture, and landscapes-with-a-subject; it fails at aerial
cityscapes, empty courtyards, clearings, and rows of benches** - and no amount of
rewording fixes the second list. Re-framing does, first or second try: the city
became an avenue seen down its length, the exam compound became an avenue between
two halls. Three techniques were established and written up:

- **img2img from a sibling plate** for any before/after or same-place variant.
  `village_ruins` failed **five** txt2img attempts and landed first batch at
  denoise 0.84. The denoise ladder is in the doc and it is narrow.
- **Composite-and-blend** when the model renders a subject but will not place it
  in an environment (`bureau_exterior`, 8 attempts): generate the subject alone,
  `remove_background`, block the composition in with PIL, blend at 0.42-0.60.
- **Grade every plate down** before shipping, with a bottom-weighted vignette -
  Category A wants these darker than a character card, and the dialogue box sits
  in the lower third.

`jungle_clearing` took eight attempts and its own recipe (PIL-blocked ground,
img2img at 0.80 - below ~0.7 dense foliage shreds into stripe noise, above ~0.85
the composition goes).

**Three registry slugs were retired as non-canon** after reading all twelve beat
sheets: `gamblers_table` to `admin_room`, `the_bridge` to `lake_shore`,
`overseer_dining` to `common_space_night`. Each replacement carries a comment
naming what it replaced and why.

### The road checkpoint: four kits, four engine capabilities

`ford_bandit`, `checkpoint_bruiser`, `checkpoint_enforcer`, `toll_collector` -
his kit designs, my stats and derived ranks. Stage 1-5 rebuilt from three waves
of one recoloured mook into Ford Bandits, then three muscle, then Enforcer +
Collector + Bruiser - the game's first **three-enemy** waves. Chapter economy
still lands on exactly **70 gems**.

Four capabilities they needed, none of which existed:

- **`onDefeat` passive trigger** (`lib/game/onDefeat.ts`) - a dying unit pays its
  own team. Post-pass over both teams from `executeSkill` *and* the DoT tick,
  because a unit can die in more than one place; fires once, guarded by
  `passiveState`, since a corpse stays on the field until turn-start cleanup.
- **`conditionStatuses` on `targetTagBonus`** - "damage up against enemies
  affected by Bleed".
- **`conditionMinLivingAllies` on `aura`** - a team buff **rechecked at the
  owner's turn start and dropped when the condition fails**. Plain `aura` applies
  once at battle start and is never revisited, so the Collector's protection
  would never have fallen off; this follows `characterSynergy`'s existing dynamic
  pattern.
- **`useSkillRank` mission goal** - his ask. The action battle event already
  carried `rank`, so it was one union member, one case, one accumulator field.

### What he corrected me on

- **I rank-scaled a tier word, then hallucinated his spec while fixing it.** His
  draft read *"Raises DEF for 1 turn and does [350]% damage"* - only `[350]` is
  bracketed. I invented a ranked `[25, 40, 50]` DEF buff, which made the tier
  word wrong at both ends, then "fixed" it by deleting *his* word instead of *my*
  invention. **The brackets are the whole notation**; unbracketed means flat,
  tier words included. Banked in `kitcheck` and in session memory, with the step
  that would actually have prevented it: **re-read the draft, do not repair the
  JSON from memory.**
- **I costed the kits at R3, which the enemy can never play.**
  `initializeEnemyDeck` builds one R1 card per skill and the AI never merges, so
  a balance read off the top row is a read of a card that cannot be dealt. He
  also pointed out three enemies share three actions, not three each. Ruling
  #116.
- **Light and dark are premium.** The Collector was proposed as light to close a
  type-chart hole; rebuilt red. Ruling #115.
- **Bleed is 1 turn on this kit.** I had set 2, citing a test asserting
  roster-wide 2. The test was stricter than the rule it enforced -
  `dotDurations.ts` has always said "unless the kit says otherwise". Ruling #52
  amended: 2 is the **default**, not a mandate.

### Two bugs the guards caught before they shipped

- **`characterSchema.ts` kept its own copy of the passive-trigger list.** Adding
  `onDefeat` to the type left the schema unaware, and the catalog *silently
  drops* kits that fail validation - so all four vanished with no error at all.
  `PASSIVE_TRIGGERS` is now one exported const both sides derive from.
- **The bleed condition would never have fired.** A TS error revealed `bleed` is
  not a `StatusEffectType`; combat stores it as
  `{ type: "damageOverTime", name: "Bleed" }`. The matcher now checks name, type
  and stat, because which field a status lands in depends on the status.

### What was deferred, and to what

- **Ch1-3 props (11 assets)** - queued in the manifest, not started. Cheap and
  reliable; the icon batch went 14/14.
- **Chapters 4-12 art** - `admin_room` first by reach. The full 94-asset manifest
  is the artifact published 2026-08-20.
- **`public/characters` + `public/npc` are still 99MB of PNG.** The same WebP
  conversion would take them to roughly 12MB. Not done because they are already
  in git history and that is his call.
- **Icons render nowhere.** `getMaterialArt` has zero callers; every inventory
  surface still shows the text label, which is the designed fallback.

### Confidence and gaps

**Verified:** every count in this entry was read off disk at close, not recalled.
Suite and build output above are from the final run. Kit values were re-read from
the JSON and checked field by field against his original message.

**Assumed:** the four enemy statlines are mine - `storyOnly` bands are still
unassigned at `KIT_DESIGN.md:83`, so there is no spec to check them against. The
de-facto roadside band (HP 3000-3600 / ATK 245-285 / DEF 65-90) is an observation
from three existing kits, not a rule.

**Untested:** the checkpoint fight has never been played. Three-enemy waves are
new to the game, the `onDefeat` heal and the fading aura have unit tests but no
playtest, and `teamMode: "anchored"` on 1-5 changes who the player can field.

**What I would check first coming back cold:** whether stage 1-5 is winnable, and
whether the Collector's aura visibly drops when his escort dies.

## Session history — folded to the archive

Moved verbatim to [`docs/archive/STATUS-2026-08.md`](archive/STATUS-2026-08.md)
on 2026-08-20. Each line below is one section in that file.

- Session log — 2026-08-09: decisions, reversals and dead ends
- Session log — 2026-08-09 (part 2): duel play session
- Session log — 2026-08-11: UI/UX overhaul, screen by screen
- Session log — 2026-08-11 (part 2): progression, format, one picker, account rank
- Session log — 2026-08-11/12 (part 3): battle playback, six screens, gacha economy, the whole story
- Session log — 2026-08-12 (part 4): first real playtest
- Session log — 2026-08-12 (part 5): the hand moves
- Session log — 2026-08-13: the first ten minutes
- Test suite audit — 2026-08-13
- Palette sweep and Google-only sign-in — 2026-08-13
- Playtest findings — 2026-08-13
- Screens and rules from the 2026-08-13 playtest
- Battle reports are written for a machine — 2026-08-13
- Where things stand — 2026-08-13 (Tanveer's own words)
- Playtest — 2026-08-13 evening: five runs against Molvarr
- Session log — 2026-08-13 (auto session): Open Issues #24–27, and what was under them
- Session log — 2026-08-13 (part 2): shadcn built, four features, two bugs, the economy audited
- Session log — 2026-08-20: skills, an engine bug family, and six Dokkan kits

## Open Issues

| # | Issue | Where | Severity |
|---|---|---|---|
| 6 | ~~Ultimates have no rank while skills rank up~~ — **shipped 2026-08-14.** Ultimates now carry a six-value `damageByUltLevel` ladder indexed by ult level, bought with character coins | `types/ultimateCard.ts` | Closed |
| 13 | Art nitpicks: Seras's horn-like hair tufts didn't render; Yalina's side braid renders as loose side curls (trigger-word/style limits — see ART_PIPELINE trigger-word table) | `public/characters/` | Cosmetic (re-roll) |
| 14 | Design feedback 2026-07-11: Mustafa approved; Siddiq redesigned (v2, still AI-invented — awaiting his sheet); Batra reworked per his direction (turban/beard/kesari, no armour). He loves Lyra/Sara/Gabrist; Duke/Yalina/Seras fine for now, iterate later | `docs/ART_PIPELINE.md` | Pending input |
| 20 | Battle screen overhaul: cinematics shipped 2026-07-12; the 2026-08-04 UX batches did the layout, enemy inspection, info panel, structured log and per-character VFX. **Remaining: mobile pass + sound hooks only** | `components/game/*` | Mostly done |
| 21 | Enemy AI: skill-selection priority rewritten 2026-07-13 (team-wide tiers + per-turn caps). Target-choice heuristics (currently lowest-HP/taunt) may still want tuning per playtest | `lib/game/ai.ts` | Mostly done |
| 23 | Stamina is effectively unlimited below ~account rank 13: a boss clear pays 100 XP, nearly every early clear ranks up, and a rank-up refills the bar to 120 (three runs). Raised 2026-08-12 with three fixes; Tanveer declined all three — **accepted, not a bug** | `store/playerStore.ts:463`, `lib/game/worldBossRewards.ts` | Design note (accepted) |
| 22 | Battle log can't show **which buffs/debuffs an action applied** — `battleEvents` doesn't model effect application, so the raw string log remains the only record. Needs an `emit` change in `combat.ts` | `lib/game/combat.ts`, `types/battleEvent.ts` | Open |
| 24 | ~~String log double-prints actions~~ **FIXED 2026-08-13 (ruling #76)** — the resolution guard was a per-instance React ref on a provider built to survive remounts, so two loops resolved one queue. Claim moved into the store, keyed by turn. **Not reproduced live**; `dedupeConsecutive` kept as a regression detector whose anomaly must now read zero | `hooks/BattleProvider.tsx`, `store/gameStore.ts` | Fixed, unverified in play |
| 25 | ~~A nulled hit must read "Tanked"~~ **BUILT 2026-08-13 (rulings #71, #75)** — gate is clause position relative to the damage step. Scoped to DoTs + `lowerUltGauge`; **stun/freeze deferred by Tanveer** and pinned by a test | `lib/game/combat.ts`, `types/battleEvent.ts` | Done (partial scope, by instruction) |
| 26 | ~~`gained 5% undefined`~~ **FIXED 2026-08-13 — and it was not cosmetic.** The synergy buff never carried `mech.stats`, so six kits' tribe synergies granted **nothing**. This table previously said "the buff itself works"; it did not. Balance knock-on awaiting Tanveer | `lib/game/passive.ts`, `lib/game/stats.ts` | Fixed, his call to keep |
| 27 | ~~Hand animations want a performance pass~~ **FIXED 2026-08-13** — it was a correctness bug, not cost: hit-testing ran against the live DOM the drag preview was reordering, so the row fed its own input. Frozen boxes now. **Feel is unjudged** — needs a playtest | `components/game/battle/Hand.tsx` | Fixed, feel unverified |

Closed: #17 ("Permanently" = cancel-proof, ruling #37), #19 (damage-modifier stats wired, ruling #36), #16 (zero clauses hidden, ruling #44), #15 (firestore.rules deployed live via Firebase MCP 2026-07-11 — cloud saves work for signed-in users; minimal `firebase.json` added), #7 (Mechanic discriminated union — see Working).

## Not Built Yet

- **Story chapters 2–12** — the twelve webtoon chapters were all adapted under the v1 Part structure and that data was **deleted** on 2026-08-18 with the rebuild. Only **chapter 1** exists in v2 (`data/story/chapter-1.json`); the rest are re-authored one chapter at a time through the FillerAssist pass, against the source beat sheets in `E:\Toll - Web toon`. `UPCOMING_PARTS` is gone — `SOURCE_CHAPTERS_WRITTEN` in `storyCatalog.ts` records that twelve source chapters exist without naming any of them.
- Story **Phase 3** — the bracket chapter 12 ends on. Not written in the source yet.
- ~10 additional characters (Tanveer adds when game is in working order)
- **Mobile layout pass** — still the biggest remaining gap in roadmap item 2, but narrowed on 2026-08-20: all 15 `min-h-screen` uses are now `min-h-dvh` and `tests/viewportUnits.test.ts` prevents new ones. Battle, gacha, archive and the hub still need their per-screen passes (the `mobilecheck` skill runs one screen at a time)
- **Audio assets** — the music *system* shipped 2026-08-09; `public/audio/` is empty until Tanveer supplies the OST (`docs/AUDIO.md`). No SFX system exists and none is planned.
- ~~FTUE / onboarding~~ **built 2026-08-13** (Bureau Orders + four battle coach marks). Daily loop and analytics remain — the orders evaluator was built general so daily missions are mostly a data change (see `docs/PRODUCT_AUDIT.md`)
- ~~Deployment~~ — **already live at https://toll-the-game.vercel.app/**, and has been. The Vercel project is linked and every push to `master` auto-builds. These docs said "not started" and I repeated it to Tanveer on 2026-08-13; he corrected it. **A push is a deploy — treat `master` as production.**
- Effect application in the battle-event stream (Open Issue #22)
- ~~Story chapter **mission objectives**, the **node-path stage map**, **multi-wave stages with persistent HP**~~ — **all three shipped 2026-08-18** in story mode v2, in a different shape than this line imagined: missions are per *stage* (up to 3, seven goal types) rather than three per chapter, the node board was built on 2026-08-17 and then deliberately deleted (ruling #108), and multi-wave persistent HP is the wave loop. Story **difficulty tiers** remain unbuilt and unwanted — story is authored difficulty at base 1x (ruling #87)

Note: "playerStore is a stub" is no longer true — it carries roster, currencies, inventory, per-character progress, stamina, gacha pity, lifetime stats, claimed orders, Auto Clear Tickets and per-difficulty clear records, with migrations at **v9** (`CURRENT_PLAYER_STATE_VERSION`, verified 2026-08-18). *(This line read "v7" until 2026-08-13 and "v8" until 2026-08-18; v8 shipped with Auto Clear in `018e9d0` and v9 with ult levels in `54ef93b`, and the note lagged both times. `storyStore` is separately at **v3** since the story rebuild.)*

## Environment

- Node 24, Next.js 16.2.10, React 19.2.7. Majors deliberately held: TypeScript 5.9 (not 6), ESLint 9 (not 10) — Next 16 support unconfirmed.
- Known `npm audit` leftover: postcss <8.5.10 nested inside `next` — upstream.
- Firebase env in `.env.local` (gitignored); pullable via Firebase MCP from project `toll-the-game`. App runs guest-mode without it.
- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` for art generation.
