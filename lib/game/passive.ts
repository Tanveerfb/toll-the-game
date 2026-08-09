import { BattleCharacter } from "@/types/character";
import { scaleMaxHp } from "@/lib/game/maxHp";
import { QueueItem } from "@/hooks/MechanicProvider";
import { BattlePhase, StatusEffect } from "@/types/mechanic";

type RegisterFn = (item: QueueItem) => void;

function mapTriggerToPhase(trigger: string): BattlePhase | null {
  const map: Record<string, BattlePhase> = {
    "onBattleStart": "OnBattleStart",
    "aura": "OnBattleStart",
    "OnPlayerTurnEnd": "OnPlayerTurnEnd",
    "OnEnemyTurnEnd": "OnEnemyTurnEnd",
    "OnPlayerTurnStart": "OnPlayerTurnStart",
    "OnEnemyTurnStart": "OnEnemyTurnStart"
  };
  return map[trigger] || null;
}

export function registerCharacterPassives(character: BattleCharacter, registerToQueue: RegisterFn) {
  if (!character.passive) return;

  // Synergy/aura mechanics are battle-start effects even when the passive's
  // main trigger is combat-time (e.g. Batra's beforeSkill HP consume, Seras's
  // onAttackReceived Charged) -- without this fallback they never register.
  const hasBattleStartMechanics = character.passive.mechanics?.some(
    (m) => m.type === "synergy" || m.type === "aura",
  );
  const phase =
    mapTriggerToPhase(character.passive.trigger) ??
    (hasBattleStartMechanics ? "OnBattleStart" : null);

  if (phase) {
    registerToQueue({
      id: `${character.instanceId}_passive_${character.passive.name}`,
      phase: phase,
      sourceInstanceId: character.instanceId,
      mechanicId: character.passive.name,
      action: async (source, teams, log) => {
        // Default-deny: a passive only fires from the bench if its data
        // explicitly opts in with worksFromSub: true (Tanveer ruling
        // 2026-07-24 — most passives need field presence, so the safe
        // default flipped from opt-out to opt-in).
        if (source.isSub && source.passive?.worksFromSub !== true) {
          return teams;
        }

        const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
        const mutateTeam = [...teams[teamKey]];
        let changed = false;

        source.passive?.mechanics?.forEach((mech) => {
          if (mech.type === "synergy") {
            const conditionTags = mech.conditionTags;
            const count = conditionTags ? mutateTeam.filter(c => c.tags?.some(t => conditionTags.includes(t))).length : 1;

            mutateTeam.forEach((ally, idx) => {
              let applies = false;
              if (mech.conditionColors && mech.conditionColors.includes(ally.color)) applies = true;
              if (conditionTags && ally.tags?.some(t => conditionTags.includes(t))) applies = true;
              
              if (applies) {
                // flatBonus: fixed % per carrier (Seras). Default: scales
                // with the number of tag carriers on the team (Batra).
                const multiplier =
                  mech.conditionTags && !mech.flatBonus ? count : 1;
                const totalPercent = mech.valuePercent * multiplier;
                
                // Named after the tag so the UI reads as a synergy, not as
                // the source's passive (playtest: "[Female] synergy showed
                // as amplify (15% damageDealt) for whatever reason").
                // damageDealt entries are consumed by the damage engine at
                // read time (ruling #36), so they are NOT preApplied.
                const buff: StatusEffect = {
                  type: "buff",
                  stat: mech.stat,
                  valuePercent: totalPercent,
                  uncancellable: true,
                  preApplied: mech.stat !== "damageDealt",
                  name: mech.conditionTags
                    ? `[${mech.conditionTags[0]}] Synergy`
                    : `${source.passive!.name}`
                };
                
                const t = { ...mutateTeam[idx], buffs: [...mutateTeam[idx].buffs, buff] };
                if (mech.stat === "all") {
                  t.currentAttack += Math.floor(t.atk * (totalPercent/100));
                  t.currentDefense += Math.floor(t.def * (totalPercent/100));
                  Object.assign(t, scaleMaxHp(t, totalPercent));
                } else if (mech.stat === "def") {
                  t.currentDefense += Math.floor(t.def * (totalPercent/100));
                } else if (mech.stat === "hp") {
                  Object.assign(t, scaleMaxHp(t, totalPercent));
                }
                mutateTeam[idx] = t;
                changed = true;
                log(`${ally.name} gained ${totalPercent}% ${mech.stat} from ${source.name}'s ${source.passive!.name}!`);
              }
            });
          }

          // conditionNoDeadAllies is currently informational only — every
          // aura here is applied once at OnBattleStart regardless (there's
          // no dynamic per-turn recheck of ally-death state yet, matching
          // the flag's pre-existing behavior for Gabrist). Isolde's aura
          // ("Increase all allies HP related stats by 10%") has no such
          // condition at all, so the gate no longer requires the flag.
          if (mech.type === "aura") {
            mutateTeam.forEach((ally, idx) => {
              const buff: StatusEffect = {
                type: "buff", stat: mech.stat, stats: mech.stats, valuePercent: mech.valuePercent, uncancellable: true, name: source.passive!.name
              };
              const t = { ...mutateTeam[idx], buffs: [...mutateTeam[idx].buffs, buff] };
              // ATK/DEF ride the buff dynamically through effectiveStat, but HP
              // is not read that way and has to be baked. "all" covers HP too
              // (ruling #55: basic stats = ATK/DEF/HP), and used to silently
              // skip it here — only a literal "hp" aura raised health.
              if (
                mech.stat === "hp" ||
                mech.stat === "all" ||
                (mech.stats ?? []).includes("hp")
              ) {
                Object.assign(t, scaleMaxHp(t, mech.valuePercent));
              }
              mutateTeam[idx] = t;
              changed = true;
              log(`${ally.name} gained ${mech.valuePercent}% ${mech.stat} from ${source.name}'s Aura!`);
            });
          }
        });

        if (changed) {
          return { ...teams, [teamKey]: mutateTeam };
        }
        return teams;
      }
    });
  }

  registerTurnRamp(character, registerToQueue);
  registerMaxHpShred(character, registerToQueue);
  registerCharacterSynergy(character, registerToQueue);
  registerRandomTurnEffect(character, registerToQueue);
}

