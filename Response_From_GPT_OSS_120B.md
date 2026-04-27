# Turn‑Based Web Card Battle UI – Production‑Ready Design Plan

_(Tailored for Next.js 13 (App Router) + TypeScript strict + Zustand + HeroUI v3 + Tailwind v4 + Framer‑Motion)_

---

## 1️⃣ HIGH‑LEVEL CONCEPT (ONE‑PAGE)

### Vision

**“A kinetic, anime‑styled tactical arena where every card move feels weighty, every unit’s status is instantly readable, and the flow of a turn is clear enough that a player can anticipate the next move at a glance.”**

### Core Design Pillars

| Pillar                             | What it means for the battle UI                                                                       | Tactical Impact                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Readability**                    | Hierarchical visual weight, “signal‑over‑noise” for numbers/effects, high‑contrast status icons.      | Player spots damage, buffs, or a looming AoE in < 300 ms.                |
| **Clarity of Intent**              | Explicit queue slots, target previews, and lock‑in phases; disabled UI signals unavailable actions.   | Reduces mis‑clicks; the player always knows “what will happen next”.     |
| **Anticipation**                   | Phase progress bar, ult‑gauge pulse, and subtle “ready” animation that cue the next turn.             | Encourages planning, makes the game feel strategic rather than reactive. |
| **Excitement**                     | Layered motion (card lift, particle splash, camera shake for big attacks), sound‑linked visual beats. | Keeps the match feeling alive and “anime‑like”.                          |
| **Accessibility & Responsiveness** | Keyboard/controller navigation, color‑plus‑shape semantics, mobile‑first touch targets.               | Everyone can play on desktop or phone with consistent experience.        |

### Visual Language (Anime/Fantasy)

- **Palette** – Deep midnight‑blue canvas, accent gels (crimson, electric‑blue, jade, amber).
- **Edges** – Soft rounded corners (4 px) with subtle glowing borders to denote rarity/faction.
- **Typography** – Primary: **“Jost”** (clean sans) for UI; Secondary: **“Bebas Neue”** for titles/labels.
- **Particle Motifs** – Small rune bursts for buffs, ember trails for ignite, icy shards for freeze.

### Interaction Flow (at a glance)

```
[OnBattleStart] → UI fades in, gauges animate → [OnPlayerTurnStart]
  ↓ Player selects up to 3 cards → queue slots fill → target markers appear
  ↓ [PlayerAction] (confirm) → Cards flip, arrows animate → action resolution
  ↓ Damage/Heal numbers pop, status icons tick → [OnPlayerTurnEnd]
  ↓ Enemy AI auto‑plays (no UI) → visible via same resolution pipeline
  ↓ Loop → Victory/Defeat overlay pops when health reaches 0
```

### Technical Quick‑Start

- All UI lives under `/app/battle/page.tsx` (client component).
- **Zustand** slice `useBattleStore` holds phase, units, hand, queue, UI flags.
- **HeroUI**–styled compound components (`<Card>`, `<Board>`, `<StatBadge>`).
- **Tailwind** – responsive grid (`lg:grid-cols-12`, `sm:grid-cols-6`).
- **Framer Motion** – common `variant` objects (`cardVariants`, `effectVariants`).

---

## 2️⃣ DETAILED BLUEPRINT

### 2.1 UX Strategy – Core Design Goals

| Goal                        | Implementation Touchpoints                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tactical Readability**    | • Damage/Heal numbers large, color‑coded, slight drop‑shadow. <br>• Buff/debuff icons appear as layered “status chips” on unit portraits. <br>• Ult gauge is a radial meter around the player avatar, pulses on change. |
| **Turn Anticipation**       | • Top‑center **Phase Bar** shows current phase with segmentation (Start → Action → End). <br>• When a phase is about to change, a subtle “glow‑bloom” animation runs on the next active UI area.                        |
| **Error‑Proof Interaction** | • Queue slots turn **red** & shake when a card is illegal (e.g., stun‑blocked). <br>• “Confirm Turn” button is disabled until queue is full or at least one card placed **and** a valid target is selected.             |
| **Excitement**              | • Each card play fires a **particle burst** using Framer Motion’s `layoutId`. <br>• Heavy AoE attacks cause a low‑frequency screen shake and a radial flash.                                                            |
| **Accessibility**           | • All status colors have **shape overlays** (e.g., a shield for “taunt”, flame for “ignite”). <br>• Keyboard focus outlines are bright cyan; screen‑reader ARIA labels include effect names.                            |

---

### 2.2 Information Hierarchy

| Layer                       | Must‑Always‑Be‑Visible                                                                        | Contextual / On‑Demand                                              |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Global**                  | • Player HP / Enemy HP bars <br>• Ult gauge <br>• Phase indicator <br>• Turn timer (optional) | • Mini‑map (if future maps added)                                   |
| **Units** (each board tile) | • Portrait, current HP bar, status chips, taunt halo (if active)                              | • Hover/ tap tooltip: full buff list, remaining duration, cooldowns |
| **Hand**                    | • Cards in hand (thumbnail, cost, rarity)                                                     | • Hover/long‑press: full card description, effect preview           |
| **Queue**                   | • 3 slot placeholders, occupied card previews                                                 | • Slot‑specific tooltip showing “Will be used on turn X”            |
| **Targeting**               | • Target markers on selectable units (colored ring)                                           | • AoE preview overlay (transparent area) that follows cursor/tap    |
| **Log**                     | • Last 3‑5 events (damage numbers) displayed as floating text in combat layer                 | • Full scrollable battle log panel (toggle)                         |
| **Victory/Defeat**          | • Full‑screen overlay with animated backdrop                                                  | –                                                                   |

---

### 2.3 Battle Screen Blueprint

Below is a **responsive layout** using Tailwind’s grid system. All units are “cards” placed on a board; the UI is split into three vertical zones on desktop, two zones on mobile.

#### 2.3.1 Desktop (≥ lg) – 12‑column grid

