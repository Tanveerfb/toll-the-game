# Toll the Game (Element Clash)

Turn-based card battle webapp for the **Element Clash** IP. Players queue skill cards drawn from their team, merge duplicates to rank them up, charge ultimates, and fight an AI-controlled enemy team.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| State | Zustand (`store/gameStore.ts`) |
| UI | HeroUI React v3 + Tailwind CSS 4 + framer-motion |
| Auth/backend | Firebase (auth wired, gameplay is client-side) |

## Getting Started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

Firebase config lives in `.env.local` (gitignored, `NEXT_PUBLIC_FIREBASE_*` keys — pull values from the `toll-the-game` Firebase project). Without it the app still runs in guest mode; auth is simply disabled.

## Routes

| Route | Purpose |
|---|---|
| `/` | Main menu (Story disabled, Archive, Practice, Login/Profile) |
| `/practice` | Starts the 4v4 test battle |
| `/archive` | Character browser |
| `/archive/[id]` | Character detail |

## Project Layout

```
app/                 Next.js routes
components/game/     BattleArena, Deck, CharacterBrowser, effects overlay
hooks/               BattleProvider (turn engine), MechanicProvider (phase queue), AuthProvider
lib/game/            combat.ts (skill execution), damage.ts (damage formula),
                     ai.ts (enemy AI), passive.ts (battle-start passives),
                     damagePreview.ts, descriptionTranslator.ts
store/               gameStore.ts (battle + deck state), playerStore.ts
data/characters/     Character JSON definitions (9 characters)
types/               Shared TypeScript contracts
docs/                Architecture, status audit, roadmap
_dev/                Design notes (character kits)
```

## Documentation

- [docs/HANDOFF.md](docs/HANDOFF.md) — **start here if you're an agent/new contributor**: context, design rulings, working style
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the battle engine works end to end
- [docs/STATUS.md](docs/STATUS.md) — living snapshot: what works, open issues
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased plan with completion history
- [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md) — AI character art generation (ComfyUI)

## Design Ownership

Skill names, mechanical effects, damage multipliers, and character kit JSON decisions belong to Tanveer. Code/agents document and implement them — they do not invent or rebalance mechanics unprompted.
