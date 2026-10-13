# Status — 2026-10-13 (cloud)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(his call, `decisions.md` 2026-09-27; `project-rules.md` §DOCS wants a
session log under it, and that conflict is logged in `conventions.md` as a
question for him). It holds the current position only. A session's log goes
to `docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** five things landed on 2026-10-13; the first three wait on him.
The fifth is the biggest change to the game since story mode left: **the six
collab units are deleted** (ruling #187, his call), the engine mechanics they
carried stay, and a v12 migration cleans any save that still names one.

1. **The audit** is `docs/GAME_AUDIT_2026-10-13.md`. Its headline: the cloud
   save has one confirmed breaking defect (issue #28, nested arrays in
   `epicClears`) and four silent-loss paths (#29–#31); the beta has about two
   hours of content, no day-two hook, and six characters with no way to
   obtain them (#32). Eight decisions for him are at its end.
2. **The redesign, round two (ruling #185).** The first round
   (`theme-options.html`, three motif swaps) he called generic. His
   direction: keep the Characters page and the bottom nav; change Home,
   Events, Gacha, Profile and Settings. Round two is
   `docs/design/mockups/screens-from-characters.html`: A Tiles, B Board,
   C Posters, each drawn from the Characters page's tile component, real art
   and real tokens, with the Characters screen unchanged as the benchmark and
   a tab-bar colour toggle. **Nothing is locked until he picks.** The
   component round (§SHADCN) follows the pick.
3. **The rules** are v3.4.0 (`decisions.md` 2026-10-13). One step is his:
   the `fleet` plugin block in `.claude/settings.json`, which the session
   could not write.
4. **Cleanup and skills**, while he thinks about the theme. Removed what
   knip proved unused (`tailwind-variants`, four dead hook/lib files);
   closed audits and finished plans archived; `Plans/README.md` rewritten.
   Eight project skills added: `redesign`, `savefield`, `importkit`,
   `newevent` (his yes to the suggestion; `simcheck` he declined), and the
   art pipeline split into `charart` (routes) → `charlora` / `kitart` /
   `artinstall`, with `kitart` carrying the **slot plan he OKs before any
   GPU time** and both drafting recipes (Lyra's at 0.9, the doc's at 0.65).
   **Ruling #186** settled the question between them: a dataset must carry
   action shots; calm front-facing sets are why Sara's and Duke's LoRAs need
   the 0.65 route. Both are candidates for a retrain on an action-bearing
   set when he next has GPU time.
   `scripts/skill_art/README.md` and `scripts/pose/README.md` are new;
   `lyra.json` gained a reconstructed `lora_use` / `kit_art`. Later the
   same day, on his go: **the save fix** (`lib/game/cloudSync.ts` decides
   when a write happens; `teamKey` replaces the nested team arrays; v11;
   `cloudStatus` on `/profile`), **area `CLAUDE.md` files** for `lib/game`
   and `scripts/skill_art` (the engine rules moved out of `AGENTS.md`), and
   **the character profile schema** (`profile.schema.json`,
   `new_profile.py`, `check_profile.py`) so a new character's art profile
   never starts from Duke's file. Still to ask
   him: `public/unreleased/` (7.3 MB), `lib/duel`, gsap, the MDX stack for
   the closed news, `docs/design/characters` (11 MB), 49 unused exports.

**Game code changed on 2026-10-13**: the save fix (v11), the collab removal
(v12; `lib/game/removedCharacters.ts`; `tests/fixtures/characters/` carry the
kept mechanics). Before that it was unchanged since `aaae4e2`. Blue Duke's art is where the
2026-10-08 status left it: `charart` step 4, LoRA v2 installed, four official
sheets with him (S2, K4, K10, U19), not picked. Batra held at step 1.

**Next:** on the PC, `docs/PC_SESSION.md` in its order: enable the `fleet`
plugin, then **rebuild Duke's dataset with action shots and retrain** (his
call, 2026-10-13; the 2026-10-08 official candidates are superseded), with
the generic draft and render scripts built first. **The save fix (#28, #30,
#31) and the area `CLAUDE.md` files landed in the cloud on his go**, same
day; the first signed-in session verifies the save against a real Firestore
(clear an Epic stage, reload, the record survives, `/profile` shows no
cloud note). Still open in the save: #29 (a stale device's whole snapshot
wins). His: the theme, the audit decisions.

**Blocked on him:**
- Round two: A Tiles, B Board or C Posters, or parts of each; and the tab
  bar colour (yellow as today, ink bar, paper with an ink line, or ink tab).
- The eight audit decisions (`docs/GAME_AUDIT_2026-10-13.md`, Part 5).
- Two rules conflicts (`conventions.md`, "v3 sections"): the `STATUS.md`
  format and where mockups live. Also: a Trello board or none; which Node the
  Vercel project runs.
- Duke: the action-shot list and count for the rebuilt dataset, then the
  LoRA v3 step, then new drafts at 0.9; the Slide name still open. Batra:
  the `lora_batra_set_a` options, now with action shots (#186).
- One line of his the session could not place: *"when we're designing a
  new character kit ... the schema needed"*. A zod schema for the kit JSON
  here, a template in `toll-kits`, or something else: his to say.
- From 2026-10-03, still open: the Merge badge on a phone; #180's calls;
  missions for Epic Battles; the Gon/Killua/Leorio answer to Tao (#138); the
  Caila and Sara sheets; the new card texts; Lyra's C4 and passive placement;
  Roused; the Orders tile; the app-icon recolour; the foundation audit; the
  folder migration; summon animations (#174).

**Don't trust:**
- Any claim that the cloud save works end to end for a signed-in player who
  has cleared an Epic stage: #28 is fixed in code (v11, keyed teams, the
  shape guard) and **not yet seen working against a real Firestore**.
- A roster count or a kit list from before 2026-10-13: the collab six are
  gone (#187). `docs/ARCHITECTURE.md` has the recount.
- `output\blue_duke\candidates` on his PC: superseded, never lock them.
- Sim numbers from before 2026-10-03.
- In the cloud container: `next build` fails on Google Fonts (the sandbox,
  not the code); `npm run test:browser` needs the Playwright symlink
  workaround.

## Where things are

| What | Where |
| --- | --- |
| The audit, and the decisions it asks for | `docs/GAME_AUDIT_2026-10-13.md` |
| The redesign options, round two | `docs/design/mockups/screens-from-characters.html` (round one, rejected: `theme-options.html`) |
| What stays and what changes, his words | `docs/HANDOFF.md` #185 |
| The rules, and what the sync left open | `project-rules.md` (v3.4.0), `conventions.md` ("Synced" note and "v3 sections"), `decisions.md` 2026-10-13 |
| The art method and its dead ends | `docs/CHARACTER_ART.md`, walked by the `charart` skill |
| Duke's and Batra's state | `scripts/lora/characters/duke.json`, `batra.json` |
| Rulings | `docs/HANDOFF.md`; newest is #184 |

## Confidence and gaps

### Verified on 2026-10-13, by running it

- `npm run check`: **1,675 passed / 137 files**, exit 0 (typecheck and lint
  included). No source file changed this session.
- Both mockups, in Chromium at 390px: every interactive box ≥ 44px in every
  option; no broken art; round one's text contrast on every token pair
  ≥ 4.5:1. Round two uses the game's own tokens, so its contrast is the
  game's.
- The live screens were captured from a scratch `next dev` on 3210 with a
  seeded roster (`/`, `/archive`, `/events`, `/gacha`, `/profile`): Home uses
  the top 40% of the viewport, Events 37%, Characters fills it.
- `grep -rn "§[0-9]"` finds no numbered rules reference left in the live docs
  (archive, `Plans/completed`, `decisions.md` and other documents' own
  sections keep theirs by design).

### Not verified

- `next build`: Google Fonts is unreachable from the container.
- Audit issue #28 against a real Firestore; the shape is confirmed in code,
  the rejection is documented Firestore behaviour.
- Every other audit finding is *read*, not *reproduced*; the levels are
  stated per finding.
- Whether the `fleet` plugin loads in a cloud session once enabled.

### Recorded as Claude's reading, not his words

- Both rounds of options and everything in their notes panels; #185's
  inference that the Characters page is the benchmark is flagged as such.
- The audit's severities and its suggested order of work.

## Outside the repo

- **`toll-kits`:** #181–#184 are still not in its `KIT_RULINGS`, and its
  `decisions/PENDING.md` entries for #182/#183 are not yet deleted.
- **ComfyUI output folders** on his PC hold all the images; nothing is in git.
