# Game audit — 2026-10-13

**Who updates this:** nobody. It is a dated snapshot, like the audits before
it (`docs/archive/FOUR_VALUES_AUDIT-2026-10-03.md`,
`Plans/2026-09-26-foundation-audit.md`). Findings he accepts move to
`docs/issues.md` or a plan; the rest stay here as the record. Move it to
`docs/archive/` once every row is either filed or declined.

**What he asked for:** *"act as a senior game developer… see what the issues
are… do audit and then come back to me."* Plus two jobs that are reported
separately: the theme redesign (`docs/design/mockups/theme-options.html`)
and the fleet-standard sync (`conventions.md`, `decisions.md`).

**How it was made.** One cloud session, read-only against commit `09bf9a3`.
Three areas were read by three agents (engine and state; the player-facing
flows and economy; security, ops and dependencies), then merged, de-duplicated
and the critical claims re-read by hand. The earlier audits are not repeated:
file sizes, the missing data adapter, the missing transition maps,
client-side authority (a granted exception), and the duplicated readouts the
four-values audit already fixed.

**Evidence levels.** *read*: traced in the code, with the file and line.
*measured*: a number taken from the data or a command. *reproduced*: seen
running. **Nothing below was reproduced in a browser**; no screen was opened
this session. The baseline was run: `npm run check` **1,675 passed / 137
files**, exit 0. A scratch `next build` **could not complete in this
container** because `next/font/google` cannot fetch Google Fonts through the
sandbox proxy; that is the container, not the code (the last checkpoint's
build was clean).