// Kind Hearted Friend (Leorio): base +valuePercent to all allies if ANY of
// requiredCharacterIds is a team member — decided once at battle start (sub
// counts; survives their death). Extra +bothAliveBonusPercent while ALL of
// them are alive on the field — rechecked at the team's turn start, dropped
// when one dies (Tanveer ruling: base static, extra dynamic).
function registerCharacterSynergy(
  character: BattleCharacter,
  registerToQueue: RegisterFn,
) {
  const mech = character.passive?.mechanics?.find(
    (m) => m.type === "characterSynergy",
  );
  if (!mech || mech.type !== "characterSynergy") return;

  const passiveName = character.passive!.name;
  const requiredIds: string[] = mech.requiredCharacterIds ?? [];
  const basePercent = mech.valuePercent ?? 10;
  const extraPercent = mech.bothAliveBonusPercent ?? 0;
  // Distinct badge names — the passive's synergy mechanic already pushes
  // buffs named after the passive itself, which would trip the
  // already-applied check here (found live: base bonus never applied).
  const baseName = `${passiveName} (bond)`;
  const extraName = `${passiveName} (bond+)`;

  // The bond's two halves target different things (Tanveer, 2026-08-09): the
  // base bond is basic stats, while the both-alive bonus is narrow enough to
  // justify reaching substats too.
  const baseTarget: { stat?: string; stats?: string[] } =
    mech.stats ? { stats: mech.stats } : { stats: ["atk", "def", "hp"] };
  const extraTarget: { stat?: string; stats?: string[] } =
    mech.bothAliveStat ? { stat: mech.bothAliveStat } : { stat: "all" };

  const applyPercentToTeam = (
    team: BattleCharacter[],
    percent: number,
    name: string,
    log: (e: string) => void,
    logText: string,
    target: { stat?: string; stats?: string[] },
  ) => {
    return team.map((ally) => {
      if (ally.buffs.some((b) => b.name === name)) return ally;
      const t = {
        ...ally,
        buffs: [
          ...ally.buffs,
          {
            type: "buff" as const,
            ...target,
            valuePercent: percent,
            uncancellable: true,
            // Basic stats are baked below, so effectiveStat must skip this
            // entry; substats aren't baked and are read from it dynamically.
            preApplied: true,
            name,
          },
        ],
      };
      t.currentAttack += Math.floor(t.atk * (percent / 100));
      t.currentDefense += Math.floor(t.def * (percent / 100));
      Object.assign(t, scaleMaxHp(t, percent));
      log(`${t.name} ${logText}`);
      return t;
    });
  };

  const removePercentFromTeam = (
    team: BattleCharacter[],
    percent: number,
    name: string,
  ) => {
    return team.map((ally) => {
      if (!ally.buffs.some((b) => b.name === name)) return ally;
      const t = { ...ally, buffs: ally.buffs.filter((b) => b.name !== name) };
      t.currentAttack -= Math.floor(t.atk * (percent / 100));
      t.currentDefense -= Math.floor(t.def * (percent / 100));
      const hpBoost = Math.floor((t.hp * percent) / (100 + percent));
      t.hp -= hpBoost;
      t.currentHP = Math.min(t.currentHP, t.hp);
      return t;
    });
  };

  // Base bonus: once, at battle start
  registerToQueue({
    id: `${character.instanceId}_passive_${passiveName}_charSynergy`,
    phase: "OnBattleStart",
    sourceInstanceId: character.instanceId,
    mechanicId: `${passiveName} (base)`,
    action: async (source, teams, log) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const team = teams[teamKey];
      const hasAny = team.some((c) => requiredIds.includes(c.id));
      if (!hasAny) return teams;
      const boosted = applyPercentToTeam(
        team,
        basePercent,
        baseName,
        log,
        `gains +${basePercent}% basic stats from ${source.name}'s ${passiveName}!`,
        baseTarget,
      );
      return { ...teams, [teamKey]: boosted };
    },
  });

  // Extra bonus: rechecked at the team's turn start (and battle start)
  if (extraPercent > 0) {
    const recheck = async (
      source: BattleCharacter,
      teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
      log: (e: string) => void,
    ) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const team = teams[teamKey];
      const allAliveOnField = requiredIds.every((id) =>
        team.some((c) => c.id === id && c.currentHP > 0 && !c.isSub),
      );
      const active = team.some((c) =>
        c.buffs.some((b) => b.name === extraName),
      );
      if (allAliveOnField && !active) {
        const boosted = applyPercentToTeam(
          team,
          extraPercent,
          extraName,
          log,
          `gains an extra +${extraPercent}% all stats — the friends fight together!`,
          extraTarget,
        );
        return { ...teams, [teamKey]: boosted };
      }
      if (!allAliveOnField && active) {
        const reverted = removePercentFromTeam(team, extraPercent, extraName);
        log(`${source.name}'s ${passiveName} extra bonus fades.`);
        return { ...teams, [teamKey]: reverted };
      }
      return teams;
    };

    for (const phase of [
      "OnBattleStart",
      character.team === "player" ? "OnPlayerTurnStart" : "OnEnemyTurnStart",
    ] as BattlePhase[]) {
      registerToQueue({
        id: `${character.instanceId}_passive_${passiveName}_charSynergyExtra_${phase}`,
        phase,
        sourceInstanceId: character.instanceId,
        mechanicId: `${passiveName} (extra)`,
        action: recheck,
        // The fade half of the recheck must run even after the passive
        // holder dies (ruling #24: extra drops when one dies — playtest
        // 2026-07-11 evening: Lyra kept +10% after the whole trio died)
        runWhenDead: true,
      });
    }
  }
}

