# Status — 2026-07-12

Living snapshot. History of the resurrection audit is in git (`docs/STATUS.md` @ `c3040f7`).

## Working (implemented, tested, browser-verified)

- **Battle engine** — full phase state machine, 3-actions-per-turn enemy AI (random living field enemy each action, decisions from live state), win/loss detection.
- **Rank system** — card rank drives damage multiplier, `*Ranked` mechanic values, and `aoeRanked` activation; flat mechanic values stay flat; ultimates rank-immune.
- **Deck (7DS GC rules)** — hand never resets; pure-random one-at-a-time refill with auto-merge on adjacent identical cards (+1 ult gauge per merge); ult guaranteed only if gauge was full BEFORE the refill; deck locked outside `PlayerAction`; empty-hand auto-pass.
- **Sub units** — battle format 4v4 (all field) or 3v3 (4th member auto-sub); sub passive active from bench, no cards, untargetable; promoted at new-turn start after a teammate dies; lone subs auto-convert to field.
- **Character kits** — 16 JSON kits incl. Duke's full Flowing Ruin, Seras (Shock/CRITICAL/Charged), the 7DS collab trio: Meliodas (Deathblow crit ramp, Full Counter stance, stance/buff-cancelling ult), Ban (Lifesteal, Extort stat-steal, Extort Life max-HP shred), Diane (Rupture, rank-gated Attack Seal, Giant's Will ATK ramp), and the HxH collab trio: Gon (buff-before-hit Rock, self ult-gauge fill, Rookie Hunter stat flip), Killua (stance-cancel + rank-gated stun, Detonate), Leorio (rank-scaling team buff, Pierce + Bleed, Kind Hearted Friend character synergy). Tanveer's roster-wide stat rebalance (2026-07-11) is live.
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
- **Enemy action count (ruling #39)** — 1 action per living field enemy, max 3, instead of a flat 3.
- **KHF extra fades after death (ruling #24 fix)** — queue items can set `runWhenDead` so cleanup-style rechecks still run for a dead source; Kind Hearted Friend's +10% extra now fades from survivors when the trio dies (found in Tanveer's saved battle log).
- **Victory fizzles the queue (ruling #43)** — leftover queued cards are discarded the moment the last enemy dies; no Momentum or gauge from post-win cards.
- **Zero-value clauses hidden (ruling #44)** — rank-1 Lightning Palm doesn't mention its stun, rank-1 Rush Rock doesn't mention Attack Seal; the clause appears at the rank where the value is real.
- **Confirmed by Tanveer 2026-07-11** — identical tag synergies stack per carrier (ruling #40); cancel-then-hit order (ruling #41); DoT ticks unaffected by damage modifiers (ruling #42).
- **Battle log dump** — SAVE BATTLE LOG on the victory/defeat overlay writes teams + the full event log to `<project>/battle-log/` via `app/api/battle-log` (gitignored, playtest debugging).
- **Type-safe mechanics (STATUS #7 closed)** — `Mechanic` is a discriminated union of 42 per-type interfaces (`types/mechanic.ts`); narrowing on `type` exposes exactly that mechanic's fields. `Character.passive` is a typed `Passive` with a `PassiveTrigger` union (`types/passive.ts`); runtime buff/debuff entries are `StatusEffect`. Zero `any` left in lib/hooks/store/components/app. The Zod schema now rejects unknown mechanic types AND unknown passive triggers at load — a typo'd kit fails with the character id and path before a battle ever starts. One documented boundary cast where validated kit JSON becomes typed data (BattleProvider).
- **Battle HUD redesign (STATUS #20, first pass — Tanveer's picks 2026-07-12)** — single-viewport layout, no page scroll: slim status strip (turn/phase/progress/speed/log), enemy row + player row of portrait-first unit tiles (art fills tile; overlaid HP bar, 5-segment ULT pips, ▲/▼/◆ counters with tooltip, Sub/Target/×N badges, DOWN stamp), event ticker above an always-visible deck dock (collapse toggle removed), queue rendered as compact chips beside Reset Hand, full log in a slide-over drawer (Actions only / All events filter). TopNav pinned to h-11 so the battle shell sizes to `100dvh - 2.875rem`; BattleArena root must NOT set a z-index (it would trap the fixed drawer/modals under the sticky TopNav's z-50).
- **Battle cinematics (STATUS #20, Tanveer's Tier-3 pick 2026-07-12)** — engine emits structured `BattleActionEvent`s (`types/battleEvent.ts`; per-target damage/heal/evade/crit/kill + exact hpBefore/hpAfter, counters) via an optional `emit` param on `executeSkill`; UI never parses log strings. `useBattleSequencer` replays them ~700ms/action (÷ battle speed): attacker ghost lunges to target, color-tinted impact flash + tile shake, damage/heal/evade/counter floaters, HP bars drain at the impact moment via display-HP overrides (store state is already final underneath). Ultimates get a full-width cut-in banner (character art + skill name, ~900ms) before the hit. Skip button jumps to final state; victory/defeat overlay is held until playback ends (covers the overkill-skip ask). Action lines removed from the toast overlay (sequencer + ticker own them); DoT/passive toasts remain. `prefers-reduced-motion` disables shake/dodge keyframes.
- **Story mode (Dokkan-style, Parts 1–2 playable — Tanveer's picks 2026-07-12)** — `/story`: part banners (cover art, tagline, cleared count; Parts 3–6 listed as coming soon) → chapter list → VN scene reader (`components/game/StorySceneReader.tsx`: portrait left/right, name plate, tap/Enter/Space to advance, Skip) → canon-locked battle (reuses `startCustomBattle` + the practice battle shell) → outro → next chapter unlocks. Chapter flow: intro scenes → battle → outro scenes; strict sequential unlock (first chapter free, each next needs the previous, next part needs the previous part's last chapter). Data: `data/story/part1.json` (Rawspent and Ledger, 4 chapters, Duke solo vs raiders/wild beasts/road bandits) + `part2.json` (Lyra, 2-stage Duke-vs-Lyra canon fight), adapted from the Arc One beat sheets; validated at load by `lib/game/storySchema.ts` (Zod; unknown character/portrait ids fail with part+chapter id). Progress: `store/storyStore.ts`, zustand persist to localStorage + best-effort Firestore mirror (`storyProgress/{uid}`, union merge) for signed-in users. Battle result screen swaps to CONTINUE STORY / RETRY BATTLE / BACK TO CHAPTERS via BattleArena's optional `story` prop; practice overlay unchanged. Enemy-only kits (`raider`, `road_bandit`, `wild_beast`, approved by Tanveer) carry `storyOnly: true` and are hidden from team select + archive via `getPlayableCharacters()`. MAIN STORY menu button enabled; Story link added to TopNav. Gotcha: the scene reader root is a div, not a `<button>` — the Skip button nests inside (button-in-button = hydration error), and `onFinish` must not fire inside a `setIndex` updater (setState-during-render).
- **Tests** — 156 across battle event emission, combat rank, Flowing Ruin, AI, debuff skills, damage formula, ticks, subs, deck flow, Seras, 7DS kits, HxH kits, description placeholders, ally targeting, lethal survival, effects/links, playtest-2 regressions, kit schema validation, story schema + sequential unlock.

## Open Issues

| # | Issue | Where | Severity |
|---|---|---|---|
| 6 | Ultimates have no rank while skills rank up — confirmed intended for now; Tanveer may add an ult level-up system later | `types/ultimateCard.ts` | Design note |
| 13 | Art nitpicks: Seras's horn-like hair tufts didn't render; Yalina's side braid renders as loose side curls (trigger-word/style limits — see ART_PIPELINE trigger-word table) | `public/characters/` | Cosmetic (re-roll) |
| 14 | Design feedback 2026-07-11: Mustafa approved; Siddiq redesigned (v2, still AI-invented — awaiting his sheet); Batra reworked per his direction (turban/beard/kesari, no armour). He loves Lyra/Sara/Gabrist; Duke/Yalina/Seras fine for now, iterate later | `docs/ART_PIPELINE.md` | Pending input |
| 20 | Battle screen overhaul: layout pass + cinematics (lunge/impact/floaters/ult cut-ins/skip) shipped 2026-07-12. Remaining: mobile pass; possible polish per playtest (per-skill VFX flavors, sound hooks) | `components/game/*` | In progress |
| 21 | Enemy AI decision quality (target/skill choices) needs tweaking — future batch per Tanveer (playtest 2) | `lib/game/ai.ts` | Planned |

Closed: #17 ("Permanently" = cancel-proof, ruling #37), #19 (damage-modifier stats wired, ruling #36), #16 (zero clauses hidden, ruling #44), #15 (firestore.rules deployed live via Firebase MCP 2026-07-11 — cloud saves work for signed-in users; minimal `firebase.json` added), #7 (Mechanic discriminated union — see Working).

## Not Built Yet

- Story Parts 3–6 (source beat sheets exist; listed as coming soon on `/story`)
- Player progression/collection (playerStore is a stub; profile shows account only)
- ~10 additional characters (Tanveer adds when game is in working order)
- Mobile layout pass, sound
- Deployment (Vercel target; Firebase project `toll-the-game` exists for auth/Firestore)

## Environment

- Node 24, Next.js 16.2.10, React 19.2.7. Majors deliberately held: TypeScript 5.9 (not 6), ESLint 9 (not 10) — Next 16 support unconfirmed.
- Known `npm audit` leftover: postcss <8.5.10 nested inside `next` — upstream.
- Firebase env in `.env.local` (gitignored); pullable via Firebase MCP from project `toll-the-game`. App runs guest-mode without it.
- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` for art generation.
