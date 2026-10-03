# Status — 2026-10-03 (cloud, part 3)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:**
- **Epic Battles is live on `/events`** (#175): Arc 1, Exam Arc, with boss Tao
  and Lyra. Stages are always open, free and repeatable. Clears are recorded
  but neither paid nor shown.
- **Boss Tao is his kit, tuned in the simulator** (#176). The events board is
  **tabs** (#177).
- **The values are four now** (#178): consistency, modularization, QOL, and
  less is more ("don't state or show the obvious"). See `AGENTS.md`.
- He is in **cloud sessions**, so no ComfyUI: UI and implementation only.

**Next:** a site-wide audit against the four values, which he asked for
straight after this checkpoint. It is a report first; fixes are his call.

**Blocked on him:**
- Missions for Epic Battles: design not started.
- Whether Gon, Killua and Leorio (about 100% against Tao) get an answer in
  Tao's kit (#138).
- Carried over:
  - which character goes through `charart` next;
  - Caila's design sheet;
  - Sara's sheet in `toll-kits` (it still shows the hood);
  - the new card texts (kitwords EXAMPLES, Open), Lyra's C4 and passive
    placement (D5), Roused, the Orders tile, the app-icon recolour and the
    foundation audit;
  - scheduling the folder migration.
- Deferred by him: summon animations and art (#174).

**Don't trust:**
- **Sim numbers before 2026-10-03.** The simulator played first skills only,
  with no ultimates, including `trialEncounters.ts`'s comment figures.
- **Tao's quoted ~80% for his teams** was measured before the 5-hit ramp lost
  its HP. A rerun was offered, not done.
- **`npm run test:browser` fails as-is in the cloud container.** It needs a
  scratch `PLAYWRIGHT_BROWSERS_PATH` with `chromium_headless_shell-1234` and
  `chromium-1234` symlinked to the 1194 builds.

## Where things are

| What | Where |
| --- | --- |
| Epic Battles model and data | `lib/game/epicBattles.ts`, `data/arcs/exam-arc.json`, `lib/game/epicClears.ts` (`playerStore.epicClears`, cloud-synced) |
| Epic screens | `components/game/events/Epic*`, `EnemyPanel`; board tabs in `EventsBoard` + `lib/game/eventTabs.ts`; tab memory `settingsStore.eventsTab` |
| Boss Tao | `data/characters/master_tao_npc.json`; mechanics in `lib/game/liveBonus.ts`, `debuffCount.ts`, `onKill.ts`, `counter.ts`, `immunity.ts` |
| Simulator | `lib/game/simulate.ts` (hands, gauge, seeded AI; limits in its header), `simStats.ts` (`collectStats`) |
| Shared battle rules | `lib/game/ultGauge.ts` `ultGaugeAfterAction`; `lib/game/deck.ts` `dealTeamHand`, `settlePlayedCard` |
| Events mockups | `docs/design/mockups/events-redesign.html` (built from the live CSS and markup; he picked A) |
| Summon screen | `components/gacha/BannerScreen.tsx` and its sheets (#174) |
| Fleet skills for cloud sessions | `.claude/skills/checkpoint`, `.claude/skills/relay` |

## Confidence and gaps

### Verified on 2026-10-03 (cloud, part 3), by running it

- `npm run check`: **1,635 passed / 134 files**, typecheck and lint clean.
- **In Chromium at 390×844:**
  - the three tabs (44px, no sideways scroll, remembered across a reload,
    Epic tab on return from an arc);
  - the arc page;
  - the stage brief;
  - the tab hover fix, by computed colour.
- `BattleProvider`'s refactor onto the shared gauge and deck functions was
  read line by line: same behaviour.

### Not verified

- A stage won on screen, and the result screen without "Rewards".
- Tao's live passive readout in the unit panel.
- `test:browser` was not run this session.
- Carried over: claiming a milestone; a duplicate's "+1 coin" tile; Sara or
  Lyra on the dark enemy side.

### Recorded as Claude's reading, not his words

- #178: less is more vs QOL is the line between what a player *reads* and
  what a player *uses*.
- #175: the shape of the clear record.
- #176: the names "Examiner's Judgement" and "Trial by Fire", made on his
  request.

## Outside the repo

- **`toll-kits`:** untouched. #175–#178 are not kit rulings, so `KIT_RULINGS`
  needs no change. #176 is a boss kit and his call to mirror.
- **Scratchpad only:** the Tao measurement runners (`taostats.ts`,
  `taosweep.ts`). They are lost when the container goes.
