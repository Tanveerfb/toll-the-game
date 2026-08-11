# Status — 2026-08-09

Living snapshot. History of the resurrection audit is in git (`docs/STATUS.md` @ `c3040f7`).

## Working (implemented, tested, browser-verified)

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
- **Battle QoL** — 1×/2× speed toggle (scales phase auto-advance + enemy resolve delays), battle-log filter (Actions only / All events incl. DoT ticks + passive procs), hover tooltips on unit ▲/▼ effect counters.
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
- **Battle HUD redesign (STATUS #20, first pass — Tanveer's picks 2026-07-12)** — single-viewport layout, no page scroll: slim status strip (turn/phase/progress/speed/log), enemy row + player row of portrait-first unit tiles (art fills tile; overlaid HP bar, 5-segment ULT pips, ▲/▼/◆ counters with tooltip, Sub/Target/×N badges, DOWN stamp), event ticker above an always-visible deck dock (collapse toggle removed), queue rendered as compact chips beside Reset Hand, full log in a slide-over drawer (Actions only / All events filter). TopNav pinned to h-11 so the battle shell sizes to `100dvh - 2.875rem`; BattleArena root must NOT set a z-index (it would trap the fixed drawer/modals under the sticky TopNav's z-50).
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

## Session log — 2026-08-09: decisions, reversals and dead ends

Recorded because a future session cannot infer *why we didn't do X* from silence.
Everything here was decided live with Tanveer; don't re-litigate or re-attempt.

### Rejected outright

- **Duke's S2 replacement.** Four options were proposed — weakpoint (×3 vs a
  debuffed target), ult-gauge drain, cancel-buffs, rupture. Tanveer rejected all
  four: *"weak point would be too powerful and others are not good enough."* He
  specified the replacement himself (self-buff then strike), which became
  **Surge**. Don't re-pitch those four.
