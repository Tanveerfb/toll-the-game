# Roadmap — Ship the Card Game

Solo dev + AI tooling. Ordered so every phase ends with something runnable. Mechanic/balance decisions marked **[Tanveer]** per division-of-labor rules.

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
- [ ] Card art integration — character portraits on cards/arena (`D:\Projects\element_clash_assets`)
- [ ] Basic sound hooks (optional, cheap with framer-motion already present)
- [ ] Mobile layout pass

## Phase 3 — Content & Story Mode

- [ ] Story mode skeleton: linear stage list (Dokkan-style stages)
- [ ] Stage = scripted enemy team + dialogue intro/outro
- [ ] Additional enemy kits — **[Tanveer]** designs kits, code implements
- [ ] Difficulty/stat tuning — **[Tanveer]**

## Phase 4 — Accounts & Ship

- [ ] Firebase auth UI (login/profile), persist progress in Firestore
- [ ] Deploy (Vercel free tier fits Next.js 16; Firebase Hosting alternative)
- [ ] Playtest loop with friends, patch

## Deliberately Out of Scope (for now)

- PvP/multiplayer, gacha/monetization, native apps
- Three.js/PixiJS battle scenes — 2D UI battles are enough to ship
