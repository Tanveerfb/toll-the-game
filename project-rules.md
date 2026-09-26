# Project Rules & Code Style
**Author:** Tanveer (Truqorun)
**Version:** 2.4.0
**Applies to:** All Next.js projects

Coding standards, architectural decisions and workflow rules. Follow these
unless the project's own `conventions.md` says otherwise — see §1.

This file grows as practice improves. A convention that proves itself on a real
project belongs here; a rule that keeps needing exceptions belongs deleted.

---

## 1. Scope and precedence

These rules are the default for every project. A project may hold its own
`conventions.md` covering choices specific to it.

**Where this file and a project's `conventions.md` disagree, stop and ask.**
Neither wins by default — a conflict usually means one of the two is out of
date, and resolving it is the owner's decision, not an inference. Record the
outcome in `decisions.md`, and update this file if it should apply everywhere.

---

## 2. Project documents

Every project carries the same document set. Each states who maintains it and
when it is updated.

| File | Holds | Updated when |
|---|---|---|
| `conventions.md` | Choices specific to this project | A decision changes |
| `decisions.md` | Why each non-obvious choice was made. Append only | A choice is made |
| `design-system.md` | Tokens, typography, density, motion, exclusions | A token or rule changes |
| `components.md` | What already exists | A component is added, moved or removed |
| `data-model.md` | Entities, relationships, invariants | An entity or invariant changes |
| `environment.md` | Environment variables and external accounts, with owners | A credential or account appears |
| `status.md` | Where the work is right now. Short. Rewritten, never appended | End of each session |
| `issues.md` | Open and closed issues | Continuously |
| `roadmap.md` | Phases. Slow moving | A phase changes |

**Every file answers "who updates this and when", or it gets deleted.** An
unmaintained document is not neutral — it is a confidently wrong instruction.

**Do not create a document before it has content.** An `environment.md` written
before any credential exists documents nothing and claims otherwise.

Status, issues and roadmap overlap. Keep their jobs distinct: roadmap is phases,
issues is the churn, status is the current position in a dozen lines.

---

## 3. Packages and APIs

- Use the **latest version compatible with the framework and the rest of the
  dependency tree** — not simply the newest published. Check peer requirements
- Verify current versions on npm before installing
- Use **Context7 MCP** for version-specific documentation before implementing
  anything library-related
- If an API may have changed since training, fetch current docs. Do not assume
- Do not add a dependency duplicating something already in the stack. Record
  every new dependency in `decisions.md`

---

## 4. Building for growth

Assume every project outlives its brief. A demo becomes an MVP, an MVP gains a
second customer type, an internal tool gets opened to clients.

**Build for growth in the boundaries:**

- Data shapes, names and relationships — expensive to change, so get them right
- Access boundaries — permission checks, not role checks
- Data access behind an interface, so storage can change without touching
  callers (§9)
- Extensible representations — a list of priced lines rather than three named
  fee fields, so a fourth needs no migration
- Structure and naming that still make sense at ten times the size

**Do not build for growth in the features.** Speculative screens, settings
nobody asked for, configuration options with one caller — cost, not foresight.

The distinction: pay upfront where retrofitting is expensive, defer where it is
not. When unsure which side something falls on, ask.

---

## 5. Modularisation and responsibility

There is no line limit. A file is the right size when it does one job.

**Split when any of these is true:**

- You cannot describe the file's job in one sentence without using "and"
- It exports more than one concern
- A component both fetches or computes data and renders it
- A store holds both UI state and domain data
- You scroll to navigate it rather than to read it
- Its name contains `utils`, `helpers`, `misc` or `common`

**Regardless of size:**

- One responsibility per file
- Business logic never lives in a component. Extract to a hook or a pure
  function
- Pure logic imports nothing from React, Next or any store
- Shared things live where their consumers can find them

Splitting a cohesive file into three fragments is worse than leaving it long.
Cohesion is the goal; brevity is a symptom.

---

## 6. Naming

The words in the interface, the code and the documentation are the same words.

- Every project with more than a handful of entities keeps a glossary. Terms
  that sound alike get defined against each other explicitly
- If the interface calls it an offer, the type is `Offer` and the collection is
  `offers`. No synonyms, no internal-only vocabulary
- Name things by what the user understands, not by how the system is built
- An action keeps its name through the whole flow: the button that says
  "Publish" produces a toast that says "Published"

---

## 7. TypeScript