```
+-----------------------------------+------------------------------+
|            Top HUD (full width)   |                              |
|   [Phase Bar]  [Ult Gauge]  [Timer]                               |
+-----------------------------------+------------------------------+
| Enemy Board (col‑span 8)          | Player Board (col‑span 4)    |
|  ┌─┬─┬─┐   ┌─┬─┬─┐   ┌─┬─┬─┐      |   ┌─┬─┬─┐   ┌─┬─┬─┐   ┌─┬─┬─┐   |
|  │E│E│E│   │E│E│E│   │E│E│E│      |   │P│P│P│   │P│P│P│   │P│P│P│   |
|  └─┴─┴─┘   └─┴─┴─┘   └─┴─┴─┘      |   └─┴─┴─┘   └─┴─┴─┘   └─┴─┴─┘   |
|   (8 tiles – 4v4)                |   (4 tiles – 4 allies)      |
+-----------------------------------+------------------------------+
|            Center Combat Feedback (full width, overlay)           |
|   floating damage numbers, AoE previews, status bursts          |
+------------------------------------------------------------------+
|   Bottom UI (full width)                                          |
|   ┌───────────────────┐   ┌─────────────────────┐                |
|   │ Hand (max 7 cards)│   │ Action Queue (3)    │                |
|   └───────────────────┘   └─────────────────────┘                |
|   [Confirm Turn]  [Cancel]                                      |
+------------------------------------------------------------------+
|            Battle Log (toggle) – collapsible panel at right side |
+------------------------------------------------------------------+
```

_Key percentages_ – Top HUD 10 vh, Enemy/Player Boards 55 vh, Combat Feedback overlay takes the same space, Bottom UI 20 vh, log 15 vh (collapsible).

#### 2.3.2 Mobile (≤ sm) – 6‑column stacked layout

```
+-------------------+
|  Top HUD (full)   |
+-------------------+
| Enemy Board (full)|
|  (2‑row grid)    |
+-------------------+
| Center Combat FB |
| (overlay)        |
+-------------------+
| Player Board (full)|
| (2‑row grid)       |
+-------------------+
| Hand (scroll‑h)   |
|   ←→ swipe        |
+-------------------+
| Action Queue (3)  |
+-------------------+
| Confirm / Cancel  |
+-------------------+
| Battle Log (toggle)|
+-------------------+
```

_Touch‑target sizing_ – Minimum 44 × 44 dp (Tailwind `min-w-[44px] min-h-[44px]`). Hand scrolls horizontally (`overflow-x-auto`).

---

### 2.4 State‑to‑UI Mapping

| Battle Phase                                 | UI Elements                                                                      | Enabled Controls                                        | Visual Transition                                                                           | Loading / Processing                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **OnBattleStart**                            | Fade‑in page, init HUD, populate decks                                           | None (blocked)                                          | `opacity-0 → opacity-100` (500 ms)                                                          | Show “Preparing…” spinner for 300 ms (even if logic ready).                             |
| **OnPlayerTurnStart**                        | Highlight Player Board (border glow), enable hand cards & queue slots            | Card selection, drag‑to‑queue, target markers appear    | `border-glow` (pulse 1.2 s)                                                                 | Small “turn‑start” sound + particle; UI non‑blocking.                                   |
| **PlayerAction** (building queue)            | Queue slots accept drops, hand cards dim when used, “target mode” cursor appears | Drag‑drop, click‑to‑select target (hover shows preview) | Card lifts (`y: -10`, `scale: 1.08`) on drag start; target ring fades in (`opacity-0 → 1`). | No blocking; only visual feedback.                                                      |
| **OnPlayerTurnEnd** (After pressing Confirm) | Lock hand & queue (gray overlay), show “Executing Turn” overlay                  | **All inputs disabled**                                 | Queue cards animate to center, then burst out to targets using `cardVariants.actionPlay`.   | Show a **progress bar** (0‑100 % over expected animation time, e.g., 2.2 s).            |
| **OnEnemyTurnStart**                         | Enemy board glows (soft orange), AI logic runs (hidden)                          | None                                                    | “Enemy thinking” indicator (spinning gear)                                                  | Show a **brief 400 ms pause** with subtle “thinking” particles to avoid freeze feeling. |
| **EnemyAction**                              | Same combat‑feedback layer renders enemy actions automatically                   | None                                                    | Same `cardVariants.actionPlay` but start from enemy side; optional reverse animation.       | No UI lock – only log updates.                                                          |
| **OnEnemyTurnEnd**                           | Highlight next player turn, re‑enable hand                                       | Hand, queue, targets                                    | Border glow flips to player side; `phaseBar` segment advances.                              | Short “turn transition” chime (150 ms).                                                 |
| **Victory / Defeat**                         | Full‑screen overlay with animated backdrop (confetti / smoke)                    | None                                                    | Fade‑in + scale‑up for “Victory!” text (`scale: 0.8 → 1.2`).                                | Block everything for 2 s, then show “Return to Lobby” button.                           |

**Processing States** – Use a `ui.isProcessing` boolean in the store. Whenever true, all interactive components subscribe to this flag and add `pointer-events-none` + `opacity-60`. This guarantees the UI never feels “frozen”; a thin animated spinner is always visible.

---

### 2.5 Combat Readability System

