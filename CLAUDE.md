@AGENTS.md
@project-rules.md

**`project-rules.md` is the fleet standard, synced to v3.4.0 on 2026-10-13**
(from v2.4.0; section references in the live docs were translated with the
map in the fleet `CHANGELOG.md`). The master copy is
`standards/project-rules.md` in `github.com/Tanveerfb/fleet-standards`, which
also ships as the `fleet` Claude Code plugin. **Not yet enabled here**: the
2026-10-13 cloud session was refused the write to `.claude/settings.json`,
so the `extraKnownMarketplaces` / `enabledPlugins` block from the
`sync-standards` skill is still his to add. `sync-standards` brings this copy up to date;
`propose-standard` sends a fix back. Never edit this copy in place.

## Project identity

- **Name**: toll-the-game (Toll, the Element Clash card battle game)
- **Repo**: `Tanveerfb/toll-the-game`, branch `master`
- **Deploys**: Vercel, from `master`, **auto-deploys on every push**. Live at
  `https://toll-the-game.vercel.app/`. Real players: none yet (he and Claude
  play). Cloud sessions work on their harness branch (§GIT).
- **Trello board**: not set. He has not said whether this project has one
  (§TRELLO): until he does, no Trello work.
- **Motif**: Shōnen Ink (ruling #154, `docs/design-system.md`). **Under
  redesign since 2026-10-13**, his call: he wants something more professional
  and less bold. Options are drawn in `docs/design/mockups/theme-options.html`
  and nothing is locked.
- **Area files** (§SCALE, since 2026-10-13): `lib/game/CLAUDE.md` (engine
  rules, simulator, the save) and `scripts/skill_art/CLAUDE.md` (kit-art
  scripts). A fact lives in one file only. **Map**: `docs/ARCHITECTURE.md`
  (the engine, not yet the §SCALE module table).

**The adoption audit is done (2026-09-27): read [`conventions.md`](conventions.md)
before any structural change.** It sorts every gap against the rules into
granted or queued, and [`decisions.md`](decisions.md) records his four answers:

- **Granted, until monetisation:** client-side authority over pulls, rewards,
  stamina and progression. The register is `docs/demo-shortcuts.md`, and it
  must be empty before roadmap item 6 or a public launch.
- **Queued, his pick, not started:** the folder migration (`src/`, `schemas/`,
  `stores/`, providers out of `hooks/`, `types/` to `z.infer`) and rendered
  sentence case in place of the motif's uppercase. **Neither is a fix to make
  in passing.** The `src/` move is one sweep he schedules; `types/` converts
  on touch.
- **Done:** the document split. `docs/STATUS.md` is a short snapshot that is
  rewritten, not appended; session logs go to `docs/archive/`; issues,
  environment and decisions have their own files.

Where `AGENTS.md`, `conventions.md` and `project-rules.md` disagree, **stop and
ask** (rules §SCOPE). Everything else converts to the standard **on touch**.
