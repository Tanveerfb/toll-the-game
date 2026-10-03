# Four-values audit — 2026-10-03

**RESOLVED 2026-10-03: every item was done or superseded the same day, in
the order group 1, then 2, then 3, then 4. His picks are ruling #180, and
#179 for news.** This copy is the record, moved here from `docs/`. Item
1.9 and item 2.15 were superseded when news closed. The file audited the
site against his four values (`AGENTS.md`, #139 and #178): consistency,
modularization, QOL, and less is more.

**How it was made:**
- Five Sonnet agents each took one area. Four opened the screens at 390×844
  in Chromium; one read the shared code.
- Opus merged the results, removed duplicates and spot-checked the claims
  marked ✓ against the code.
- **Every fix below is a proposal. The call is his.**

**Not seen on screen:**
- `/profile`, because a guest is redirected to `/login` on a build without
  Firebase.
- The battle result dialog, the events clear screens, and Orders (closed).

Size: **S** is a line or two, **M** is one component, **L** is
cross-cutting.

---

## 1. Wrong or broken. Fix whatever the style call

| # | Finding | Where | Proposal | Size |
|---|---|---|---|---|
| 1.1 | ✓ **The tutorial says "Drag one card onto its match to merge them."** Touch merges by tapping MERGE and then the partner (#118). A drag fights the hand's scroll. | `lib/tutorial/steps.ts:60` | Reword to the tap flow. | S |
| 1.2 | ✓ **Inventory's empty line says "story clears drop these".** Story was removed (#152). | `components/game/InventoryModal.tsx:170` | Drop the story mention, or the whole line under 3.x. | S |
| 1.3 | **The tutorial coach sits on top of open sheets** (Controls, Log, unit details), and its spotlight frames the wrong thing. | `components/game/battle/BattleCoach.tsx`, `BattleArena.tsx:1464` | Pause the coach while a sheet or dialog is open. | M |
| 1.4 | **Archive "Preview" starts a live, locked battle** against a training dummy, with no warning. Leaving needs a forfeit (#153). | `/archive/character/*`, `PreviewButton` | Rename it ("Test fight"), or confirm first. Whether practice fights lock is his call. | S |
| 1.5 | **A tap on a hand card also opened the explain panel**, which stayed open over the team row for turns. Tap is meant to act and hold to explain (#118). Not certain: it may be a queued preview. | `components/game/battle/Hand.tsx` | Investigate, then show the preview on hold only. | M |
| 1.6 | **Small battle controls:** PICK 36×20, MERGE 47×20, and keyword hints 28px tall, all under the 44px floor. | `Hand.tsx`, `components/ui/KeyworkHighlighter.tsx` | After arming, make the whole card the merge target; pad the keyword hit areas. | M |
| 1.7 | **Duke's Kit Numbers names are cut off** ("FIST OF FLOWING RUI…"), so three skills are unreadable. | `components/game/KitNumbers.tsx:103` | Let the name wrap, or stack the result under it. | S |
| 1.8 | **A guest cannot reach `/profile`**, so volume, inventory and avatar are out of reach without Google sign-in. | `app/profile/page.tsx:93-97` | Render the profile for guests, with a "Sign in" row. | M |
| 1.9 | **Old patch notes still mention Story and "five tabs".** | `content/news/updates/2026-09-01-the-log-shows-effects` | Superseded: news closed (Coming soon) 2026-10-03. | S |

## 2. Shown twice, or stating the obvious (less is more)

| # | Finding | Where | Proposal | Size |
|---|---|---|---|---|
| 2.1 | **Stamina, gems, rank and world level repeat on 3–4 screens**, though the top bar already shows them. Repeats: the Events subtitle, the gacha draw panel ("5,000 GEMS"), the Profile resource row, and the Inventory "Account" section with its invested tally. | `EventsBoard.tsx:88-101`, `BannerScreen.tsx`, `profile/page.tsx:124-205`, `InventoryModal.tsx:106-215` | Remove the repeats. Keep world level once, wherever he wants it. | S |
| 2.2 | **Counts nobody acts on:** "2 / 5 units" on the archive, "14 / 14" on NPCs (never changes), "Locked (19)", "9 entries" on News, "2 of 12 owned" on summon twice, "0 / 4 · 3 on field" on the team picker, the Roster "n/21", and Kit Numbers "3 steps". | `CharacterBrowser.tsx:352-432`, `NewsFeed.tsx:178-186`, `FeaturedSheet`, `BannerScreen.tsx:~274`, `TeamPicker.tsx:262`, `KitNumbers.tsx` | Drop them. **Keep** the Filters badge, which says a filter is on (QOL). | S |
| 2.3 | **Helper sentences:** | | Delete them. Where a rule really needs explaining, put it behind a `Hint`. | M |
| | – "Save a team here to load it in any battle." | `TeamPicker.tsx:299` | | |
| | – The 3-line sub rule under the format toggle | `TeamSelect.tsx:~40-55` | | |
| | – "Any character in the game, owned or not…" | `TeamSelect.tsx:174` | | |
| | – "Pick at least one unit…", which wraps to 6 lines and pushes the Start bar to 130px | `TeamSelect.tsx:414-416` | | |
| | – "Auto spends the cheapest manuals first…" | Growth dialog | | |
| | – "Mute is in the top bar on every screen" | `SoundSettings.tsx:37` | | |
| | – The subtitles on Profile's link tiles | `profile/page.tsx` | | |
| | – The NPC subtitle "Story-only enemies — not part of the playable roster" | `archive/npc/page.tsx:31-33` | | |
| | – "Patch notes and service notices" | `app/news/page.tsx` | | |
| | – The developer paragraph and three perks on Login | `app/login/page.tsx` | | |
| 2.4 | **The Molvarr brief is a wall of text:** three paragraphs (difficulty cap, "bundle above is fixed…", "a ticket skips the fight…"), the yellow "Level 1 at difficulty 1" chip that repeats the chosen difficulty, and NEW/LOCKED on every chip. | `components/game/events/EventBrief.tsx:107-196, 386-392` | Keep "First clear" and "Every clear" plus the lock states. Drop the paragraphs and the chip. | M |
| 2.5 | **The Epic stage says "free, no rewards" three times:** in the arc list caption, the arc alert and the "0 stamina · no rewards" cost line. That clashes with #178 (the clear screen already dropped it). | `EpicArcList.tsx:28`, `EpicArcScreen.tsx`, `EpicStageBrief.tsx:78-84` | Keep the Enter button alone. Keep the "endgame" alert only if he wants a difficulty warning. | S |
| 2.6 | **A name shown 2–3 times on a brief:** "Master Tao" is the title, then the enemy panel, then the "MASTER TAO · LV 20" badge. Molvarr and the trial have the same pattern. | `EpicStageBrief.tsx:56-66`, `EventBrief.tsx:292` | The enemy panel shows art and stats only; drop the badge's name. | S |
| 2.7 | **The pull results end in a tally of zeros** ("0 NEW 0 ULT COIN +0 COIN"), plus "1 of 1, grouped" and "What this summon gave you." | `components/gacha/PullReveal.tsx:~245-270` | Drop all three. | S |
| 2.8 | **The summon sheets repeat themselves:** "Not yet" on 10 of 12 greyed tiles, and Milestone states each reward twice ("500 gems to go", "Rolled for you…", the confirm modal's "495 more gems…"). | `FeaturedSheet`, `MilestoneSheet`/`MilestonePicker`, `ConfirmPullModal` | Let the greyed art and LOCKED do the work. | S |
| 2.9 | **Battle repeats itself:** the Controls sheet shows TURN, ACTIONS, RESOLVED and FIELD, which the screen already shows. The result dialog repeats the "actions resolved" tally. Aura toasts at turn 1 cover the enemy HP bars. | `BattleArena.tsx:~1245, 1394`, toasts | Drop the readouts. Send passive and aura messages to the log only. | M |
| 2.10 | **Home shows each destination twice:** alert tiles ("World Boss ready", the banner, "Unread notices") sit above the matching mode tiles. | `components/HomeMenu.tsx:173-253` | Fold each alert into its tile as a badge. **Conflict:** this is QOL vs less is more. | M |
| 2.11 | **Closed Orders takes the top row of Home** ("Being overhauled"). | `OrdersButton.tsx:51-67` | Show nothing while it's closed, as the nav already does. | S |
| 2.12 | **Event board chips:** "Repeatable" and "2 phases" are record-style. | `EventCard.tsx:128-140` | Keep only the stamina cost on the board. **Conflict:** this is QOL vs less is more. | S |
| 2.13 | **Empty-state lines on Events and Inventory** ("No trials are open to you yet. Climb account ranks…"). **Conflict:** #139 wants empty states; #178 says absence speaks. | `EventsBoard.tsx:~76-120`, `InventoryModal.tsx:195` | One short line, or hide an empty tab. | S |
| 2.14 | **The currency chips stay up during battle.** | `TopNav` with `[data-battle-active]` | Hide them in battle, the way the tab bar already stands down. | S |
| 2.15 | **News and post pages repeat themselves:** a kind badge on every row (only one kind exists), a trailing "→", "N min read", and a standfirst that repeats the feed summary. | `NewsFeed.tsx`, `NewsPostLayout.tsx:78-96` | Superseded: news closed (Coming soon) 2026-10-03. | S |

## 3. One job, several implementations (consistency + modularization)

| # | Finding | Where | Proposal | Size |
|---|---|---|---|---|
| 3.1 | **The Back control is built five ways, with four labels:** "‹ Events", "← Character archive", "Back to the menu", "Back to events" / "BACK TO EVENTS", and "Back to stages". | `EventBrief.tsx:281`, `EpicArcScreen.tsx:49`, `EpicStageBrief.tsx:51`, `archive/character/[cardNumber]/page.tsx:94`, `login/page.tsx:208`, `ClearSummary.tsx`, `events/page.tsx:388,469` | One `components/ui/BackLink`, and one label rule. | M |
| 3.2 | **The selectable tile (picked = yellow slab) is hand-rolled about 8 times**, and the rule is pasted in comments. | `TeamSelect.tsx:85`, `MilestonePicker.tsx:50`, `AccountModal.tsx:118-150`, `TeamPicker.tsx:346,404`, `BannerScreen.tsx:266,317` | A `SelectTile` primitive, or a `selected` variant on `Panel`. | M |
| 3.3 | **Empty states come in three looks and three phrasings** across about 10 files. | `EventsBoard`, `NewsFeed`, `InventoryModal`, `BattleLogDrawer` ×2, `EffectsList`, `BattleArena`, `BannerScreen`, `TeamPicker`, `UnitDetailPanel` | One `EmptyState`, once he rules on 2.13. | M |
| 3.4 | **Chips are hand-rolled although `Badge` exists** (about 14 sites). The skill-type chip is written twice. | `KitDetails.tsx:167`, `SkillDocument.tsx:90`, `BattleLogDrawer.tsx` ×6, etc. | Use `Badge` with a small variant; add one `SkillTypeBadge`. | M |
| 3.5 | **Rewards are formatted three ways**, and ticket plurals exist only in Orders. | `OrdersBoard.tsx:47-70`, `RewardList.tsx:63-95`, `PullReveal.tsx:219` | Move `rewardParts` into `lib/game/` and render it in one `RewardRow`. | M |
| 3.6 | **The rank, cap and clock logic is copied** into TopNav, HomeMenu, Profile and Inventory, so two `Resource` components and two rank bars exist. Home keeps its own copy of the boss's stamina cost. | `TopNav.tsx:93-130, 354`, `profile/page.tsx:46-130`, `HomeMenu.tsx:42`, `InventoryModal.tsx:111` | `lib/game/accountSummary.ts`, `hooks/useNow`, one `RankBar`, and import the cost. | M |
| 3.7 | **The mobile tab bar is hard-coded**, not built from `GAME_ROUTES` (the routes list the docs name as the single source). Its comment says "five slots" but there are four. | `TopNav.tsx:437-444`, `lib/nav/routes.ts` | Derive the tabs from routes with a `tab` flag. | S |
| 3.8 | **One collection, three names:** "Archive", "Your characters" and "Roster". ✓ The Archive icon is the coin glyph, a stopgap from when Story had the book. | `TopNav.tsx:66`, `profile/page.tsx:197,265`, `HomeMenu.tsx:236` | Use one word (his) and give Archive back the `BookOpen` icon. | S |
| 3.9 | **Other words that drift:** Foe/Enemy; "Retry battle / Change team / Quit" versus "Rematch / Change teams / Main menu" for the same jobs; Start battle / Fight / Enter; "Tickets" / "ticket(s)"; some labels typed in capitals, others capitalised by CSS. | `BattleArena.tsx:1397-1450`, Controls sheet, `TeamSelect.tsx:356`, `OrdersBoard.tsx:62` | One word per job. Naming is his. | S |
| 3.10 | **TeamSelect skips the `Screen` shell** (`max-w-6xl`), so the desktop column breaks the capped-width rule. Profile and character pages hand-write their `<h1>`. | `TeamSelect.tsx:165`, `profile/page.tsx:155`, `archive/character/...:160` | Use `Screen` and `SectionHeader`. | M |
| 3.11 | **Home and Profile build the same navigation tile twice** with different padding. | `HomeMenu.tsx:29-133`, `profile/page.tsx:233-262` | One `NavTile`. | M |
| 3.12 | **Three collapsible header rows are raw buttons.** | `Deck.tsx:316`, `EffectsList.tsx:549`, `SubstatDrawer.tsx:34`, `BattleLogDrawer.tsx:380` | A `DisclosureRow` or shadcn `Collapsible`. | M |
| 3.13 | **Sheets are used unevenly:** gacha wraps them in `PanelSheet`, while battle and archive call the raw primitive. Growth is a centred dialog but Filters is a bottom sheet. Login's unicode "←" differs from the other back arrows. | various | Promote `PanelSheet` into `components/ui`; he decides Growth's shape. | M |
| 3.14 | **About 14 one-off sizes** (`max-w-[112px]` three times, the drawer's `w-[360px]`, and others). | `BattleArena.tsx:80,1121,1162`, `BattleLogDrawer.tsx:332`, … | Make the repeated ones tokens. | S |

## 4. Missing affordances (QOL)

| # | Finding | Where | Proposal | Size |
|---|---|---|---|---|
| 4.1 | **The team picker has no search, sort or filter for 43 characters**, and two Dukes differ only by a cut-off subtitle. | `components/game/TeamPicker.tsx` | Reuse CharacterBrowser's search, sort and filters. | M |
| 4.2 | **Archive sort is ATK, DEF and HP only.** The search hint says "Query name, id, tag", showing players the word "id". | `CharacterBrowser.tsx:63-69` | Add a level sort, and change the placeholder to "Search". | S |
| 4.3 | **The battle header says "HAND 6" for the enemy's hand** with no side label. | battle HUD | "Enemy hand", or show pips only. | S |
| 4.4 | **The confirm modal has both X and Cancel.** It shows a currency preview on every 5-gem pull. | `ConfirmPullModal.tsx` | Keep one close control. The preview for a single pull is his call. | S |
| 4.5 | **No skeleton component exists.** "—" is the loading placeholder everywhere. | `profile/page.tsx:114`, `TopNav` | Confirm "—" is his accepted loading state, then record it in `conventions.md`. | S |

---

**Checked and fine:**
- No horizontal scroll at 390px on any screen.
- Top-level controls are ≥44px outside battle.
- `BattleLock` and the layout are clean.
- No raw hex colours.
- Dialogs go through `MountedDialog`.
