import { describe, expect, it } from "vitest";
import { parseDuelMove } from "@/lib/duel/parseMove";
import { serializeDuelState } from "@/lib/duel/serializeState";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { executeSkill } from "@/lib/game/combat";
import { registerCharacterPassives } from "@/lib/game/passive";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import type { BattleCharacter } from "@/types/character";
import type { ActionCard } from "@/types/action";

function unit(
  id: string,
  team: "player" | "enemy",
  over: Partial<BattleCharacter> = {},
): BattleCharacter {
  const data = getCharacterById(id) as unknown as Record<string, unknown>;
  return {
    ...(data as object),
    instanceId: id,
    currentHP: (data.hp as number) ?? 1000,
    currentAttack: (data.atk as number) ?? 100,
    currentDefense: (data.def as number) ?? 50,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    ...over,
  } as BattleCharacter;
}

function card(source: string, rank: 1 | 2 | 3, index: number): ActionCard {
  const data = getCharacterById(source) as unknown as { skills: unknown[] };
  return {
    id: `card-${index}`,
    sourceInstanceId: source,
    skill: data.skills[0] as ActionCard["skill"],
    rank,
  };
}

const baseContext = () => ({
  enemyTeam: [unit("lyra_npc", "enemy")],
  playerTeam: [unit("duke", "player")],
  hand: [card("lyra_npc", 2, 0), card("lyra_npc", 1, 1)],
  turn: 3,
  actionBudget: 3,
});

describe("parseDuelMove — a bad move must never reach the engine", () => {
  it("accepts a well-formed move", () => {
    const result = parseDuelMove(
      JSON.stringify({
        turn: 3,
        actions: [{ cardIndex: 0, targetInstanceId: "duke" }],
        reasoning: "opening",
      }),
      baseContext(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions[0]?.sourceInstanceId).toBe("lyra_npc");
    expect(result.actions[0]?.targetInstanceId).toBe("duke");
    expect(result.reasoning).toBe("opening");
  });

  it("allows an omitted target — the engine picks one", () => {
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0 }] }),
      baseContext(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.actions[0]?.targetInstanceId).toBe("");
  });

  it("allows an explicit pass", () => {
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ pass: true }] }),
      baseContext(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.actions[0]).toBeNull();
  });

  it("rejects malformed JSON instead of throwing", () => {
    const result = parseDuelMove("{not json", baseContext());
    expect(result.ok).toBe(false);
  });

  it("rejects a move written for another turn", () => {
    // The stale-file case: a leftover move must not replay into this turn.
    const result = parseDuelMove(
      JSON.stringify({ turn: 2, actions: [{ cardIndex: 0 }] }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/turn/);
  });

  it("rejects more actions than the turn allows", () => {
    const result = parseDuelMove(
      JSON.stringify({
        turn: 3,
        actions: [{ pass: true }, { pass: true }],
      }),
      { ...baseContext(), actionBudget: 1 },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a card that isn't in hand", () => {
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 9 }] }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects playing the same card twice", () => {
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0 }, { cardIndex: 0 }] }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/twice/);
  });

  it("rejects an unknown target", () => {
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0, targetInstanceId: "ghost" }] }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects targeting a downed unit", () => {
    const context = baseContext();
    context.playerTeam = [unit("duke", "player", { currentHP: 0 })];
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0, targetInstanceId: "duke" }] }),
      context,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects targeting a benched unit — subs are untargetable (ruling #7)", () => {
    const context = baseContext();
    context.playerTeam = [unit("duke", "player", { isSub: true })];
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0, targetInstanceId: "duke" }] }),
      context,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a card whose owner is stunned", () => {
    const context = baseContext();
    context.enemyTeam = [
      unit("lyra_npc", "enemy", {
        debuffs: [{ type: "stun", debuffDuration: 1 }],
      }),
    ];
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0 }] }),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/stunned/);
  });

  it("rejects a card whose owner is down", () => {
    const context = baseContext();
    context.enemyTeam = [unit("lyra_npc", "enemy", { currentHP: 0 })];
    const result = parseDuelMove(
      JSON.stringify({ turn: 3, actions: [{ cardIndex: 0 }] }),
      context,
    );
    expect(result.ok).toBe(false);
  });
});

describe("serializeDuelState", () => {
  const state = () =>
    serializeDuelState({
      ...baseContext(),
      recentEvents: ["Duke used something"],
    });

  it("shows Claude its own units, hand and the opponent's board", () => {
    const text = state();
    expect(text).toContain("Your units");
    expect(text).toContain("Your hand");
    expect(text).toContain("Opponent's field units");
    expect(text).toContain("Duke");
    expect(text).toContain("3 actions");
  });

  it("includes the kit, not just the stat line — you can't pilot what you can't read", () => {
    const text = state();
    expect(text).toContain("Kit:");
    expect(text).toMatch(/Red Ice/); // Lyra's skills by name
  });

  it("surfaces scheduled automatic behaviour", () => {
    const molvarr = unit("molvarr", "enemy");
    const text = serializeDuelState({
      enemyTeam: [molvarr],
      playerTeam: [unit("duke", "player")],
      hand: [],
      turn: 0,
      actionBudget: 3,
    });
    // Molvarr's SP fires on its own schedule and isn't Claude's to suppress.
    expect(text).toMatch(/SP Skill fires automatically/);
  });

  it("NEVER leaks the player's hand or queued cards", () => {
    // The whole balance signal depends on this: seeing Tanveer's plan would
    // mean testing his planning, not his kits.
    const text = state().toLowerCase();
    expect(text).not.toContain("player hand");
    expect(text).not.toContain("queued");
    expect(text).not.toContain("opponent's hand");
  });

  it("marks benched units as untargetable rather than listing them as targets", () => {
    const text = serializeDuelState({
      ...baseContext(),
      playerTeam: [
        unit("duke", "player"),
        unit("lyra", "player", { instanceId: "benched", isSub: true }),
      ],
    });
    expect(text).toMatch(/Benched/);
  });

  it("handles an empty hand without pretending there are cards", () => {
    const text = serializeDuelState({ ...baseContext(), hand: [] });
    expect(text).toMatch(/empty/i);
  });
});