| Effect                                | Visual Treatment                                                                                                                                                                  | Timing / Stacking                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Damage**                            | Large red number (`text-[2rem] font-bold text-rose-500`) + small orange outline. <br>Falls from the target with `motion.y: -30 → 0` over **300 ms**.                              | If > 1 damage on same unit in a turn, numbers **group** (e.g., “-45”) with a `+` prefix for extra hits. |
| **Heal**                              | Light green (`text-emerald-400`) with a subtle halo (<span style="text-shadow: 0 0 4px #6ee7b7">)                                                                                 | Same timing as damage, but w/ upward motion 300 ms.                                                     |
| **Buff / Debuff Icon**                | Small circular chip on top‑right of portrait: <br>• **Buff** = blue shield icon + `bg-blue-900/70`. <br>• **Debuff** = red skull icon + `bg-red-900/70`. <br>Hover shows tooltip. | Icon **pulses** (`scale: 1 → 1.1`) when applied, fades out after duration.                              |
| **DoT / HoT (Ignite, Poison, Regen)** | Periodic **tick text** (“-5”) appears each turn, **attached to the unit** with a small animated particle (flame/poison droplet).                                                  | Appear **just after** the main damage/heal number; duration shown as small numeric badge.               |
| **Ult Gauge**                         | Radial progress around player avatar, **glows** on increase. <br>When crossing threshold, a **burst sparkle** (gold) plays.                                                       | Gauge updates instantly; gradient animation over **150 ms**.                                            |
| **Death / Revive**                    | Death: unit portrait fades to grayscale, “✖” overlay fades in. <br>Revive: bright flash, sound `revive.wav`, portrait returns with “+HP” number.                                  | Death animation **500 ms**; revive **700 ms** (includes “revive” text).                                 |
| **Multiple Simultaneous Effects**     | **Priority order:** 1️⃣ Damage > 2️⃣ Heal > 3️⃣ Buff/Debuff icons > 4️⃣ Status ticks. <br>All numbers stack in a **vertical stack** above the unit with `gap-1`.                      | Stack animates sequentially (0.12 s offset).                                                            |
| **Stun / Taunt**                      | Stun: **blue electric ring** around unit, shakes slightly. <br>Taunt: **golden crown icon**; enemy AI target arrows snap to it.                                                   | Ring fades in 150 ms, stays for duration.                                                               |

**Noise Reduction** – If more than **5** numbers appear on a single unit in the same frame, they collapse into a single “+X” (e.g., “+27”) with an asterisk that can be tapped to expand a tiny tooltip.

---

### 2.6 Action Queue Interaction Design

#### 2.6.1 Selecting Cards

| Interaction                            | Visual Cue                                                                       | State              |
| -------------------------------------- | -------------------------------------------------------------------------------- | ------------------ |
| **Hover / Focus** (desktop)            | Card lifts (`scale: 1.02`) and border glows (`ring-2 ring-primary`).             | `isHover=true`     |
| **Tap** (mobile)                       | Card flips slightly (`rotateY: 10deg`) and “selected” badge appears on top‑left. | `isSelected=true`  |
| **Drag to Queue**                      | Card **drags** with shadow, queue slots highlight (`bg-primary/10`).             | `dragging=true`    |
| **Drop on Valid Slot**                 | Slot flashes green (`bg-green-500/30`) then locks card.                          | `queueSlot.filled` |
| **Invalid Drop** (e.g., queue full)    | Slot shakes left‑right (`x: [-4, 4, -4]`) and red ring (`ring-2 ring-red-500`).  | `error`            |
| **Card Disabled** (e.g., stunned unit) | Card opacity `0.4`, “X” overlay (no‑entry icon).                                 | `isDisabled`       |

#### 2.6.2 Reordering

- **Drag‑reorder** along the queue bar; placeholder stripe shows where card will land.
- **Keyboard**: arrow keys left/right on selected queue slot, `Enter` to confirm move.

#### 2.6.3 Deselect / Cancel

- **Tap** the card again removes it from queue (returns to hand).
- **Cancel Button** (top‑right of queue) clears entire queue after **confirm dialog** (`Are you sure?`).

#### 2.6.4 Interaction States

| State                      | UI Indicator                                                        | Reason                                 |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| **Valid**                  | Green glow, slot highlight on hover.                                | Card can be queued and target exists.  |
| **Invalid – No Target**    | Red ring + “Target required” tooltip on queue slot.                 | Card needs a target but none selected. |
| **Invalid – Stunned Unit** | Card dimmed, “Stunned” badge appears.                               | Unit cannot act.                       |
| **Queue Full**             | Queue bar `cursor-not-allowed`, new cards show red overlay on drag. | Max 3 actions reached.                 |
| **Full Queue – Ready**     | “Confirm Turn” button enabled, pulses lightly.                      | Player can lock in actions.            |

#### 2.6.5 Error Prevention & Recovery

- **Guarded Confirm** – Button disabled unless `queue.length > 0` **and** each card has a valid target (checked via store selector).
- **Undo Stack** – Store maintains last‑action snapshot; pressing **Ctrl+Z** (desktop) or **Shake** (mobile) reverts queue to previous state.
- **Toast Alerts** – On invalid actions, show a short toast (`"Cannot target a stunned ally"`).

---

### 2.7 Targeting & Threat Clarity

| Visual Concept          | Implementation                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Standard Target**     | Semi‑transparent **blue ring** (`ring-2 ring-blue-500/50`) around the unit.                                                                                                                         |
| **Taunt‑Forced Target** | **Gold ring** (same thickness) _plus_ a small “taunt” icon (`⚔️`) anchored to the top‑right of the ring.                                                                                            |
| **AoE Preview**         | When a card with AoE is selected, a **radial gradient** (`bg-gradient-to-r from-transparent via-primary-500/30 to-transparent`) covers the area; fades out when another target selected.            |
| **Invalid Target**      | Red “X” overlay on unit + shake animation.                                                                                                                                                          |
| **Target Confirmation** | Click/tap on a unit toggles a **checkmark badge** on the ring.                                                                                                                                      |
| **Accessibility**       | Ring colors also encode **shape**: <br>• Circle (standard) <br>• Hexagon (taunt) <br>• Dashed circle (invalid). <br>Screen readers announce `"Target: Enemy #2 – Stunned, cannot be selected"` etc. |
| **Animation**           | Target ring scales up from 0.8 → 1 over **150 ms**, then pulses 1‑2 times (`scale: 1 → 1.05`).                                                                                                      |
| **Priority Highlight**  | If a unit is the _only_ valid target (forced by taunt), its ring gets a **double‑glow** (`box-shadow: 0 0 8px gold`).                                                                               |

---

### 2.8 Motion & Timing