- **Strict mode always.** `"strict": true` is non-negotiable
- No `any`. Use `unknown` and narrow
- Props, parameters, return types and state are explicitly typed
- `type` for object shapes and unions. `interface` only when extending

**Where zod is in use, domain types are inferred from schemas:**

```ts
export const requestSchema = z.object({ /* ... */ })
export type Request = z.infer<typeof requestSchema>
```

There is no global `types/` directory. A hand-written type mirroring a schema
drifts from it. Non-domain types — props, UI unions, hook returns — are declared
in the file that owns them.

---

## 8. Project structure

```
src/
  app/              routes only, grouped by route group or role
  components/       shared across two or more features
  components/ui/    shadcn, customised per project — see §14
  features/         feature-specific components, colocated
  hooks/            one hook per file
  lib/              clients, constants, helpers with a real name
  lib/domain/       pure business logic. No React, no storage
  lib/data/         data access adapter, where the project has one
  schemas/          zod schemas and inferred types, where zod is used
  stores/           zustand, one per domain
  styles/globals.css
public/
.secrets/           gitignored. Never committed — see §22
```

**Promotion.** A feature component gaining a second consumer moves to
`components/` in the same commit that creates the second use. Not before.

**Import aliases.** Always `@/`. Never relative paths climbing directories.
Confirm `"paths": { "@/*": ["./src/*"] }` in `tsconfig.json`.

---

## 9. Data access

Where a project has a backend, a mock backend, or any prospect of changing
either, **all reads and writes go through an adapter**.

```
lib/data/
  index.ts      the active adapter
  types.ts      the interface every adapter implements
  <impl>.ts     one file per implementation
```

- The interface is defined in **domain terms** — `listOffersForEngineer`,
  `submitRequest`. If a method name mentions a collection, a document or a
  query, it belongs one layer down
- No component reads storage directly
- A prototype's mock implementation and the eventual real one satisfy the same
  interface. That is what makes a prototype extensible rather than disposable

This is usually the single decision separating "we build on it" from "we start
again".

---

## 10. Entity lifecycles

Where a record moves through states — orders, requests, applications, jobs:

- **Allowed transitions are declared once**, as an explicit map, in
  `lib/domain/`
- Nothing writes a status directly. Every change goes through a transition
  function that rejects illegal moves
- The state diagram lives in the project's documentation and is the
  specification the map implements
- Status history is append-only where an audit trail matters

Scattered status assignments produce records that are somehow both cancelled and
in progress, and the bug surfaces in production rather than in review.

---

## 11. Prototypes and shortcuts

Where a build is deliberately incomplete — a demo, a phased delivery, a spike —
every shortcut is marked in code and registered in `demo-shortcuts.md`:

```ts
// DEMO: fee calculated client-side. Production computes server-side.
// See demo-shortcuts.md #4
```

The register lists what is fake, what replaces it, and the risk if it ships.
**It is the next phase's backlog.** An unmarked shortcut is a shortcut that
will ship.

Separate the shortcuts that are safe to build on — mock implementations behind
an adapter, seed data, structure — from those that must be torn out: simulated
payments, client-side authorisation, fake identity. Anything standing in for a
server-side rule is in the second group without exception.

---

## 12. Styling

- **Tailwind only.** No CSS Modules, no styled-components, no inline `style`
  objects except for genuinely computed values
- Tailwind v4 is CSS-first. Tokens live in `@theme` in `globals.css`. No
  `tailwind.config.ts` unless a plugin requires one
- **Never write a raw hex value, font size or spacing value in a component**
- Tokens are defined before any interface work begins

Where Tailwind becomes unreadable, the answer is a component, not a stylesheet.

---

## 13. Design direction

Every project has a `design-system.md` defining palette, typography, spacing,
density, motion and exclusions. Build nothing before it exists.

**Propose a direction before building one.** Offer two to four named directions
with a sentence each on why they suit this subject and audience, and let the
owner choose. A starting vocabulary — not exhaustive, and often none of these
is right:

| Direction | Suits |
|---|---|
| Classroom / school | Learning tools, onboarding, anything instructional |
| Cyberpunk / high-contrast dark | Developer tools, monitoring, gaming adjacent |
| Minimalist / editorial | Content-led products, portfolios, reading |
| Industrial / dispatch board | Operations, logistics, field service, dense state |
| NDIS / accessibility-standard | Care, health, government, disability services |
| Consumer-warm | Marketplaces, hospitality, lifestyle |

Ground the choice in subject and audience. A tool used outdoors on a phone and a
dashboard read at a desk are different design problems.

