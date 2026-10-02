# Status — 2026-10-02

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** Three new units are game-ready but **not live**: blue Lyra, Caila
and green Duke (`"unreleased": true`, ruling #171). They show only under
`next dev`. The engine gained Freeze, [Cold], the ultimate seal and a team
counter (#164–#167). Last checkpoint: `git log -1`. This session's log:
`docs/archive/STATUS-2026-10.md`.

**Next:** his playtest of the three in practice on his local dev server, then
their art (`docs/ART_REQUESTS.md`, Category E). Release = art + delete the
flag.

**Blocked on him:**
- Caila's design sheet (E2 cannot start without it).
- Confirming the new card texts (`.claude/skills/kitwords/EXAMPLES.md`, Open).
- Carried over: which screens show Lyra's C4 card pose and passive art (D5);
  his next Lyra variant (B1 reserved); Roused; the closed Orders tile; the app
  icon recolour; the foundation audit's next section; scheduling the folder
  migration and sentence case.

**Don't trust:** no screen was opened this session. The new units, Frozen
and [Cold] rows, and the sealed-ultimate card are verified in tests only.

## The three units (all `unreleased`)

| Unit | Card | Role | Kit | Engine pieces |
| --- | --- | --- | --- | --- |
| Lyra, "Grounded in Frost" | 100032 | defense, sub-DPS | `blue_lyra.json` | Frostline: fading ATK (field only), [Cold] → Freeze |
| Caila, "The Wandering Apothecary" | 100033 | support | `caila.json` | [Vial], ultimate seal, team gauge from Theriac |
| Duke, "An Art Still Unfolding" | 100034 | DPS | `green_duke.json` | Undertow team counter, Confluence bonds by name |

Every rule is in the ledger, #164–#171, with his words and which answers were
selections of Claude's options. The `toll-kits` workshop is synced to this
checkpoint (its drafts are marked imported, PENDING emptied).

## Confidence and gaps

### Verified on 2026-10-02, by running it

- `npm run check`: **1,522 passed / 125 files**, typecheck and lint clean.
- A scratch production build passed (`.next-verify` removed, `tsconfig.json`
  restored).
- Proved red by breaking them: the release gate, the frozen post-pass, and
  the blue Lyra bench rule (`tests/examArcKits.test.ts`).
- Headless traces of blue Lyra vs red Lyra and green Duke vs blue Duke ran
  every new path (Cold tiers, Freeze skipping a turn, team counter, stance
  stacks) without error.

### Believed but NOT verified

- Nothing was looked at in a browser: the hand's "Frozen" overlay, the effects
  rows for [Cold]/[Frozen]/ultimate seal, the dev-only roster.
- Sim numbers ignore ultimates: **the simulator keeps no ult gauge, so it
  never casts one** (a task chip was raised for it). Green Duke's 0% vs blue
  Duke and blue Lyra's 100% vs red Lyra are AI-and-format measurements, not
  balance verdicts (#138).

### Known open decisions recorded as Claude's reading

- Frostline "field only" is read as: a Lyra who starts on the bench never
  gets the battle-start ATK bonus, even after she is promoted (#165).
- Green Duke's Confluence bonuses still apply when he starts on the bench —
  he corrected Lyra's only.

### Carried over, untested by anything

- A reload between two trial fights loses the run; `worldBossPreview.ts` and
  `immunity.ts` have no test; no screen flow is tested; the SFX files do not
  exist. Lyra's new skill art has still not been seen on a game screen.

### What I would check first coming back cold

1. `git status` and `git log -3`.
2. `npm run dev` on his box, practice: field the three, watch a freeze land
   and a sealed ultimate grey out.
3. Ledger #164–#171 before touching any of the new mechanics.

## Outside the repo

- **`toll-kits`** (`E:\Projects\toll-kits`): main now carries the merged
  workshop branch. **The story repo `element-clash-toll`** (`E:\Toll - Web
  toon`) has an unmerged branch `claude/pensive-brahmagupta-8yv4rd` (chapter
  rewrites, Arc 1 renumbered to 20) and a stale merged one; untouched.
- ComfyUI, 7DSGC references and the Lyra LoRA are as recorded in
  `docs/ART_PIPELINE.md`.