| Animation                      | FR Motion Variant                                                 | Recommended Duration | Stagger / Overlap                      |
| ------------------------------ | ----------------------------------------------------------------- | -------------------- | -------------------------------------- |
| **Card Draw**                  | `initial: {y:-200, opacity:0}, animate: {y:0, opacity:1}`         | 300 ms               | Sequential per card (stagger 80 ms)    |
| **Card Hover Lift**            | `whileHover: {y:-10, scale:1.04}`                                 | 150 ms               | Immediate                              |
| **Queue Slot Fill**            | `animate: {scale:[0.8,1.1,1], opacity:[0,1]}`                     | 250 ms               | No overlap                             |
| **Target Ring Appear**         | `initial:{scale:0.7, opacity:0}, animate:{scale:1, opacity:1}`    | 120 ms               | Parallel with card selection           |
| **Action Play (Card to Unit)** | `variants: {start:{x:0}, end:{x: targetX, y: targetY, rotate:5}}` | 400 ms               | Damage numbers appear **after** 200 ms |
| **Damage / Heal Pop**          | `y:-30 → 0, opacity:0→1` + fade out                               | 300 ms               | Overlaps with card flight              |
| **Buff/Debuff Icon Pulse**     | `animate:{scale:[1,1.15,1]}`                                      | 500 ms (loop)        | Continuous while active                |
| **Ult Gauge Pulse**            | `animate:{scale:[1,1.1,1]}`                                       | 250 ms on increase   | Triggered each time gauge rises        |
| **Screen Shake (Heavy AoE)**   | `animate:{x:[-10,10,-10,10,0]}`                                   | 500 ms total         | Only on damage > 30% max HP            |
| **Phase Bar Segment Advance**  | `animate:{width: `${newPercent}%`}`                               | 200 ms               | Synchronized with turn start           |
| **Victory/Defeat Overlay**     | `initial:{opacity:0, scale:0.8}, animate:{opacity:1, scale:1}`    | 600 ms               | Blocks further input after full finish |

**Stagger Strategy** – When multiple units act in the same phase (e.g., 4 enemies attacking), start each unit’s card flight **150 ms** after the previous one, creating a wave effect that stays readable.

**Performance Tips** – Use `layoutId` for shared elements (e.g., card moving from hand to queue) to let Framer Motion reuse DOM nodes, reducing reflows. Keep animation CSS in Tailwind `@layer utilities` for easy tuning.

---

### 2.9 Component Architecture

#### 2.9.1 Store Shape (Zustand – TypeScript)

```ts
// src/store/battleStore.ts
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";

export type UnitSide = "player" | "enemy";
export type UnitStatus = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  buffs: Buff[];
  debuffs: Debuff[];
  isTaunted: boolean;
  isStunned: boolean;
  isAlive: boolean;
};

export type Card = {
  id: string;
  name: string;
  cost: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  type: "skill" | "attack" | "buff" | "ultimate";
  target: "single" | "ally" | "enemy" | "aoe";
  description: string;
  // optional UI‐only flags
  isDisabled?: boolean;
};

export type QueueSlot = {
  card?: Card;
  targetId?: string; // unit id
};

export type Phase =
  | "BattleStart"
  | "PlayerTurnStart"
  | "PlayerAction" // building queue
  | "PlayerTurnEnd"
  | "EnemyTurnStart"
  | "EnemyAction"
  | "EnemyTurnEnd"
  | "Victory"
  | "Defeat";

export interface BattleState {
  phase: Phase;
  playerUnits: UnitStatus[];
  enemyUnits: UnitStatus[];
  hand: Card[];
  queue: QueueSlot[];
  selectedCardId?: string; // card being dragged / targeted
  targetIds: string[]; // currently highlighted targets
  log: string[];
  ultGauge: number; // 0‑100
  isProcessing: boolean;
  // actions
  startPlayerTurn: () => void;
  enqueueCard: (cardId: string, targetId?: string) => void;
  dequeueSlot: (slotIndex: number) => void;
  reorderQueue: (fromIdx: number, toIdx: number) => void;
  confirmTurn: () => Promise<void>;
  cancelTurn: () => void;
  // … other battle actions
}

// create store with devtools for debugging
export const useBattleStore = create<BattleState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      phase: "BattleStart",
      playerUnits: [],
      enemyUnits: [],
      hand: [],
      queue: [{}, {}, {}],
      selectedCardId: undefined,
      targetIds: [],
      log: [],
      ultGauge: 0,
      isProcessing: false,

      // ====== actions ======
      startPlayerTurn: () => set({ phase: "PlayerTurnStart" }),

      enqueueCard: (cardId, targetId) => {
        const { hand, queue, isProcessing } = get();
        if (isProcessing) return;
        const emptyIdx = queue.findIndex((s) => !s.card);
        if (emptyIdx === -1) return; // full

        const card = hand.find((c) => c.id === cardId);
        if (!card) return;

        set((state) => {
          const newQueue = [...state.queue];
          newQueue[emptyIdx] = { card, targetId };
          return { queue: newQueue };
        });
      },

      dequeueSlot: (slotIdx) =>
        set((s) => {
          const newQueue = [...s.queue];
          newQueue[slotIdx] = {};
          return { queue: newQueue };
        }),

      reorderQueue: (fromIdx, toIdx) =>
        set((s) => {
          const newQueue = [...s.queue];
          const [moved] = newQueue.splice(fromIdx, 1);
          newQueue.splice(toIdx, 0, moved);
          return { queue: newQueue };
        }),

      confirmTurn: async () => {
        const { queue, phase } = get();
        if (phase !== "PlayerTurnStart") return;
        set({ isProcessing: true, phase: "PlayerTurnEnd" });
        // simulate waiting for animations + logic
        await new Promise((r) => setTimeout(r, 1500));
        // after logic runs, reset queue, swap phase
        set({
          queue: [{}, {}, {}],
          isProcessing: false,
          phase: "EnemyTurnStart",
        });
        // trigger enemy AI elsewhere
      },

      cancelTurn: () => set({ queue: [{}, {}, {}] }),

      // ... other reducers for taking damage, applying buffs, etc.
    })),
  ),
);
```

**Selectors** (to minimise re‑rendering):

