import { describe, expect, it } from "vitest";
import { getPassiveReadout } from "@/lib/game/passiveStacks";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import dukeData from "@/data/characters/duke.json";
import serasData from "@/data/characters/seras.json";
import yalinaData from "@/data/characters/yalina.json";
import dianeData from "@/data/characters/diane.json";
import banData from "@/data/characters/ban.json";
import masterTaoData from "@/data/characters/master_tao.json";
import gonData from "@/data/characters/gon.json";
import killuaData from "@/data/characters/killua.json";
import siddiqData from "@/data/characters/siddiq.json";
import saraData from "@/data/characters/sara.json";
import gabristData from "@/data/characters/gabrist.json";
import isoldeData from "@/data/characters/isolde.json";
import mustafaData from "@/data/characters/mustafa.json";
import batraData from "@/data/characters/batra.json";
import leorioData from "@/data/characters/leorio.json";
import chiaraData from "@/data/characters/chiara.json";
import molvarrData from "@/data/characters/molvarr.json";
import frostData from "@/data/characters/frost.json";

type CharData =
  | typeof dukeData
  | typeof serasData
  | typeof yalinaData
  | typeof dianeData
  | typeof banData
  | typeof masterTaoData
  | typeof gonData
  | typeof killuaData
  | typeof siddiqData
  | typeof saraData
  | typeof gabristData
  | typeof isoldeData
  | typeof mustafaData
  | typeof batraData
  | typeof leorioData
  | typeof chiaraData
  | typeof molvarrData
  | typeof frostData;

function fromData(
  data: CharData,
  overrides: Partial<BattleCharacter> = {},
): BattleCharacter {
  return {
    id: data.id,
    name: data.id,
    instanceId: data.id,
    team: "player",
    color: data.color as BattleCharacter["color"],
    atk: data.atk,
    def: data.def,
    hp: data.hp,
    currentAttack: data.atk,
    currentDefense: data.def,
    currentHP: data.hp,
    tags: (data as { tags?: string[] }).tags,
    skills: data.skills as unknown as [SkillCard, SkillCard],
    ultimate: (data as { ultimate?: unknown }).ultimate as BattleCharacter["ultimate"],
    passive: (data as { passive?: unknown }).passive as BattleCharacter["passive"],
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ...overrides,
  } as BattleCharacter;
}

const noContext = { playerTeam: [], enemyTeam: [], currentTurn: 0 };

describe("Stack badge + ready tick (Duke, Yalina)", () => {
  it("Duke: no readout until his first Flowing Ruin stack is granted", () => {
    const duke = fromData(dukeData);
    expect(getPassiveReadout(duke, noContext)).toBeNull();
  });

  it("Duke: 1/3 stacks, no tick, no activation tag (threshold, not a growing benefit)", () => {
    const duke = fromData(dukeData, {
      passiveState: { flowingRuinStacks: 1 },
    });
    const readout = getPassiveReadout(duke, noContext);
    expect(readout?.stacks).toEqual({ current: 1, max: 3 });
    expect(readout?.ready).toBe(false);
    expect(readout?.activationMode).toBeUndefined();
  });

  it("Duke: 3/3 stacks shows the green ready tick", () => {
    const duke = fromData(dukeData, {
      passiveState: { flowingRuinStacks: 3 },
    });
    const readout = getPassiveReadout(duke, noContext);
    expect(readout?.ready).toBe(true);
    expect(readout?.readyMessage).toBeTruthy();
    expect(readout?.activationMode).toBeUndefined();
  });

  it("Yalina: 5/5 stacks shows the ready tick AND the buildup tag (each stack itself adds damage)", () => {
    const yalina = fromData(yalinaData, {
      passiveState: { momentumStacks: 5 },
    });
    const readout = getPassiveReadout(yalina, noContext);
    expect(readout?.stacks).toEqual({ current: 5, max: 5 });
    expect(readout?.ready).toBe(true);
    expect(readout?.activationMode).toBe("buildup");
  });
});

