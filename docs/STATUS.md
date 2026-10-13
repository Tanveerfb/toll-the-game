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

**State:** four things landed on 2026-10-13; the first three wait on him.

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
   Seven project skills added: `redesign`, `savefield`, `importkit`, and the
   art pipeline split into `charart` (routes) → `charlora` / `kitart` /
   `artinstall`, with `kitart` carrying the **slot plan he OKs before any
   GPU time** and both drafting recipes (Lyra's at 0.9, the doc's at 0.65).
   `scripts/skill_art/README.md` and `scripts/pose/README.md` are new;
   `lyra.json` gained a reconstructed `lora_use` / `kit_art`. Still to ask
   him: `public/unreleased/` (7.3 MB), `lib/duel`, gsap, the MDX stack for
   the closed news, `docs/design/characters` (11 MB), 49 unused exports.

**Game code is unchanged since `aaae4e2`.** Blue Duke's art is where the
2026-10-08 status left it: `charart` step 4, LoRA v2 installed, four official
sheets with him (S2, K4, K10, U19), not picked. Batra held at step 1.

**Next:** his picks, in this order if he has one session: the save fix
(#28, #30, #31, one session, no design content), then the theme, then the
loop decisions. Then blue Duke's picks when he is back on his PC.

**Blocked on him:**
- Round two: A Tiles, B Board or C Posters, or parts of each; and the tab
  bar colour (yellow as today, ink bar, paper with an ink line, or ink tab).
- The eight audit decisions (`docs/GAME_AUDIT_2026-10-13.md`, Part 5).
- Two rules conflicts (`conventions.md`, "v3 sections"): the `STATUS.md`
  format and where mockups live. Also: a Trello board or none; which Node the
  Vercel project runs.
- Duke: picks from the official sheets, snow and river plates, the Slide
  name. Batra: the `lora_batra_set_a` options.
- From 2026-10-03, still open: the Merge badge on a phone; #180's calls;
  missions for Epic Battles; the Gon/Killua/Leorio answer to Tao (#138); the
  Caila and Sara sheets; the new card texts; Lyra's C4 and passive placement;
  Roused; the Orders tile; the app-icon recolour; the foundation audit; the
  folder migration; summon animations (#174).

**Don't trust:**
- Any claim that the cloud save works end to end for a signed-in player who
  has cleared an Epic stage (#28).
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