```ts
// src/store/selectors.ts
export const usePhase = () => useBattleStore((s) => s.phase);
export const usePlayerUnits = () => useBattleStore((s) => s.playerUnits);
export const useEnemyUnits = () => useBattleStore((s) => s.enemyUnits);
export const useHand = () => useBattleStore((s) => s.hand);
export const useQueue = () => useBattleStore((s) => s.queue);
export const useIsProcessing = () => useBattleStore((s) => s.isProcessing);
export const useTargetIds = () => useBattleStore((s) => s.targetIds);
export const useLog = () => useBattleStore((s) => s.log);
export const useUltGauge = () => useBattleStore((s) => s.ultGauge);
```

Components **subscribe only to the selectors they need**, keeping re‑renders low even when the log updates.

#### 2.9.2 Component Tree (React + HeroUI)

```
BattlePage (client)
├─ <Battle HUD>
│   ├─ <PhaseBar />
│   ├─ <UltGauge />
│   ├─ <Timer />
│   └─ <VictoryOverlay / DefeatOverlay />
├─ <EnemyBoard />
│   ├─ <UnitTile unit={enemy[0]} side="enemy" />
│   └─ …
├─ <CombatLayer>
│   ├─ <DamageNumber />
│   ├─ <HealNumber />
│   ├─ <StatusEffectParticle />
│   └─ <AoEOverlay />
├─ <PlayerBoard />
│   ├─ <UnitTile unit={player[0]} side="player" />
│   └─ …
├─ <HandArea>
│   ├─ <CardSlot card={c} draggable />
│   └─ …
├─ <QueueArea>
│   ├─ <QueueSlot index={0} />
│   ├─ <QueueSlot index={1} />
│   └─ <QueueSlot index={2} />
├─ <ActionButtons>
│   ├─ <ConfirmButton disabled={!canConfirm} />
│   └─ <CancelButton />
└─ <BattleLogToggle />
    └─ <BattleLogPanel />
```

**Presentational vs Store‑Connected**

| Component                             | Type                                                         | Reason                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `<PhaseBar>`, `<UltGauge>`, `<Timer>` | **Connected** (use selectors)                                | Displays mutable global state.                                                                                   |
| `<UnitTile>`                          | **Connected** (receive unit data via selector)               | Needs hp, buffs etc.                                                                                             |
| `<CardSlot>`                          | **Presentational** (props: card, draggable)                  | Receives `hand` from `<HandArea>`.                                                                               |
| `<HandArea>`                          | **Connected** (useHand, enqueueCard)                         | Manages drag‑and‑drop interactions.                                                                              |
| `<QueueArea>`, `<QueueSlot>`          | **Connected** (useQueue, reorder, dequeue)                   | Queue updates frequently.                                                                                        |
| `<CombatLayer>`                       | **Presentational** (receives effect props from battle logic) | Animations are driven by a **temporary effect store** (`useEffectQueue`) to avoid polluting global battle state. |
| `<BattleLogPanel>`                    | **Connected** (useLog)                                       | Toggles open/close locally.                                                                                      |
| `<VictoryOverlay>`                    | **Connected** (phase === 'Victory')                          | Renders high‑z index UI.                                                                                         |

**HeroUI v3 Compound Usage Example**

```tsx
// src/components/Card/Card.tsx
import { motion } from "framer-motion";
import { Card as HUICard } from "@heroui/react";

export const Card = ({
  card,
  draggable,
  onSelect,
  isSelected,
  isDisabled,
}: {
  card: Card;
  draggable?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
  isDisabled?: boolean;
}) => {
  const variants = {
    hover: { y: -8, scale: 1.04 },
    disabled: { opacity: 0.4 },
  };

  return (
    <motion.div
      className="relative"
      whileHover={!isDisabled ? "hover" : undefined}
      variants={variants}
    >
      <HUICard
        className={`
          w-24 h-36 bg-gray-800 rounded-xl shadow-lg
          ${isSelected ? "ring-4 ring-primary" : ""}
          ${isDisabled ? "pointer-events-none" : ""}
        `}
        onClick={!isDisabled ? onSelect : undefined}
      >
        <HUICard.Header className="p-1">
          <span className="text-sm font-bold">{card.name}</span>
        </HUICard.Header>
        <HUICard.Body className="flex items-center justify-center">
          <img src={`/cards/${card.id}.png`} alt={card.name} className="h-12" />
        </HUICard.Body>
        <HUICard.Footer className="flex justify-between items-center p-1 text-xs">
          <span className="text-yellow-400">{card.cost}</span>
          <span className={`badge-${card.rarity}`}>{card.rarity}</span>
        </HUICard.Footer>
      </HUICard>
    </motion.div>
  );
};
```

The component remains **presentational**; any store connection happens higher up in `<HandArea>`.

#### 2.9.3 File System Layout (Next.js)

```
/app
  /battle
    page.tsx          // BattlePage component (client)
    layout.tsx        // optional layout (global UI)
/components
  /Battle
    PhaseBar.tsx
    UltGauge.tsx
    Timer.tsx
    VictoryOverlay.tsx
    DefeatOverlay.tsx
  /Board
    EnemyBoard.tsx
    PlayerBoard.tsx
    UnitTile.tsx
  /Hand
    HandArea.tsx
    Card.tsx
  /Queue
    QueueArea.tsx
    QueueSlot.tsx
  /Combat
    CombatLayer.tsx
    DamageNumber.tsx
    HealNumber.tsx
    StatusEffectParticle.tsx
    AoEOverlay.tsx
  /Log
    BattleLogToggle.tsx
    BattleLogPanel.tsx
  /Buttons
    ConfirmButton.tsx
    CancelButton.tsx
/store
  battleStore.ts
  selectors.ts
  effectQueue.ts   // temporary effect store for visual bursts
/styles
  tailwind.config.js   // includes custom colors, animation utilities
  globals.css          // HeroUI + Tailwind import
```

---

### 2.10 Design Token Direction