describe("Stack badge, no ready tick (Seras, Diane, Ban)", () => {
  it("Seras: at max Charged stacks, no ready tick, buildup tag", () => {
    const seras = fromData(serasData, {
      passiveState: { chargedStacks: 6 },
    });
    const readout = getPassiveReadout(seras, noContext);
    expect(readout?.stacks).toEqual({ current: 6, max: 6 });
    expect(readout?.ready).toBe(false);
    expect(readout?.activationMode).toBe("buildup");
  });

  it("Diane: 3/5 Giant's Will stacks, buildup tag", () => {
    const diane = fromData(dianeData, {
      passiveState: { turnRampStacks: 3 },
    });
    const readout = getPassiveReadout(diane, noContext);
    expect(readout?.stacks).toEqual({ current: 3, max: 5 });
    expect(readout?.activationMode).toBe("buildup");
  });

  it("Ban: 2/5 Extort Life stacks, buildup tag", () => {
    const ban = fromData(banData, {
      passiveState: { maxHpShredStacks: 2 },
    });
    const readout = getPassiveReadout(ban, noContext);
    expect(readout?.stacks).toEqual({ current: 2, max: 5 });
    expect(readout?.activationMode).toBe("buildup");
  });
});

describe("Master Tao: Healing Flames counter (no activation tag — a fired-count, not a scaling stat)", () => {
  it("1/3 heal-triggers used", () => {
    const tao = fromData(masterTaoData, {
      passiveState: { igniteConsumeTriggers: 1 },
    });
    const readout = getPassiveReadout(tao, noContext);
    expect(readout?.stacks).toEqual({ current: 1, max: 3 });
    expect(readout?.activationMode).toBeUndefined();
  });
});

describe("Progress-to-once counter (Gon, Killua)", () => {
  it("Gon: 4/10 attacks received, not yet fired", () => {
    const gon = fromData(gonData, {
      passiveState: { attacksReceived: 4 },
    });
    const readout = getPassiveReadout(gon, noContext);
    expect(readout?.progress).toEqual({ current: 4, required: 10 });
    expect(readout?.fired).toBe(false);
    expect(readout?.activationMode).toBe("once");
  });

  it("Gon: fired after the 10th attack — progress locks at 10/10, ACTIVE", () => {
    const gon = fromData(gonData, {
      passiveState: { attacksReceived: 10, statShiftTriggered: true },
    });
    const readout = getPassiveReadout(gon, noContext);
    expect(readout?.progress).toEqual({ current: 10, required: 10 });
    expect(readout?.fired).toBe(true);
  });

  it("Killua: same pattern as Gon, independently", () => {
    const killua = fromData(killuaData, {
      passiveState: { attacksReceived: 7 },
    });
    const readout = getPassiveReadout(killua, noContext);
    expect(readout?.progress).toEqual({ current: 7, required: 10 });
    expect(readout?.fired).toBe(false);
  });
});

describe("Conditional pill (Siddiq) — no activation tag, toggles live", () => {
  it("lit when current HP is below the 50% gate", () => {
    const siddiq = fromData(siddiqData, {
      currentHP: Math.floor(siddiqData.hp * 0.4),
    });
    const readout = getPassiveReadout(siddiq, noContext);
    expect(readout?.conditionMet).toBe(true);
    expect(readout?.activationMode).toBeUndefined();
  });

  it("unlit at full HP", () => {
    const siddiq = fromData(siddiqData);
    const readout = getPassiveReadout(siddiq, noContext);
    expect(readout?.conditionMet).toBe(false);
  });
});

describe("One-shot pill (Sara) — stays visible after firing", () => {
  it("AVAILABLE before it has fired", () => {
    const sara = fromData(saraData);
    const readout = getPassiveReadout(sara, noContext);
    expect(readout?.oneShot).toEqual({ available: true });
    expect(readout?.activationMode).toBe("once");
  });

  it("USED (still visible) after it has fired", () => {
    const sara = fromData(saraData, {
      passiveState: { lethalSurvived: true },
    });
    const readout = getPassiveReadout(sara, noContext);
    expect(readout?.oneShot).toEqual({ available: false });
  });
});

