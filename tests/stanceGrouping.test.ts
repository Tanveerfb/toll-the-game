import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
import {
  blocksFor,
  categorizeEffects,
  memberDurationToShow,
  effectDescription,
  prettyName,
} from "@/components/game/battle/EffectsList";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Ruling #131 (Tanveer, 2026-09-16). Two halves.
 *
 * **Display.** A stance is one thing the player put up, and its parts are
 * *"displayed separately on the character… it won't say one stance effect, it
 * will say three separate effects."* They are listed apart, under the stance's
 * own name, rather than collapsed into a single row called "Stance".
 *
 * **Engine.** *"Taunt shouldn't be a debuff on enemies in the first place. It
 * could be either a buff on self or a stance effect — enemies will just be
 * forced to attack the character with a taunt effect."* So the marker moved to
 * the taunter.
 */

const noopLog = () => {};

function makeChar(
  overrides: Partial<BattleCharacter> & {
    instanceId: string;
    team: "player" | "enemy";
  },
): BattleCharacter {
  const dummy: SkillCard = {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [dummy, dummy] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ...overrides,
  } as BattleCharacter;
}

function skillOf(characterId: string, skillName: string): SkillCard {
  const c = getCharacterById(characterId);
  if (!c) throw new Error(`no character ${characterId}`);
  const found = (c.skills as unknown as SkillCard[]).find(
    (s) => s.skillName === skillName,
  );
  if (!found) throw new Error(`no skill ${characterId}/${skillName}`);
  return found;
}

/** The rows the panel would draw, flattened to readable strings. */
function panel(unit: BattleCharacter): string[] {
  const out: string[] = [];
  for (const block of blocksFor(categorizeEffects(unit))) {
    if (block.kind === "single") {
      out.push(prettyName(block.row.effect));
    } else {
      out.push(`[${block.name}]`);
      for (const row of block.rows) out.push(`  ${row.effect.type}`);
    }
  }
  return out;
}

describe("#131 — a stance lists its parts under its own name", () => {
  it("Yalina's Attention Drawer puts taunt and damage reduction on HER, as one group", () => {
    const yalina = makeChar({ instanceId: "yalina", team: "player" });
    const e1 = makeChar({ instanceId: "e1", team: "enemy" });
    const e2 = makeChar({ instanceId: "e2", team: "enemy" });

    const result = executeSkill(
      {
        sourceInstanceId: "yalina",
        skill: skillOf("yalina", "Attention Drawer"),
        targetInstanceId: "e1",
        rank: 1,
      },
      { playerTeam: [yalina], enemyTeam: [e1, e2] },
      noopLog,
    );

    const her = result.playerTeam[0];
    const taunt = her.buffs.find((b) => b.type === "taunt");
    const stance = her.buffs.find((b) => b.type === "stance");
    expect(taunt).toBeDefined();
    expect(stance).toBeDefined();
    // One group, so the panel can head both rows with the skill's name.
    expect(taunt!.groupId).toBe(stance!.groupId);
    expect(taunt!.groupName).toBe("Attention Drawer");

    expect(panel(her)).toEqual([
      "[Attention Drawer]",
      "  taunt",
      "  stance",
    ]);

    // And nothing is stamped on the enemies any more.
    for (const enemy of result.enemyTeam) {
      expect(enemy.debuffs.some((d) => d.type === "taunt")).toBe(false);
    }
  });

  it("Meliodas's Full Counter is a named group, not a row called 'Stance'", () => {
    const meliodas = makeChar({ instanceId: "meliodas", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "meliodas",
        skill: skillOf("meliodas", "Full Counter"),
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [meliodas], enemyTeam: [enemy] },
      noopLog,
    );
    expect(panel(result.playerTeam[0])).toEqual(["[Full Counter]", "  stance"]);
  });

  it("a stance applied to ALLIES is grouped on each of them", () => {
    // Mustafa's Fortress grants its damage reduction to the team, so it never
    // touches the self-buff path. That site was missed when grouping landed
    // and it rendered on every ally as a bare row called "Stance".
    const mustafa = makeChar({ instanceId: "mustafa", team: "player" });
    const ally = makeChar({ instanceId: "ally", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "mustafa",
        skill: skillOf("mustafa", "Earth Stance: Fortress"),
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [mustafa, ally], enemyTeam: [enemy] },
      noopLog,
    );
    for (const unit of result.playerTeam) {
      expect(panel(unit)).toEqual(["[Earth Stance: Fortress]", "  stance"]);
    }
  });

  it("an ordinary self-buff is NOT grouped — the change is scoped to stances", () => {
    // Heading every buff row with its skill name would restyle the whole
    // panel for no gain; the ask was about stances specifically.
    const gon = makeChar({ instanceId: "gon", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "gon",
        skill: skillOf("gon", "Jajanken: Rock"),
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [gon], enemyTeam: [enemy] },
      noopLog,
    );
    const grouped = result.playerTeam[0].buffs.filter((b) => b.groupId);
    expect(grouped).toEqual([]);
  });
});

