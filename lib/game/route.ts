import type { StoryChapter, StoryDropRange, StoryTeamPick } from "@/types/story";

/**
 * Story routes — the board a chapter is walked on (ruling #94, and Tanveer's
 * rulings across 2026-08-17).
 *
 * A chapter stopped being "one battle" and became a route. The player moves by
 * spending one of three orbs, each an independent random 1–6, and **only the tile
 * they land on resolves** — tiles passed over do nothing. That is what makes three
 * orbs a decision rather than a dice roll.
 *
 * Two rules bend that, both his:
 *  - **A STOP tile cannot be skipped.** *"if the stop node is on the way, it will
 *    have to encounter that."* Movement halts on it however much roll was left.
 *    The boss is always a STOP, sitting immediately before the finish, so no roll
 *    can ever carry a player past the fight and onto the payout.
 *  - **One path, no branching** — *"just one long zig zaggy path"* — for now. The
 *    graph shape is kept because forks are the obvious next step, and the walk
 *    already handles them.
 *
 * Everything here is pure. The board renders it, `storyStore` persists a position
 * within it, and neither owns the rules.
 */

export type RouteTileType =
  | "start"
  | "fight"
  | "boss"
  | "scene"
  | "loot"
  | "empty"
  | "finish";

/** Loot is authored as ranges and rolled when the tile resolves, like repeat
 *  drops — so two runs of the same board don't pay identically. */
export interface RouteLoot {
  coin?: StoryDropRange;
  materials?: Record<string, StoryDropRange>;
}

export interface RouteNode {
  id: string;
  type: RouteTileType;
  /** Board position in grid units, not pixels — the renderer scales them. */
  col: number;
  row: number;
  /** Which of the chapter's scene blocks plays here. */
  scenes?: "intro" | "outro";
  /** Opposition for a `fight` or `boss` tile. */
  enemies?: StoryTeamPick[];
  /** `loot`: what this tile pays into the route's banked payout. */
  loot?: RouteLoot;
}

export interface StoryRoute {
  nodes: RouteNode[];
  /** Directed and forward-only: node id → the ids one step onward. */
  edges: Record<string, string[]>;
}

/** A tile no roll may pass. The boss is one; the finish ends the route anyway. */
export function isStop(node: RouteNode): boolean {
  return node.type === "boss" || node.type === "finish";
}

export const ORB_MIN = 1;
export const ORB_MAX = 6;
export const ORB_COUNT = 3;

export function rollOrb(rng: () => number = Math.random): number {
  return ORB_MIN + Math.floor(rng() * (ORB_MAX - ORB_MIN + 1));
}

export function rollOrbs(rng: () => number = Math.random): number[] {
  return Array.from({ length: ORB_COUNT }, () => rollOrb(rng));
}

/**
 * Spends orb `index` and rolls a fresh value into that slot alone.
 *
 * The other two keep their values, so the player always holds exactly three live
 * options — no spent state, no waiting for a refresh (Tanveer: *"when a number is
 * pressed, the new number to replace that and re rolled again"*).
 */
export function spendOrb(
  orbs: number[],
  index: number,
  rng: () => number = Math.random,
): number[] {
  if (index < 0 || index >= orbs.length) return orbs;
  const next = [...orbs];
  next[index] = rollOrb(rng);
  return next;
}

export function nodeById(route: StoryRoute, id: string): RouteNode | undefined {
  return route.nodes.find((node) => node.id === id);
}

export function terminalNode(route: StoryRoute): RouteNode | undefined {
  return route.nodes.find((node) => node.type === "finish");
}

export function bossNode(route: StoryRoute): RouteNode | undefined {
  return route.nodes.find((node) => node.type === "boss");
}

/**
 * Every tile `steps` moves from `fromId`.
 *
 * Absorbing on any STOP tile: reaching one mid-walk ends the move there, which is
 * how the boss becomes unskippable. A 6 rolled two tiles short of the boss lands
 * on the boss, not past it — so a big roll near the end is never wasted and never
 * a shortcut.
 *
 * Breadth-first over (node, stepsUsed) so a board that rejoins doesn't report the
 * same tile twice. Returns at most one id while routes stay single-path.
 */
export function landingsFrom(
  route: StoryRoute,
  fromId: string,
  steps: number,
): string[] {
  if (steps <= 0) return [];
  const landings = new Set<string>();
  let frontier = [fromId];
  let remaining = steps;

  while (remaining > 0 && frontier.length > 0) {
    const stepped: string[] = [];
    for (const id of frontier) {
      for (const onward of route.edges[id] ?? []) {
        if (!stepped.includes(onward)) stepped.push(onward);
      }
    }
    if (stepped.length === 0) break; // dead end; nothing to land on
    remaining -= 1;

    const continuing: string[] = [];
    for (const id of stepped) {
      const node = nodeById(route, id);
      if (node && isStop(node)) {
        landings.add(id); // absorbed: a STOP eats the rest of the roll
      } else if (remaining === 0) {
        landings.add(id); // the roll ran out exactly here
      } else {
        continuing.push(id);
      }
    }
    frontier = continuing;
  }
  return [...landings];
}

