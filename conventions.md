# Conventions — toll-the-game

**What this file is:** the choices specific to this project, and every place it
**diverges from [`project-rules.md`](./project-rules.md)**, each either granted
or queued.

**Audited against v2.4.0**, on 2026-09-27, section by section, with the counts
below measured that day. If `project-rules.md` is a higher version than this
line, the audit is stale.

**What this file is not:** how to work in this repo. That is
[`AGENTS.md`](./AGENTS.md) (loaded through `CLAUDE.md`): commands, engine rules,
traps, who owns what. Not duplicated here.

**Precedence.** `project-rules.md` §1: where the fleet rules and this file
disagree, **stop and ask.** The divergences below are settled; anything not
listed follows the fleet rules. The reasons live in
[`decisions.md`](./decisions.md).

---

## Divergences from `project-rules.md`: granted

### §11, §20, §22 Authority — the game decides value in the browser. **Exception granted 2026-09-27, until monetisation.**

The fleet rules: prices, permissions and record states are decided
server-side, and a shortcut standing in for a server-side rule must be torn
out.

Here, gacha pulls, pity, currencies, stamina, progression, battle rewards and
order claims are all decided client-side in `store/playerStore.ts`. The save
syncs to Firestore, and `firestore.rules` accepts any write a player makes to
their own `users/{uid}` document. The full list is
[`docs/demo-shortcuts.md`](docs/demo-shortcuts.md).

It stays that way because:
- there is no player base: only Tanveer and Claude play;
- nothing is bought and nothing is compared between players.

**It ends before roadmap item 6 (monetisation) or any public launch,
whichever is first.** Not covered: secrets and credentials (§22 in full), and
the `// DEMO:` markers §11 wants at each site, which are queued below.

---

## Open against the fleet rules: not yet decided

*Real divergences with no exception. Backlog, not policy. Every gap is either
granted above or listed here.*