// Giant's Will (Diane): +valuePercent base ATK at the start of each of her
// team's turns AFTER the first, up to maxStacks. Uncancellable.
function registerTurnRamp(character: BattleCharacter, registerToQueue: RegisterFn) {
  const mech = character.passive?.mechanics?.find(
    (m) => m.type === "turnRamp",
  );
  if (!mech || mech.type !== "turnRamp") return;

  registerToQueue({
    id: `${character.instanceId}_passive_${character.passive!.name}_turnRamp`,
    phase: character.team === "player" ? "OnPlayerTurnStart" : "OnEnemyTurnStart",
    sourceInstanceId: character.instanceId,
    mechanicId: `${character.passive!.name} (ramp)`,
    action: async (source, teams, log) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const team = [...teams[teamKey]];
      const idx = team.findIndex((c) => c.instanceId === source.instanceId);
      if (idx === -1 || team[idx].currentHP <= 0 || team[idx].isSub)
        return teams;

      const self = {
        ...team[idx],
        buffs: [...team[idx].buffs],
        passiveState: { ...team[idx].passiveState },
      };

      // "for each turn passed" — the first turn hasn't passed yet
      if (!self.passiveState.turnRampStarted) {
        self.passiveState.turnRampStarted = true;
        team[idx] = self;
        return { ...teams, [teamKey]: team };
      }

      const maxStacks = mech.maxStacks ?? 5;
      const stacks = (self.passiveState.turnRampStacks as number) || 0;
      if (stacks >= maxStacks) return teams;

      const percent = mech.valuePercent ?? 15;
      self.passiveState.turnRampStacks = stacks + 1;
      self.currentAttack += Math.floor(self.atk * (percent / 100));

      // Single display badge, updated in place (preApplied: gain is baked)
      const badgeName = character.passive!.name;
      const badgeIdx = self.buffs.findIndex((b) => b.name === badgeName);
      const badge = {
        type: "buff" as const,
        stat: "atk",
        valuePercent: percent * (stacks + 1),
        uncancellable: true,
        preApplied: true,
        name: badgeName,
      };
      if (badgeIdx === -1) self.buffs.push(badge);
      else self.buffs[badgeIdx] = badge;

      log(
        `${self.name}'s ${badgeName}: ATK +${percent}% (${stacks + 1}/${maxStacks}).`,
      );
      team[idx] = self;
      return { ...teams, [teamKey]: team };
    },
  });
}