describe("statDebuffImmunity — boss-exclusive ATK-down immunity", () => {
  const strike = (mechanics: unknown[]) => ({
    skillName: "Test Strike",
    characterId: "t",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
    mechanics,
  });

  it("blocks a generic ATK-down but lets a DEF-down through", () => {
    const lyra = unit("lyra_npc", "enemy");
    const attacker = unit("duke", "player");
    const res = executeSkill(
      {
        sourceInstanceId: "duke",
        skill: strike([
          { type: "debuff", stat: "atk", valuePercent: 50, duration: 2 },
          { type: "debuff", stat: "def", valuePercent: 30, duration: 2 },
        ]) as never,
        targetInstanceId: "lyra_npc",
      },
      { playerTeam: [attacker], enemyTeam: [lyra] },
      () => {},
    );
    const debuffs = res.enemyTeam[0].debuffs;
    expect(debuffs.some((d) => d.stat === "atk")).toBe(false);
    expect(debuffs.some((d) => d.stat === "def")).toBe(true);
  });

  it("blocks Flowing Ruin's own ATK-down, which lands via a separate path", () => {
    // The whole point: Duke's empowered hit is the most common source of
    // ATK-down in the game and does NOT go through the generic debuff branch.
    const lyra = unit("lyra_npc", "enemy");
    const duke = unit("duke", "player", {
      passiveState: { flowingRuinStacks: 3 },
    });
    const dukeSkill = (getCharacterById("duke") as never as { skills: unknown[] })
      .skills[1];
    const res = executeSkill(
      { sourceInstanceId: "duke", skill: dukeSkill as never, targetInstanceId: "lyra_npc", rank: 3 },
      { playerTeam: [duke], enemyTeam: [lyra] },
      () => {},
    );
    expect(res.enemyTeam[0].debuffs.some((d) => d.stat === "atk")).toBe(false);
    // ...and the hit itself still lands; immunity is not damage reduction.
    expect(res.enemyTeam[0].currentHP).toBeLessThan(res.enemyTeam[0].hp);
  });

  it("leaves a unit without the passive fully vulnerable", () => {
    const target = unit("duke", "enemy");
    const attacker = unit("lyra_npc", "player");
    const res = executeSkill(
      {
        sourceInstanceId: "lyra_npc",
        skill: strike([{ type: "debuff", stat: "atk", valuePercent: 50, duration: 2 }]) as never,
        targetInstanceId: "duke",
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    expect(res.enemyTeam[0].debuffs.some((d) => d.stat === "atk")).toBe(true);
  });

  it("is on the NPC kit only — playable Lyra stays vulnerable", () => {
    const npc = getCharacterById("lyra_npc");
    const playable = getCharacterById("lyra");
    const has = (c: typeof npc) =>
      (c?.passive?.mechanics ?? []).some((m) => m.type === "statDebuffImmunity");
    expect(has(npc)).toBe(true);
    expect(has(playable)).toBe(false);
  });
});

describe("lyra_npc_2 — chapter 2's second fight", () => {
  it("is identical to lyra_npc apart from the extra passive mechanic", () => {
    const a = getCharacterById("lyra_npc") as never as Record<string, unknown>;
    const b = getCharacterById("lyra_npc_2") as never as Record<string, unknown>;
    expect(b.hp).toBe(a.hp);
    expect(b.atk).toBe(a.atk);
    expect(b.def).toBe(a.def);
    expect(JSON.stringify(b.skills)).toBe(JSON.stringify(a.skills));
    expect(JSON.stringify(b.ultimate)).toBe(JSON.stringify(a.ultimate));
    // The difficulty comes from the passive, not from hardcoded stats
    // (Tanveer, 2026-08-09).
    const mechs = (m: Record<string, unknown>) =>
      ((m.passive as { mechanics?: { type: string }[] }).mechanics ?? []).map((x) => x.type);
    expect(mechs(a)).toEqual(["buff", "statDebuffImmunity"]);
    expect(mechs(b)).toEqual(["buff", "statDebuffImmunity", "aura"]);
  });

  it("raises ATK, DEF and HP by 5% at battle start", async () => {
    const data = getCharacterById("lyra_npc_2") as never as Record<string, unknown>;
    const lyra = unit("lyra_npc_2", "enemy");
    let captured: { action: (c: unknown, t: unknown, l: unknown) => Promise<{ enemyTeam: BattleCharacter[] }> } | null = null;
    registerCharacterPassives(lyra, (item) => {
      if (!captured) captured = item as never;
    });
    expect(captured).not.toBeNull();

    const teams = { playerTeam: [] as BattleCharacter[], enemyTeam: [lyra] };
    const result = await captured!.action(lyra, teams, () => {});
    const after = result.enemyTeam[0];

    // HP is baked (it isn't read through effectiveStat) — this used to be
    // skipped entirely for an "all" aura, which only raised ATK/DEF.
    expect(after.hp).toBe(Math.floor((data.hp as number) * 1.05));
    expect(getEffectiveAttack(after)).toBe(Math.floor((data.atk as number) * 1.05));
    expect(getEffectiveDefense(after)).toBe(Math.floor((data.def as number) * 1.05));
  });
});
