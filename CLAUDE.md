@AGENTS.md
@project-rules.md

**`project-rules.md` is the fleet standard (v2.4.0), copied from
`E:\Projects\_COMMON` on 2026-09-26.** That folder holds the master copy. Improve
it there and re-copy; never edit this copy in place.

**This repo predates the standard, and its adoption audit has not been done.**
`E:\Projects\_COMMON\adopting-the-standard.md` says the first pass writes
`conventions.md` and changes no code. That pass is queued, not started. Until it
lands:

- Where `AGENTS.md` and `project-rules.md` disagree, **stop and ask** (rules §1).
- The repo's known structural differences (no `src/`, a global `types/`
  directory) are not bugs to fix in passing.
- Convert files to the standard **on touch**, not in sweeps.