// Extort Life (Ban): at the end of each full round — if he took NO damage
// since the last check, all enemies' max HP drops by valuePercent per stack
// (max maxStacks, uncancellable). Taking damage fully reverts the shred and
// resets the stacks (Tanveer ruling: full revert; no free heal on revert,
// current HP just re-clamps under the restored max).
function registerMaxHpShred(character: BattleCharacter, registerToQueue: RegisterFn) {
  const mech = character.passive?.mechanics?.find(
    (m) => m.type === "maxHpShred",
  );
  if (!mech || mech.type !== "maxHpShred") return;

  registerToQueue({
    id: `${character.instanceId}_passive_${character.passive!.name}_shred`,
    phase: "OnEnemyTurnEnd",
    sourceInstanceId: character.instanceId,
    mechanicId: `${character.passive!.name} (shred)`,
    action: async (source, teams, log) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const oppKey = source.team === "player" ? "enemyTeam" : "playerTeam";
      const team = [...teams[teamKey]];
      const opponents = [...teams[oppKey]];
      const idx = team.findIndex((c) => c.instanceId === source.instanceId);
      if (idx === -1 || team[idx].currentHP <= 0 || team[idx].isSub)
        return teams;

      const self = {
        ...team[idx],
        passiveState: { ...team[idx].passiveState },
      };
      const tookDamage = !!self.passiveState.tookDamageThisRound;
      self.passiveState.tookDamageThisRound = false;

      const maxStacks = mech.maxStacks ?? 5;
      const percent = mech.valuePercent ?? 8;
      const stacks = (self.passiveState.maxHpShredStacks as number) || 0;

      if (tookDamage) {
        if (stacks > 0) {
          self.passiveState.maxHpShredStacks = 0;
          for (let i = 0; i < opponents.length; i++) {
            const opp = {
              ...opponents[i],
              passiveState: { ...opponents[i].passiveState },
            };
            const base = opp.passiveState.maxHpShredBaseHp as
              | number
              | undefined;
            if (base) {
              opp.hp = base;
              delete opp.passiveState.maxHpShredBaseHp;
            }
            opponents[i] = opp;
          }
          log(
            `${self.name}'s ${character.passive!.name} resets — enemy max HP restored.`,
          );
        }
      } else if (stacks < maxStacks) {
        self.passiveState.maxHpShredStacks = stacks + 1;
        const totalPercent = percent * (stacks + 1);
        for (let i = 0; i < opponents.length; i++) {
          const opp = {
            ...opponents[i],
            passiveState: { ...opponents[i].passiveState },
          };
          if (opp.currentHP <= 0) continue;
          const base =
            (opp.passiveState.maxHpShredBaseHp as number | undefined) ?? opp.hp;
          opp.passiveState.maxHpShredBaseHp = base;
          opp.hp = Math.max(1, Math.floor(base * (1 - totalPercent / 100)));
          opp.currentHP = Math.min(opp.currentHP, opp.hp);
          opponents[i] = opp;
        }
        log(
          `${self.name}'s ${character.passive!.name}: all enemies' max HP -${totalPercent}% (${stacks + 1}/${maxStacks}).`,
        );
      }

      team[idx] = self;
      return { ...teams, [teamKey]: team, [oppKey]: opponents };
    },
  });
}

