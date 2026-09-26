# Shōnen Ink foundation: one token set, shadcn for every control

> **Progress**
>
> | Phase | What | State |
> | --- | --- | --- |
> | 1 | Tokens, type scale, fonts, primitives, `/dev/ui` gallery | **done 2026-09-26**, browser-checked at 390px |
> | 2 | The shell: nav, tab bar, `Screen`, `SectionHeader` | **done 2026-09-26**, browser-checked at 390 and 1280px. `Panel` and the home hub moved to phase 3: both hold screen content |
> | 3 | Screens, one per pass | **done 2026-09-26.** Home hub, archive, events, team select, profile & login, gacha, news, in his order, each browser-checked except the signed-in profile page. Old-theme uses: 1,294 in 76 files at the start, **~345 in 17 files** after (battle, plus `DetailOverlay`, `card`, `Panel`'s legacy surfaces) |
> | 4 | Battle: mockups first, then the arena | not started |
> | 5 | Retire Combat Terminal, and the guards that keep it retired | not started |

**Asked for 2026-09-26.** Tanveer: *"we are working on keeping the css and
component foundation right. only work with shadcn, customize them and use them
for the project purposes. and also we need a design motif for the game too."*
He picked **Shōnen Ink** from four drawn options (ruling #154). The rules and
values are in `docs/design-system.md`; this file is only the order of work.

## ⚠ A push mid-migration ships a mixed look

Every phase changes what the live site looks like, and **a push to `master` is
a production deploy.** Once phase 1 lands, the primitives are Shōnen Ink while
most screens still paint Combat Terminal: yellow buttons on dark cyan panels.
That is expected mid-migration, and it is his call when to push. Say so at
every `git checkpoint` until phase 5.

## What was measured before starting

| | count |
| --- | --- |
| Combat Terminal token uses (`bg-panel`, `text-readout`, `border-edge`, `chamfer`…) | **1,294 in 76 files** |
| Hard-coded font sizes (`text-[10px]`…) | **304 in 61 files**, 9 distinct values |
| shadcn primitives installed | 11 |
| Hand-built overlays (`fixed inset-0` / `role="dialog"`) | 9 files: `ModalShell`, `PullReveal`, `DetailOverlay`, `BattleArena`, `CharacterBrowser`, `BattleCoach`, `BattleLogDrawer`, `UnitDetailPanel`, `app/profile/page.tsx` |
| Hand-built tab set | 1: `CharacterProgressionPanel` |
| Hand-built toggles (`role="switch"` / `aria-pressed`) | 11 files |
| shadcn's own tokens (`--background`, `--primary`…) | **stock greyscale and unused**, while screens paint from a second hand-made set |

Heaviest files by token use: `UnitDetailPanel` 51, `BattleArena` 50,
`TeamPicker` 33, `profile/page` 33, `BannerScreen` 32, `BattleLogDrawer` 31,
`TeamSelect` 28, `CharacterBrowser` 26, `KitDetails` 24.

## Phase 1: the foundation

1. **Tokens.** shadcn's semantic names carry the motif (`--background`,
   `--card`, `--primary`, `--border`…), plus the few the game needs that
   shadcn has none for (`--ground-*`, `--halftone`, `--slab`). **One token
   set.** The Combat Terminal tokens stay defined, marked legacy, until phase 5
   deletes them.
2. **Type scale.** `text-micro` 9px, `text-label` 10px, `text-caption` 11px
   in `@theme`. Tailwind's own steps from 12px up.
3. **Fonts.** M PLUS 1p replaces Rajdhani as `--font-body`. Bangers stays.
   **Risk:** M PLUS 1p is wider, so fixed-width rows (the 47px hand card, unit
   tiles, resource chips) may overflow. Browser-check them at 390px.
4. **Primitives** paint from the semantic tokens only, never a Combat Terminal
   name: `button`, `badge`, `card`, `input`, `select`, `slider`, `progress`,
   `table`. Added from shadcn and customised: `tabs`, `switch`,
   `toggle-group`, `dialog`, `sheet`, `popover` (`Hint` moves onto it).
5. **`/dev/ui`**, development only (his pick, 2026-09-26): every primitive in
   every variant, on the ground and on paper.
6. **Guard:** a test that no file in `components/ui/` references a Combat
   Terminal token. Prove it fails first.

### Phase 1 as built (2026-09-26)

- **Tokens:** shadcn's names carry the motif in `:root`. The stock `.dark`
  block, the `dark` class on `<html>` and the unused sidebar/chart tokens are
  gone; the game has one theme. The treatments are `@utility` classes:
  `ground-halftone`, `ink-slab`, `ink-slab-sm`, `ink-slab-primary`,
  `ink-skew`, `speed-lines`.
- **Migrated primitives:** `button`, `badge`, `input`, `select` (stock
  semantic already), `slider`, `progress`, `Hint`.
- **Added from shadcn:** `tabs`, `switch`, `toggle`, `toggle-group`,
  `dialog`, `sheet` (bottom by default), `popover` (`Hint` now builds on it).
  **The CLI wrote `import { cn } from "cn"` into all seven and installed an
  unrelated npm package called `cn`**; both were undone, and
  `tests/uiTokens.test.ts` now fails on that import.
- **`/dev/ui`** returns 404 in a production build (checked against
  `next start`).
- **Guard:** `tests/uiTokens.test.ts`. Every `components/ui/` file is either
  MIGRATED (no Combat Terminal token, no pixel font size) or PENDING (must
  still contain one). Proven red by planting `bg-panel` in `tabs.tsx`.
- `npm run check` 1,501 + 1 skipped / 123 files, `test:browser` 17 / 3,
  `next build` clean.

**What every existing screen now shows, before its own pass:** M PLUS 1p for
all body text; yellow, skewed primary buttons; paper hints; square corners
wherever `rounded-*` was used; ink as the default border colour.

**Browser-checked 2026-09-26** on a scratch dev server (`verify-dev` in
`.claude/launch.json`, port 3210, `.next-verify`), at 390x844:
- **No page scrolls sideways** and no text is clipped on `/`, `/events`,
  `/practice`, `/archive`, `/gacha`, `/news`, `/login`, `/dev/ui`.
- **One regression: hand-card skill names.** M PLUS 1p is about 25% wider
  than Rajdhani at 9px (canvas-measured side by side). Long names were
  already truncated; short ones that used to fit now truncate too:
  *Shatterburn* 45 → 56px, *Flash Point* 41 → 51px, on a 44px card.
  **Fixed the same day, his pick "Two lines on cards"** (an option label,
  not his words): `Hand.tsx` clamps the name to two lines with
  `hyphens-auto`, so *Shatterburn* reads *Shatter- / burn*. Measured in a
  live fight: card height unchanged at 108px, and only the two
  *Fist of Flowing Ruin* names still clamp.
- Truncated names on the character page (*Fist of Flowing Ruin : Slide*)
  are in Bangers, which did not change: they predate this work.
- On `/dev/ui`: the active tab and primary button compute to the intended
  paper/yellow, skew and slab. The dialog traps focus, closes on Escape and
  returns focus. The sheet opens full-width from the bottom edge. Every
  control is 44px or more, except the inline hint word (the known exception).
- **Screenshots from the browser pane were not usable for layout**: they
  crop the emulated viewport, which made correct text look clipped.
  Geometry was measured in the page instead.
- The battle lock (#153) held every navigation on `/practice` until the
  fight was forfeited, which is its first check in a browser.

## Phase 2: the shell (done 2026-09-26)

- **`TopNav`:** a solid ground bar with a 2px rule. The blur is gone
  (excluded by the motif), but the tab bar's portal stays, because the next
  filter added to the nav would bring back the bug it exists for. The
  wordmark is a skewed paper label on a yellow slab. Desktop route links take
  the tab treatment.
- **The nav chips:** counters, Orders, rank, world level and avatar are all
  `NAV_CHIP` (`components/ui/navChip.ts`), the secondary button at `sm`. It is
  one definition and lives in its own file because `TopNav` renders
  `OrdersButton`. Only the nav variant of `OrdersButton` moved; its home-tile
  variant goes with the home hub.
- **The bottom tab bar** is a paper strip with an ink rule. The active tab is
  a yellow fill.
- **`Screen`** paints `ground-halftone`. That is safe before the screens
  migrate: both grounds are dark, so light text still reads.
- **`SectionHeader`:** `page` is the loud treatment (skewed paper title,
  yellow eyebrow). `panel` and `block` print in their surface's colour, so
  they read inside a dark legacy panel now and a paper one later.
- **`AudioControl`** is the outline icon button.
- **Found and fixed on the way: `cn` was dropping classes.** tailwind-merge
  took `text-micro`, `text-label` and `text-caption` for colours. The
  secondary button (every nav chip) lost its ink, and every badge lost its
  size. `lib/utils.ts` registers the three sizes; `tests/cn.test.ts` was red
  against the old `cn` and green after.
- **`tests/layoutSystem.test.ts`'s shell guard** now recognises the halftone
  ground as well as the grid, so it did not go blind the day `Screen`
  switched. Proven by planting `"ground-halftone min-screen-below-nav"` in
  `app/news/page.tsx`: red, then restored.
- **Measured in the browser:**
  - At 390px, row 1 of the nav fits.
  - The chips are ink on paper, 44px.
  - `--nav-h` matches the rendered bar at one row (46px) and two (94px).
  - No page clips text or scrolls sideways.
  - Desktop row 2 fits at 1280px.

**Moved to phase 3:** `Panel` and `HomeMenu`. Both hold screen content.

## Phase 3: screens, one per pass

Each pass: swap tokens, fold font sizes onto the scale, replace hand-built
controls with the phase-1 primitives, then `mobilecheck` at 390px.

### Home hub (done 2026-09-26)

He picked it first, over the suggested Events.

- **`Panel`** gained Shōnen Ink variants without losing the legacy ones, so
  its unmigrated callers are untouched:
  - `surface="paper"`: ink on paper, a 2px ink outline.
  - `lift`: `slab`, or `primary` (the yellow slab, meaning "act on this").
  - `press`: a tile that is really a button.
- **Every hub tile is a paper panel** from one `panelVariants` call: the
  alerts, the mode buttons and the Orders tile. A tile that is ready to act
  on (a World Boss run affordable, orders to claim) gets the yellow slab.
- **Orders opens in the shadcn `Dialog`**, no longer `DetailOverlay`.
  - The button is wrapped in `DialogTrigger`. Opened with a bare `setOpen`,
    closing dropped focus onto `<body>`, which the browser check caught.
  - The step tabs are the shadcn `Tabs` (`line` variant). They are 44px
    now; they were about 28px.
  - The order progress bar is the `Progress` primitive. `Progress` is 8px
    tall with an ink outline now, because yellow on the paper track alone
    was too faint.
- **`OrdersBoard` is drawn for paper.** Text is ink. The reward line, the
  claimed tick and the step counts use element hues as FILLS with ink on
  them, not as coloured text.
- **Measured at 390px:**
  - All nine tiles are paper with ink text, and the ready ones carry the
    yellow slab.
  - No clipping, and no sideways scroll.
  - The Orders dialog traps focus, closes on Escape, and returns focus to
    the tile.
- **Not seen:** the step tabs inside Orders. Signed out, the board shows its
  locked view, and signing in in the browser pane was not done. The same
  `Tabs` primitive was checked on `/dev/ui`.
- **`DetailOverlay` is unchanged.** It has 18 other callers whose content is
  still light-on-dark, so it moves with them, a screen at a time.

### Archive (done 2026-09-26)

**Decided first, by mockup:** how kit text highlights on paper. Three options
were drawn (`docs/design/mockups/kit-document-on-paper.html`); he picked the
**marker**, recorded as ruling #155. Values and the full treatment table are
in `docs/design-system.md` → Kit text.

**Built:**
- **Kit text**
  - `KeyworkHighlighter`: marker keywords, heavy-ink numbers, fill arrows.
  - `KitDetails`: `SkillBlock`, `PassiveProse` and `PassiveDetailSections`
    each own a paper card. `PassiveProse bare` skips the card on a host
    that is already paper.
  - `SkillDocument` and `KitPhases`: phase tabs are now shadcn `Tabs`.
  - `skillTypeStyle`: ink on the chip hues, plus a shared `HEAL_NUMBER_CLASS`.
- **`prose.tsx`** is surface-agnostic, so the paper kit document and the
  dark news posts share it.
- **The character page**: identity card, lore and kit document are paper
  panels. The back link and tags are primitives.
- **Kit Numbers**: paper rows, and the shadcn `Dialog`. Focus goes back to
  whichever row opened it, via `onCloseAutoFocus`, since there is no single
  trigger.
- **Growth** (`CharacterProgressionPanel`): the shadcn `Dialog` plus `Tabs`,
  which replaced the game's one hand-built tab set.
  - "Raise to" is a `ToggleGroup`.
  - The four tabs share their states through
    `components/game/growth/growthStyle.ts` (now, next, gain, short, notes).
- **The archive list** (`CharacterBrowser`):
  - Tiles are paper.
  - The filter sheet is the shadcn `Sheet`; the hand-built portal is gone.
  - Chips are the shadcn `Toggle`, filled in the element's hue when on.
  - Filters shows a yellow count badge.
- **Both archive index pages** use `SectionHeader`.
- **New shared pieces:**
  - `SectionHeader size="section"`.
  - The `--color-rule` token.
  - The `ink-marker` utility.
- **Guards:** `uiTokens` gained `prose` and `KeyworkHighlighter`.
  `buttonPrimitive`'s debt list lost six files.

**Measured in the browser at 390px:**
- **No sideways scroll anywhere.**
  - One clipped label was found and fixed: the tile's stat-label column went
    from 22px to 26px.
  - The only truncation left is the long *Fist of Flowing Ruin* names, in
    Bangers, which predate this work.
- **The character page:**
  - Paper panels with ink text.
  - Six marker keywords.
  - Fill arrows.
  - Ink-on-hue chips.
- **Kit Numbers:** traps focus, closes on Escape, returns focus to its row.
- **Growth:** 44px tabs, and the ladder reads now = yellow, next = green.
- **The filter sheet:** bottom, full width, 44px chips. A chip is on in its
  hue (red) or yellow.
- **A news post:** light text and rules on the ground.
- **The battle detail panel:** skill and passive blocks are paper cards
  with the marker on paper. The fight was left only by forfeit.

**Found on the way: two browser-pane quirks, neither the app's.** They are
now in `AGENTS.md`.
1. The pane does not advance CSS transitions, so a computed colour read
   after a state change is the value from before the change. That made
   selected chips look unselected, and an exited sheet look open.
2. At an emulated 390px, a coordinate click can land somewhere other than
   the element the tool reported: one landed on the header above the
   Filters button.

**Not seen:** the Level tab's "Raise to" toggles. Duke is at the level cap,
which shows the cap note instead.

### Events (done 2026-09-26)

**New shared pieces, because events needed them and so did screens already
migrated:**
- **`components/ui/alert.tsx`** (shadcn `alert`) is the one note component,
  in three variants: `default` (neutral, ink rule), `info` (yellow rule) and
  `destructive` (red rule). It is opaque paper so it reads on either ground.
  The growth tabs' three hand-typed note styles moved onto it.
- **`components/ui/inkTone.ts`** holds `INK_TONE.gain`, `.loss` and
  `.reward`: what a number means, as a fill with ink on it. Growth's `gain`
  now reads from it.
- **`table.tsx`** is surface-agnostic (rules in `currentColor`), because its
  other caller is the battle's still-dark `EffectsList`.
- **`PanelHeader`** is drawn for paper. Both its callers are the clear
  summaries.

**The screens:**
- **Board:** events are paper cards, and their chips are outline badges.
- **Brief:**
  - The enemy card is paper, and the level line is a yellow badge that moves
    with the selected difficulty.
  - Difficulty is a `ToggleGroup`.
  - Rewards are paper, with the first-clear bundle on a gold fill.
  - Notes are `Alert`s.
  - **Enter battle is the primary (slanted yellow) button**, as in the
    mockup. Auto clear is the outline.
- **Trial road:** it stays on the ground.
  - The victory card is paper on the yellow slab.
  - Losses are red fills.
  - Next fight is the primary button.
- **Clear summaries:** paper panels. Unlocks are gold fills, survivors
  green, losses red. Back is primary.
- **Auto Clear confirm and results:** both are the shadcn `Dialog`, and
  both hand focus back to their opener by hand, since neither has a
  `DialogTrigger`.
- **The `shadcn add alert` bug came back.** The CLI reinstalled the stray
  `cn` package, so `tests/uiTokens.test.ts` now also fails if `cn` is in
  `package.json`.

**Measured in the browser at 390px:**
- The board and brief do not clip or scroll sideways.
- D2 reads Level 26 and 12,102 / 406 / 249, matching the stat pipeline.
- The difficulty toggles are 60px.
- Auto Clear confirm is paper with red loss fills. It traps focus, closes on
  Escape, and returns focus to the Auto clear button.
- The results table has ink headers, and its per-run rewards dialog returns
  focus to View.

To reach Auto Clear, the pane's own `toll-player-storage` was given
`molvarr@1`/`@2` clears and 5 tickets, and one 3-run skip was spent. That is
the pane's data only.

**Not seen:** the trial road and the two clear summaries, which need a won
fight. The battle `EffectsList` on the new table was not seen either.

### Team select (done 2026-09-26)

- **`TeamPicker`** is its own paper panel, so it reads on both hosts: the
  practice bench and the event brief.
  - Preset chips are the shadcn `Toggle`. Save, manage, rename and delete
    are `Button`s (delete is `destructive`).
  - The roster and the preset manager are the shadcn `Dialog`.
  - A picked roster tile wears the yellow slab and a yellow pick number.
- **`TeamSelect`** (the practice bench):
  - The masthead is `SectionHeader`.
  - Mode and Format are `ToggleGroup`s in a paper settings strip.
  - VS is a yellow skewed mark.
  - The boss picker is paper.
  - The pinned action bar is a paper strip, and Start is the primary button.
  - It left the button guard's debt list.
- **`DuelToggle`** (dev only) is the shadcn `Toggle`.
- **`hooks/useReturnFocus.ts`** is the one way a dialog with several openers
  hands focus back. It started in the roster, and Kit Numbers and Auto Clear
  results moved onto it.
- **Left as it was, and flagged:** preset naming still uses
  `window.prompt` / `window.alert`. Those are the browser's own dialogs, so
  they cannot be themed or given a 44px floor. Replacing them with a named
  form is a UX change, so it is his call.
- **Measured at 390px:**
  - No clipping.
  - The toggles are 44px, and yellow when on.
  - Start battle is the element at its own centre, so the tab bar does not
    cover it (the #123 regression).
  - The roster dialog: 18 tiles. A pick marks yellow and fills the slot (the
    team went from 3 to 4). Escape closes it and returns focus to the slot.

### Preset naming, and profile & login (done 2026-09-26)

**Preset naming** is `components/game/PresetNameDialog.tsx`, his pick
("In-game name dialog", an option label). It replaced `window.prompt` and
`window.alert`, which were the game's last native dialogs.
- It serves save and rename. The "eight presets already" error shows inside
  the dialog.
- Blank names cannot be submitted. No length cap was added: the store has
  none, and a limit would be a number he has not set.
- Measured in the browser:
  - The field is focused on open, pre-filled, and 44px.
  - Save adds the chip and returns focus to "+ Save current".
  - Rename pre-fills the current name and returns focus to its Rename
    button, with the manager still open.

**Profile & login:**
- **Profile page:** the header, resource tiles and navigation tiles are
  paper. The stamina bar is `Progress`. A walled rank bar fills gold.
- **`InventoryModal`** and **`AccountModal`** are the shadcn `Dialog`. The
  avatar picker marks the chosen one yellow. Sign in is the primary button.
- **`SoundSettings`:** paper. Mute is the shadcn `Toggle`.
- **Login:**
  - The panel is paper; the blur is gone.
  - Perks carry yellow icon chips, and errors are an `Alert`.
  - **The Google button keeps Google's own white shape**, as their branding
    asks.
- **`DevGrantPanel`** (dev only) is a dashed paper panel. Its native
  `<select>` is now the shadcn `Select`, whose first caller this is: its
  trigger now matches `Input`, and its list is paper.
- The login page, `AccountModal` and `SoundSettings` left the button
  guard's debt list.
- **Measured:** the login page at 390px (paper panel, a white 48px Google
  button, a light guest link, no clipping).
- **Not seen:** the profile page, both of its dialogs and the dev panel.
  `/profile` sends a signed-out visitor to `/login`, and signing in from the
  browser pane was not done.

### Gacha (done 2026-09-26)

**New shared piece:** `components/ui/MountedDialog.tsx` is the shadcn
`Dialog` for a modal its caller mounts only while it is open. It carries a
title and subtitle, closes on dismiss, and returns focus to the opener
(`useFocusBackToOpener` in `hooks/useReturnFocus.ts`). Seven modals repeated
that wrapper and now use it: `AutoClearConfirm`, `InventoryModal`,
`AccountModal`, `ConfirmPullModal`, `RatesModal`, `FeaturedModal` and
`MilestonePicker`. Inventory and Account gained focus return by it.

**The screen:**
- **Banner:** the gems/tickets switch is the shadcn `Tabs`. The banner art
  carries speed lines, since a hero image is where the motif allows them.
- **Featured row and milestone track:** paper. The bar is yellow and the
  final marker gold.
- **Draw buttons:** Draw ×11 is the primary (slanted yellow) and Draw ×1 the
  paper secondary, both as `Button`.
- **Claim rows:** a gold wash when claimable. The "bar keeps running" note is
  an `Alert`.
- **Modals:**
  - All on `MountedDialog`, drawn for paper. Spend and gain are
    `INK_TONE` fills, element codes are fills, and "Owned" is yellow.
  - **`PullReveal` is the shadcn `Dialog`** in place of its own portal. It
    keeps the GSAP flip, cannot close while cards are still flipping, never
    closes on the backdrop, marks a new unit with the reward-gold slab
    (`ink-slab-reward`), and makes Draw again the primary action.
- **`ModalShell` is deleted** (it had no callers).
  - `tests/overlayStacking.test.ts`'s floor dropped from 6 to 4 with the
    reason written in, since those overlays moved onto portalled shadcn
    primitives.
  - `BannerScreen` and `MilestonePicker` left the button guard's debt list.

**Measured at 390px:**
- The banner screen does not clip. Both draw buttons are 64px.
- Featured: 12 rows, the owned one yellow, element codes as fills.
- Rates: 12 rows. Both Featured and Rates return focus.
- One real single summon: the confirm dialog showed −5 as a red fill and +5
  milestone as a green one, the reveal ignored Escape mid-flip, and Skip
  worked. Escape then closed it and returned focus to Draw ×1.
- The milestone picker: 12 tiles, a yellow pick, "Claim Lyra". Focus returns
  to the Claim button.

The pane's `toll-player-storage` spent 5 gems on that summon. Its milestone
bar was set to 1000 to reach the picker, then restored to 5.

### News, and the stragglers (done 2026-09-26)

- **`components/news/NewsKindBadge.tsx`:** one kind badge in place of two
  copies. The copies used element blue and gold, which are reserved for
  units. An update is now the ink badge and a notice the yellow one.
- **Feed:**
  - Rows are paper cards. An unread one carries a heavy yellow left rule.
  - The kind filter is a `ToggleGroup`.
  - The current page is the paper button, not the primary.
- **Post:**
  - The title is `SectionHeader`.
  - The body is one paper sheet, like the archive's kit document; the
    surface-agnostic `prose.tsx` takes its ink.
  - The older/newer links are paper tiles.
- **`app/error.tsx`** is now on `Screen`. The updated shell guard caught it
  when it was first written with the halftone by hand. Its heading is
  `destructive`, not the red element hue.
- **`PlayerAvatar`** is paper.
- `tests/navHeight.test.ts`'s floor dropped from 3 to 2 with the reason: the
  direct users of `screen-below-nav` are now `Screen` and login's full-bleed
  column.
- **Measured at 390px:**
  - The feed: 9 paper rows with ink badges, a paper search field, no
    clipping.
  - A post: a paper sheet with ink headings and body, no clipping.

Suggested order for the rest, busiest-for-a-player first. He can reorder:
1. ~~Events~~ (done 2026-09-26, above)
2. ~~Team~~ (done 2026-09-26, above)
3. ~~Archive~~ (done 2026-09-26, above)
4. ~~Gacha~~ (done 2026-09-26, above)
5. ~~Profile and login~~ (done 2026-09-26, above)
6. ~~News~~ (done 2026-09-26, above)

## Phase 4: battle, mockups first

The arena is the densest screen, and ground-versus-paper there is a real
design question: a paper HUD over the fight may be too heavy. **Per ruling
#144, draw options before building.** Then `BattleArena`, `Hand`,
`TeamUnitTile`, `UnitDetailPanel`, `BattleLogDrawer`, `EffectsList`,
`CardDetail`, `BattleCoach`, `TeamDetailsList`. Run `npm run test:browser`:
`hand.browser.test.tsx` pins the hand's geometry.

## Phase 5: retire Combat Terminal

- Delete the legacy tokens, `.terminal-grid`, `.chamfer` and `.chamfer-lg`.
- Update `docs/design/mockups/` notes that describe the old look.
- Guards, each proven red first:
  - No Combat Terminal token anywhere.
  - No `text-[Npx]` in a component.
  - No raw hex in a component.
  - No `fixed inset-0` overlay outside `components/ui/`.
