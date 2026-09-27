# Environment

**Who updates this:** whoever adds an environment variable, an external
account or a local tool the build depends on, in the same change
(`project-rules.md` §2, §26). **Names, purposes and owners only, never
values.** Started 2026-09-27 from the Environment section of `docs/STATUS.md`,
moved verbatim below the table.

## Accounts and variables

| What | Purpose | Owner |
| --- | --- | --- |
| Firebase project `toll-the-game` | Auth (Google sign-in) and the Firestore cloud save. `firestore.rules` is deployed from this repo | Tanveer |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Client Firebase config, read in `lib/firebase.ts`. In `.env.local` (gitignored). Absent, the game runs in guest mode | Tanveer |
| Vercel project | Hosts https://toll-the-game.vercel.app/. **Every push to `master` deploys to production** | Tanveer |
| GitHub `Tanveerfb/toll-the-game`, `Tanveerfb/toll-kits` | The game, and the private kit workshop | Tanveer |
| ComfyUI portable, `E:\Installed\ComfyUI_windows_portable` | Art generation, local only (`docs/ART_PIPELINE.md`) | Tanveer's machine; Claude drives it |

No server-side credential exists: there is no Admin SDK and no service account.

## Toolchain

- Node 24, Next.js 16.2.10, React 19.2.7. Majors deliberately held: TypeScript 5.9 (not 6), ESLint 9 (not 10) — Next 16 support unconfirmed.
- Known `npm audit` leftover: postcss <8.5.10 nested inside `next` — upstream.
- Firebase env in `.env.local` (gitignored); pullable via Firebase MCP from project `toll-the-game`. App runs guest-mode without it.
- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` for art generation.