- **SFX of any kind.** Audio is music only, supplied by him. No battle sounds,
  no UI clicks, no text blips (ruling #51).
- **Story environment backgrounds.** Deferred by his call — they are the biggest
  lever on "scenes look cheap" but the art direction isn't settled. No generated
  plates, no blurred-character fallback, no stylised backdrops (ruling #50).
- **Navigation depth.** Offered as one of four candidate story-UX problems; he
  explicitly dismissed it. Part → chapter → brief stays.

### Reversed mid-session (the second answer is current)

- **Text reveal:** character-by-character typewriter → **per-word over final
  layout**. Not a speed problem — slicing the string reflows the paragraph and
  leaves the eye on half-words. No ms/char value fixes it.
- **"Flowing Ruin is overtuned"** → **retracted**. Drawn from a 1v1 duel, where
  Duke's cards are ~100% of the hand; in 4v4 they're ~25% and his empowerment
  fires 4× less often. He is a 1v1 specialist, mid-pack in a team. No nerf.
- **Substat modifiers:** multiplicative → **additive percentage points**. This
  reverses a "2026-07-24 ruling" recorded in `substats.ts` and locked by a test;
  Tanveer's read is that it predates the substat system existing.
- **Synergy targeting:** `stat: "all"` → **basic stats**, except Seras and Batra.
  Applied after "all" was made to reach substats, which would otherwise have
  handed every synergy a large hidden substat buff.
- **Duke's Surge multipliers:** 400% R3 → **335%**. At 400 an empowered R3 hit
  2276, beating his own bare ultimate (2175) and breaking ruling #2.

### Tuned by iteration (final values only — intermediate ones are not meaningful)

- **Lyra (`lyra_npc`)**: target went 8 turns → **~4 turns**; ATK 250 → 50 → 140;
  HP 3300 → 4800 → 7000 → **8000**; multipliers cut then restored to the midpoint
  between mob and playable. Final fight: Duke wins turn 4 on 215/1500.
- **Part 1 mobs**: ~3× health, ATK untouched — longer fights, not deadlier ones.

### Deviations from what was originally specced

- The duel spec's `state.md` was specified without opponent kits or scheduled
  behaviour. Tanveer asked for full kit visibility ("you should have kits of your
  own characters in mind too"), so it now carries both sides' kits, the active
  phase for a boss, and when forced SP / stat spikes fire.
- Story rewards: a first clear grants the one-time bundle **and** a drop roll.
  Flagged as an assumption at the time; never overruled, so it stands.

### Unverified / assumed

- **Duel mode has only been played twice, both 1v1 practice-shaped story
  fights.** Never exercised in 3v1, 3v3 or 4v4, never against a phased boss, and
  the forced-SP interaction with a Claude-controlled turn is untested live.
- **Isolde's lifesteal aura fix has not been playtested** — proven by unit test
  only. Same for the max-HP unwind on expiry and HP-shrinking debuffs (no kit
  authors one yet).
- **Lyra's second-fight variant (`lyra_npc_2`) has not been played.**
- Everything since 2026-08-09's presentation batch is verified by types, lint,
  tests and a clean build — **not** by browser. Tanveer does the visual pass now.

## Session log — 2026-08-09 (part 2): duel play session

Four duel games plus a boss stat-test run. Everything below is **uncommitted**
in the working tree at checkpoint time — 732 tests, lint and a clean build.

### Shipped

- **Symmetric action economy** — new `lib/game/actionEconomy.ts` owns
  `actionsForTurn(team)`: living field members +1, capped at 3, elite tier
  always 3. The player was pinned at a flat **3** in four places
  (`store/gameStore.ts` ×3 guards, `components/game/Deck.tsx` auto-execute,
  empty-slot rendering and queue-full state) while the enemy already scaled.
  Tanveer confirmed the flat 3 was a testing shortcut, not design.
  `enemyActionsForTurn` is now a thin alias. Ruling **#59** in HANDOFF; the
  engine-rules bullet in `AGENTS.md` was rewritten (it still said "Enemy side
  takes 3 actions per enemy turn").
  **Verified live**: solo Molvarr correctly got 3 (elite), a 1-unit non-elite
  side got 2.
- **Starbound Ward is buff-only** — `combat.ts` hardcoded *every*
  `skill.type === "ultimate"` as `isAttack`, so Isolde's support ultimate ran
  an attack pass first; `damage.ts` floors damage at 1, so it chipped **1 HP
  off each ally it buffed**. `isHealOrBuff` already classified it correctly —
  `isAttack` ignored that. New `isSupportUltimate` gate requires
  `hasFriendlyAllyMechanic && skillDamagePercent <= 0`, so a future
  buff-and-damage ultimate still attacks (Chiara's All In self-buffs then hits
  — verified by test). `descriptionTranslator.ts` said "to all enemies" for any
  `aoe`; now says "to all allies" for zero-damage support skills.
  **An existing test asserted the buggy 1298 value and documented the chip as
  expected** — rewritten to 1300, plus 3 regression tests.
- **Corrosion respects Debuff Immunity** — `applyCorrosion` in
  `bossPassives.ts` never checked `debuffImmune`. Boss passives apply debuffs
  outside the skill path, so they bypassed `combat.ts`'s gate entirely and
  corroded warded units. Fixed + test.
- **Duel rejections are visible** — a rejected move now writes
  `.duel/rejected.md` (cleared when the next state posts). Previously the only
  record was `duel-log.md`, which is how a whole turn got silently handed to
  the scripted AI mid-game without me noticing.
- **eslint ignores `.next-*/**`** — `npm run check` was reporting 12,182
  problems from `.next-verify` build output. Source was always clean.

- **Passive-rolled debuffs are cancellable** — `registerRandomTurnEffect` in
  `passive.ts` stamped `uncancellable: true` on the *debuff* branch too.
  Tanveer: "it shouldn't carry uncancellable, even from passive proc — it
  should be a cancellable debuff and therefore tackled by debuff immunity."
  Flag dropped, and the branch now skips Debuff-Immune targets. Ally buffs from
  the same helper stay uncancellable. Chiara's Cut the Deck ATK-down option
  also went **1 → 2 turns** (kit JSON + its hardcoded passive description
  string; the translator does not generate passive text).

### Deliberately NOT done

- **Stun on a side's last living unit denies the whole turn.** Surfaced in game
  1 (Tanveer: "you won because i couldn't play any cards"). Options were
  offered; he did not pick one. Still open, still intended-by-default.

### Balance observations from play (data, not decisions — Tanveer owns these)

- **Duke's Flowing Ruin 3-stack payoff on Slide** decided game 3 outright. The
  bonus reads as a single-target reward, but Slide is AoE, so it lands +100%
  damage **and** the −50% ATK on all four targets in one action, with lifesteal
  on every hit (~500 self-heal). The opposing team spent the rest of the fight
  at half attack.
- **Chiara's House Rules shuts off Molvarr phase 1 entirely** — Corrosive Surge
  is his only debuff applicator, Growing Malice reads debuff count for ATK, and
  phase 2's Corrosive Tide keys off Corrosion. One Attack-Debuff seal disables
  all three; he sat at 120 ATK. Phase 2 is immune to this because Corrosive
  Tide is a passive, not a skill.
- **Yalina's Attention Drawer is anti-synergy vs Rupture kits** — its damage
  reduction registers as a *buff*, so Diane's Rupture doubled on the taunter
  (731 vs ~500 on everyone else). Taunt also only redirects single-target, so
  it did nothing against an all-AoE comp.

### Engine facts confirmed by logs (previously assumed wrong)

- **Stance-cancel resolves before the attack lands.** Killua's Lightning Palm
  into a Full Counter Meliodas took **zero** counter damage. Attacking a
  counter-stance unit with a cancel skill is free.
- Rupture checks for `[buff]` entries specifically — synergy/aura `[effect]`
  entries do not trigger it.
- Detonate scales off banked ult gauge (~+20%/point; ~+100% at 5).

### Duel mode coverage

Series went **2–1 to Tanveer** (game 1 Claude, games 2–3 Tanveer; a 4th
"winner takes all" match became a boss stat-test and then died to hot reload).
Now exercised: three 4v4s, a **3v1 vs a phased boss**, forced-SP auto-fire
(Ancient Rhythm took the last action as designed), phase-break transition
(Molvarr phase 1 → phase 2 with a fresh 4000 HP bar), healer/support comps,
stance-counter kits, HP-scaling units, and the elite action-count branch.

**Still untested:** duel mode against a boss with a *forced SP that Claude
tries to override* (the branch exists, only the cooperative path ran).

### Gotchas worth keeping

- **Editing engine files mid-duel kills the battle** — hot reload dropped a
  live fight. Finish the game or accept the restart.
- `.duel/state.md` is **not** deleted when a move is consumed, so a watcher
  polling "state exists && move gone" fires on stale state. Poll on **mtime
  change**, and read the action-budget line **every turn** — assuming a carried
  -over budget got a 3-action move rejected wholesale (only 2 were legal),
  which handed the turn to the AI and lost game 2.

### Kit audit + future-character Q&A (2026-08-10)

Chat-only session (Tanveer had no UI access). Two parts, **no code changed**:

**Roster audit — clean.** Scripted sweep of all 28 kits incl. boss phases and SP
skills found: no `uncancellable` hostile mechanics remaining, no heal-type skill
carrying damage, no zero-value or duration-less buff/debuff entries beyond the
intended ones (Gon/Killua's permanent ATK buffs). Tier words are roster-wide
consistent: **plain "raises/lowers" = 30, "greatly" = 50**, zero violations.
Chiara's Marked Card `[30,50,50]` was the one flag and turned out to be correct
design — ruling #58 was too narrow and now carries the carve-out (a ladder may
step *between* tier words; what's forbidden is a ladder *inside* one).
`"massively"` = **100% raising, 80% lowering** (ruling #56; asymmetric because a
stat can never be reduced to zero). Corrected 2026-08-10 — this section
previously claimed it had no value assigned, contradicting #56 and `tierWord`.
`"slightly"` was **my** invention, not Tanveer's vocabulary; it appears nowhere
in kits or rulings.

**Knuckle Bine + Isaac Netero** (`author_notes.md`, HxH collab, not finalized) —
13 behaviour questions answered and written into `author_notes.md` under
"Confirmed behaviour — answers from Tanveer, 2026-08-10". Highlights that will
bite whoever implements them:

- **[APR] is ONE uncancellable effect** bundling counter + 20% basic-stat-down +
  taunt. Deliberate exception to ruling #60 — **#60 still needs this carve-out
  written in.**
- IRS one-shots **one boss phase**, never a whole boss; a phase shift clears
  [APR] and Knuckle restarts.
- Netero **draws unplayable, greyed-out cards** during [Suppressed] — clogging
  the shared hand for 3 turns is the intended cost, not an oversight.
- Netero's `type-neutral` is **defensive only** (neutralises an enemy's type
  advantage against him). This **contradicts the existing Design Glossary entry**
  in `docs/ARCHITECTURE.md`, which defines it bidirectionally — needs a separate
  variant. **Undecided.**
- Modelling correction worth keeping: I judged APR "too fast" off R3 values.
  Priced at R1 (roster convention R1 ≈ 65% of R3) it's 3 turns vs a 1210 body,
  7 vs a 4000 boss — the intended slow burn. **Price new mechanics at R1.**

**Rank ladders for both characters are my DRAFT, unapproved** (table in
`author_notes.md`). Knuckle S1 at 390% R1 would be the roster's highest R1
single-target — the number to cut first if he tests strong.

### Kit-design teaching session (2026-08-10, in progress)

Tanveer is teaching his kit-design method so Claude can draft **collab and
pop-culture-inspired units**; he keeps designing the **OG roster** himself.
Captured in **`docs/design/KIT_DESIGN.md`** (new) — read that, not this summary.

Rules established that weren't written down anywhere before:

- **Three roles: DPS / support / defense.** Role comes from **kit identity**;
  the scaling stat is irrelevant to it. Never read role off the numbers. All 18
  playable characters are assigned (10 DPS / 4 defense / 4 support); `storyOnly`
  enemies unassigned.
- Stat bands are a **tendency**, not a rule. **The band figures quoted in this
  section were pre-rebalance and are now wrong** — the roster stat rebalance
  later the same day (ruling #68) moved every statline. **Current bands live in
  `docs/design/KIT_DESIGN.md`**, re-read from JSON after the change.
- **Lore anchors** were later downgraded: Tanveer, 2026-08-10 — "no need to
  factor lore numbers in the kit". They're a flourish he applies himself
  (Netero's 287 ATK = 287th Hunter Exam), never a requirement, and not something
  to ask him for.
- **1–2 new mechanics per batch of 2–3 characters**, given to at least one of
  them. Knuckle+Netero are currently **over budget at four**.
- **Standard/Premium collab designation is discontinued** — ignore it.
- **Price a mechanic's pacing at R1, not R3** (R1 ≈ 65%, R2 ≈ 80% of R3). I
  called APR "too fast" off R3 and was wrong; at R1 it's the intended slow burn.
- **An after-effect does not proc on a target the hit killed** — stated twice
  independently (Netero's follow-up, and a "damage then Freeze" ultimate).

**Practice runs — not going into the game.** A 7DS **Jericho** draft was done as
an exercise and deliberately NOT written into `author_notes.md`. Tanveer's
verdict: "good try", with one correction — her ultimate should hit **one** target
then Freeze it, rather than my AoE-damage-plus-single-freeze. **[Freeze] is
already on his future-mechanics list**, so don't invent a competing keyword.

A second practice kit, 7DS **Estarossa**, scored **9/10** — the highest-value
feedback being how the score works: *the last point is a bonus reserved for
beating his own vision, not a deduction.* 9/10 is a clean pass; don't chase the
tenth point by adding complexity. Its new mechanic **[Hellblaze]** (target
cannot be healed) he identified as **Infect from 7DS Grand Cross** — proven, not
exotic. Estarossa is **not official**; nothing from it was written to the repo.

**He names the character. Every time.** I picked King (7DS) for the third
practice kit and started drafting; he stopped it: *"don't go on your own. i will
give you characters."* He works from a roster plan and stays inside the anime he
knows (7DS, HxH). **One practice kit is still owed**, waiting on his pick.

### Description audit — every skill and passive (2026-08-10)

Tanveer asked for a full audit of skill/passive description text. All 30 kits
rendered at R1/R2/R3 (231 lines) and diffed rather than eyeballed in JSON.

**Wording rules he settled** (ruling #62–#65 in `docs/HANDOFF.md`):

- **No "each" on an AoE after-effect.** An effect written after the attack
  already applies to everyone hit: "depletes 3 ultimate gauges", never "from
  each".
- **Author with semicolons; the game prints prose.** `dropZeroValueClauses`
  hides on semicolon segments (ruling #28), so the separator must survive into
  the JSON — but `joinClausesAsProse` now renders survivors as "A and B" /
  "A, B and C". Writing "and" into the JSON merges the clauses and deletes the
  damage text at a rank where the effect is 0 (Isolde's Severed Ledger R1 —
  I broke exactly this and he caught it).
- **Effects sharing a duration share a clause**: "seals Debuff and Attack Debuff
  skills for 2 turns". Keyed on the *resolved* duration, so Chiara's R2 (where
  only one category is sealed) stays unmerged.
- **Never restate a target the prose already names.** Ally-facing skills name
  their target in prose, so they need a looser guard than the "to all X" shape.
- **Tier words are NOT mandatory** — explicit percentages are equally legal and
  are correct when 30/50 are the wrong size. Leorio's 20/30/50 stands. I had
  been applying tier words as the only legal form; corrected.
- **Never name an unimplemented mechanic.** Frost's Glacial Bind said "Freezes"
  while running `stun`.
- Attack seal reads "**attack seals for N turns**". Lifesteal and Extort are
  mechanics, so "**lifesteals** / **extorts** X% of damage dealt".

**Bugs found and fixed** (12 kit JSONs + the translator):

- Durations that existed in data but were invisible to the player: Ban's Snatch,
  Road Bandit's Sand Throw, Wild Beast's Rending Claws.
- Prism's Blessing Light rendered "…cleanses their debuffs **to all enemies**" —
  a heal skill stores its heal amount in `damageRanked`, which the target
  inference read as hostile. Now `skill.type === "heal"` is never "damage".
- Yalina's Attention Drawer appended "to all enemies" onto text that already
  said "taunts all enemies" — the guard only matched the literal "to all X".
- "Applies 3 Ignite for 2 turns **stacks**" (Batra, Master Tao) — duration was
  injected mid-phrase.
- Singular/plural: "Stance lasts 2 **turn**", "1 ultimate **gauge(s)**",
  "3 ultimate **gauge**". The singular-fixer assumed the count touched the noun;
  it now allows up to two words in between.
- **Duke's Flowing Ruin said "(Only once)" — the text was wrong, not the code.**
  `combat.ts` already re-applies the ATK-down on every enhanced attack, which is
  the intended behaviour. Removed the marker rather than "fixing" the engine.
- Isolde's Woven Blessing repeated "(Uncancellable)" that the UI already shows as
  a badge above the text.
- Ban's Fox Hunt had `50%` / `2 turns` hardcoded in prose; parameterised to
  `[extort.value]` / `[extort.duration]` so it can't drift from the data.

**Not a bug, corrected by him:** Ban's Snatch and Fox Hunt word Extort
differently *because they are different cards* — Snatch is a zero-damage debuff
skill, Fox Hunt damages first then extorts. I proposed unifying them; wrong.

### Roster stat rebalance (2026-08-10) — ruling #68

Benchmarked our statlines against 7DSGC numbers Tanveer supplied. Theirs cluster
at **HP ≈ 12.2 × ATK, DEF ≈ 0.63 × ATK**; ours were **7.1 / 0.39**. Time-to-kill
was **2.1 hits**, so with three actions a turn a focused unit died before acting
— the reason taunts, DR, heals and cleanses so rarely paid for their card.

**Applied**: HP into the 3–4k band (roughly doubled), DEF ×1.6, **ATK left
alone** because every skill multiplier is tuned to it. Measured through
`executeSkill` afterwards: **4.3 hits** (Meliodas R3 → Chiara 700 damage into
3000 HP). Slightly past the 3.8 target because DEF rose too and subtracts flat —
if playtest says slow, shave DEF ~15% rather than touching HP.

Decisions worth keeping:

- **Role templates, not per-character ratio maths.** Deriving HP from ATK gave
  Mustafa (65 ATK) a 910 HP "tank" — nonsense. Bands instead: DPS ~2900–3600 HP,
  support ~3000–3200, defense ~3600–4000 with the top DEF.
- **HP scalers get a real but below-average ATK** (Sara 190, Yalina 110, from 34
  and 30). 7DSGC's HP scalers have ordinary statlines — the scaling stat decides
  what the *skill reads from*, not whether the character has stats. Side benefit:
  ATK-down and Extort finally bite on them.
- **Inflating a stat silently buffs whatever scales off it**, so the companion
  deflation was mandatory: Sara %HP 23/28/35 → 14/17/21 (ult 40 → 24), Yalina
  20/25/30 → 9/12/14 (40 → 18), Mustafa's DEF-scaled 325/400/500 → 165/200/250
  (450 → 225). ATK-scaled *heals* went the other way against doubled bars:
  Siddiq 260/320/400 → 440/540/680, Prism 90/120/170 → 150/200/290. Isolde needed
  nothing (her heal is %HP and self-corrects), same for Molvarr's %max-HP
  Corrosion. **Verified**: Sara now deals 83% of Meliodas' damage, against 84%
  before — relative position preserved.
- **DEF is flat subtraction** (`damage.ts`), so matching 7DSGC's DEF/ATK ratio is
  mostly cosmetic for us — even doubled DEF removes ~18% of a 350% skill. HP is
  the ratio that decides how the game feels.
- Enemies scaled to hold encounter difficulty: trash HP ×1.5 / ATK ×1.9 / DEF
  ×1.6 (stays trash, still threatens doubled bars), Lyra duel NPCs 14500/265/185,
  Molvarr P1 5400/285/175 and P2 7200/400/230.

**Untested:** Molvarr's pacing. Phases are ~1.8x longer now and his turn-10 stat
spike and max-HP drain were tuned against a shorter fight. Needs a world-boss
playtest, not more arithmetic.

### DBZ kit brainstorm (2026-08-10)

Four kits drafted with Tanveer and filed in `author_notes.md` under a **PARKED —
not queued for implementation** header. They are brainstorming output; Knuckle
and Netero above them remain the only planned future characters.

Base Goku (glass-cannon DPS, spends own HP), Vegeta (defense/sub-DPS, ramps from
being hit, scored 8/10), Super Saiyan Goku (duelist, ally-death and solo-enemy
clauses, proposes `[Desperation]`), Final Form Freeza Full Power (executioner
whose DR/ATK/DEF start at +50% and decay 10% a turn to a 20% floor — the decay
*is* the 100% form burning out).

Design rules this produced, all now in `docs/design/KIT_DESIGN.md`:

- **Buffs multiply** (`stats.ts`), so magnitudes stay small: self-buff ladder
  **25/50/75%**, team-wide **20/30/50%** (Leorio). Self-R2 should equal the
  team ceiling and self-R3 clear it — 60% sat too close to 50 to read as a
  different class of effect. A source-material "x3" is flavour on the name, not
  the number (ruling #66).
- **One scaling stat per kit**, heals included (ruling #67). Roster check found
  **Isolde genuinely violates it** — heal `hp`, damage/ult `atk`. Siddiq heals
  off ATK, so ATK is the established form; direction of the fix is Tanveer's
  call and her numbers move either way. **Still open.** Yalina and Iron only
  declare a second stat on zero-damage skills, where it's inert — cosmetic.
- **Skill ranks never exceed 3.** Escalation past that belongs in the ultimate.
- **No lore-number hunting** for statlines — anchors are a flourish he applies
  himself, never a requirement.
- **"Massively" = 100% raising / 80% lowering** and always has (ruling #56).
  Three documents wrongly said it was reserved with no value; corrected.

Process note: Tanveer's feedback that kit talk is *creative*, not a spec queue —
"sometimes you take things too literally… try to enjoy the culture like me."
Saying an ult is cool because it beat Frieza is not a request to add [Pierce].

### Stage effects (2026-08-10) — rulings #69/#70

Encounter difficulty now lives on the **stage**, not in character kits.
Authored per chapter in `data/story/*.json`:

```json
"stageEffects": [
  { "type": "statBoost",    "target": "enemy",  "stat": "all", "valuePercent": 5 },
  { "type": "bonusActions", "target": "player", "value": 1 }
]
```

- `target` is `player` / `enemy` / `both`. **Absent or empty = a standard
  fight**, the default everywhere; Tanveer names which fights get effects.
- `bonusActions` **respects the hard cap of 3** — it lifts a side that is under
  the cap (a lone unit at 2), never raises the ceiling.
- `statBoost` is **baked into base stats at battle start**, not applied as a
  buff, so `cancelBuffs` can't strip the arena and Rupture doesn't count it as
  a buff to punish. `stageAdjustedStats` in `lib/game/stageEffects.ts` does it,
  extracted from the provider so it is unit-testable.
- The fight brief renders **three sections — enemy / both / player** in the
  roster's arrow idiom ("All stats 5% 👆 during battle").

**Why it exists.** Playtesting Part 2 Chapter 2, Tanveer hit a fight he could
not win: a canon *solo* team gets `1 + 1 = 2` actions while the boss's
`tier: "elite"` grants a flat 3 — a permanent 50% action deficit, every turn.
His idea was to fix it at the stage level so future encounters can be tuned
without touching kits.

**`lyra_npc_2` is deleted.** It was a byte-identical copy of `lyra_npc` whose
only difference was a passive granting "All stats 5% up" — now a stage effect.
That duplicate had already drifted: it was never registered in `characterArt`,
so the 2-2 boss rendered with **no art at all**, which is the bug that started
this. Removed from the catalog, the VFX registry and its obsolete tests.
`tests/characterArt.test.ts` now walks every kit and asserts it resolves to an
art file that exists on disk, so the next unregistered kit fails in
`npm run check` instead of in a playtest.

**Boss balance, verified in play.** NPC Lyra is **3x the playable version's HP**
(10800 vs 3600) by Tanveer's rule, 11340 after her 5%. Duke wins on **turn 4
with 428/3150 HP (13.6%)** — he deals ~2,960/turn to her ~1,490 by turn 3, and
she would kill him on turn 5. The variance is deliberate and lives in *which
card Duke's 3rd Flowing Ruin stack lands on*: the +100% proc contributed 4,332
across two casts, 38% of her bar. **Losing a few times is the intent** — "good
way to learn the battle system too" — and uncleared chapters cost no stamina,
so a loss costs only time. Do not nerf it.

**Not done:** the enemy HP over-scaling from ruling #68 is still live for
everything except NPC Lyra (Molvarr, trash mobs). Molvarr's pacing remains
untested.

## Session log — 2026-08-11: UI/UX overhaul, screen by screen

Tanveer's brief was "one screen at a time" plus "the project color tokens are
also up for a change". Five screens landed: archive index, archive detail,
news feed + post, story index, chapter brief, story flow beats. Battle is
explicitly **deferred to its own session** — he wants "to optimize the battle
UI more if possible", not a rewrite, and it needs scoping first.

Every direction was chosen by him from a mockup before any code was written.
The mockups are published artifacts (links in the batch's chat); they are not
in the repo, so this section is the durable record of what was decided.

### The palette: "Combat Terminal" (globals.css `@theme`)

Direction B of three, picked 2026-08-11. The archive was the pilot; every
later screen inherited it.

Why it exists at all: `styles/globals.css` carried stock shadcn greyscale
(`oklch(0.145 0 0)` …) that **nothing consumed**. The real palette was 884
hardcoded `zinc-*`/`amber-*` utilities across 53 files. There was no token
layer to change.

Token groups: surfaces (`void` `panel` `panel-raised` `inset`), lines
(`gridline` `hairline` `edge` `edge-strong`), text (`readout-strong` `readout`
`readout-dim` `readout-muted`), chrome (`signal` `signal-dim`), elements
(`el-light` `el-red` `el-blue` `el-green` `el-dark`), and the semantic aliases
(`role-attack` `role-control` `role-heal` `role-ultimate`).

**Two rules the palette depends on. Breaking either makes the game unreadable
rather than merely ugly:**

1. **`signal` cyan is system chrome only** — nav, focus, active state, counts,
   section rules. Never a unit, never a stat.
2. **The five element hues belong to units and nothing else.**

The `role-*` tokens deliberately **alias** the element hues (red aggression,
green restoration, violet affliction, gold climax) rather than introducing a
second colour vocabulary. The two readings never appear adjacent: element
shows once in a character's identity block, skill-type accents live in the kit
document. Five hues plus signal is the entire language.

`readout-strong` is achromatic on purpose. Numbers inside skill text used to
be amber; a kit line already carries a keyword hue *under* a skill-type
accent, so a third colour on every digit was noise. Bright-on-dim separates
them without spending a hue.

Also added: `.terminal-grid` (the 44px ground) and `.chamfer` / `.chamfer-lg`.
**Chamfered controls take an inset focus ring, not `outline`** — `clip-path`
clips an outline along with everything else, so the focus state would be
invisible.

### Overlay portal fix + guard (the Growth-modal bug)

Tanveer hit the Growth modal rendering *behind* the kit document. Cause:
`position: sticky` **always** creates a stacking context, the archive detail
rail is `lg:sticky`, and the modal's `fixed inset-0` was therefore scoped to
the rail. `z-[60]` couldn't help — it was competing inside the wrong context.

`DetailOverlay` now renders through `createPortal` into `document.body`, so
placement can't break it again. Hydration guard is `useSyncExternalStore`, not
set-state-in-an-effect — the effect version trips
`react-hooks/set-state-in-effect`. Escape closes it (it was previously a
keyboard trap).

`tests/overlayStacking.test.ts` enforces the rule structurally: every
component painting a `fixed inset-0` overlay must either portal or appear in
an allowlist **with a written reason it's safe where it sits**. It also
asserts the detected-overlay count hasn't collapsed, so a regex that quietly
stops matching can't make the suite vacuously pass.

**Still latent, deliberately left for the battle session:** `BattleArena`
applies `battle-shake-strong` to its wrapper, and an active `transform`
creates a containing block — so the log drawer and battle modals become
arena-relative for ~0.4s on heavy hits. Same class of bug, self-correcting,
not worth touching mid-screen.

### Screens

**Archive index** — `Card` wrapper dropped for a signal-rule masthead;
chamfered controls; raw stats became micro-bars. Bars scale against the
**whole population, never the filtered view** — otherwise filtering to tanks
makes a unit look stronger because the others were hidden.

**Archive detail** — Layout 1 of three ("Dossier"): sticky identity rail, kit
document right. Bars here scale against the **playable roster peak**, so 245
ATK reads as "middling attacker"; NPC kits above that ceiling clamp at 100%
and honestly read as off the scale. The element hue is allowed to speak in
exactly three places: the identity code chip, the stat bars, and the Result
column of the kit preview. `SkillDocument`'s Mult column was **removed** at
his request — the multiplier already appears inside the translated
description, so the column printed it twice per row.

**News** — Feed A of two ("Changelog"): month rules, day in the left gutter,
kind tag per row. The Updates/Notices **tab pair is gone**: `content/news/
notices/` holds only `_placeholder.mdx` (which exists so Turbopack's dynamic
import resolves), so half the control did nothing but reveal an empty list.
The filter row only renders when both kinds actually exist. Unread went from
one nav dot to per-post — the catch is that `markNewsViewed` fires on mount,
so last-viewed is captured in a **lazy `useState` initialiser before that
effect runs**, or opening the page clears the pips in the paint that draws
them. Post pages gained a standfirst (the frontmatter `summary`, promoted),
real reading time, and Older/Newer walking the **merged** feed.

**Story index** — Reading 1 of three, chosen after Tanveer pushed back with
"you are not thinking long term, assume I have 24 chapters". The 6-chapter
design didn't survive that; the 24-chapter one does, because the lead part
never renders more than **one** row whatever it contains, so 24 chapters costs
four more collapsed bars than 6 does.

Newest-first: current part leads with cover + only the current chapter +
"All chapters in this part (N)"; everything unreachable collapses to one line;
finished parts collapse to one bar each, newest first, **each opening the same
modal** — one interaction pattern, not inline-expand for history and a modal
for everything else.

Locked chapters are **redacted, not hidden** (his call, from three options).
The row keeps its number and position; title and enemies do not. Redaction is
**fixed-width** — blocking out the real title character-for-character leaks
its length, and "Nine Years" against "The World That Toll Built" is most of
the guess. Sealed parts and `UPCOMING_PARTS` titles are hidden too.

The parts→chapters drill-down was **deleted** (`StoryPartSelect`,
`StoryChapterList`): with sealing on, the second screen showed one live row and
three redacted ones. `{kind:"parts"}` and `{kind:"chapters"}` collapsed into
`{kind:"index"}`.

Chapter select is scoped by **part chips, not a flat paginated list** — at 24
chapters a flat list means paging past whole parts to reach a chapter you can
already name. Pagination (shared `lib/pagination.ts`, extracted from the news
feed when the second consumer appeared) therefore only fires on search, which
genuinely crosses every part.

> **`searchChapters` must never match a sealed chapter.** Typing an unreleased
> chapter's exact title returns nothing. This is a correctness property, not a
> nicety: without it, search becomes an enumeration tool and walks straight
> past the redaction the whole index is built around. Asserted directly in
> `tests/storyIndex.test.ts`, including a loop over every progress point.

**Chapter brief** — Option B of two ("Decision"): team select leads, because
on a replay it is the only thing the player actually changes. The four stacked
bordered boxes each held one label and one value — four borders for four short
facts, with the only interactive control pushed below them. Now: signal-ruled
header, team, an "Against" block with enemy **portraits** (the index shows
portraits two clicks earlier; the brief was still joining names into a
string), then a three-cell fact strip.

**Story flow beats** — Reader **Option A** (keep the dialogue box) chosen;
Option B (no box, portrait left, ruled line) was rejected outright — do not
revive it. Timings preserved exactly: the 1400ms title-card hold, tap-to-
dismiss, the letter-spacing animation on complete. VS takes gold
(`role-ultimate`) since that already means climax in the kit document; the
split halves become element-blue against role-red. Rewards uses gold for
first-clear and neutral for ordinary drops, so a first clear reads differently
from a farm run before you read a word. The amber `PAGE_BG` gradient is gone
from every story view.

**Survived untouched, as required:** the scene reader's word-at-a-time reveal,
its `prefers-reduced-motion` opt-out, and confirm-skip on unseen scenes.

### Shared components pulled along (flagged at the time)

`prose.tsx` is `/news`'s typography too, so its section rules going signal
took the news pages with it. `TopNav` went cyan because it sits directly above
the pilot screen. `KeyworkHighlighter`, `PassiveProse` and `KitDetails`'
skill-type chips migrated with the archive — which means **battle currently
reads half-cyan**, and that debt lands in the battle session, not as a
surprise.

`OwnedTeamSelect` migrated with the brief (it *is* the lead element of Option
B) and is shared with `/practice`, which now has a cyan team picker on an
amber page until its turn.

### Not migrated yet

`/practice`, `/gacha`, `/world-boss`, `/profile`, `/login`, `/`, and the
battle arena proper.

## Session log — 2026-08-11 (part 2): progression, format, one picker, account rank

Started as "I need a team preset system", turned into six systems because the
first question exposed three things that were stored but never used. Everything
below is on `master`. 876 tests, lint and build green.

### The finding that reframed the whole batch

`buildBattleChar` read stats **straight from the catalog JSON**. `level`,
`ascension` and `ultLevel` had been sitting in `playerStore` since the world-
boss batch, consumed by nothing. A maxed character fought exactly as hard as a
freshly pulled one, and a "trial" story unit was mechanically identical to an
owned one. Tanveer's ask ("trial chars but a bit levelled up, say level 10")
was impossible to answer coherently until that was fixed, so progression came
first and everything else built on it.

### Progression (`lib/game/progression.ts`) — ruling: approved 2026-08-11

The curve was **already specced** in `docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md`
lines 22-24 and 73-76, written long before this session. It was implemented as
written with two departures, both approved:

1. The doc computes a rounded per-level constant, `round(base / 59)`. Integer
   rounding systematically shortchanges small stats — Ban's 80 DEF reaches
   **1.74x** at Lv60 while Yalina's 4000 HP reaches exactly 2.00x, so the stat
   a character has least of grows slowest, punishing the characters built
   around a low stat. Implemented as `round(base * (1 + (level-1)/59))`
   instead: every stat lands on 2.00x regardless of magnitude.
2. The per-band ascension bump was marked "tuning TODO". It is **+1/6 of base
   per band, six bands**, summing to the +1x the doc asks for → ~3x at fully
   ascended Lv60.

**Ult levels** (ruled 2026-08-11): an ultimate's multiplier grows 60% of its
own value across the six levels — a 500% ult reads 500 / 560 / 620 / 680 /
740 / 800. One rule for every playable ult. `MAX_ULT_LEVEL` was already in
`lib/gacha/dupes.ts` and is now exported and reused rather than redefined.

**Nothing currently in the game changed.** Default progress is level 1 /
ascension 0, and ascension 0 caps max level at 1, so every character sits at
exactly 1.000x. All 810 tests at the time passed unchanged, which is the
empirical proof rather than the argument.

Order of application in `buildBattleChar`: **catalog base → progression →
stage effects**. Progression is intrinsic to the unit; a stage effect is the
encounter modifying whatever turned up. Player units read `getCharacterProgress`
once at battle start (never mid-battle); an explicit `level` on the pick
overrides it, which is the hook trial characters use.

`BattleCharacter.ultLevel` is **optional** — required broke ten hand-built test
fixtures for no benefit, and absent-means-1 is a true no-op.

### 3 field + 1 sub (`lib/game/format.ts`)

Tanveer: "all battles are meant to be 3 + 1 sub vs enemy, not 4 vs enemy like
we have been playing." Confirmed to constrain **both sides**, as a default with
an override ("unless I say otherwise").

The rule had lived **only inside `components/game/TeamSelect.tsx`**, the
practice sandbox. `OwnedTeamSelect` — story and world boss — had no format
concept at all, which is exactly why those battles shipped four on the field.
It now lives in lib and is applied in `startCustomBattle`, where teams are
assembled and no screen can forget it. `options.fieldCap` is the documented
override and the practice bench passes it, so its 4v4 still works.

A pick that **already declares `isSub` keeps that answer** — an authored
encounter that deliberately benches its second unit isn't overruled by
position.

**Balance consequence, deliberately accepted:** world boss and non-canon story
chapters now field three. Molvarr was tuned against four attackers. No current
chapter has more than 2 enemies, so the enemy-side half of the cap bites
nothing today.

### One team picker (`components/game/TeamPicker.tsx`)

Tanveer: "a global team picker used everywhere across the game, not duplicated
instances specially made for certain sections."

`OwnedTeamSelect` is **deleted**. `TeamSelect` lost ~250 lines of duplicated
slot grid and roster overlay and now composes two `TeamPicker`s (both
`source="catalog"`, presets off on the enemy side) plus the boss selector and
the format switcher — the three things genuinely specific to a bench.

Props: `anchors` (unremovable, ownership-exempt), `openSlots`, `source`
(`roster` | `catalog`), `showPresets`, `fieldCap`, `trialIds`. The fourth slot
renders as **Sub**, greyed, because the bench is real now.

### Team presets + sticky last team (`lib/game/teamPresets.ts`)

**One global list** shared by every mode (his call), capped at 8 — beyond that
the chip row stops being scannable, which was its point. Chips carry member
portraits so a team is picked by recognition rather than by name.

Conflict rules, all tested: an anchored or unowned member **leaves its slot
open and says why**; never silently dropped, never refuses to load, and the
stored preset is **never edited behind the player's back**. Order is preserved
because with 3-on-field a reorder would silently change who benches.

**Sticky last team** is the actual fix for "tired of picking chars manually
each time" — the brief reset `picked` to `[]` on every visit. Saved **on
launch, not on selection**: a team you assembled and then abandoned isn't the
one you want back.

Known rough edge: preset naming/renaming uses `window.prompt`. Functional,
ugly, flagged to Tanveer, not yet replaced.

### Trial characters (`lib/game/storyTeam.ts`)

The *behaviour* already existed — `storyAnchors` bypasses the ownership check
on purpose so a fresh account can play Duke's story without pulling Duke. What
was missing is that **nothing told the player**, so an unowned character
silently appearing read as a bug.

Now: a Trial badge on the slot plus one line explaining it's lent for this
battle only, and the unit fights at the chapter's `trialLevel` (default 10,
per-chapter so it can rise deeper into the story). An **owned** lead is never
overridden — the player's own progression applies, so an invested copy always
beats the loaner. Tested at the crossover: Lv11 already beats the Lv10 loaner,
so there's no band where investing makes a character worse.

### Account rank + world level (`lib/game/accountRank.ts`, `lib/game/worldLevel.ts`)

Bands of **20** to a cap of **60**, walls at 20 and 40 cleared by ascension
trials (Genshin model). Mirrors character ascension deliberately — same shape
learned once, applied twice.

XP bar: **100 for the first rank, compounding 10%** per rank. That is steep and
the consequence is documented rather than hidden: rank 59→60 alone costs
25,164, and the full climb is **275,798**.

**XP banks at a wall rather than being discarded**, and clearing the trial pays
out everything earned while stuck. Throwing it away would punish players for
continuing to play, which is the opposite of what a retention gate is for.

**A rank-up refills stamina** (his call).

World level: WL1 from the start, WL2 at rank 20, WL3 at 40, WL4 at 60.
`effectiveDifficulty` implements the floor/ceiling rule — a chapter's
`baseDifficulty` is a **floor** even for a low-rank player, the account's rank
is the ceiling, so the floor rises with the story and the ceiling with the
account, and the dial only ever *adds* an option. `baseDifficultyForPart`:
difficulty 1 through part 5, 2 from part 6 to 10, holding at 2 past that.

**XP sources** (his ruling): story chapters pay on **first clear only** —
p1c1..p2c2 = 10/11/12/13/15/16 — and world boss pays **100 per clear, every
clear**. That number was chosen against the stamina economy, not picked: 40
stamina a run and 288 regenerated daily is ~7 runs and ~720 XP/day, reaching
the first wall in a week, the second in ~2 months, and rank 60 in ~1 year. At
50 the same climb takes over two years. **First clears are flavour; repeatables
are the ladder** — the six existing chapters total 77 XP, which doesn't reach
rank 2.

Reward multiplier applies to the whole payout **including account XP**.

**Near-miss worth recording:** `grantWorldBossRewards` rest-spreads its
argument into the materials map. Adding `accountXp` without destructuring it
out would have created an inventory item called "accountXp" that nothing
displays and nothing spends. Caught, fixed, and pinned with a test.

**Still provisional, marked as such in code:** `ENEMY_LEVEL_PER_DIFFICULTY = 8`
and `REWARD_BONUS_PER_DIFFICULTY = 0.35`. A test asserts rewards always outpace
enemy stat growth — if that ever inverts, raising world level becomes work for
no gain and nobody opts in. Keep the test.

### Scene-only chapters

Ruled 2026-08-11: **a chapter may have no battle** and still pays first-clear
rewards. `StoryChapter.battle` is now optional; such a chapter runs brief →
title → intro → outro → complete → rewards.

Guarded in seven places: type, schema (a *half-filled* `battle` key is still a
load-time failure), `storyAnchors`, `resolveStoryTeam`, the index's enemy list,
the brief, and the flow. Two traps closed: **Skip Story** would have jumped to
a versus beat that never resolves (now falls back to the title card), and the
versus view bounces to the index rather than rendering a splash for a fight
that doesn't exist. The brief hides the picker and the Against block entirely
and its CTA reads **Read**.

### Persistence

`playerStore` went **v3 → v5** in one session. v4 added `presets` and
`lastTeam`; v5 added `account` and `worldLevel`. Both purely additive, both
with tests proving an older save comes through at today's behaviour (rank 1 /
world level 1, empty lists) and that a current-version doc passes through
untouched.

### Story adaptation draft

`docs/design/STORY_PARTS_3_TO_6_DRAFT.md` — parts 3–6 mapped from
`E:\Toll - Web toon` chapters 3–6, at Tanveer's invitation. **Nothing written
to `data/story/`**, no dialogue drafted, no new characters. Three rulings are
folded in: scene-only chapters allowed, ignited Tao is a levelled `master_tao`
rather than a second phase, and the Seris closing scene gets no battle
("intrigue only, not villain identification").

### Not done

- ~~#24 battle UI~~ — done 2026-08-11 (layout B).
- ~~#31's UI half~~ — done 2026-08-12 on the events brief and the nav/profile
  rank display. Still open: the two ascension trial **encounters** (Tanveer's
  design; the board entries exist and refuse entry).
- Preset naming still uses `window.prompt`.
- Pre-token palette remaining: `/practice` and `/login` only.

## Session log — 2026-08-11/12 (part 3): battle playback, six screens, gacha economy, the whole story

The longest session so far — roughly eight batches, none committed until the
end. Everything below is implemented, `npm run check` green (961 tests / 81
files), production build clean. **None of it is browser-verified** — Tanveer
playtests.

### 1. The flash of the future (started as a bug report)

Tanveer: *"it shows a glimpse of future battle stat snapshot before the actions
actually play one at a time. this should never be the case. it should play in
async-await style."*

He was right, and the cause was architectural. `resolveplayerTurnWrapper` ran
the **entire** action queue in one synchronous `while` loop and called
`updateTeams()` **once at the end**; same shape in `resolveEnemyTurnWrapper`. So
the store held end-of-turn truth while the sequencer replayed the turn from the
beginning. `useBattleSequencer` already fought this by seeding `hpBefore` in a
layout effect — but that covered only HP, only on units appearing as event
targets, and only `if (!runningRef.current)`. Buffs, ult gauges, the hand, the
team dots and the boss phase-break banner all still jumped ahead.

**`lib/game/playback.ts` (new)** is the gate. Both resolvers are async now and
commit per action: `executeSkill → commit → await playback → next`.

- **Keyed on counts, not a live "is it playing" flag.** The sequencer only
  starts on a layout effect *after* the commit, so a resolver asking "are you
  busy?" immediately after committing would always be told "no" and race
  straight past. `playedEvents >= battleEvents.length` has no such window, and
  an action that emits no events is trivially already played — right for a pass.
- **Three ways it cannot hang**, because a stuck gate is a frozen fight: no
  sequencer mounted (tests, duel watcher) resolves instantly; unmounting
  mid-animation releases the wait; a 12s ceiling backstops the rest.
- **`presentedHp` moved into the store.** It was local to the sequencer, so
  `TeamBarDots` and `RosterButton` read `currentHP` raw and greyed units out on
  commit. One source now.
- `setPhaseBreak` moved behind the await; dead units' cards leave the hand after
  the await, not on commit.
- **Skip collapses the rest of the turn**, not just the event on screen —
  otherwise every remaining action waits for playback that isn't coming. Resets
  per turn.
- Adjacent fix: the sequencer treated its whole event stream as fresh on mount,
  so a remounting arena replayed every event since turn 1. Harmless when the
  hook only drew floaters; not harmless once resolvers wait on that count.

### 2. Battle UI — layout B

Mockup (`scratchpad/battle-ui.html`) offered a console frame and a side rail;
Tanveer picked **B**. Built: a 56px right rail (Skip / Speed / Log · Foe · Team ·
Exit) replacing three floating buttons whose own code carried comments about
colliding with each other.

**The palette was the bulk of it.** Battle was the last screen on the pre-token
palette — eight chrome hues against five element hues — and
`lib/game/elementSwatch.ts` still returned Tailwind `rose/sky/emerald/violet/
amber`, so elements rendered at different values in battle than in the archive.
Three collisions had to be resolved:

- **Ultimate cards were cyan** — the same cyan now used for the rail and End
  Turn. **R3 was gold**, which is the ultimate's colour on the tile flag and the
  queue chip. So `cardFrameStyle` became one achromatic ramp for the merge
  ladder, with gold reserved for the ultimate.
- CRIT and ULT badges sat on the same log row, both gold. Crit went achromatic.
- Skill-type badges spent five hues restating what the glyph already said.

Tile: art on top, **fixed-height** readout underneath (the chip strip used to
wrap and shove the portrait down), HP as the largest number, bar achromatic
until ≤30%, ult as one bar plus a READY flag, chips capped at 3 with `+n`.
Console: action pips, **Reset/End Turn pinned outside the scroll container** (a
full queue used to scroll End Turn off the edge), cards carrying name and power,
rank as `◆◆◇`.

`BattleLogDrawer` now portals. It was a documented exception reading *"portal it
if the arena stops being near-viewport-sized"* — the rail is exactly that.

**Not done:** the mockup proposed merge-by-dragging-onto-its-twin. Drop means
reorder today and repurposing it risked breaking that; the Merge button stays.

### 3. Two rulings on effects and the bench

- **Grey (uncancellable) effects hidden by default**,
  `settingsStore.showUncancellableEffects`, with an inline `+n fixed` reveal
  *where the hidden chips would be* — a control in a corner wouldn't be found.
  Two empty states had to change or they'd have claimed no effects while hiding
  some.
- **Subs are off the battlefield entirely** — tiles, team dots, roster stacks.
  They live in the Team list. This surfaced a real bug: `UnitDetailPanel`
  resolved its unit with `Math.max(0, findIndex(...))` against a field-only
  list, so opening a benched unit silently showed the **first field unit**
  instead. Near-unreachable before; the Team list is now the only way to meet a
  sub.

### 4. Home, nav, profile, archive

Mockup `scratchpad/home-nav-profile.html`. Tanveer: **Home A**, **Nav B with
inline icon+text links**, **Profile A**, roster moved to the archive.

- **Home** was a second navbar — the nav listed all eight routes and home listed
  the same eight as cards. Now: a Continue hero derived from progress, alerts
  that only render when true (boss runs *affordable*, banner days + pulls to
  milestone, unread news), then a quiet grid.
- **Nav** grew a second row carrying stamina/gems/coin/rank — previously visible
  only on home. **The trap:** `h-[calc(100dvh-2.875rem)]` was hardcoded in
  **six** screens, so a taller nav would have silently cut ~33px off each. The
  nav now publishes `data-nav-rows`, CSS derives `--nav-h` via `:has()`, and
  screens use `.screen-below-nav`. A guard test forbids the magic number
  returning. The row stands down in battle, gated on `mounted` because
  `battlePhase` comes back from sessionStorage.
- **Profile** opens on rank/XP/world level *and why it's capped*. Roster section
  removed. Two modals on `DetailOverlay`: **Inventory** (held materials only,
  count of unheld, account figures, investment totals) and **Account** (sign-in,
  cloud state, display picture, sign out — which had been the loudest control on
  the page).
- **Archive** took the roster listing: owned-only by default with a `Show locked
  (n)` toggle, tiles reading `Lv 42 · A3 · U2`.
- `PlayerHud.tsx` **deleted** — the nav row replaced it, nothing referenced it.
- **Display picture is a portrait picker**, not an upload — no storage bucket
  exists, and a dead upload button is worse than none. Stored in `settingsStore`
  (device-local) rather than `playerStore`, because that store's cloud sync
  writes a fixed field list and is versioned: adding to it means a schema bump
  on every existing Firestore document. Flagged, not done.

### 5. Events, and the gacha economy

`/world-boss` → **`/events`** (`git mv`, history preserved). `lib/game/events.ts`
holds Molvarr plus the **two ascension trials**, which `RANK_WALLS` has declared
at ranks 20 and 40 since the rank system landed and which no screen had ever
mentioned. Board → brief → battle → results. The brief is where
`enemyLevelForDifficulty` finally reaches `startCustomBattle` — world level had
been built and wired to nothing. Trials refuse entry with "Encounter not
authored yet" rather than presenting a dead button.

**Gacha was redesigned whole, including the loop.** Rulings, in the order they
arrived (each superseding the last):

1. Costs 5 gems single / 50 multi; bar 3 / 30.
2. **Superseded:** milestones move 300/600 → **500/1000**, and gems are **1:1**
   with progress.
3. **The final milestone does not override the first.** Both claimable at any
   time, in any order; the lap only wraps once the final threshold is reached
   **and every reward on it has been taken**.
4. The first milestone rolls **from the banner's featured units**, not the whole
   roster. The two milestones differ only in who chooses.

`lib/gacha/milestone.ts` was rewritten around `settleLimitedLap`. The old model
reset the lap the moment 600 was claimed and **silently forfeited an unclaimed
300** — the code carried a comment admitting it and a test asserting the forfeit
as correct behaviour. Both are gone. Constants renamed `_FIRST`/`_FINAL`: a
constant called `LIMITED_MILESTONE_300` holding 500 is how the next re-tune goes
wrong.

**Persisted state v5 → v6.** `claimed300` → `claimedFirst`, plus `claimedFinal`
on both banners. A Limited lap in flight is **reset, not converted** — the bar
counted a 3-per-single unit against 300/600 and now counts gems against
500/1000, so carrying 450 forward would show progress never made at the new
rate. Permanent kept ticket pricing and its 600, so its bar carries untouched.

Reveal screen: it used to **dismiss itself** (GSAP `onComplete` wired straight to
the close handler), with no skip and no way to review an 11-pull. Materials
rendered raw ids (`training_manual`). Dupes were invisible even though
`resolvePullResult` had already computed new-vs-dupe — so `ResolvedPullOutcome`
now carries `isNew`/`ultLevel` from the store rather than being re-derived by
diffing the roster afterwards.

### 6. Ruling #43, refined — and the bug it caught

Tanveer: cards needing an enemy fizzle; heals, cleanses and buffs still fire; an
attacking ultimate returns to the deck; a non-attacking ultimate (Isolde's
Starbound Ward) fires.

`lib/game/targetRequirement.ts`. **For ultimates the discriminator is damage,
not type** — Starbound Ward is `type: "ultimate"` with `damage: 0`.

**The bug:** the first implementation checked damage *before* type. On a `heal`,
`damageRanked` is the **heal magnitude** — Isolde's Threads of Renewal
`[20,25,30]`, Siddiq's Cleansing Bloom and Prism's Blessing Light all carry one,
and AGENTS.md excludes heals from the damage rule for exactly that reason. So
all three heals would have been **cancelled**, the precise opposite of the
ruling, on the character that prompted it. The tests passed because they
asserted invented fixtures. Replaced with a pass that walks **every real kit**,
plus a guard asserting a real heal-with-`damageRanked` still exists so the test
can't lose its teeth. Verified by reintroducing the bug: 2 failures, both new
tests.

Second correction: returned ultimates do **not** rejoin the hand mid-turn. They
go to `pendingReturnCards` and are dealt **first at the next turn's draw**, ahead
of the random refill. Overflow keeps waiting; a card whose owner died or benched
is discarded.

### 7. Battles you aren't meant to win

`lib/game/victoryCondition.ts` + `victoryAtEnemyHpPercent` on a chapter. Ruled:
the fight happens and **ends as a victory at 20% enemy HP**, the panels explain
what happened, rewards pay normally. Absent = the old kill-everything rule, so
every prior battle is untouched.

- **Pooled across the enemy side, not per unit** — otherwise focusing one enemy
  ends a three-unit fight while the other two stand untouched.
- **Defeat beats the threshold in the same commit.** A mutual knockout is a
  loss; if the threshold won that race, wiping your own team on the killing blow
  would read as a win.
- Remaining queued cards fizzle on the threshold too, per §6.

### 8. The story — all twelve parts

The source folder holds **twelve** chapters, not six; 7–12 were all marked
LOCKED and had never been mapped. `STORY_PARTS_7_TO_12_DRAFT.md` written, then
both drafts acted on.

**Rulings:** dialogue is pulled from the canon beat sheets, not invented; **no
invented battles** — chapters 3, 4, 6, 11 and 12 have no fights in the source,
so those parts are scene-only; Yalina stays playable after dying (Himeko
precedent); Seras is concealed rather than duplicated.

Two corrections from Tanveer that changed the work:

- **"Seras" and "Seris" are the same character** — I had written them up as two,
  which would have put a villain with no assets into the plan alongside a
  playable with a full kit. She has **two arts**: combat (registered) and
  civilian (`public/unreleased/seras_civilian_wip.png`, unregistered).
- **`sea_monster` is Molvarr** — the generic id from before he was named. So it
  was never available as the smaller Ch10 creature.

Result: `data/story/part3–12.json`, all validated by the Zod schema at load,
`UPCOMING_PARTS` now empty. Battles only where the source fights: part 5 (4),
part 7 (3), part 8 (1), part 9 (3), part 10 (1). The 20% rule applies in five
chapters — Chiara's stalemate, Duke/Batra breaking off, all three Molvarr
chapters. `tests/storyCatalogIntegrity.test.ts` asserts the fightless chapters
stay fightless, XP never goes backward, and scene-only chapters cost no replay
stamina.

**Mine, not canon, and worth review:** part 5's stage effects (Duke −50% ATK for
the no-Toll round, Tao +1 action while Lyra is down, level 15 for the ignited
round); the Ch10 creature is **`wild_beast`** because the source wants a smaller
Molvarr-kin and no such kit exists; the connective narration between canon
lines.

Seras is **never named** — Tao doesn't say her name in the Ch10 dialogue either,
so her lines are credited to "Unknown female voice" in both part 6 and part 10.

### Not done, deliberately

- Merge-by-drag on hand cards (§2).
- Avatar in cloud save (§4) — needs a `playerStore` version bump.
- A kit for the Ch10 Molvarr-lite creature (§8).
- Ascension trial encounters — Tanveer's design.
- `/practice` and `/login` are still on the pre-token palette.
- Preset naming still uses `window.prompt`.


## Open Issues

| # | Issue | Where | Severity |
|---|---|---|---|
| 6 | Ultimates have no rank while skills rank up — confirmed intended for now; Tanveer may add an ult level-up system later | `types/ultimateCard.ts` | Design note |
| 13 | Art nitpicks: Seras's horn-like hair tufts didn't render; Yalina's side braid renders as loose side curls (trigger-word/style limits — see ART_PIPELINE trigger-word table) | `public/characters/` | Cosmetic (re-roll) |
| 14 | Design feedback 2026-07-11: Mustafa approved; Siddiq redesigned (v2, still AI-invented — awaiting his sheet); Batra reworked per his direction (turban/beard/kesari, no armour). He loves Lyra/Sara/Gabrist; Duke/Yalina/Seras fine for now, iterate later | `docs/ART_PIPELINE.md` | Pending input |
| 20 | Battle screen overhaul: cinematics shipped 2026-07-12; the 2026-08-04 UX batches did the layout, enemy inspection, info panel, structured log and per-character VFX. **Remaining: mobile pass + sound hooks only** | `components/game/*` | Mostly done |
| 21 | Enemy AI: skill-selection priority rewritten 2026-07-13 (team-wide tiers + per-turn caps). Target-choice heuristics (currently lowest-HP/taunt) may still want tuning per playtest | `lib/game/ai.ts` | Mostly done |
| 22 | Battle log can't show **which buffs/debuffs an action applied** — `battleEvents` doesn't model effect application, so the Raw string-log toggle remains the only record. Needs an `emit` change in `combat.ts` | `lib/game/combat.ts`, `types/battleEvent.ts` | Open |

Closed: #17 ("Permanently" = cancel-proof, ruling #37), #19 (damage-modifier stats wired, ruling #36), #16 (zero clauses hidden, ruling #44), #15 (firestore.rules deployed live via Firebase MCP 2026-07-11 — cloud saves work for signed-in users; minimal `firebase.json` added), #7 (Mechanic discriminated union — see Working).

## Not Built Yet

- Story **Phase 3** — the bracket part 12 ends on. Not written in the source yet; parts 1–12 are all adapted and `UPCOMING_PARTS` is empty.
- ~10 additional characters (Tanveer adds when game is in working order)
- **Mobile layout pass** — the biggest remaining gap in roadmap item 2
- **Audio assets** — the music *system* shipped 2026-08-09; `public/audio/` is empty until Tanveer supplies the OST (`docs/AUDIO.md`). No SFX system exists and none is planned.
- FTUE / onboarding, daily loop, analytics (see `docs/PRODUCT_AUDIT.md`)
- Deployment (Vercel target; Firebase project `toll-the-game` exists for auth/Firestore). **Not started** — no Vercel project linked, CLI not installed
- Effect application in the battle-event stream (Open Issue #22)
- Story chapter **mission objectives** (3 per chapter paying gems once), **difficulty tiers**, the **node-path stage map**, and **multi-wave stages with persistent HP** — all scoped out of the 2026-08-09 rewards batch, each its own future batch

Note: "playerStore is a stub" is no longer true — it carries roster, currencies, inventory, per-character progress, stamina and gacha pity, with migrations at v6.

## Environment

- Node 24, Next.js 16.2.10, React 19.2.7. Majors deliberately held: TypeScript 5.9 (not 6), ESLint 9 (not 10) — Next 16 support unconfirmed.
- Known `npm audit` leftover: postcss <8.5.10 nested inside `next` — upstream.
- Firebase env in `.env.local` (gitignored); pullable via Firebase MCP from project `toll-the-game`. App runs guest-mode without it.
- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` for art generation.
