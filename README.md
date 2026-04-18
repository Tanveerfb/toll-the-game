# Toll the Game

A strategic card battle framework built on Next.js 14+ (App Router). 

## Technology Stack
- **Next.js 14+**: Core routing and application layer.
- **TypeScript**: Strict robust structural typings.
- **Zustand**: Single source of truth for global state scaling (Gacha, Battle States).
- **PixiJS & Three.js**: Visual rendering layers.
- **Recharts**: Internal testing evaluation componentry. 

## Features Currently Implemented
- **Phase Engine Loop**: Fully fleshed battle phase transitions pausing seamlessly for Player/AI interaction.
- **Asymmetric Queue Resolutions**: A top-down `MechanicProvider` managing deeply registered callbacks that resolve based strictly on `BattlePhase` timings (e.g. `OnBattleStart`, `OnPlayerTurnEnd`).
- **Damage Mitigations**: Additive mechanics engine (`damage.ts`) featuring:
  - **Ignite**: Stack-based global vulnerability exploitation (+10% per stack).
  - **Detonate**: Contextual burst triggers explicitly based on target's generated ultimate gauges. 
  - **Weakpoint**: x3 Multipliers strictly validated against present active debuffs. 

## Getting Started

First, run the development server:

```bash
npm run dev
# or tightly bound commands depending on package manager
```

Open [http://localhost:3000](http://localhost:3000) with your browser to visualize the current mechanic evaluations mapped cleanly onto the **BattleTester** overlay!
