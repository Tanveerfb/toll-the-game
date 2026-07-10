# Toll The Game — Codebase Audit & Enhancements Report

Based on a thorough review of the current architecture, documentation, and codebase state, here is a detailed audit of `toll-the-game`. This report outlines recommendations for engineering enhancements, Quality of Life (QoL) additions for both developers and players, and areas to address technical debt.

---

## 1. Architecture & Engineering Improvements

### **Strict Typing for Mechanics & Passives**
- **The Issue**: Currently, `Character.passive` is typed as `any`, and there are frequent `as any` casts surrounding mechanics (noted in `STATUS.md` #7). Furthermore, the `Mechanic` interface in `types/mechanic.ts` is a massive object with 36+ optional fields (e.g., `atkStolen`, `sealType`, `counterDamagePercent`).
- **The Enhancement**: Refactor `Mechanic` and `Passive` into **Discriminated Unions**. 
  - Instead of one giant interface where `atkStolen` is technically available on a `heal` mechanic, define specific interfaces (`interface ShockMechanic { type: 'shock', damagePercent: number, duration: number }`, etc.) and union them: `type Mechanic = ShockMechanic | ExtortMechanic | ...`.
  - This provides airtight intellisense, eliminates the need for `any` casting, and prevents runtime bugs where a mechanic expects a field that wasn't provided.

### **Runtime Validation for JSON Kits**
- **The Issue**: Character kits act as the source of truth and are loaded from `data/characters/*.json`. If a typo is made in a mechanic name or a required field is missed, it could crash the battle engine at runtime.
- **The Enhancement**: Since `zod` is already in the dependencies, create a Zod schema for `Character` and `Mechanic` and parse the JSON files upon loading (e.g., in `characterCatalog.ts`). This ensures that any malformed kit data throws a clear, developer-friendly error immediately on app load rather than mid-battle.

### **State Management Optimization**
- **The Enhancement**: Ensure that `gameStore.ts` does not cause unnecessary re-renders. The store is handling deep state (entire battle phases, hands, field units). Utilize selective Zustand selectors in the UI components (e.g., `useGameStore(state => state.playerTeam)`) so that a change in enemy ultimate gauge doesn't re-render the player's deck.

---

## 2. Quality of Life (QoL) Additions

### **Player QoL Enhancements**
- **Battle Log / Action History**: In complex card battles, it's easy to miss a passive proc, evade, or exact damage numbers. Adding a toggleable or sliding "Battle Log" pane that prints out actions (e.g., *"Ban used Extort -> Stole 400 ATK from Duke"*, *"Duke evaded!"*) would vastly improve readability.
- **In-Battle Status Tooltips**: Currently, players have to memorize what every buff/debuff icon means. Implementing a long-press or hover tooltip on unit status icons in the `BattleArena` to explain the exact effect and remaining duration (e.g., *"Shock: taking 30% damage over 2 turns"*) is a modern gacha staple.
- **Animation Speed Toggle**: As the game progresses, battles might feel slow. Adding a `1x / 2x` speed toggle that scales the `framer-motion` transition durations and the 500ms auto-advance delays in `BattleProvider` would be highly appreciated by players.

### **Developer QoL Enhancements**
- **Consolidated Verification Script**: Add a `npm run check` script to `package.json` that runs `"tsc --noEmit && eslint . && vitest run"`. This allows you to verify types, linting, and tests in one command before committing.
- **Graceful Firebase Degradation**: Address `STATUS.md` issue #15 where Firebase throws console errors on page load due to missing permissions. Wrap the Firestore reads in a check for authentication, or suppress the warning gracefully when running in guest mode to keep the console clean for debugging game logic.

---

## 3. Gameplay / Systems Refinements

### **Damage Preview Parity**
- **The Enhancement**: The `lib/game/damagePreview.ts` system is excellent for card hover states. Ensure it remains perfectly in sync with `damage.ts` and `combat.ts`. As complex passives (like Extort or Giant's Will) are added, the preview needs to evaluate against the *projected* effective stats, not just base stats, and factor in Type Advantage modifiers to be truly accurate.

### **Ultimate Card Progression**
- **The Enhancement**: As noted in `STATUS.md` #6, ultimates currently lack ranks. If you plan to introduce an Ultimate level-up system later (like Dokkan's Super Attack levels or 7DS Ultimate Move levels), architecting the `UltimateCard` type now to accept a `level: number` (1-6) that dynamically scales the ultimate's mechanic multipliers will save massive refactoring later.

### **Robust Effect Resolution (Tick System)**
- **The Enhancement**: Ensure the exact order of operations in `lib/game/tick.ts` is bulletproof. For example, if a unit takes lethal damage from a "Shock" tick at the start of the turn, do they trigger `onLethalDamage` passives? Does a sub promote immediately in that same `OnPlayerTurnStart` phase, or wait until next turn? Documenting and writing explicit Vitest coverage for these exact edge-case death scenarios will prevent frustrating bugs.

---

## 4. Technical Debt & Asset Management

### **Asset Optimization**
- **The Enhancement**: `STATUS.md` #11 mentions a 4 MB legacy background PNG in `public/bg-images/`. Convert this (and any future AI-generated art that is too heavy) to `.webp` format. It will reduce the bundle size and improve page load times significantly, especially on Vercel's free tier bandwidth.
- **Image Cache-Busting**: The current workaround `?v=ART_VERSION` is okay for development, but Next.js `next/image` handles hashing and caching automatically if configured correctly. Migrating standard `<img>` tags to Next's `<Image>` component for static assets will handle optimization and cache-busting natively.

### **Dependency Upgrades Strategy**
- **The Enhancement**: TypeScript 6 and ESLint 10 are deliberately held back. Keep a close eye on the Next.js release notes. Once Next.js 16 marks full stable support for ESLint 9/10 and TS 6, unpin them to take advantage of the newer TS compiler performance and strictness features.