Then, always:

- Do not invent colours, type sizes or spacing values. If none are defined, ask
- Spend visual boldness in one place; everything around it stays quiet
- Sentence case throughout, including buttons and table headers
- Never convey state by colour alone

---

## 14. shadcn and customisation

**Lean on shadcn.** It is the default source for primitives — do not hand-build
what it provides.

**Never ship it generic.** shadcn components are copied into the repository and
owned locally; that is the point. Every project customises them before feature
work:

- Tokens in `@theme` drive colour, radius, spacing and typography, so primitives
  inherit the project's identity rather than the default look
- Variants extended where needed, removed where not
- Density, focus treatment and motion set per project

A build that looks like every other shadcn build means step one was skipped.
Equally, this is a pass over the primitives in use — not a week rewriting a
component library.

---

## 15. Component registry

Every project has a `components.md` listing what exists.

- **Read it, and verify it against the filesystem, before building any
  component.** It is an index, not a source of truth
- If something close exists, extend it with a prop. Do not fork it
- Add what you build to the registry in the same commit

An unmaintained registry is worse than none, because it gets trusted.

---

## 16. Quality of life and utilities

Build the expected version, not a bare minimum needing immediate extension.

| Component | Expected |
|---|---|
| Table | Pagination, search, column filters, sortable columns, row selection, empty state, skeleton |
| List | Search, filter, empty state, skeleton |
| Form | Inline validation, submit loading state, success and error feedback, disabled while submitting |
| Modal | Backdrop close, Escape close, focus trap, loading state |
| Select | Search when over ten options, clear selection, loading state |
| Image | Skeleton, error fallback, lazy loading |
| Card | Skeleton variant |
| Input | Clear button, character count, password reveal — where applicable |
| Button | Sizes (sm, md, lg), outline and ghost treatments, loading, full width, leading and trailing icons |

Every list has a written empty state saying what to do next. Every async view has
a skeleton matching its final layout, not a spinner.

**Offer improvements proactively.** Where a screen would clearly benefit from an
unscoped utility — bulk actions, keyboard shortcuts, saved filters, export,
inline preview — propose it. Offer it; do not build it unasked.

Anything deliberately deferred gets a `// TODO:` naming what is missing.

---

## 17. Interface patterns

**Button to modal overlay.** On pages carrying a lot of content, tools or
sub-sections, put secondary tasks behind a button that opens an overlay rather
than stacking them on the page. It keeps the primary task legible and scales as
the page grows.

Use for: filters and advanced search, create and edit forms, detail from a list,
settings, bulk actions, confirmations.

Do not use for: the page's primary task, anything repeated many times in a row,
or content that must be read alongside what is behind it — those want a panel or
an inline section.

Every overlay closes on backdrop click and Escape, traps focus, and returns
focus to the control that opened it.

---

## 18. Motion

**Framer Motion or GSAP.** Aim for the feel of Windows and Android system
animation: quick, purposeful, physically plausible, always explaining what
changed.

- Motion answers a user action, or draws attention to one thing arriving. Never
  decoration
- Roughly 150–250ms for state changes, up to 300ms for larger surfaces
- Ease out on entry, ease in on exit. Nothing linear except continuous motion
- Transform and opacity only. Never animate layout properties
- One orchestrated moment per app at most — the thing the product exists to do
- No entrance animations on page sections, no hover transitions on every card,
  no staggered list reveals
- `prefers-reduced-motion` removes all of it

---

## 19. Asking before assuming

- **Use the question tool when a decision is the owner's to make.** Tappable
  options beat prose questions, especially on mobile. Two to four short
  mutually exclusive options, one to three questions at a time
- **Never assume design values.** Ask first; propose only when invited
- **Ask once per technical decision.** Once confirmed, apply consistently
- **Ask before structural decisions** — navigation, auth strategy, folder
  conventions
- **Ask when this file and `conventions.md` conflict** (§1)

---

## 20. State and validation

**Zustand** where the project needs shared client state. A project with little
client state does not need a store. Confirm once, then apply consistently.

- One store per domain. Never one global store
- **Separate UI state from server data.** View context, form progress, filters
  and dialogs belong in a store. Server data does not get mirrored into one —
  mirroring produces two sources of truth that drift
- Selectors only. No derived data in a store. Actions describe intent
- `immer` for deeply nested updates. `persist` for only what must survive reload

**Zod** where the project handles external data: forms, API responses, uploads,
stored records. A static site with no inputs does not need it.

