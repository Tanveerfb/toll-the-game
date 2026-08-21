# Roadmap — Ship the Card Game

Solo dev + AI tooling. Ordered so every phase ends with something runnable. Mechanic/balance decisions marked **[Tanveer]** per division-of-labor rules.

---

## Forward Product Roadmap (2026-07-18, Tanveer's ordered sequence)

**Principle: one feature at a time, fully polished, before starting the next.** No parallel half-built systems.

The foundation (combat, kits, story P1-2, archive, art, auth) is solid enough to build the live game properly. Ordered:

1. **[Tanveer] Finalize the world-boss kit** — the premium multi-phase sea-monster kit (see `docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md`, Concept A/B references). Blocks the world-boss update.
2. **Game UI/UX tuning for players + SFX + music + misc** — the player-experience polish pass (mobile, juice, audio system, onboarding); the biggest gap per `docs/PRODUCT_AUDIT.md`. Includes a full **battle-screen overhaul** (2026-07-24 brainstorm, not yet spec'd — see memory `toll-battle-ui-overhaul-requirements`): reference blend is **7DSGC** (skill-deck/hand system, info panels, character detail screens — polish existing execution up to that standard) + **Dokkan** (battle flow, team-panel/turn structure, Super Attack-style cutscenes on big hits, rank-scaled: R1 simple, R2 a step up, R3/ultimate full treatment). Layout is fully open, not locked to the current single-viewport convention. Needs a desktop session with the visual companion for actual mockups before writing a spec.
   **UX OVERHAUL DONE 2026-08-04** — a full project audit produced a 5-batch plan, sequenced homepage-first, all shipped: (1) homepage → game hub (live player HUD, tiered mode cards, unified nav shared with TopNav via `lib/nav/routes.ts`), (2) enemy inspection in battle + `UnitDetailPanel` relayout to no-scroll density, (3) structured battle log rendered from the typed `battleEvents` stream instead of `string[]`, (4) per-character VFX extended from 5 → all 27 kits (CSS/motion only, ult cut-ins switch to the existing skill art), (5) archive detail page re-rendered as a typographic document sharing `/news`'s styling. Plus Tanveer's playtest fixes: Growth gated to owned characters and moved to a modal, practice dummy 400 → 100k HP, and Damage Preview rebuilt as **Kit Preview** (support skills read "1 damage", passives were absent, multi-phase kits were truncated to phase 1). Kit data stays JSON. Ships with `content/news/updates/2026-08-04-interface-overhaul.mdx`.
   **Still open under this item:** audio (BGM + SFX), FTUE/onboarding, and the four battle-layout calls in `docs/design/mockups/battle-mobile.html`. The mobile pass itself shipped 2026-08-21 (rulings #118–120). Arena spacing between team rows is deliberate — don't compact it.
3. **BUILT 2026-07-31.** **World Boss + Ascension update** — leveling (base/59, ~3x with ascension bumps), stamina, world-boss encounter, drops/inventory. Reachable cap Lv40 this update. Spec: `WORLD_BOSS_AND_ASCENSION_PLAN.md`. **UX reference (2026-07-24, 15 screenshots — see memory `toll-world-boss-refs`, `docs/design/references/world-boss-refs/`):** 7DSGC's "Death Match" world-boss flow — difficulty ladder (Normal/Hard/Extreme/Hell, stamina-gated), the actual battle (identical engine/UI to a regular fight, boss drawn at giant scale, multi-phase "heart" counter matching our already-built `CharacterPhase` system, a knockdown beat between phases), a boss-info/preview screen (stat callouts + named boss skills + Ultimate), and an ascension/Limit-Break screen (material slots + currency cost). **Confirmed SOLO, no co-op** — the reference's matchmaking/lobby/Host-Bonus/CC-threshold layer is explicitly dropped (even in 7DSGC itself that system is barely used). Material taxonomy: 3 deliberately different acquisition-friction types (event-gated/scarce, freely farmable, daily-capped) — the existing stamina gate (120 cap / 40 per run) already covers the "daily-capped" case, no second cap needed.
4. **BUILT 2026-08-02 (code complete, awaiting commit/deploy).** **Gacha** — summon/banners/milestone-bar pity/ult-level dupes/currencies. Spec: `docs/design/GACHA_DESIGN.md`, `docs/superpowers/specs/2026-08-01-gacha-design.md`. The pity-model conflict flagged below was resolved in favor of the reference's milestone-bar approach (300/600 thresholds, independent claims, replaces the old hard-80/soft-70 numbers entirely) rather than layering both — see the spec's "Milestone bar" section for the full resolution. Debut banner (in-game name "V1. Beta Roster Banner") ships with 12 non-collab characters at a one-off 5% flat rate; Permanent banner ships empty pending Tanveer flagging characters into it. Banner splash art **built 2026-08-02** — a composite of 6 existing character portraits (Duke, Seras, Lyra, Sara, Chiara, Gabrist) over a generated burst background (see `docs/ART_PIPELINE.md`), not a fresh AI render. **Original UX reference (2026-07-24, 4 screenshots — see memory `toll-gacha-design`, `docs/design/references/gacha-refs/`):** 7DSGC's banner screen, a "Rates" transparency modal, and a multi-tier coin shop (coin shop not built — monetization is still roadmap item 6, unaddressed).
4b. **BUILT 2026-08-09.** **Story rewards + team agency** — story chapters now pay a one-time first-clear bundle (gems/coin/manuals) plus range-rolled repeat drops (coin/manuals), gate replays behind stamina while leaving uncleared attempts free, and declare a per-chapter `teamMode` (`canon`/`anchored`/`free`) so future chapters can be fought with the player's own roster. Closes the gap where story — the mode with the most content — touched none of the leveling/stamina/gacha systems built after it. Spec: `docs/superpowers/specs/2026-08-09-story-rewards-and-team-agency-design.md`. Parts 1–2 stay `canon`; all reward numbers are placeholders in `data/story/*.json` awaiting **[Tanveer]** tuning. Ships with `content/news/updates/2026-08-09-story-rewards.mdx`. **Still open for story:** mission objectives, difficulty tiers, the node-path stage map, multi-wave stages with persistent HP (see Phase 3 below), and Parts 3–6 content.

4c. **BUILT 2026-08-09.** **Story presentation overhaul + music layer** — Tanveer's verdict on the story experience was "it's not good right now"; he confirmed *scenes look cheap*, *no pacing or weight* and *battle handoff is flat*, and dismissed the navigation-depth complaint. Delivered: typewriter reveal with the VN tap contract, AUTO/HISTORY/skip-confirm, narration visually separated from dialogue, portraits reframed with the previous speaker retained, chapter title card, **VS splash**, chapter context in the battle status strip, CHAPTER COMPLETE on first clear, and a full **music layer** (role-keyed manifest, two-deck crossfade, autoplay gate, missing-file tolerance, volume/mute in a TopNav popover). Spec: `docs/superpowers/specs/2026-08-09-story-presentation-and-music-design.md`. Ships with `content/news/updates/2026-08-09-story-presentation.mdx`.
   **Two things are Tanveer's:** environment **backgrounds are deferred** by his call (they're the biggest remaining lever on "cheap"), and **the OST itself** — `public/audio/` is empty and the game is silent until he adds the files listed in `docs/AUDIO.md`. **No SFX system exists and none is planned.** This closes the audio half of item 2 below at the system level; FTUE remains, and the mobile pass shipped 2026-08-21.

5. **BUILT 2026-08-01.** **Patch-notes system + first patch notes** — `/news` route, MDX-based, Updates/Notices tabs, localStorage unread badge. Standing rule since: every player-facing change ships with a news post going forward.
6. **Monetization + game promotion** — commerce (payment, packs, battle pass), compliance, marketing.

This supersedes the "Deliberately Out of Scope" note below — gacha/monetization are now IN scope, sequenced.

---

## Phase 0 — Resurrect the Build ✅ (2026-07-06)

- [x] Restore configs from `5bce3ad`: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`
- [x] Dependencies updated to latest compatible (Next 16.2.10, React 19.2.7, HeroUI 3.2.1, Firebase 12.15, Tailwind 4.3, Zustand 5.0.14, Zod 4.4). Unused deps removed: three, pixi.js, recharts, lottie-web, sass. Majors held pending ecosystem support: TypeScript 6, ESLint 10, @types/node kept at Node-24 line
- [x] Firebase env restored to `.env.local` from `toll-the-game` Firebase project (via MCP)
- [x] Build-blocking type errors fixed (KeyworkHighlighter glossary index, combat taunt sourceId, gameStore dead interface member); Firebase init made optional so builds work without env
- [x] `npm run build` + `npm run lint` green; `/`, `/practice`, `/archive` smoke-tested 200
- [ ] Manual playtest: 4v4 battle to victory/defeat
- [ ] Commit: restored working baseline + docs

## Phase 1 — Correctness (engine trustworthy)

- [x] Fix STATUS.md #1: card rank drives damage, `*Ranked` mechanic values, and `aoeRanked` (2026-07-06)
- [x] Fix #2: Duke's Flowing Ruin consume — skills + ultimate gain/consume, all targets debuffed (2026-07-06)
- [x] Resolve #3: enemy side takes 3 actions per turn, random living enemy each, no fixed pattern (2026-07-06)
- [x] Vitest added; 18 tests across rank scaling, Flowing Ruin, and AI selection
- [x] Fix #12: Weaken deals damage + ATK-down [15/25/40]%; damageRanked > 0 always deals damage; Draw Fire taunts all; targetSelf buffs fixed (2026-07-06)
- [x] Fix #4: `/login` (email + Google, guest-mode fallback) and `/profile` (info + logout) built (2026-07-06)
- [x] Replace `require()` with static imports via characterCatalog (#5) (2026-07-06)
- [x] Unit tests for `damage.ts` — pierce, ignite, detonate, weakpoint stacking (2026-07-06)
- [x] Verify stun/duration tick semantics (#9) — tick logic extracted to `lib/game/tick.ts` + tested; a 2-turn stun blocks exactly one turn (2026-07-06)

**Phase 1 complete — 35 tests passing.**

## Phase 2 — Game Shell (playable product, not tech demo)

- [x] UI migrated from HeroUI to shadcn/ui + Tailwind 4 (2026-07-06, design decision)
- [x] Team selection screen — sandbox: player picks BOTH teams (1–4 each, per Tanveer's ruling), feeds `/practice` via `startCustomBattle` (2026-07-06)
- [x] Battle end screen — victory/defeat overlay with Rematch (same teams), Change Teams, Main Menu (2026-07-06)
- [x] MechanicProvider queue now clears between battles (stale passive registrations fixed)
- [x] Sub-unit system (2026-07-06, per Tanveer's spec): one bench slot per team — passive active from bench, no cards, untargetable; promoted to field at the START of a new turn after a teammate dies. Battle format selector (4v4 = all field / 3v3 = 4th unit auto-sub); teams may be any 1–4 units; lone subs auto-convert to field
- [x] Frontend redesign pass (2026-07-06, dokkaninfo.com as reference): archive index → filterable unit-tile grid; archive detail → two-column layout (sticky identity panel + flattened kit sections); battle arena unit cards compacted; team select toolbar layout. Portrait tiles are placeholders for future card art
- [x] Deck flow per 7DS GC ruling (2026-07-07): hand never resets; pure-random one-at-a-time refill with auto-merge on adjacent identical draws (+1 gauge per merge); fill-to-cap covers a promoted sub after a field wipe; Reset Deck button removed
- [x] Card art v1 (2026-07-07): fully AI-generated locally (ComfyUI + Animagine XL 4.0, Dokkan × 7DSGC style, per Tanveer's direction) — all 9 characters, wired into archive tiles, character detail, team select slots/roster, deck cards, and arena avatars. Pipeline + prompts documented in `docs/ART_PIPELINE.md`
- [x] Card art v2/v3 (2026-07-07): Duke/Gabrist/Yalina/Lyra redesigned from Tanveer's direction, ref photos, and concept art (`docs/design/characters/refs/`); image cache-busting via `?v=ART_VERSION` + `images.localPatterns`
- [ ] Basic sound hooks (optional, cheap with framer-motion already present)
- [x] Mobile layout pass — **reframed 2026-08-18 (ruling #107): mobile is the default posture, not a late pass.** Everything built from here is authored at 390×844 first and desktop second. **Swept 2026-08-21**, and the debt list above turned out to be wrong in both directions: gacha and archive were already close (the `vh` sweep had landed, chips were `min-h-11`), while the two real problems weren't named at all — `components/ui/button.tsx` had **five of nine sizes under 44px including `default`**, and every mechanic keyword in the game sat behind a hover-only `Tooltip` on a `<span>`, i.e. invisible on a phone. Both are fixed in the primitives and pinned by `tests/touchTargets.test.ts` (rulings #119–120). Nav, hub, gacha, archive, orders, world boss, team select and battle's controls all swept. **Still open: battle *layout* only** — see below.
- [ ] Battle screen user-friendliness overhaul — **[Tanveer]** scheduled after all mechanics work as expected (his call, 2026-07-11)
- [x] **Battle layout at 390 — decided and built 2026-08-21** (ruling #118, which folded battle into the general pass and retired the "own dedicated session" line that stood here). Mockup first per #106, then his four calls, all shipped the same day: the **56px control rail became a bottom sheet** behind one Controls button, with only Skip and Speed left in the open; **hand cards floor at 56px** (`min-w-14`) so the row that was always `overflow-x-auto` finally overflows instead of squeezing eight cards into 43px slivers; **merge arms from the card's own button** and commits on a tap, keeping drag for desktop; the unit tile's **effect strip became a readout** and **focus-fire moved onto the portrait at 44px**. The event ticker was cut — *"if someone needs to know what happened then they can just check the log."* And his own find, which the audit had missed: the card preview was hover-only, so on a phone **there was no way to read a skill in battle at all** — press-and-hold now opens it. `docs/design/mockups/battle-mobile.html` is the record of the decision. **Not browser-verified.**

## Phase 3 — Content & Story Mode

- [x] Kit intake pipeline (2026-07-07): template at top of `newchars.md`; implemented kits move to `data/characters/*.json` and leave the file
- [x] Seras kit (2026-07-07) + new systems: type advantage chart, evade, Shock, CRITICAL
- [x] 7DS collab trio Meliodas/Ban/Diane (2026-07-07) + new systems: crit chance, counter stances, Extort, Extort Life max-HP shred, Attack Seal, Giant's Will ramp, Rupture, lifesteal; effective-stats fix (buffs/debuffs now real)
- [x] Species/synergy tags across the full roster (2026-07-07)
- [x] Literal effect durations engine rework, ruling #21 (2026-07-11)
- [x] HxH collab trio Gon/Killua/Leorio (2026-07-11) + new systems: buff-before-hit, gainUltGauge, rank-gated stun, Bleed, statShiftAfterAttacks, characterSynergy
- [x] Tanveer's roster-wide stat rebalance + terse description pass wired in (2026-07-11)
- [x] Archive UX: colored effect pills, typed skill chips, mechanic-driven damage preview for newer kits, sticky topnav (2026-07-11)
- [x] Dokkan wording system (rulings #26–27): tiered raise/lower words, per-skill hover values, phrase-level cancel pills, one pill per effect (2026-07-11)
- [x] Single-ally target selection for rank-gated ally buffs (Leorio) + Kind Hearted Friend badge-collision fix (2026-07-11)
- [x] Pierce generalized to flat 50% DEF ignore; counter-stance damage preview rows (2026-07-11)
- [x] Art v4: HxH trio, Siddiq redesign, Batra kesari rework; Mustafa design approved (2026-07-11)
- [ ] Story mode skeleton: not a flat list — a node-path stage map (Dokkan-style). **UX reference (2026-07-24, 15 screenshots — see memory `toll-stage-map-reference`, `docs/design/references/story-mode-refs/`):** the full Dokkan flow (Chapter → Area → Stage → Difficulty tier → Team Select → loading screen → VS splash → node-path map → per-fight results → stage-clear summary), plus 7DSGC's quest-log chapter archive (cleared/current/locked episode states, per-chapter milestone reward) and a game-modes hub for later. This is the CEILING reference (Dokkan's full 5-layer hierarchy after years of content), not a minimum bar — pick only the layers toll-the-game's actual scope needs (likely Chapter → Stage → node-map, skipping Area/Difficulty-tiers unless replay-at-harder-difficulty is wanted). Real mechanical implication: multi-wave stages need a persistent-HP-across-encounters rule, not full-heal-per-battle like today's single fights.
- [ ] Stage = scripted enemy team + dialogue intro/outro
- [ ] Additional enemy kits — **[Tanveer]** designs kits, code implements
- [ ] Difficulty/stat tuning — **[Tanveer]** (Ban's ATK 40 glass stat-thief statline is intentional; roster-wide numbers may shift in playtesting)

## Phase 4 — Accounts & Ship

- [x] Firebase auth UI (login/profile), persist progress in Firestore (2026-07-11 — `firestore.rules` deployed live; `users/{uid}` carries storyProgress + player state; guest mode without `.env.local`)
- [x] Deploy — **live at https://toll-the-game.vercel.app/**. The Vercel project is linked and **every push to `master` triggers a build automatically**, so shipping is a `git push` (Tanveer, 2026-08-13, correcting a stale claim in these docs that it was never started). The Vercel CLI is not installed locally and isn't needed for this flow.
- [ ] Playtest loop with friends, patch

## Deliberately Out of Scope (for now)

- PvP/multiplayer, gacha/monetization, native apps
- Three.js/PixiJS battle scenes — 2D UI battles are enough to ship