| Token                  | Value Example                                                                                          | Usage                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **Color – Faction**    | `primary: #1a73e8` (Blue Magic) <br> `secondary: #e91e63` (Red Fire) <br> `neutral: #4a5568` (Gray)    | Border glows, background gradients   |
| **Color – Status**     | `buff: #4ade80` (green), `debuff: #f87171` (red), `ignite: #fb923c` (orange), `taunt: #fbbf24` (amber) | Status chips, effect particles       |
| **Color – Semantic**   | `success: #10b981`, `error: #ef4444`, `warning: #f59e0b`, `info: #3b82f6`                              | Toasts, button states                |
| **Typography**         | `font-family-primary: 'Jost', sans-serif` <br> `font-family-secondary: 'Bebas Neue', cursive`          | UI labels, titles                    |
| **Type Scale**         | `h1: 2.5rem (40px)`, `h2: 2rem (32px)`, `body: 1rem (16px)`, `caption: 0.75rem (12px)`                 | HUD, card text                       |
| **Shadow / Elevation** | `elev-1: 0 1px 3px rgba(0,0,0,0.2)` <br> `elev-2: 0 4px 6px rgba(0,0,0,0.3)`                           | Boards, queue slots                  |
| **Border Radius**      | `rounded-sm: 4px`, `rounded-md: 8px`, `rounded-lg: 12px`                                               | Cards, panels                        |
| **Spacing**            | `gap-1: 4px`, `gap-2: 8px`, `gap-4: 16px`, `p-2: 8px`                                                  | Layout grid, padding                 |
| **Animation**          | `transition: all 0.2s ease-out` (default) <br> `bounce: cubic-bezier(.68,-0.55,.265,1.55)`             | Card hover, queue reveal             |
| **Z‑Index Layers**     | `z-base: 0`, `z-feedback: 10`, `z-overlay: 20`, `z-modal: 30`                                          | Combat numbers, HUD, victory overlay |

All tokens live in `tailwind.config.js` under `theme.extend` and are consumed via `className` like `bg-primary`, `text-status-debuff`, `shadow-elev-2`.

**Accessibility Tokens**

- **Focus Ring**: `outline-none focus-visible:ring-2 focus-visible:ring-primary/80`.
- **Reduced Motion**: Respect `prefers-reduced-motion` via `motionReduced` flag; skip non‑essential particle animations.
- **Color Contrast**: Verify each semantic color meets WCAG AA on both dark and light backgrounds.

---

### 2.11 Accessibility & Responsiveness

| Aspect                  | Implementation                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Keyboard Navigation** | <br>• **Tab** cycles through actionable UI: Hand cards → Queue slots → Confirm/Cancel. <br>• **Enter** selects a card, **Space** confirms target, **Esc** clears active selection. <br>• Global listener on `keydown` for `Ctrl+Z` (undo queue). |
| **Controller Support**  | Map to Xbox layout (configurable): <br> • **D‑pad / Left stick** → navigate hand. <br> • **A / X** → pick card. <br> • **B / Circle** → deselect / cancel. <br> • **Y / Triangle** → confirm turn. Use `useRafLoop` to poll gamepad state.       |
| **Touch Interaction**   | • Minimum 44 × 44 dp touch targets. <br>• Drag‑to‑queue with elastic snapping. <br>• Long‑press on a card (≥ 500 ms) shows full description tooltip.                                                                                             |
| **Screen‑Reader**       | • ARIA labels on cards: `aria-label="Fireball skill, cost 2, target enemy, 2× damage"` <br>• Live region for battle log updates (`role="log"`).                                                                                                  |
| **Color‑Blind Safe**    | • Status icons (shield, flame, skull) accompany color changes. <br>• Target rings use distinct **shapes** (solid, dashed, double) beyond hue.                                                                                                    |
| **Responsive Layout**   | • Tailwind breakpoints: `lg` (desktop), `md` (tablet), `sm` (mobile). <br>• Hand area switches to horizontal scroll on < sm. <br>• Battle log collapses into a bottom sheet on mobile.                                                           |
| **Reduced Motion**      | Detect `prefers-reduced-motion` and disable: <br>• Card “fly‑out” path, <br>• Particle bursts, <br>• Use a simple fade instead.                                                                                                                  |
| **Focus Management**    | When a phase changes, automatically move focus to the primary interactive element (e.g., first hand card at turn start). Provide `tabIndex={-1}` on non‑focusable visual decorations.                                                            |

---

## 3️⃣ PAGE SKELETON & COMPONENT LIST

### 3.1 `/app/battle/page.tsx`

```tsx
// app/battle/page.tsx
"use client";
import { useEffect } from "react";
import { usePhase, useIsProcessing } from "@/store/selectors";
import PhaseBar from "@/components/Battle/PhaseBar";
import UltGauge from "@/components/Battle/UltGauge";
import EnemyBoard from "@/components/Board/EnemyBoard";
import PlayerBoard from "@/components/Board/PlayerBoard";
import CombatLayer from "@/components/Combat/CombatLayer";
import HandArea from "@/components/Hand/HandArea";
import QueueArea from "@/components/Queue/QueueArea";
import ActionButtons from "@/components/Buttons/ActionButtons";
import BattleLogToggle from "@/components/Log/BattleLogToggle";
import VictoryOverlay from "@/components/Battle/VictoryOverlay";
import DefeatOverlay from "@/components/Battle/DefeatOverlay";

export default function BattlePage() {
  const phase = usePhase();
  const processing = useIsProcessing();

  // on mount start battle
  useEffect(() => {
    // assume battleStore has hook to init data
  }, []);

  return (
    <div className="relative flex flex-col h-screen bg-gray-900 text-white">
      {/* Top HUD */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800">
        <PhaseBar />
        <UltGauge />
        {/* optional timer */}
      </header>

      {/* Main board area */}
      <main className="flex-1 grid grid-cols-12 gap-2 p-2 overflow-hidden">
        {/* Enemy board */}
        <section className="col-span-8 flex flex-col gap-2">
          <EnemyBoard />
        </section>

        {/* Player board */}
        <section className="col-span-4 flex flex-col gap-2">
          <PlayerBoard />
        </section>

        {/* Combat FX – overlay on top of board */}
        <CombatLayer />
      </main>

      {/* Bottom UI */}
      <footer className="flex flex-col gap-1 p-2 bg-gray-800">
        <HandArea disabled={processing || phase !== "PlayerTurnStart"} />
        <QueueArea disabled={processing || phase !== "PlayerTurnStart"} />
        <ActionButtons />
      </footer>

      {/* Log & Overlays */}
      <BattleLogToggle />
      {phase === "Victory" && <VictoryOverlay />}
      {phase === "Defeat" && <DefeatOverlay />}
    </div>
  );
}
```

