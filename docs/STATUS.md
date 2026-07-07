# Status — 2026-07-07

Living snapshot. History of the resurrection audit is in git (`docs/STATUS.md` @ `c3040f7`).

## Working (implemented, tested, browser-verified)

- **Battle engine** — full phase state machine, 3-actions-per-turn enemy AI (random living field enemy each action, decisions from live state), win/loss detection.
- **Rank system** — card rank drives damage multiplier, `*Ranked` mechanic values, and `aoeRanked` activation; flat mechanic values stay flat; ultimates rank-immune.
- **Deck (7DS GC rules)** — hand never resets; pure-random one-at-a-time refill with auto-merge on adjacent identical cards (+1 ult gauge per merge); ult guaranteed only if gauge was full BEFORE the refill; deck locked outside `PlayerAction`; empty-hand auto-pass.
- **Sub units** — battle format 4v4 (all field) or 3v3 (4th member auto-sub); sub passive active from bench, no cards, untargetable; promoted at new-turn start after a teammate dies; lone subs auto-convert to field.
- **Character kits** — 10 JSON kits incl. Duke's full Flowing Ruin (3-stack consume, +50% dmg, ATK-down all targets, skills+ult both build/consume) and Seras (Shock DoT, CRITICAL ult, Charged evade passive, Powerful Opponent synergy); debuff-type skills deal their damageRanked damage.
- **Type advantage** — Dark<>Light mutual, Red>Green>Blue>Red; +20%/−10%/0; CRITICAL ignores it.
- **Evade system** — base 0% for everyone; Charged stacks grant +5% each; evaded attacks deal nothing but still feed Charged.
- **UI (shadcn/ui + Tailwind 4)** — main menu, team select (format toggle, 1–4 units, art slots), battle arena (compact unit cards, sub badges, victory/defeat overlay with rematch), deck dock with hover previews and rank-aware descriptions, archive tile grid + Dokkan-style detail pages, login/profile (Firebase optional → guest mode).
- **Character art** — full roster AI-generated (ComfyUI + Animagine XL 4.0, Dokkan × 7DSGC style); pipeline in `docs/ART_PIPELINE.md`.
- **Tests** — 50 across combat rank, Flowing Ruin, AI, debuff skills, damage formula, ticks, subs, deck flow.

## Open Issues

| # | Issue | Where | Severity |
|---|---|---|---|
| 6 | Ultimates have no rank while skills rank up — confirmed intended for now; Tanveer may add an ult level-up system later | `types/ultimateCard.ts` | Design note |
| 7 | `Character.passive: any` and `as any` casts around mechanics — type safety hole | `types/character.ts` | Medium (refactor) |
| 11 | 4 MB legacy background PNG | `public/bg-images/` | Cosmetic |
| 13 | Art nitpicks: Seras's horn-like hair tufts didn't render; Yalina's side braid renders as loose side curls (trigger-word/style limits — see ART_PIPELINE trigger-word table) | `public/characters/` | Cosmetic (re-roll) |
| 14 | Mustafa + Siddiq designs still AI-invented (Batra invented from lore hints) — regenerate when Tanveer supplies sheets. Duke/Gabrist/Yalina redesigned per his direction + ref photos 2026-07-07; Lyra/Tao/Sara/Seras from his locked sheets (`docs/design/characters/`) | `docs/ART_PIPELINE.md` | Pending input |
| 15 | Console `FirebaseError: Missing or insufficient permissions` on page load — a Firestore read is denied by security rules (likely guest/unauthenticated). Harmless to gameplay but noisy; fix rules or gate the read when Firebase persistence work starts (Phase 4) | Firebase / stores | Low |

## Not Built Yet

- Story mode (menu button disabled) — needs Tanveer's enemy kits + stage design
- Player progression/collection (playerStore is a stub; profile shows account only)
- ~10 additional characters (Tanveer adds when game is in working order)
- Mobile layout pass, sound
- Deployment (Vercel target; Firebase project `toll-the-game` exists for auth/Firestore)

## Environment

- Node 24, Next.js 16.2.10, React 19.2.7. Majors deliberately held: TypeScript 5.9 (not 6), ESLint 9 (not 10) — Next 16 support unconfirmed.
- Known `npm audit` leftover: postcss <8.5.10 nested inside `next` — upstream.
- Firebase env in `.env.local` (gitignored); pullable via Firebase MCP from project `toll-the-game`. App runs guest-mode without it.
- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` for art generation.