/**
 * The tiles a move actually steps onto, in order — the last one is the landing.
 *
 * `landingsFrom` answers *where you end up*; this answers *how you got there*, so
 * the board can walk a token tile by tile instead of teleporting it. Same rules:
 * a STOP tile ends the walk early, and the sequence excludes the tile you started
 * on.
 *
 * Forks take the first branch, which is exact while routes stay single-path and
 * is the sensible default afterwards — a fork's destination is the player's
 * choice, and that choice is made before this is called.
 */
export function walkPath(
  route: StoryRoute,
  fromId: string,
  steps: number,
): string[] {
  const path: string[] = [];
  let at = fromId;
  for (let step = 0; step < steps; step += 1) {
    const onward = (route.edges[at] ?? [])[0];
    if (!onward) break;
    path.push(onward);
    at = onward;
    const node = nodeById(route, at);
    if (node && isStop(node)) break; // absorbed; the roll's remainder is spent
  }
  return path;
}

/** Whether a move of `steps` from `fromId` can legally land on `toId`. */
export function canLand(
  route: StoryRoute,
  fromId: string,
  steps: number,
  toId: string,
): boolean {
  return landingsFrom(route, fromId, steps).includes(toId);
}

/** Rolls one loot tile into concrete amounts. */
export function rollLoot(
  loot: RouteLoot,
  rng: () => number = Math.random,
): { coin: number; materials: Record<string, number> } {
  const roll = (range: StoryDropRange) =>
    range.min + Math.floor(rng() * (range.max - range.min + 1));
  const materials: Record<string, number> = {};
  for (const [id, range] of Object.entries(loot.materials ?? {})) {
    const amount = roll(range);
    if (amount > 0) materials[id] = amount;
  }
  return { coin: loot.coin ? roll(loot.coin) : 0, materials };
}

/**
 * How long a part's routes run, in tiles — Tanveer's numbers, 2026-08-17, and
 * they are **geography, not difficulty**: *"i would decide the length of the
 * lattice based on what the story needs"*.
 *
 * Part 1 is a village and its immediate surroundings, so ten. Part 2 is one fight
 * in a small area, so five. Part 3 walks all the way to the exam ground, so
 * twenty. Parts he hasn't ruled on fall back to ten, which is the shape of a
 * contained scene — a wrong-but-modest guess rather than a sprawling one.
 */
export const ROUTE_STEPS_BY_PART: Record<number, number> = {
  1: 10,
  2: 5,
  3: 20,
  4: 15,
};
export const DEFAULT_ROUTE_STEPS = 10;

export function routeStepsForPart(partOrder: number): number {
  return ROUTE_STEPS_BY_PART[partOrder] ?? DEFAULT_ROUTE_STEPS;
}

/** Loot bands, his numbers: coin 1k–3k, or 1–5 training manuals. */
const LOOT_TABLE: RouteLoot[] = [
  { coin: { min: 1000, max: 3000 } },
  { materials: { training_manual: { min: 1, max: 5 } } },
];

/** One loot tile per ~8–9 tiles, so a ten-tile route carries one and a twenty
 *  carries two. */
const TILES_PER_LOOT = 8.5;

/**
 * A stable hash of the chapter id.
 *
 * Boards are generated rather than hand-authored — 37 chapters of hand-written
 * graphs would be churn nobody could keep consistent — but a board must not
 * change between visits, so placement is seeded off the chapter's own id instead
 * of a random number. The same chapter always produces the same board; different
 * chapters differ.
 */