### 3.2 Component Inventory (Presentational vs Connected)

| Component              | Path                                         | Responsibility                                                        | Store‑Connected?                    |
| ---------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `PhaseBar`             | `components/Battle/PhaseBar.tsx`             | Displays current phase segments                                       | ✅ (phase selector)                 |
| `UltGauge`             | `components/Battle/UltGauge.tsx`             | Radial gauge + pulse                                                  | ✅ (ultGauge selector)              |
| `EnemyBoard`           | `components/Board/EnemyBoard.tsx`            | Renders enemy unit tiles in grid                                      | ✅ (enemyUnits selector)            |
| `PlayerBoard`          | `components/Board/PlayerBoard.tsx`           | Renders player units (including statuses)                             | ✅ (playerUnits selector)           |
| `UnitTile`             | `components/Board/UnitTile.tsx`              | Shows portrait, HP bar, buffs icons, target ring                      | ✅ (unit data passed as prop)       |
| `CombatLayer`          | `components/Combat/CombatLayer.tsx`          | Collects temporary visual effects from `effectQueue` store (non‑core) | ✅ (effectQueue)                    |
| `DamageNumber`         | `components/Combat/DamageNumber.tsx`         | Animated floating numbers                                             | 🟢 Pure presentation                |
| `HealNumber`           | `components/Combat/HealNumber.tsx`           | Same as above                                                         | 🟢 Pure                             |
| `StatusEffectParticle` | `components/Combat/StatusEffectParticle.tsx` | Particle bursts for buffs/debuffs                                     | 🟢                                  |
| `AoEOverlay`           | `components/Combat/AoEOverlay.tsx`           | Transparent AoE preview during targeting                              | ✅ (targeting state)                |
| `HandArea`             | `components/Hand/HandArea.tsx`               | Horizontal scroll of cards, drag‑drop initiation                      | ✅ (hand selector, enqueue actions) |
| `Card`                 | `components/Hand/Card.tsx`                   | Render a single card                                                  | 🟢 (presentational)                 |
| `QueueArea`            | `components/Queue/QueueArea.tsx`             | Show 3 slots, allow reorder, remove                                   | ✅ (queue selector)                 |
| `QueueSlot`            | `components/Queue/QueueSlot.tsx`             | Slot UI, drop highlight, X for removal                                | 🟢 (pure)                           |
| `ActionButtons`        | `components/Buttons/ActionButtons.tsx`       | Confirm / Cancel buttons with disabled logic                          | ✅ (phase + queue + processing)     |
| `BattleLogToggle`      | `components/Log/BattleLogToggle.tsx`         | Show/hide scrollable log panel                                        | ✅ (log selector)                   |
| `BattleLogPanel`       | `components/Log/BattleLogPanel.tsx`          | Render scrollable list of strings                                     | ✅                                  |
| `VictoryOverlay`       | `components/Battle/VictoryOverlay.tsx`       | Full‑screen win animation                                             | ✅ (phase === 'Victory')            |
| `DefeatOverlay`        | `components/Battle/DefeatOverlay.tsx`        | Full‑screen loss animation                                            | ✅ (phase === 'Defeat')             |
| `Timer` (optional)     | `components/Battle/Timer.tsx`                | Turn timer countdown                                                  | ✅                                  |
| **Utility**            | `store/effectQueue.ts`                       | Queue of visual FX for `CombatLayer` (transient)                      | 🟢 (non‑persistent)                 |

> **🟢 = Pure Presentational (props only)**  
> **✅ = Connected (uses Zustand selector)**

### 3.3 Core Interaction Flow (Hooks)

```tsx
// HandArea.tsx
import { useHand, usePhase, useIsProcessing } from "@/store/selectors";
import { Card } from "@/components/Hand/Card";
import { motion } from "framer-motion";
import { useBattleStore } from "@/store/battleStore";

export default function HandArea({ disabled }: { disabled: boolean }) {
  const hand = useHand();
  const enqueue = useBattleStore((s) => s.enqueueCard);
  const phase = usePhase();

  const handleSelect = (cardId: string) => {
    // open target selection UI after card chosen
    // set selectedCardId in global store...
    // We could also push to a temporary selection state
  };

  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {hand.map((c) => (
        <motion.div
          key={c.id}
          drag={!disabled}
          whileHover={{ scale: 1.06 }}
          dragConstraints={{ left: 0, right: 0 }}
          onClick={() => handleSelect(c.id)}
        >
          <Card card={c} isDisabled={disabled || phase !== "PlayerTurnStart"} />
        </motion.div>
      ))}
    </div>
  );
}
```

### 3.4 Animation Variants (central location)

```ts
// src/animations/variants.ts
export const cardVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  hover: { scale: 1.05, transition: { type: "spring", stiffness: 200 } },
  drag: { scale: 1.08 },
};

export const damageVariants = {
  initial: { y: -30, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const targetRingVariants = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15 },
  },
  pulse: {
    scale: [1, 1.08, 1],
    transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" },
  },
};

export const queueSlotVariants = {
  empty: { backgroundColor: "#2d3748" },
  filled: { backgroundColor: "#1a202c" },
};
```

All components import the same `variants` to stay in sync.

---

## 4️⃣ IMPLEMENTATION ROADMAP (Phased Checklist)