describe("Always-active marker (Gabrist, Isolde, Mustafa, Batra's synergy half) — no tag, no number", () => {
  it("Gabrist: plain aura, no crash with empty passiveState", () => {
    const gabrist = fromData(gabristData);
    const readout = getPassiveReadout(gabrist, noContext);
    expect(readout?.alwaysActive).toBe(true);
    expect(readout?.activationMode).toBeUndefined();
    expect(readout?.stacks).toBeUndefined();
  });

  it("Isolde: multi-mechanic aura still resolves to a single ACTIVE marker", () => {
    const isolde = fromData(isoldeData);
    const readout = getPassiveReadout(isolde, noContext);
    expect(readout?.alwaysActive).toBe(true);
  });

  it("Mustafa: color-conditioned synergy (no conditionTags) still counts as plain-synergy", () => {
    const mustafa = fromData(mustafaData);
    const readout = getPassiveReadout(mustafa, noContext);
    expect(readout?.alwaysActive).toBe(true);
  });

  it("Batra: consumeHpPercent half gets no readout on its own — only the synergy half shows ACTIVE", () => {
    const batra = fromData(batraData);
    const readout = getPassiveReadout(batra, noContext);
    expect(readout?.alwaysActive).toBe(true);
    expect(readout?.stacks).toBeUndefined();
    expect(readout?.conditionMet).toBeUndefined();
  });
});

describe("Multi-tick row (Leorio) — independently-lit ticks", () => {
  it("Bond active, Together inactive when only one of Gon/Killua is present", () => {
    const leorio = fromData(leorioData);
    const gon = fromData(gonData, { instanceId: "gon" });
    const readout = getPassiveReadout(leorio, {
      playerTeam: [leorio, gon],
      enemyTeam: [],
      currentTurn: 0,
    });
    expect(readout?.subStates).toEqual([
      { label: "Bond", active: true },
      { label: "Together", active: false },
    ]);
  });

  it("Both ticks active when Gon and Killua are both alive and on-field", () => {
    const leorio = fromData(leorioData);
    const gon = fromData(gonData, { instanceId: "gon" });
    const killua = fromData(killuaData, { instanceId: "killua" });
    const readout = getPassiveReadout(leorio, {
      playerTeam: [leorio, gon, killua],
      enemyTeam: [],
      currentTurn: 0,
    });
    expect(readout?.subStates).toEqual([
      { label: "Bond", active: true },
      { label: "Together", active: true },
    ]);
  });

  it("Together drops when one of them dies, Bond still holds", () => {
    const leorio = fromData(leorioData);
    const gon = fromData(gonData, { instanceId: "gon", currentHP: 0 });
    const killua = fromData(killuaData, { instanceId: "killua" });
    const readout = getPassiveReadout(leorio, {
      playerTeam: [leorio, gon, killua],
      enemyTeam: [],
      currentTurn: 0,
    });
    expect(readout?.subStates).toEqual([
      { label: "Bond", active: true },
      { label: "Together", active: false },
    ]);
  });
});

describe("Chiara: rank-up countdown (the random per-turn buff half has no readout at all)", () => {
  it("counts down toward turn 3, once tag", () => {
    const chiara = fromData(chiaraData);
    const readout = getPassiveReadout(chiara, {
      playerTeam: [],
      enemyTeam: [],
      currentTurn: 0, // displayedTurn = 1
    });
    expect(readout?.progress).toEqual({ current: 1, required: 3 });
    expect(readout?.fired).toBe(false);
    expect(readout?.activationMode).toBe("once");
  });

  it("fires and locks ACTIVE once rankUpOwnDeckTriggered is set", () => {
    const chiara = fromData(chiaraData, {
      passiveState: { rankUpOwnDeckTriggered: true },
    });
    const readout = getPassiveReadout(chiara, {
      playerTeam: [],
      enemyTeam: [],
      currentTurn: 3,
    });
    expect(readout?.progress).toEqual({ current: 3, required: 3 });
    expect(readout?.fired).toBe(true);
  });
});

describe("Molvarr: derived ATK line (Growing Malice) — no icon/tag", () => {
  it("+X% ATK scales with the enemy team's live debuff count", () => {
    const molvarr = fromData(molvarrData, { team: "enemy" });
    const enemyOfMolvarr = fromData(dukeData, {
      instanceId: "e1",
      team: "player",
      debuffs: [
        { type: "debuff", stat: "atk", debuffDuration: 2 },
        { type: "stun", debuffDuration: 1 },
      ],
    });
    const readout = getPassiveReadout(molvarr, {
      playerTeam: [enemyOfMolvarr],
      enemyTeam: [molvarr],
      currentTurn: 0,
    });
    expect(readout?.lines).toEqual(["+10% ATK"]); // 2 debuffs * 5%/debuff
    expect(readout?.activationMode).toBeUndefined();
  });
});

describe("No passive at all", () => {
  it("returns null", () => {
    const frost = fromData(frostData);
    expect(getPassiveReadout(frost, noContext)).toBeNull();
  });
});