| Rule | Gap | Tracked as |
| --- | --- | --- |
| §7, §8, §24, §26 | **Folder layout.** No `src/` (`@/*` maps to `./*`); a global `types/` (13 files, several mirroring zod schemas by hand); `store/` not `stores/`; providers (`AuthProvider`, `BattleProvider`, `MechanicProvider`) in `hooks/`; schemas in `lib/game/` not `schemas/`; `lib/firebase.ts` not `lib/firebase/client.ts` | **His call 2026-09-27: queued migration** (`decisions.md`). The `src/` and alias move is one sweep scheduled with him; `types/` → `z.infer` on touch |
| §13 | **Rendered uppercase.** Headings render in Bangers, a capitals face, and micro-labels are uppercased by CSS. Source copy is sentence case | **His call 2026-09-27: follow the standard, queued.** Needs mockups (#144) and a decision on the heading face |
| §2 | **`components.md` does not exist.** The folder map in `AGENTS.md` names the main components, not all of them | Queued. Write it when a component is next added; §15 then applies |
| §3 | **Two animation libraries**: `framer-motion` (4 importers) and `gsap` + `@gsap/react` (`components/gacha/PullReveal.tsx` only). §18 says one or the other | Queued. Move `PullReveal` to framer-motion when it is next touched, then drop `gsap` |
| §5 | **Six files over 1,000 lines**: `lib/game/combat.ts` 1,793, `components/game/BattleArena.tsx` 1,528, `lib/game/damagePreview.ts` 1,195, `store/playerStore.ts` 1,076, `store/gameStore.ts` 1,050, `hooks/BattleProvider.tsx` 1,018. Also `lib/utils.ts`, a `utils` name (§5), which is shadcn's `cn` at the path its CLI expects | Queued (foundation audit M2). Split on touch, by responsibility, not by size. `lib/utils.ts` is likely an exception to raise when touched |
| §8 | **Three relative `../` imports**, all in `lib/game/damage.ts` | Queued, on touch |
| §9 | **No data adapter.** `hooks/AuthProvider.tsx` imports `firebase/auth` directly; `lib/game/cloudSave.ts` reads and writes Firestore with no interface | Queued. The natural moment is the server-authority move above |
| §10 | **No declared transition map** for the events screen's views or the battle phase; transitions are `setView` / store writes in callbacks | Queued as foundation audit S2 (`Plans/2026-09-26-foundation-audit.md`) |
| §11 | **No `// DEMO:` markers** at the client-side authority sites | Queued. One pass over the rows in `docs/demo-shortcuts.md` |
| §13 | **"Never convey state by colour alone"** has not been measured | Queued: measure before claiming either way |
| §16 | **QOL gaps**: `TeamPicker` has no search or sort (audit Q1, his UX); one skeleton in the app | Queued. Q1 needs his direction; most views read local state and have nothing to wait for, so measure which do before adding skeletons |
| §18 | **`prefers-reduced-motion` covers the CSS animations only.** No `MotionConfig reducedMotion="user"`, so framer-motion and gsap animations play regardless | Queued. An accessibility requirement, never an exception |
| §21 | **Route-level error boundaries**: only `app/error.tsx` (root). **Fetching**: no SWR or TanStack Query; the cloud save loads in an effect in `AuthProvider`, and `lib/duel/client.ts` polls with `fetch` (dev duel tool) | Queued |
| §22 | **`.secrets/` is not in `.gitignore`**, and **no pre-commit hook blocks `private_key`**. No credential file exists today, so nothing is exposed | Queued. Both are one-line changes, left out of an audit that changes no code |
| §23 | **Two old TODOs**: `lib/game/ascension.ts:22` (bands 4–6) and `lib/game/progression.ts:18` (the ascension bump's tuning) | Queued. Confirm with him that both are deliberately deferred, or move them to `docs/ROADMAP.md` |
| §25 | **`app/api/battle-log` and `app/api/dev`** are routes the docs do not list | Queued. Add them to the folder map in `AGENTS.md` |

---

## Fully compliant: worth stating

- **§7** `strict` is on, and there are **no `any` annotations** (three regex
  hits on 2026-09-27 were the word in comments).
- **§12** Tailwind only; tokens in `@theme` in `styles/globals.css`. **No raw
  hex, pixel font size or retired token in a component**, enforced by
  `tests/uiTokens.test.ts` since 2026-09-27, with two named exemptions.
- **§13–§14** A chosen direction (Shōnen Ink, ruling #154) with
  `docs/design-system.md`, and every control is a customised shadcn primitive.
- **§17** Every overlay is the shadcn `Dialog` or `Sheet` (backdrop, Escape,
  focus trap, focus return); `tests/overlayStacking.test.ts` bans hand-built
  ones.
- **§20** Zustand, one store per domain (`gameStore`, `playerStore`,
  `settingsStore`, `duelStore`), selectors in the hot paths. Zod parses the kit
  JSON and the orders at load.
- **§22, §26** No Admin SDK and no service account, so there is no server
  credential to leak; the client Firebase config is public by design.
  `firestore.rules` is deployed. One app per Firebase project, so no named
  database is needed.
- **§23** No `console.log` in source; `npm run check` and a production build
  are clean.
- **§27** npm, with `package-lock.json`.
- **§28** Git only on his trigger. `AGENTS.md`, `CLAUDE.md` and memory all say
  so.

---

## §2 Document set: mapped, not duplicated

| §2 document | Here |
| --- | --- |
| `conventions.md` | this file |
| `decisions.md` | [`decisions.md`](./decisions.md) for working choices; **design rulings** stay in the numbered ledger in [`docs/HANDOFF.md`](docs/HANDOFF.md) |
| `design-system.md` | [`docs/design-system.md`](docs/design-system.md) |
| `components.md` | none yet (queued above) |
| `data-model.md` | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), with its Design Glossary (§6) |
| `environment.md` | [`docs/environment.md`](docs/environment.md): names, purposes and owners, never values |
| `status.md` | [`docs/STATUS.md`](docs/STATUS.md): `Start here` and "Confidence and gaps" only. Session logs go to `docs/archive/` |
| `issues.md` | [`docs/issues.md`](docs/issues.md) |
| `roadmap.md` | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| `demo-shortcuts.md` (§11) | [`docs/demo-shortcuts.md`](docs/demo-shortcuts.md) |

---

## Project-specific working agreement

The operational detail is in `AGENTS.md`. What is unique to this project:

- **He owns UI and UX direction, story, mechanics, kits and numbers; Claude
  owns structure and data types** (#139). A redesign starts with several live
  HTML mockups at 390px, and he picks (#144).
- **Async views show a Skeleton shaped like the final content; "—" means no
  value, never loading** (audit 4.5, 2026-10-03).
- **Phone first**: design at 390×844, verify phone width before desktop (#107).
- **Kits are designed in `toll-kits`**, a separate private repo, because a push
  here is a production deploy.
- **Never block on missing art**: queue it in `docs/ART_REQUESTS.md` and ship a
  fallback.
- **Verify on a scratch server** (`:3210`), never on his dev server (`:3000`).
