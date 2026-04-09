<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# toll-the-game — Project Documentation

## Project Name

toll-the-game

## Stack

| Technology          | Role                                          |
| ------------------- | --------------------------------------------- |
| Next.js 14+         | App framework (App Router)                    |
| TypeScript (strict) | Type safety across all files                  |
| SASS                | Styling (modular .module.scss files)          |
| Firebase            | Authentication only (no Firestore/Storage)    |
| Zod                 | Runtime schema validation                     |
| PixiJS              | 2D sprite/canvas rendering for card/battle UI |
| Three.js            | 3D background or scene effects                |
| Lottie (lottie-web) | Animated skill/UI effects                     |
| Framer Motion       | Page/component transitions and UI animations  |
| Zustand             | Global game state management                  |

---

## Folder Structure

```
app/                  Next.js App Router — pages, layouts, route segments
components/
  ui/                 Reusable, generic UI components (buttons, modals, tooltips)
  game/               Game-specific components (card displays, battle UI, health bars)
lib/
  firebase.ts         Firebase app init — auth export only
  game/
    damage.ts         Damage calculation logic and modifiers
    gacha.ts          Gacha/banner pull system logic
    ai.ts             Enemy AI decision logic
store/
  gameStore.ts        Zustand store for shared game state (battle, player, gacha)
types/                TypeScript type/interface definitions (no logic)
hooks/                Custom React hooks
public/               Static assets (images, audio, spritesheets)
```

---

## Types & Interfaces (`/types`)

### `color.ts` — `Color`

```ts
type Color = "light" | "red" | "blue" | "green" | "dark";
```

Represents the elemental/faction color of a character or card. Used for matchup logic and visual theming.

---

### `skillType.ts` — `SkillType`

```ts
type SkillType =
  | "attack"
  | "debuff"
  | "heal"
  | "buff"
  | "stance"
  | "disable"
  | "cleanse"
  | "ultimate";
```

Categorizes what a skill does. `"ultimate"` is reserved exclusively for `UltimateCard` and excluded from `SkillCard.type`.

---

### `statMultiplier.ts` — `StatMultiplier`

```ts
type StatMultiplier = "atk" | "hp" | "def";
```

Identifies which stat a skill's damage/effect scales from.

---

### `character.ts` — `Character`

```ts
interface Character {
  name: string;
  color: Color;
  atk: number;
  def: number;
  hp: number;
  skills: [SkillCard, SkillCard]; // exactly 2 skills
  ultimate?: UltimateCard; // optional ultimate
}
```

Core character definition used in battle and collection. `skills` is a fixed-length tuple of exactly 2 `SkillCard` entries.

---

### `skillCard.ts` — `SkillCard`

```ts
interface SkillCard {
  skillName: string;
  url?: string; // optional icon/animation URL
  statMultiplier: StatMultiplier;
  damageRanked: [number, number, number]; // [low, mid, high] ranked damage
  characterId: string;
  type: Exclude<SkillType, "ultimate">; // never "ultimate"
}
```

Represents a regular skill card. `damageRanked` is a 3-tier tuple allowing ranked upgrade behavior. `type` explicitly excludes `"ultimate"` to enforce correct typing.

---

### `ultimateCard.ts` — `UltimateCard`

```ts
interface UltimateCard {
  skillName: string;
  url?: string;
  statMultiplier: StatMultiplier;
  damage: number; // single fixed damage value (not ranked)
  characterId: string;
  type: "ultimate"; // always literal "ultimate"
}
```

Represents a character's ultimate skill. Unlike `SkillCard`, `damage` is a single value and `type` is the literal `"ultimate"`.

---

## Game Logic Files (`/lib/game`)

### `damage.ts`

Handles all damage calculations during battle.

- Base damage formula using `statMultiplier` (atk/hp/def)
- Modifier effects:
  - **Ignite**: damage-over-time multiplier applied each turn
  - **Detonate**: burst damage triggered by combining status effects
  - **Weakpoint**: bonus damage multiplier when hitting an exposed weakness
- Will export pure functions only (no side effects); results fed into Zustand store externally

### `gacha.ts`

Handles the banner/pull system for acquiring characters and cards.

- Pull rate tables per banner tier
- **Pity steps**: guaranteed upgrades at pull counts 150 / 300 / 600
- Banner types (e.g., standard, limited, character-specific)
- All pull state tracked locally (no server calls); seeded RNG for reproducibility

### `ai.ts`

Controls enemy decision-making during battle.

- Priority queue (highest to lowest):
  1. `heal` / `cleanse` — if any ally is debuffed or low HP
  2. `ultimate` — if ultimate gauge is full
  3. `buff` / `debuff`
  4. `attack`
  5. `stance`
- Target selection: always targets the **lowest HP** ally first
- Will export a single `getAIMove(state)` function returning the chosen skill and target

---

## Data Storage

- **All game data** (characters, cards, battle state, gacha pulls) is stored **locally** using Zustand (in-memory) and `localStorage` for persistence
- **Firebase** is used **only for authentication** (sign in / sign up / session management)
- No game data is written to Firebase or any remote database

---

## State Management (`/store/gameStore.ts`)

- Uses **Zustand** for all shared game state
- Planned slices:
  - `battleState` — current battle (active characters, turn order, HP, status effects)
  - `playerState` — player's owned characters/cards, pull history, pity counters
  - `uiState` — modal visibility, active screen, loading flags
- Store is the single source of truth; game logic functions in `/lib/game` are called externally and their results written back into the store
