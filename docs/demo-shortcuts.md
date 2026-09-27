# Shortcuts register

**Who updates this:** any change that adds, moves or removes a client-side
decision about something with value. `project-rules.md` §11 requires the
register, and `decisions.md` (2026-09-27) is why these are allowed for now.

**The exception ends before roadmap item 6 (monetisation) or any public
launch, whichever is first.** This file is that phase's backlog: every row
must be server-side by then.

**Not marked in code yet.** §11 also wants a `// DEMO:` comment at each site,
pointing here. That is queued in `conventions.md`; the 2026-09-27 audit
changed no code.

## Must be torn out: a server-side rule running in the browser

Every row is forgeable today: `firestore.rules` lets a signed-in player write
anything into their own `users/{uid}` document, and a guest's save is
localStorage.

| # | What is decided client-side | Where | Replaced by | Risk if it ships |
| --- | --- | --- | --- | --- |
| 1 | **Gacha pulls, pity and milestone claims**: the roll, the result, the pity bar | `store/playerStore.ts` `pullLimited`, `pullPermanent`, `claimLimitedFirst`, `claimLimitedFinal`, `claimPermanentFinal`; `lib/gacha/` | A server function that rolls and writes the result | Any character, any time, for free, the day pulls cost money |
| 2 | **Currencies**: gems, coin, tickets granted and spent | `grantCurrency`, `grantPayout` (`lib/game/payout.ts`), `grantWorldBossRewards`, `grantAutoClearTickets` | Server-side ledger of grants and spends | Unlimited currency |
| 3 | **Battle outcomes**: who won, and what that pays | The engine runs in the browser (`hooks/BattleProvider.tsx`); `app/events/page.tsx` calls `grantWorldBossRewards` on a win it was told about | Server-verified result, or rewards granted without trusting the client's claim of a win | Rewards for fights never fought |
| 4 | **Stamina**: spending and regeneration against the device clock | `spendStaminaAction`, `spendAutoClearRun`, `lib/game/stamina.ts` | Server time and a server-held bar | Unlimited runs by changing the clock or the save |
| 5 | **Progression**: levels, ascension, ult levels, account XP, rank walls | `levelCharacterTo`, `ascendCharacter`, `levelUpUltimate`, `grantAccountXpAction`, `clearRankWall` | Server-side validation of each spend | Maxed roster without playing |
| 6 | **Bureau Orders claims** (closed since #159) | `claimOrder` | Server-side claim with the goal re-checked | Rewards claimed repeatedly |
| 7 | **The whole save** | `lib/game/cloudSave.ts` writes the document; `firestore.rules` accepts any shape | Rules that validate the document, or server-only writes | Everything above, in one write |

## Safe to build on

Nothing today is a mock behind an adapter: there is no adapter (§9, queued in
`conventions.md`). Seed data and the kit JSON are real content, not
shortcuts.