describe("#131 — every stance row says what it does", () => {
  it("a counter stance states its counter damage", () => {
    // This row was BLANK before #131. `effectDescription` had branches for
    // corrosion, DoTs, stun, seal, taunt, flatValue and valuePercent, and a
    // counter stance carries none of those — its number lives on
    // `counterDamagePercent` — so Meliodas's Full Counter rendered a named
    // row with an empty value for the whole time it was up.
    expect(
      effectDescription({
        type: "stance",
        name: "Full Counter",
        counterDamagePercent: 250,
        buffDuration: 1,
      } as StatusEffect),
    ).toBe("Counters attackers for 250% ATK");
  });

  it("a taunt reads from the taunter's side", () => {
    // Was "Attacks redirect to the source", which only made sense while the
    // entry sat on the unit being redirected.
    expect(effectDescription({ type: "taunt" } as StatusEffect)).toBe(
      "Enemies must attack this unit",
    );
  });

  it("a damage-reduction stance no longer states the opposite of itself", () => {
    // `damageReduction` reads as "damage taken" in his vocabulary, so a
    // straight "+25%" said the unit was taking a QUARTER more damage while a
    // stance was cutting it by a quarter.
    expect(
      effectDescription({
        type: "stance",
        stat: "damageReduction",
        valuePercent: 25,
      } as StatusEffect),
    ).toBe("-25% damage taken");
  });

  it("an ordinary stat buff keeps its sign", () => {
    expect(
      effectDescription({
        type: "buff",
        stat: "atk",
        valuePercent: 30,
      } as StatusEffect),
    ).toBe("+30% ATK");
  });
});

describe("#134 — every stance card reads the same way", () => {
  /**
   * The shape Tanveer approved from the 7DS reference: *"Assumes a Stance for
   * 1 turn(s) which Taunts enemies and inflicts…"* — the stance and its
   * duration lead, the parts follow and inherit it.
   *
   * Ours trailed the duration ("…gains 25% damage reduction for 1 turn"),
   * which reads as though it governed only the last clause rather than the
   * whole stance.
   */
  const render = (id: string, name: string) =>
    [0, 1, 2].map((r) =>
      buildDescriptionForRank(skillOf(id, name) as never, r),
    );

  it("Yalina's taunt stance", () => {
    expect(render("yalina", "Attention Drawer")).toEqual([
      "Assumes a stance for 1 turn: taunts all enemies and reduces damage taken by 25%.",
      "Assumes a stance for 1 turn: taunts all enemies and reduces damage taken by 40%.",
      "Assumes a stance for 2 turns: taunts all enemies and reduces damage taken by 60%.",
    ]);
  });

  it("Mustafa's team stance", () => {
    expect(render("mustafa", "Earth Stance: Fortress")[2]).toBe(
      "Assumes a stance for 2 turns: reduces allies' damage taken by 60%.",
    );
  });

  it("Meliodas's counter stance states its counter, and names no one", () => {
    // Was three sentences that called the caster by name ("Meliodas counters
    // with … his ATK") — the only card in the game that did.
    expect(render("meliodas", "Full Counter")[2]).toBe(
      "Assumes a stance for 2 turns: counters attackers for damage equal to 400% ATK.",
    );
  });

  it("the toll collector's taunt now says how far it reaches", () => {
    // #131 made its bare "Taunts" untrue — that was one enemy under the old
    // engine and is all of them now.
    expect(render("toll_collector", "State Your Business")[0]).toBe(
      "Assumes a stance for 1 turn: taunts all enemies and reduces damage taken by 35%.",
    );
  });

  it("every stance card opens the same way", () => {
    const all: [string, string][] = [
      ["yalina", "Attention Drawer"],
      ["mustafa", "Earth Stance: Fortress"],
      ["toll_collector", "State Your Business"],
      ["iron", "Iron Wall"],
      ["meliodas", "Full Counter"],
    ];
    for (const [id, name] of all) {
      for (const line of render(id, name)) {
        expect(line).toMatch(/^Assumes an? (?:\w+ )?stance for \d+ turns?: /);
      }
    }
  });
});