// Cut the Deck (Chiara): at the start of each of her team's turns, rolls one
// of the passive's `options` uniformly at random and applies it for that
// option's own duration — a fresh roll every turn, not additive/stacking
// (badges share one name so a re-roll simply replaces the prior badge on
// tick expiry rather than piling up). Requires field presence — her passive
// is explicitly "while on battlefield" (default-deny, no worksFromSub).
function registerRandomTurnEffect(
  character: BattleCharacter,
  registerToQueue: RegisterFn,
) {
  const mech = character.passive?.mechanics?.find(
    (m) => m.type === "randomTurnEffect",
  );
  if (!mech || mech.type !== "randomTurnEffect") return;
  const options = mech.options;
  if (!options || options.length === 0) return;

  const applyEntry = (
    list: BattleCharacter[],
    stat: string,
    valuePercent: number,
    duration: number,
    kind: "buff" | "debuff",
    name: string,
  ) =>
    list.map((c) => {
      if (c.currentHP <= 0 || c.isSub) return c;
      if (kind === "buff") {
        return {
          ...c,
          buffs: [
            ...c.buffs,
            {
              type: "buff" as const,
              stat,
              valuePercent,
              buffDuration: duration,
              uncancellable: true,
              name,
            },
          ],
        };
      }
      return {
        ...c,
        debuffs: [
          ...c.debuffs,
          {
            type: "debuff" as const,
            stat,
            valuePercent,
            debuffDuration: duration,
            uncancellable: true,
            name,
          },
        ],
      };
    });

  registerToQueue({
    id: `${character.instanceId}_passive_${character.passive!.name}_randomTurnEffect`,
    phase:
      character.team === "player" ? "OnPlayerTurnStart" : "OnEnemyTurnStart",
    sourceInstanceId: character.instanceId,
    mechanicId: `${character.passive!.name} (roll)`,
    action: async (source, teams, log) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const enemyKey = source.team === "player" ? "enemyTeam" : "playerTeam";
      const selfNow =
        teams[teamKey].find((c) => c.instanceId === source.instanceId) ??
        source;
      if (selfNow.currentHP <= 0 || selfNow.isSub) return teams;

      const picked = options[Math.floor(Math.random() * options.length)];
      const badgeName = `${character.passive!.name}: ${picked.kind === "buff" ? "+" : "-"}${picked.valuePercent}% ${picked.stat}`;

      let team = teams[teamKey];
      let enemies = teams[enemyKey];
      if (picked.target === "self") {
        team = team.map((c) =>
          c.instanceId === source.instanceId
            ? applyEntry(
                [c],
                picked.stat,
                picked.valuePercent,
                picked.duration,
                picked.kind,
                badgeName,
              )[0]
            : c,
        );
      } else if (picked.target === "allies") {
        team = applyEntry(
          team,
          picked.stat,
          picked.valuePercent,
          picked.duration,
          picked.kind,
          badgeName,
        );
      } else {
        enemies = applyEntry(
          enemies,
          picked.stat,
          picked.valuePercent,
          picked.duration,
          picked.kind,
          badgeName,
        );
      }

      log(
        `${source.name}'s ${character.passive!.name} rolls: ${badgeName} for ${picked.duration} turn(s)!`,
      );
      return { ...teams, [teamKey]: team, [enemyKey]: enemies };
    },
  });
}