| Phase                                                | Goal                                                                    | Key Deliverables                                                                                                                                                                                                                                                  | Approx. Effort (person‑days) |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Phase 1 – Core HUD & Boards**                      | Render static battle screen, connect store data, show units & hand.     | • `<PhaseBar>`, `<UltGauge>` <br>• `<EnemyBoard>` & `<PlayerBoard>` (unit tiles with HP) <br>• `<HandArea>` (display cards) <br>• Basic `<QueueArea>` (empty slots) <br>• Store selectors + dummy data for visual testing.                                        | 4‑5                          |
| **Phase 2 – Interaction Polish (Queue & Targeting)** | Enable card selection, queue building, target preview, validation.      | • Drag‑and‑drop to queue (HeroUI + Framer Motion). <br>• Target ring logic (`useBattleStore.setTargetIds`). <br>• Validation (stun, missing target) + UI error feedback. <br>• Confirm/Cancel logic with processing flag.                                         | 6‑7                          |
| **Phase 3 – Animation & Feedback**                   | Add all motion, combat numbers, status particles, phase transitions.    | • Framer‑Motion variants integration. <br>• `<CombatLayer>` visual effects queue. <br>• Damage/Heal numbers, buff icons, AoE preview, screen shake. <br>• Victory/Defeat overlay animations. <br>• Reduced‑motion fallback.                                       | 8‑10                         |
| **Phase 4 – Responsiveness & Accessibility**         | Ensure mobile/keyboard/controller friendliness, color‑blind safe UI.    | • Responsive layout breakpoints (mobile, tablet, desktop). <br>• Touch target sizing, long‑press tooltips. <br>• Keyboard focus ring, ARIA labels, live region for log. <br>• Gamepad mapping (optional library). <br>• Contrast audit, color‑plus‑shape testing. | 4‑5                          |
| **Phase 5 – Polish & QA**                            | Polish visual consistency, finalize design tokens, performance testing. | • Design token finalization (Tailwind config). <br>• Optimize store selectors (memoization). <br>• Run Lighthouse performance & aXe accessibility audit. <br>• Add unit‑tests for store reducers, integration tests (Cypress).                                    | 3‑4                          |

**Total Estimated Time:** **≈ 25 person‑days** (≈ 5 weeks for a 2‑person team).

### Risks & Mitigation

| Risk                                                          | Impact                                                | Mitigation                                                                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **State‑driven re‑renders cause animation jank**              | UI lag during heavy phases (multiple damage numbers). | Use **Zustand selectors** per component; keep combat numbers in a **separate transient store** (`effectQueue`) unlinked from core battle state. |
| **Drag‑and‑drop on mobile can be flaky**                      | Users may accidentally reorder queue.                 | Add **tap‑to‑add** fallback: tap a card → “Add to queue” button appears; drag only on desktop.                                                  |
| **Large number of status icons clutter the board**            | Overwhelming visual noise.                            | Limit **max 4 icons per unit**; overflow shown as `+N` badge that expands on hover/tap.                                                         |
| **Screen‑reader announcements cause overload**                | Log floods with every damage number.                  | Use **ARIA live region** at `polite` level but **batch** events: announce “Player dealt 120 damage and 45 heal”.                                |
| **Different device aspect ratios break the board layout**     | Tiles overlapping or hidden.                          | Use **CSS Grid** with `auto-fit` for board tiles, define **min‑max** sizes (`minmax(60px, 1fr)`). Test on 4:3, 16:9, 21:9.                      |
| **Framer Motion heavy on CPU** (especially on low‑end phones) | Stutter.                                              | Respect `prefers-reduced-motion` and provide a **“low‑motion” CSS class** that disables particle FX; optionally toggle via UI setting.          |
| **Unhandled AI turn timings cause UI freeze**                 | Player perceives lag.                                 | Insert **artificial “thinking” delay** (400‑800 ms) with spinner; keep UI in `processing` mode.                                                 |
| **Future expansion (more cards, larger boards)**              | Current layout may not scale.                         | Design **component props** to accept `gridSize` and `maxCards`; store uses arrays, not fixed length.                                            |
| **HeroUI v3 upgrade breaking changes**                        | Styles break.                                         | Pin HeroUI version in `package.json`; encapsulate UI components behind thin wrappers that map to the HeroUI API.                                |

---

## 📦 QUICK START FOR DEVS

1. **Install dependencies**

   ```bash
   npm i next@13 zustand @hero-ui/react framer-motion tailwindcss@latest postcss autoprefixer
   npx tailwindcss init -p
   ```

2. **Add Tailwind + Custom Tokens** (`tailwind.config.js`)

   ```js
   /** @type {import('tailwindcss').Config} */
   module.exports = {
     content: [
       "./app/**/*.{js,ts,jsx,tsx}",
       "./components/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {
         colors: {
           primary: "#1e40af", // deep blue magic
           secondary: "#c53030", // fire red
           success: "#10b981",
           warning: "#f59e0b",
           buff: "#4ade80",
           debuff: "#f87171",
           ignite: "#fb923c",
           taunt: "#fbbf24",
           // … add factions, elements, rarity
         },
         borderRadius: { sm: "4px", md: "8px", lg: "12px" },
         boxShadow: {
           "elev-1": "0 1px 3px rgba(0,0,0,0.2)",
           "elev-2": "0 4px 6px rgba(0,0,0,0.3)",
         },
         animation: {
           "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
         },
       },
     },
     plugins: [],
   };
   ```

3. **Create store (`src/store/battleStore.ts`)** – use the snippet from section 2.9.1.

4. **Add a temporary mock data loader** (in `page.tsx` or a separate `initBattle.ts`) to fill `playerUnits`, `enemyUnits`, `hand`.

5. **Run dev**

   ```bash
   npm run dev
   ```

6. **Iterate** through the roadmap phases, committing UI changes after each phase.

---

### Closing Note

All decisions above keep **separation of concerns** clear:

- **Zustand** holds _authoritative_ battle state (phase, units, queue).
- **Transient effect store** (`effectQueue`) triggers UI‑only animations without polluting core logic.
- **HeroUI** gives a consistent, theme‑able component API; Tailwind handles responsive spacing & colors.
- **Framer Motion** provides declarative, easily‑tuned motion that respects user‑preference settings.

Follow the phased checklist, test each component in isolation, then combine for the full battle experience. With the layout, tokens, and component tree in place, the team can now focus on the fun part: _making those anime‑style card clashes feel alive._ 🎮🚀