function seedOf(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Builds a chapter's board: one path, zig-zagging, boss immediately before the
 * finish.
 *
 * Shape, per his rulings: a single path with no branching; exactly one fight, and
 * it is the boss; one or two loot tiles depending on length; no heal tiles,
 * because with a single fight there is nothing to heal between. Everything else
 * is empty ground — the walk itself is the content, and empty tiles are what give
 * a 1–6 roll somewhere harmless to land.
 */
export function buildRoute(chapter: StoryChapter, partOrder: number): StoryRoute {
  const steps = Math.max(4, routeStepsForPart(partOrder));
  const seed = seedOf(chapter.id);

  // Fixed positions: start, the intro scene, then the boss and finish at the end.
  const hasIntro = chapter.intro.length > 0;
  const bossIndex = steps - 2;
  const finishIndex = steps - 1;
  const introIndex = hasIntro ? 1 : -1;

  // Loot goes on interior tiles only — never the start, the intro, the boss or
  // the finish — spread by the seed so two chapters of the same length differ.
  const lootCount = Math.max(1, Math.round(steps / TILES_PER_LOOT));
  const interior: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    if (i === 0 || i === introIndex || i >= bossIndex) continue;
    interior.push(i);
  }
  const lootAt = new Set<number>();
  for (let n = 0; n < lootCount && interior.length > 0; n += 1) {
    // Spread the picks across the interior rather than clustering them.
    const band = Math.floor(interior.length / lootCount);
    const offset = band > 0 ? (seed + n * 7) % band : 0;
    const index = Math.min(interior.length - 1, n * band + offset);
    lootAt.add(interior[index]);
  }

  const nodes: RouteNode[] = [];
  const edges: Record<string, string[]> = {};

  for (let i = 0; i < steps; i += 1) {
    const id = `n${i}`;
    // The zig-zag: three columns walked back and forth as the row climbs, which
    // is what keeps a twenty-tile route on a phone screen.
    const cycle = i % 4;
    const col = cycle === 0 ? 0 : cycle === 1 || cycle === 3 ? 1 : 2;

    let node: RouteNode;
    if (i === 0) node = { id, type: "start", col, row: i };
    else if (i === introIndex)
      node = { id, type: "scene", col, row: i, scenes: "intro" };
    else if (i === bossIndex)
      node = { id, type: "boss", col: 1, row: i, enemies: chapter.battle?.enemyTeam };
    else if (i === finishIndex) node = { id, type: "finish", col: 1, row: i };
    else if (lootAt.has(i))
      node = {
        id,
        type: "loot",
        col,
        row: i,
        loot: LOOT_TABLE[(seed + i) % LOOT_TABLE.length],
      };
    else node = { id, type: "empty", col, row: i };

    nodes.push(node);
    edges[id] = i === finishIndex ? [] : [`n${i + 1}`];
  }

  return { nodes, edges };
}

/** The authored route if the chapter has one, else the generated board. */
export function routeFor(chapter: StoryChapter, partOrder: number): StoryRoute {
  return chapter.route ?? buildRoute(chapter, partOrder);
}

/**
 * Sanity-checks a board before it is walked.
 *
 * Authored graphs are hand-written data and the two ways they break are silent: a
 * board with no finish can never be completed, and a tile nothing points at can
 * never be reached. Both present as a player stuck with no legal move, which is
 * indistinguishable from a bug in the movement rules.
 */
export function routeProblems(route: StoryRoute): string[] {
  const problems: string[] = [];
  const ids = new Set(route.nodes.map((node) => node.id));

  if (route.nodes.length === 0) problems.push("route has no nodes");
  if (!route.nodes.some((node) => node.type === "start"))
    problems.push("route has no start node");

  const finishes = route.nodes.filter((node) => node.type === "finish");
  if (finishes.length !== 1)
    problems.push(`route needs exactly one finish node, found ${finishes.length}`);

  const bosses = route.nodes.filter((node) => node.type === "boss");
  if (bosses.length > 1)
    problems.push(`route has ${bosses.length} boss nodes, expected at most one`);

  // The boss must gate the finish, or a roll could land the payout without the
  // fight — which is the whole point of the STOP rule.
  if (bosses.length === 1 && finishes.length === 1) {
    const gate = route.edges[bosses[0].id] ?? [];
    if (!gate.includes(finishes[0].id))
      problems.push("boss node does not lead to the finish node");
    for (const [from, onward] of Object.entries(route.edges)) {
      if (from === bosses[0].id) continue;
      if (onward.includes(finishes[0].id))
        problems.push(`node "${from}" reaches the finish without passing the boss`);
    }
  }

  for (const [from, onward] of Object.entries(route.edges)) {
    if (!ids.has(from)) problems.push(`edge from unknown node "${from}"`);
    for (const to of onward) {
      if (!ids.has(to)) problems.push(`edge to unknown node "${to}"`);
    }
  }

  const start = route.nodes.find((node) => node.type === "start");
  if (start) {
    const seen = new Set<string>([start.id]);
    const queue = [start.id];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      for (const onward of route.edges[id] ?? []) {
        if (seen.has(onward)) continue;
        seen.add(onward);
        queue.push(onward);
      }
    }
    for (const node of route.nodes) {
      if (!seen.has(node.id)) problems.push(`node "${node.id}" is unreachable`);
    }
  }

  return problems;
}