describe("#131 — a stance states its duration once", () => {
  /**
   * The 7DS shape Tanveer gave as the reference: "Assumes a Stance for 1
   * turn(s) which Taunts enemies and inflicts Quell damage…" — one duration,
   * on the stance, inherited by its parts. Repeating it on every row reads as
   * several independent timers on one thing.
   */
  it("a part sharing the stance's duration shows none of its own", () => {
    expect(memberDurationToShow(2, 2, true)).toBeUndefined();
  });

  it("a part that outlasts or undercuts the stance shows its own", () => {
    expect(memberDurationToShow(3, 2, true)).toBe(3);
    expect(memberDurationToShow(1, 2, true)).toBe(1);
  });

  it("an ungrouped row always shows its own", () => {
    expect(memberDurationToShow(2, 2, false)).toBe(2);
    expect(memberDurationToShow(2, undefined, false)).toBe(2);
  });

  it("a permanent part of a timed stance still reads as permanent", () => {
    // undefined own duration is how permanence is shown (#110) — it must not
    // be mistaken for "same as the group".
    expect(memberDurationToShow(undefined, 2, true)).toBeUndefined();
  });
});

describe("#131 — blocksFor", () => {
  const row = (effect: Partial<StatusEffect>, category: "buff" | "debuff") => ({
    effect: effect as StatusEffect,
    category,
  });

  it("keeps ungrouped rows as singles, in order", () => {
    const blocks = blocksFor([
      row({ type: "buff" }, "buff"),
      row({ type: "debuff" }, "debuff"),
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["single", "single"]);
  });

  it("collects members that are not adjacent", () => {
    const blocks = blocksFor([
      row({ type: "taunt", groupId: "g", groupName: "Stand Fast" }, "buff"),
      row({ type: "buff" }, "buff"),
      row({ type: "stance", groupId: "g", groupName: "Stand Fast" }, "buff"),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "group", name: "Stand Fast" });
    expect(
      blocks[0].kind === "group" ? blocks[0].rows.length : 0,
    ).toBe(2);
  });

  it("never pulls a row out of its category band", () => {
    // #30 orders the table buffs, then debuffs, then grey effects. A group
    // spanning two bands would drag one out of its section.
    const blocks = blocksFor([
      row({ type: "stance", groupId: "g", groupName: "X" }, "buff"),
      row({ type: "taunt", groupId: "g", groupName: "X" }, "debuff"),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.kind === "group")).toBe(true);
  });

  it("falls back to the effect's own name when a group has no groupName", () => {
    const blocks = blocksFor([
      row({ type: "stance", groupId: "g", name: "Improvised" }, "buff"),
    ]);
    expect(blocks[0]).toMatchObject({ name: "Improvised" });
  });
});

describe("#131 — taunt lives on the taunter", () => {
  const basicAttack: SkillCard = {
    skillName: "Basic Attack",
    characterId: "enemy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };

  it("a taunt pulls EVERY enemy, not only the one it was cast at", () => {
    // toll_collector's State Your Business has no `aoe`, so under the old
    // model it redirected exactly the enemy it struck. Tanveer chose the
    // glossary's meaning — "Direct all single target enemy attacks to self".
    const collector = makeChar({
      instanceId: "collector",
      team: "player",
      buffs: [{ type: "taunt", buffDuration: 1, appliedSeq: 1 }],
    });
    const other = makeChar({ instanceId: "other", team: "player" });
    const e1 = makeChar({ instanceId: "e1", team: "enemy" });
    const e2 = makeChar({ instanceId: "e2", team: "enemy" });

    for (const attacker of ["e1", "e2"]) {
      const result = executeSkill(
        {
          sourceInstanceId: attacker,
          skill: basicAttack,
          targetInstanceId: "other",
          rank: 1,
        },
        { playerTeam: [collector, other], enemyTeam: [e1, e2] },
        noopLog,
      );
      expect(
        result.playerTeam.find((c) => c.instanceId === "collector")!.currentHP,
      ).toBeLessThan(1000);
      expect(
        result.playerTeam.find((c) => c.instanceId === "other")!.currentHP,
      ).toBe(1000);
    }
  });

  it("Debuff Immunity no longer makes an enemy untauntable", () => {
    // A consequence of the inversion, and a deliberate one: the taunt is not
    // a debuff on the enemy, so debuff immunity has nothing to resist.
    const taunter = makeChar({
      instanceId: "taunter",
      team: "player",
      buffs: [{ type: "taunt", buffDuration: 2, appliedSeq: 1 }],
    });
    const other = makeChar({ instanceId: "other", team: "player" });
    const immune = makeChar({
      instanceId: "immune",
      team: "enemy",
      buffs: [{ type: "buff", debuffImmune: true, buffDuration: 3 }],
    });
    const result = executeSkill(
      {
        sourceInstanceId: "immune",
        skill: basicAttack,
        targetInstanceId: "other",
        rank: 1,
      },
      { playerTeam: [taunter, other], enemyTeam: [immune] },
      noopLog,
    );
    expect(
      result.playerTeam.find((c) => c.instanceId === "taunter")!.currentHP,
    ).toBeLessThan(1000);
  });
});