- One schema per entity, in `schemas/`
- Parse at every boundary — submission, response, stored data read
- Enums declared once in zod and imported. No scattered string literals
- Seed and fixture data parsed through the same schemas. If it will not
  validate, the schema or the data is wrong, and finding out early is the point
- Form schemas extend entity schemas. They never redefine them

---

## 21. Forms, errors and data fetching

**Forms.** Simple forms — login, contact, search — use uncontrolled inputs with
`useRef`. Complex forms — multi-step, conditional, dynamic validation — use
`react-hook-form` with `zod`. Never mix controlled and uncontrolled inputs in
one form. Validate on the client, and again on the server; client validation is
a courtesy, not a control.

**Errors.** `try`/`catch` around every async operation. Nothing fails silently.
`error.tsx` for route-level boundaries, error boundary components around complex
or third-party subtrees. Users never see a raw error — every fallback says what
happened and what to do, and does not apologise.

**Fetching.** Server Actions or Route Handlers for mutations. Client-side
fetching uses SWR or TanStack Query, never bare `useEffect` plus `fetch`.
Loading, error and empty states handled every time.

---

## 22. Security and secrets

- **`.secrets/` at the project root holds service account files, keys and
  anything else sensitive.** It is in `.gitignore` on the first commit, before
  any code exists — not after the file lands
- `.gitignore` also covers `.env*` and credential files from the first commit
- Credentials are referenced **by path through an environment variable**. Never
  read their contents into a prompt, a log or a source file. For Firebase Admin,
  point `GOOGLE_APPLICATION_CREDENTIALS` at `.secrets/`; where the platform
  supports application default credentials, prefer having no key on disk at all
- A pre-commit hook blocking anything containing `private_key` costs one setup
  and prevents the mistake that cannot be undone
- **Never commit a credential, even to a private repository.** Repositories
  change visibility, get handed to clients, get cloned by collaborators and
  interns. Git history is permanent; cleaning it means rewriting history across
  every clone
- Use scoped service accounts rather than the default broad-permission one
- If a key is exposed, rotate it first and clean history second. Rotation is
  immediate; history cleanup is not
- `environment.md` records every external account and **who owns it**. This is
  what bites at client handover
- Prices, permissions, roles and record states are decided server-side. Anything
  the client can send, the client can forge

---

## 23. Comments, cleanliness and build discipline

- Comment non-obvious decisions and complex logic. Not obvious code
- JSDoc on exported functions and hooks
- No `console.log` left behind. No commented-out code
- No TODO surviving more than one session unless explicitly deferred in writing
- Run `npm run build` after every medium or major change and fix everything
  before moving on
- TypeScript and ESLint errors are blockers, not warnings. Warnings cleared
  before a task is done
- Nothing ships with a failing build

---

## 24. Custom hooks

- Reusable stateful logic becomes a hook in `hooks/`
- Named `use[Name].ts`, one hook per file
- Return typed objects, not arrays, except for simple pairs

---

## 25. For agents

- **Never present a problem without a direction out of it.** Every issue comes
  with at least one proposed fix, its trade-off, and a recommendation. A list of
  problems with no proposed solutions is not a useful report
- Use the question tool for decisions that are the owner's to make (§19)
- Do not create pages or routes absent from the project's documentation.
  Propose them
- Read `components.md` and check the filesystem before creating a component
- Do not introduce a colour, size or spacing value outside `design-system.md`
- Do not bypass the data adapter (§9) or write a status directly (§10)
- Do not add dependencies without asking
- Do not run destructive git commands — force push, history rewrite, branch
  deletion — unless explicitly asked
- Never read a credential file's contents into context
- Where documentation and code disagree, the documentation is the intent and the
  code is the bug, unless told otherwise
- Rewrite `status.md` at the end of a session. Do not append to it

---

## 26. Firebase

The default backend for auth, data and storage across the fleet. Recovered in v2.3.0 from
v2.0.0 §17, which v2.1.0 dropped — 14 of 15 active projects use Firebase and nothing else
covered it.

- **Two SDKs, and the boundary between them is the whole rule.** The client SDK
  (`firebase`) is initialised once, in `lib/firebase/client.ts`, and used from client
  components. The Admin SDK (`firebase-admin`) is **server-only** — Route Handlers, Server
  Actions, `*.server.ts` modules — and lives in `lib/firebase/admin.ts` opening with
  `import "server-only"`. **Never import the Admin SDK from a file a client bundle can
  reach.**