**The owner owns design and numbers (#139).** Every direction below that
touches a number, a reward, a rule or a screen is a question to put to him,
not a change to make.

---

## The headline

The engine is sound and well-guarded; the audits before this one did their
job there. The two things that are not sound sit either side of it:

1. **The cloud save is the weakest system in the game**, and it is the one
   thing that must not lose a player's progress. One confirmed defect breaks
   it outright for any signed-in player who clears an Epic Battles stage
   (finding 1), and four more paths lose or overwrite progress silently
   (findings 2–5). None of this is covered by the client-authority exception:
   that exception is about forgery, not about losing honest progress.
2. **The game has about two hours of content and no reason to come back on
   day two.** Day one hands over most of the roster (finding 6), the gem
   income after that is 375 for life (finding 7), nothing resets daily, six
   released characters cannot be obtained at all (finding 8). This is not a
   bug list; it is the shape of the beta, and he has said he is building PvE
   content before anything else. It is written down so the order of that work
   can be chosen against it.

Everything else is medium or low, and most of it is one session each.

---

## Part 1 — Must fix: the save

### 1. Cloud save breaks permanently after the first Epic Battles clear · **critical** · read

`lib/game/epicClears.ts:39` stores `teams: string[][]` (an array of arrays)
and `lib/game/cloudSave.ts:47` lists `epicClears` in `CLOUD_FIELDS`, so
`cloudDocument` copies it verbatim into the Firestore write. **Firestore
rejects nested arrays** ("Nested arrays are not supported"). From the first
epic clear with a non-empty team, every `setDoc` throws; `hooks/AuthProvider.tsx:145-147`
catches it with `console.error` and the player is never told. The first-login
seed (`:94`) throws the same way, so `uid` is never set.
`tests/cloudSave.test.ts:55` even uses `teams: [["duke","lyra"]]` as a
fixture, but only exercises the patch logic, so nothing checks that the
document is Firestore-serialisable.

**Not reproduced against Firestore** (no account in this container); the
constraint is documented Firestore behaviour and the shape is confirmed in the
code.

**Direction:** store each team as one key (`"duke|lyra"`) or `{ ids: [] }`,
with a v11 migration; add a test that walks `cloudDocument()` and fails on a
nested array or `undefined`; show save failures in the UI instead of logging
them. **One session.**

### 2. Any stale tab or device overwrites the cloud with its whole snapshot · **high** · read

`hooks/AuthProvider.tsx:140-144` writes every cloud field from local state
with `{ merge: true }`: a field-level merge of a possibly stale document, so
it is last-writer-wins for everything. The cloud is read once per auth change
(`:64-97`); there is no `onSnapshot` and no `storage` listener across tabs.
Phone and PC, or two tabs on one phone: whichever acts last writes its old
roster, currencies, pity and inventory over the new one.

**Direction:** write only changed fields (a diff against the last saved
snapshot) and subscribe with `onSnapshot`, applying `cloudPatch` on remote
change; a `storage` listener closes the two-tab case.

### 3. A failed first read seeds the cloud with starter defaults · **high** · read

`hooks/AuthProvider.tsx:67-110`: if `getDoc` throws (offline on a fresh
device, no persistence enabled), the catch logs and falls through.
`setUser` already ran at `:65`, so the auto-sync subscriber (`:158-177`) is
live, and the next store change, for example `rememberLastTeam` on any battle
launch (`app/events/page.tsx:235,257`), writes a full document of
`DEFAULT_PLAYER_STATE` over the real save.

**Direction:** a `cloudReady` flag set only after a successful read or seed;
the subscriber returns early until then; a visible "cloud save unavailable"
state.

### 4. Sign-in replaces guest progress silently; sign-out deletes it · **medium** · read

`lib/game/cloudSave.ts:85-95` applies every field present in the cloud
document over local state, with no prompt and no newest-wins;
`app/login/page.tsx` carries no warning; `hooks/AuthProvider.tsx:115-118`
then `resetPlayerState()` on sign-out. A guest who pulled characters, signed
in to an existing account and signed out again has lost them twice.

This may be the intended policy. It is undocumented, and the login screen
says the opposite ("bank your progress").

**Direction (his call):** when both a non-default local save and a cloud
document exist, ask which to keep; at minimum say so on the login screen.

### 5. The last 1.5 s of progress is dropped on sign-out and on tab close · **medium** · read

`hooks/AuthProvider.tsx:169-171` debounces the write by 1,500 ms; the
cleanup clears the pending timer when `user` flips to null, `logout()`
(`:199-203`) does not flush first, and no `pagehide` / `visibilitychange`
handler exists. A pull followed by closing the PWA never reaches Firestore,
and on the next open the older cloud copy wins (finding 2 again).

**Direction:** flush the pending write inside `logout` and on
`visibilitychange === "hidden"`.

### Also in the save, lower

- **Sign-out does not clear the persisted battle**, so a won boss fight pays
  the next account that signs in on that device (`hooks/AuthProvider.tsx:117`
  resets only `playerStore`; `BattleLock` routes the next player to the claim
  screen). Medium, read. Direction: `resetBattle()` in the sign-out branch.
- **A corrupt or hand-edited save bricks the UI silently.** Persisted data is
  cast, never parsed (`store/playerStore.ts:329-360`); if `migratePlayerState`
  throws, `hasHydrated` never flips and `/events` renders an empty screen
  forever. `AGENTS.md` invites editing `toll-player-storage` by hand, so this
  input is expected. Medium, read. Direction: a zod schema with per-field
  defaults inside `migrate` and on the cloud read; set `hasHydrated` in the
  error branch; keep a backup key.
- **The persisted battle has no schema version** (`store/gameStore.ts:956-1032`).
  Every push auto-deploys; a reload mid-fight after a deploy resumes units
  built by old code. Low. Direction: `version` plus a `migrate` that drops a
  mismatched battle.

---

## Part 2 — The game: loop, content, economy

All numbers measured from the data and constants on 2026-10-13; the day-one
simulation is `scratchpad/econ.py` in the session, not in the repo.

### Content inventory

| Item | Count | Evidence |
| --- | --- | --- |
| Character kit files | 35 | `data/characters/` |
| Enemy-only (`storyOnly: true`) | 14 | grep |
| Unreleased (hidden on deploy, #171) | 3: blue_lyra, caila, green_duke | `characterCatalog.ts:211-218` |
| **Playable, released** | **18** | `CHARACTERS_WITH_ART` |
| Obtainable by gacha | **12** (the banner's featured) | `data/banners/debut-2026-08.json` |
| **Playable but unobtainable** | **6**: ban, diane, gon, killua, leorio, meliodas | finding 8 |
| Gem banners | 1, permanent, 5 % featured | `lib/gacha/banners.ts` |
| Ticket banner pool | 0 characters, tab hidden | `banners.ts:313-318` |
| World bosses | 1 (Molvarr), 4 tiers, **tiers 2–4 placeholder rewards** | `worldBossRewards.ts:155-158` |
| Trials | 2 authored, **1** with an encounter | `events.ts`, `trialEncounters.ts` |
| Epic arcs / stages | 1 / 2, no stamina, no rewards | `data/arcs/exam-arc.json` |
| Enemy kits in live content | 7 of 14 | trial and arc data |
| Orders | 16 authored, closed (#159) | `ORDERS_OPEN = false` |
| News | 0 posts, "Coming soon" (#179) | `lib/news/open.ts` |

Honest content: about **1.5–2 hours** of distinct play. After the rank-20
trial, everything is repetition of Molvarr.

### The core loop, traced

Day one from the hub: Orders renders nothing, so six tiles. The new player
owns Duke and 1,000 gems. Gacha is 50 gems a multi, so **20 multis on day
one**, crossing both milestones: roughly 9 of the 12 featured units owned,
gems at 0. Then Molvarr at 40 stamina: each clear pays 100 account XP, every
rank-up refills stamina to 120 and pays 5 Auto Clear tickets, so one full bar
chains into **24 clears and rank 13 with no regen** (issue #23, which he
accepted). Day two: the rank-20 wall and the First Ascension Trial. Day seven:
Molvarr at world level 1–2 is the only repeatable fight, Epic stages pay
nothing, the Second Trial reads "Encounter not authored yet", and gem income
is whatever the first clears paid.

### 6. Day one consumes the gacha · **critical for retention** · measured

1,000 starter gems at 50 a multi is 220 pulls on day one, which also triggers
both milestone claims. Nearly the whole obtainable roster arrives before the
player has fought once.

**Question for him:** is 1,000 the beta's deliberate "try everything" grant?
If the beta is for playtesting kits, yes and this is fine. If it is meant to
feel like the game, the number or the cost is his to pick.

### 7. Gem income after day one is 375 for life · **high** · measured

Every farmable table pays `gems: 0`. The only gem source is Molvarr's first
clears: 50 / 75 / 100 / 150, the last three behind ranks 20 / 40 / 60. Orders
(closed) would have paid 550 + 700.

**Question:** what is the repeatable gem source? He has said missions on Epic
Battles are the plan; that decides this.

### 8. Six released characters cannot be obtained by any path · **critical for the collection** · read

The banner's `featured` has 12 ids; the permanent pool draws from
`permanentPool: true` and no kit sets it; milestone claims pick from
`featured`; no order grants a character. The hub says "1 of 18 owned" and the
Characters screen lists all 18, so a player can see a third of the roster
they can never own. The Permanent Tickets the first clears pay (1/2/3/5) have
no sink for the same reason: the ticket banner's pool is empty and its tab is
hidden.

**Question:** do the collab six (Meliodas, Ban, Diane, Gon, Killua, Leorio)
go into the permanent pool, a second banner, or get hidden from the owned
count until they have a path? Which characters go in `permanentPool`?

### 9. No day-two hook · **high** · read

No daily reset anywhere in `lib/`; no limited banner (by his ruling); Orders
and News closed; Epic stages pay nothing; stamina pressure removed early by
rank refills and tickets. Nothing in the game changes between today and
tomorrow.

**Question:** which comes first: Epic Battles missions, a daily, or reopening
Orders? One of them is the day-two hook; the other two can wait.

### 10. The hub misnames its one real screen, and one tile is a dead end · **high** · read

The tile reads "World Boss / Molvarr" (`components/HomeMenu.tsx:56`) while
the route, nav and tab bar say "Events" and the screen holds three tabs; Epic
Battles and Trials are invisible from the hub. The News tile ("Coming soon")
opens a page that says "Coming soon".

**Direction:** one name through the flow (§NAMING), "Events" with the three
destinations under it; a closed mode is not a tile. Both options in the theme
mockups draw it that way, so this is settled together with the theme.

### 11. Onboarding has no guide outside the battle while Orders is closed · **high** · read

The hub's lead was Orders ("what do I do next"); it renders nothing now. The
tutorial is four in-battle coach marks (`lib/tutorial/steps.ts:48-79`).
Nothing says that stamina pays for Events, that a character must ascend
before it can level at all (`ASCENSION_MAX_LEVEL[0] = 1`), or that the rank
bar stops at 20.

**Question:** what leads the hub during the overhaul, a single "next" pointer
or step 1 of Orders reopened?

### 12. Epic Battles are open at rank 1, authored at level 20, pay nothing, and lock the player in · **medium** · read

Tao NPC 10,500 HP against Duke's 3,150 at level 1; the lock holds through the
defeat card. A day-one player taps the second tab, is wiped, and learns
nothing. **Question:** does a recommended band belong on the stage brief (his
less-is-more call), and when do the stage levels get tuned?

### Also, lower

- **The Second Ascension Trial is reachable and unauthored** (lock reason
  "Encounter not authored yet"; rank 40 is weeks, not years, of daily play).
  Question: author it, or withhold it with `visibleWhen` until it exists.
- **Molvarr tiers 2–4 pay placeholder numbers on the live site**
  (`worldBossRewards.ts:155-158`); world level 2 is reachable on day two.
  Question: author the three tables, or confirm the placeholders stand.
- **Practice fields the whole catalog for free** (both pickers are
  `source="catalog"`), which removes the collection's only stake. Confirm the
  sandbox is meant to be ownership-free.
- **Sign-in copy promises claims that are closed** ("claim what you've
  earned", `app/login/page.tsx:313`).
- **`storyOnly: true` now means enemy-only** on 14 kits. Rename on touch, or
  keep for story's return: his call, since the `types/` migration is on touch.

---

## Part 3 — Engine, ops and dependencies

### Engine (read)

- **Reload during the enemy turn skips the rest of it; reload at the end of
  the player turn gives a second action phase** · medium. `gameStore.ts:1022-1030`
  snaps any non-player phase back to `PlayerAction`; `finishedResolutions` is
  not persisted, so the same turn can be resolved twice. Deliberate as a
  resume strategy, but it is an extra-turn exploit and corrupts turn counts.
  Direction: persist `finishedResolutions`; resume enemy-side phases at
  `OnEnemyTurnStart`, or replay the remaining AI actions headlessly.
- **`executeSkill` mutates its input when Ignite stacks** · medium.
  `combat.ts:369-381` copies the arrays but not the entries; `:1356-1360`
  writes `existing.stacks` on an entry the caller still holds. `effectDiff.ts:21-24`
  snapshots eagerly to defend against exactly this. Direction: replace the
  entry; a purity test that deep-freezes the inputs.
- **Stamina discards up to 4m59s of regen on every spend, and a backwards
  clock eats stamina across devices** · medium. `stamina.ts:33` writes
  `updatedAt: now`, dropping the partial tick; a negative delta clamps to 0 and
  the next spend bakes the loss in, and `stamina` syncs to the cloud.
  Direction: carry the remainder; reset `updatedAt` when `now < updatedAt`.
- **Live battles are unseeded** · low. Every RNG entry point is injectable
  but `BattleProvider` passes `undefined`, so a persisted or reported battle
  cannot be replayed. Direction: mint a seed in `startCustomBattle`, persist
  it, thread one RNG through the four call sites.
- **`AuthProvider` subscribes to the whole player store and republishes a new
  context value every render** · low (`AuthProvider.tsx:31, 206`).

### Ops (read)

- **Sentry ships without source maps** · medium. `next.config.ts` has no
  `withSentryConfig`; crashes from phones arrive as minified frames in a
  hashed chunk, which is the one thing the file says it exists for. The
  "collapse identical events" claim in `lib/sentry.ts:30-31` has no code
  behind it. Direction: wrap the config with `withSentryConfig` and a
  server-only auth token recorded in `docs/environment.md`.
- **The service-worker cache never rotates** · medium. `public/sw.js:31`
  `VERSION = "v1"` never changes, so `toll-assets-v1` keeps every deploy's
  chunks forever; nothing is precached, so the offline branch can never hit.
  The art prefixes it lists are not what `next/image` requests
  (`/_next/image?url=…`), so they cache nothing. Deploys are **not** masked
  (navigations are network-first). Direction: stamp the version from the
  build id, precache `/`, cap entries, fix or drop the art prefixes.
- **`tailwind-variants` is installed and never imported** · low; `cva` is
  the one in use. Direction: uninstall, with a line in `decisions.md`.
- **No `engines` and no `.nvmrc`** · low; §RUNTIME. The deploy runs on
  Vercel's Node; this container is 22. Direction: pin to what the Vercel
  project is set to, in both places.
- **`public/unreleased/` deploys six unlisted art files** (7.4 MB) to the
  public site · low. Ruling #171 hides unreleased content; the folder is
  reachable by path. Direction: move it out of `public/`.
- **Repo weight: 136 MB tracked, 115 MB in `public/`** · low. Direction:
  Git LFS for the character art, or at least the design refs out of git.
- **`@typescript-eslint/no-explicit-any` is switched off** in
  `eslint.config.mjs:57` against §TS; actual use is 4 hits in source, 34 in
  tests. Direction: re-enable for source with a `tests/**` override.
- `.next-verify/` is not in `tsconfig.json`'s `exclude`, which is why a
  verify build dirties `tsconfig.json`. One line.

---

## Part 4 — In good shape

Worth stating so nobody re-audits it: turn resolution claims live in the
store and close the remount double-resolve; reward claims are synchronous and
idempotent (no double grant found on retry or reload); player-save migrations
are complete and chained v1→v10; hydration gating is consistent on eleven
screens; `buildBattleUnit` / `battleStats` is one path and phases use it;
`tick.ts` rebuilds arrays rather than mutating; `firestore.rules` is
default-deny with one uid-scoped match; Firebase is lazy-loaded behind one
cached promise; no credential, key or env file is tracked; Sentry is inert
without a DSN and sends no PII; the full `jsx-a11y` ruleset is on with zero
disables; 137 unit files and 3 browser files with no `.skip` or `.only`; the
Next family is version-aligned; the dev-only API routes are gated on every
verb and write only under gitignored paths.

---

## Part 5 — His decisions, in one list

1. The six collab characters: permanent pool, a second banner, or hidden from
   the owned count? (finding 8)
2. 1,000 starter gems: a playtest grant, or the game? (6)
3. The repeatable gem source, and which day-two hook comes first: Epic
   missions, a daily, or Orders reopened? (7, 9)
4. Sign-in over a guest save: ask, keep cloud, or keep local? (4)
5. What leads the hub while Orders is closed? (11)
6. Author the Second Trial and Molvarr tiers 2–4 now, or withhold them?
7. Practice: ownership-free on purpose? (Part 2, lower)
8. The theme: A, B or C in `docs/design/mockups/theme-options.html`, or
   parts of each. Then the component round (§SHADCN).

## Part 6 — A suggested order

1. **The save** (findings 1, 3, 5, sign-out battle reset): one session, no
   design content, and it is the thing a public player would hit first.
2. **The theme**, once he picks, since the hub fix (10) and the sentence-case
   sweep land with it; then the component round.
3. **Finding 2** (field diff and `onSnapshot`) with the corrupt-save parse,
   as the second save session.
4. **The loop**: his answers to 1–3 above decide the next content session.
5. Ops in passing: `engines`, `tailwind-variants`, `public/unreleased/`,
   Sentry source maps, the service worker version.
