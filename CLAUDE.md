@AGENTS.md
@project-rules.md

**`project-rules.md` is the fleet standard (v2.4.0), copied from
`E:\Projects\_COMMON` on 2026-09-26.** That folder holds the master copy. Improve
it there and re-copy; never edit this copy in place.

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
ask** (rules §1). Everything else converts to the standard **on touch**.