- **A service account key never lives inside a project repo.** Either keep it entirely
  outside the repository and reference it by path through an environment variable, or paste
  the JSON into a deployment environment variable. Both satisfy §22; keeping it outside the
  repo is stricter than §22's `.secrets/` and is preferred where the fleet shares one key
  store. **Never commit a key file**, even to a private repository.
- **Environment variables.** Client-exposed config is `NEXT_PUBLIC_FIREBASE_*` — `API_KEY`,
  `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`. Admin
  credentials and any admin allowlist stay server-only and unprefixed. All of it in
  `.env.local`, gitignored. Record every one in `environment.md` (§2) by name and owner,
  never by value.
- **One Firebase project, many apps: use a named database.** `getFirestore(app, "db-name")`,
  never the default, when an internal tool shares a Firebase project with a public site.
  Isolation without a second project.
- **A duplicated authorisation check must be noted at both sites.** An admin allowlist that
  exists in app code *and* in `firestore.rules` is two sources of truth kept in sync by hand.
  When you touch either, say so at the other.
- **Editing `firestore.rules` does nothing until it is deployed.** Validate first
  (`firebase_validate_security_rules` via the Firebase MCP), then
  `firebase deploy --only firestore:rules`. Confirm the result rather than trusting the exit
  status — a deploy can report success and create nothing.
- **A composite index is declared in `firestore.indexes.json`, and a missing one does not
  fail fast.** The Admin SDK retries, so the symptom is a build that *hangs* until the
  framework kills the page, reporting nothing useful. Suspect a missing index before
  anything else when a page build times out.
- **Firebase is not exempt from §16 or §21.** Every read and write path gets loading, error
  and empty states.
- **A public page never fetches Firestore in a component.** It serves crawlers an empty
  skeleton, which for a content site is the whole ballgame. Read on the server; the one
  exception is an admin preview route rendering an unpublished draft, which the server path
  will not return.

---

## 27. Package manager

- **npm is the fleet default.** Use it unless the project's own `CLAUDE.md` explicitly says
  otherwise.
- A project may pin a different manager for its own reasons. That is a per-project override,
  **documented in that project's `CLAUDE.md`**, not a fleet change. Do not switch a
  project's package manager without asking.

---

## 28. Git, commits and the checkpoint

Recovered nothing; this is new in v2.4.0. It exists because agents commit on their own
initiative, which looks like diligence and is not.

**Git is invoked by the owner. An agent never commits or pushes on its own initiative** —
not `add`, not `commit`, not `push`, not a "quick tidy-up commit" at the end of a task. A
dirty working tree at the end of a piece of work is the correct state, not an untidy one.

**There is one trigger, and it is a phrase:**

| The owner says | The agent does |
| --- | --- |
| *anything else* | No git at all. Leave the tree as it is. |
| `checkpoint` | Documentation pass, then **ask** about commit and push, separately. |
| **`git checkpoint`** | Documentation pass, then **commit and push.** Both pre-authorised. |
| **`git checkpoint max`** | The same, exhaustively verified claim by claim. |

The `checkpoint` skill lives at `~/.claude/skills/checkpoint/SKILL.md` and `relay`, its
inverse, at `~/.claude/skills/relay`. **Both are user-level and may not appear in a session's
surfaced skills list — look for them rather than improvising a commit process**, which is how
a session ends up inventing its own worse version of a protocol that already exists.

**Batch. Do not commit per change.** A session's work lands as one considered set of commits
at a checkpoint. A long string of small commits is not tidiness — it is the thing this rule
exists to prevent, and it makes a session's history harder to read rather than easier.

**An approval does not generalise.** "Yes, commit that" authorises the commit in front of you
and nothing after it. The next one needs its own trigger. The same applies to a push: one
push approved is not pushing approved.

**Where the branch auto-deploys, a push is a production release.** Say so in the
confirmation. The owner should never learn from somewhere else that a checkpoint shipped.

**The safety exceptions still stand**, and they are worth a sentence rather than silence: a
secret in the staged diff, a dirty tree containing work that is not yours, a detached HEAD,
or a push that would need a force. Stop for those even mid-checkpoint. A routine push needs
no such sentence.

**Every commit must build standalone** (§23). When splitting a session's work, check
file-level imports at each boundary — a green typecheck on the final tree proves nothing
about the commits before it.

---

## Checklist — new project

