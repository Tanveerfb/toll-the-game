# Status — 2026-10-03 (cloud, part 4)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:**
- **The four-values audit is finished.** All 43 items are done or superseded
  (#180; the record is `docs/archive/FOUR_VALUES_AUDIT-2026-10-03.md`).
- The UI says less and uses the new shared components (see "Where things
  are").
- **News is closed and its posts are deleted** (#179).
- **Epic Battles** (#175) and boss Tao (#176) are live on `/events`.
- He is in **cloud sessions**, so no ComfyUI: UI and implementation only.

**Next:** his next batch, not named yet.

**Blocked on him:**
- **Try the Merge badge on a phone.** Its 44px hit area overlaps the card's
  name strip, so a tap just above or below it merges instead of playing.
- Approve or reverse Claude's calls inside his audit picks (#180, last
  bullet).
- Missions for Epic Battles; an answer to Gon, Killua and Leorio against Tao
  (#138); an optional Tao rerun after his ramp lost its HP.
- Carried over:
  - which character goes through `charart` next;
  - the Caila and Sara design sheets;
  - the new card texts (kitwords EXAMPLES, Open);
  - Lyra's C4 and passive placement (D5);
  - Roused;
  - the Orders tile;
  - the app-icon recolour;
  - the foundation audit;
  - the folder migration;
  - summon animations (#174).

**Don't trust:**
- Sim numbers from before 2026-10-03, which were measured without
  ultimates or second skills.
- **`npm run test:browser` needs the workaround in the cloud container:**
  `PLAYWRIGHT_BROWSERS_PATH` pointing at a folder with
  `chromium_headless_shell-1234` and `chromium-1234` symlinked to the 1194
  builds.

## Where things are

| What | Where |
| --- | --- |
| Shared UI parts (new 2026-10-03) | `components/ui/`: `BackLink`, `SelectTile`, `EmptyState`, `NavTile`, `DisclosureRow`, `PanelSheet`, `ShiftRow`, `skeleton`; `Badge` sizes; listed in `docs/design-system.md` |
| Shared game parts | `components/game/RankBar`, `SkillTypeBadge`, `RosterToolbar`; `lib/game/accountSummary.ts`, `rewardParts.ts`, `rosterFilter.ts`; `hooks/useNow`, `useOverlayOpen`, `useRosterFilters` |
| Guards against the old patterns | `tests/sharedComponents.test.ts`, `tests/touchTargets.test.ts` (`hit-44`), `tests/tabsHover.test.ts` |
| Nav source of truth | `lib/nav/routes.ts`; the phone tab bar is derived from its `tab` flag |
| News switch | `lib/news/open.ts` (`NEWS_OPEN = false`); the return is on `ROADMAP.md` |
| Epic Battles and boss Tao | `lib/game/epicBattles.ts`, `data/arcs/`, `data/characters/master_tao_npc.json` |
| Simulator | `lib/game/simulate.ts` (limits in its header), `simStats.ts` |

## Confidence and gaps

### Verified on 2026-10-03 (part 4), by running it

- `npm run check`: **1,675 passed / 137 files**, typecheck and lint clean.
- `test:browser`: **17 passed / 3 files**.
- `next build`: clean.
- **16 screens on the production build at 390×844:**
  - no horizontal overflow;
  - nothing interactive under 44px in both dimensions;
  - no page errors, except Vercel's analytics scripts, which 404 off Vercel.

### Not verified

- A battle won on the production build, and the passive-toast filter in a
  live fight.
- The skeletons on a slow connection.
- The Merge overlap on a real phone.
- Carried over: claiming a milestone; a duplicate's "+1 coin" tile.

### Recorded as Claude's reading, not his words

- The calls inside his picks listed in #180, including the restored
  guest-progress warning.
- #178's line between what a player *reads* and what a player *uses*.

## Outside the repo

- **`toll-kits`:** untouched. None of #175–#180 is a kit ruling.
- **Scratchpad only, lost with the container:**
  - the Tao measurement runners (`taostats.ts`, `taosweep.ts`);
  - the sweep script (`sweep.mjs`);
  - the `pw/` browser symlink folder.