- [ ] `create-next-app` with TypeScript, Tailwind, App Router, `src/`, `@/` alias
- [ ] `.gitignore` covers `.secrets/` and `.env*` — first commit, before code
- [ ] `tsconfig.json` strict confirmed
- [ ] Design direction proposed and chosen (§13)
- [ ] `design-system.md` written and tokens in `@theme` before any UI work
- [ ] shadcn initialised and primitives customised to the tokens (§14)
- [ ] Navigation style confirmed with the owner
- [ ] Zustand and zod confirmed as needed or not needed
- [ ] Data adapter interface defined, if the project has data (§9)
- [ ] Base components built: navigation, footer, button
- [ ] Document set created — only the files that have content (§2)
- [ ] Structure matches §8
- [ ] MCP servers active: Context7, Next.js DevTools, shadcn, Firebase and
      Vercel where applicable, web search
- [ ] `.env.local` created, and every variable recorded by name and owner in
      `environment.md` (§26 for the Firebase set)
- [ ] First `npm run build` passes clean
- [ ] **`project-rules.md` copied into the project root and `@project-rules.md` imported
      from `CLAUDE.md`** — and **committed**. An untracked copy is one `git clean` from gone.

---

## Changes

### 2.4.0
Added **§28 Git, commits and the checkpoint** after a session committed four times off its own
initiative across one piece of work — each commit individually defensible, the pattern not what
was wanted. The rule was previously carried only in conversation and in individual projects'
`CLAUDE.md`, which meant every new repo relearned it the same way.
- One trigger phrase, stated as a table: `git checkpoint` is the authorisation, everything else
  is not.
- Batching made explicit, because "commit early, commit often" is the default an agent arrives
  with and it is wrong here.
- An approval does not generalise to the next commit.
- Names the `checkpoint` and `relay` skills by path, and warns that they may not appear in a
  surfaced skills list.

**Appended, nothing renumbered** — §1 through §27 are unchanged, so every `conventions.md`
cross-reference written against v2.3.0 remains correct. Copies of this file elsewhere in the
fleet now read as one minor version behind, which is the drift detector working as intended.

### 2.3.0
Recovered two sections that v2.1.0 dropped, found when `tinker-together` was audited against
v2.2.0 and turned out to be running v2.0.0. Nothing renumbered — both were **appended** as
§26 and §27, because §12, §16, §18, §22 and §25 are referenced by name from existing
projects' `conventions.md` and `decisions.md`, and renumbering would silently invalidate
every one of those references.
- §26 Firebase restored from v2.0.0 §17, expanded with what the NCA work proved: rules are
  inert until deployed, a missing composite index hangs a build rather than failing it, and
  a public page must never fetch Firestore in a component. Reconciled with §22 rather than
  contradicting it — a key kept outside the repo is stricter than `.secrets/`, not a
  violation of it.
- §27 Package manager restored from v2.0.0 §18, unchanged in substance.
- Checklist: `project-rules.md` must be copied in **and committed**. Its absence from the
  v2.2.0 checklist is why one project's copy has never been tracked.

### 2.2.0
Conventions proven on the Simetrix build, generalised.
- Project document set defined, with update triggers and the delete-if-unowned
  rule (§2)
- Naming section added — interface, code and documentation share vocabulary (§6)
- Data adapter promoted to its own rule (§9)
- Entity lifecycle rule added — transitions declared once, nothing writes status
  directly (§10)
- Prototype shortcut register added (§11)
- Security expanded: `.secrets/`, credentials by path, pre-commit hook, scoped
  accounts, rotation order, account ownership (§22)
- Sections consolidated to keep the file readable as it grows

### 2.1.0
- Building for growth, with the line between foresight and speculation
- shadcn customisation made explicit
- Design direction proposals with a starting vocabulary
- QoL extended; standing instruction to offer improvements
- Button-to-modal overlay documented with its limits
- Motion given its own section
- Question tool named as the default for decisions
- Zustand and zod scoped to projects that need them
- Agents must pair every problem with a proposed solution

### 2.0.0
- File length limit removed; replaced by responsibility rules and split triggers
- Precedence rule added — conflicts escalate rather than resolve silently
- Global `types/` directory removed; domain types inferred from zod
- CSS Modules withdrawn; Tailwind only, tokens in `@theme` for v4
- Eight-variant Button withdrawn in favour of shadcn variants plus QoL props
- "Latest version" softened to "latest compatible"
- Design system, component registry and security sections added
- Zustand scope clarified
- Structure moved under `src/`
