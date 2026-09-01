import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";
import type {
  BattleEventEffect,
  BattleEventEffectChange,
} from "@/types/battleEvent";
import { statPhrase } from "@/lib/game/stats";

/**
 * Status-change detection for the battle event stream (Open Issue #22).
 *
 * Deliberately a **diff, not instrumentation.** `executeSkill` pushes onto
 * `buffs`/`debuffs` from roughly two dozen sites, and passives, defeat
 * handlers and `syncExtortLinks` add more outside it; hand-emitting at each
 * one guarantees the next site added forgets to, and forgets silently. A
 * before/after comparison over every character on the field cannot miss a
 * site, including ones that do not exist yet.
 *
 * The snapshot converts entries to plain data **eagerly**. `executeSkill`
 * shallow-copies the status arrays (`buffs: [...c.buffs]`), so a before-state
 * holding live `StatusEffect` references would be corrupted by any site that
 * mutates an entry in place rather than replacing it.
 */

/** Fields that make two entries the *same* status, ignoring magnitude. Used
 *  to recognise a refresh: a recast that overwrites a duration shows up as a
 *  removal plus an application, and reading that as a cleanse is a lie. */
function identityKey(effect: BattleEventEffect): string {
  return [
    effect.slot,
    effect.type,
    effect.name ?? "",
    effect.stat ?? "",
    (effect.stats ?? []).join(","),
  ].join("|");
}

/** Full equality key — two entries with the same one are interchangeable, so
 *  a multiset comparison over these is what "unchanged" means. */
function signature(effect: BattleEventEffect): string {
  return [
    identityKey(effect),
    effect.valuePercent ?? "",
    effect.value ?? "",
    effect.duration ?? "",
    effect.sealType ?? "",
    effect.uncancellable ? "u" : "",
    effect.debuffImmune ? "i" : "",
  ].join("|");
}

function toEventEffect(
  entry: StatusEffect,
  slot: "buff" | "debuff",
): BattleEventEffect {
  return {
    slot,
    type: entry.type,
    name: entry.name,
    stat: entry.stat,
    stats: entry.stats,
    valuePercent: entry.valuePercent,
    value: entry.value,
    duration: slot === "buff" ? entry.buffDuration : entry.debuffDuration,
    sealType: entry.sealType,
    uncancellable: entry.uncancellable || undefined,
    debuffImmune: entry.debuffImmune || undefined,
  };
}

function flatten(char: BattleCharacter): BattleEventEffect[] {
  return [
    ...char.buffs.map((e) => toEventEffect(e, "buff")),
    ...char.debuffs.map((e) => toEventEffect(e, "debuff")),
  ];
}

export type EffectSnapshot = Map<string, BattleEventEffect[]>;

export function snapshotEffects(chars: BattleCharacter[]): EffectSnapshot {
  const snapshot: EffectSnapshot = new Map();
  for (const char of chars) snapshot.set(char.instanceId, flatten(char));
  return snapshot;
}

function diffBy(
  before: EffectSnapshot,
  chars: BattleCharacter[],
  key: (effect: BattleEventEffect) => string,
  collapseRefresh: boolean,
): BattleEventEffectChange[] {
  const changes: BattleEventEffectChange[] = [];

  for (const char of chars) {
    const unmatched = [...(before.get(char.instanceId) ?? [])];
    const applied: BattleEventEffect[] = [];

    for (const current of flatten(char)) {
      const currentKey = key(current);
      const index = unmatched.findIndex((prior) => key(prior) === currentKey);
      if (index === -1) applied.push(current);
      else unmatched.splice(index, 1);
    }

    const appliedIdentities = new Set(applied.map(identityKey));
    const removed = collapseRefresh
      ? unmatched.filter((entry) => !appliedIdentities.has(identityKey(entry)))
      : unmatched;

    if (applied.length > 0 || removed.length > 0) {
      changes.push({
        instanceId: char.instanceId,
        name: char.name,
        applied,
        removed,
      });
    }
  }

  return changes;
}

/**
 * What changed between `before` and the characters' current state — for an
 * **action**, where magnitude matters and a recast is worth showing.
 *
 * Characters with no change are omitted entirely, so an action that moved no
 * statuses produces an empty array rather than a row per unit. A refresh is
 * collapsed to an application: the multiset sees remove-plus-add, and printing
 * that as a cleanse the player never got is a lie.
 */
export function diffEffects(
  before: EffectSnapshot,
  chars: BattleCharacter[],
): BattleEventEffectChange[] {
  return diffBy(before, chars, signature, true);
}

/**
 * The same comparison at **identity** rather than full equality — for a
 * turn-start/turn-end tick.
 *
 * A tick decrements every durationed effect it does not expire, so the full
 * diff would report the entire board as refreshed once per turn: technically
 * accurate, and unreadable. Comparing identities instead leaves the survivors
 * silent and reports only what a player would actually call an event — a buff
 * that ran out, a boss passive that granted something new.
 *
 * The cost is deliberate: a magnitude change with no identity change (a
 * Corrosion gaining a stack) is invisible here. On an action that matters and
 * `diffEffects` catches it; once a turn it is noise.
 */
export function diffEffectIdentities(
  before: EffectSnapshot,
  chars: BattleCharacter[],
): BattleEventEffectChange[] {
  return diffBy(before, chars, identityKey, false);
}

const TYPE_LABEL: Partial<Record<BattleEventEffect["type"], string>> = {
  stun: "Stunned",
  taunt: "Taunt",
  seal: "Seal",
  ignite: "Ignite",
  decay: "Decay",
  corrosion: "Corrosion",
  damageOverTime: "Damage over time",
  healOverTime: "Regeneration",
  stance: "Stance",
};

/**
 * One log-line label for a status change. Presentation, so it lives beside the
 * diff rather than inside the drawer: the drawer renders chips, the simulator
 * prints lines, and both need the same words.
 *
 * Not the kit-description voice — tier words ("greatly", "massively") belong
 * to authored card text, and a log entry states what actually happened.
 */
export function describeEventEffect(effect: BattleEventEffect): string {
  const parts: string[] = [];

  if (effect.debuffImmune) {
    parts.push(effect.name ?? "Debuff Immunity");
  } else if (effect.valuePercent !== undefined && effect.valuePercent !== 0) {
    const sign = effect.slot === "debuff" ? "−" : "+";
    const stats = statPhrase(effect);
    parts.push(
      `${effect.name ? `${effect.name}: ` : ""}${stats} ${sign}${effect.valuePercent}%`,
    );
  } else if (effect.type === "seal") {
    parts.push(`${effect.sealType ?? "attack"} skills sealed`);
  } else {
    const base = effect.name ?? TYPE_LABEL[effect.type] ?? effect.type;
    parts.push(
      effect.value !== undefined && effect.value > 0
        ? `${base} (${effect.value.toLocaleString()}/turn)`
        : base,
    );
  }

  if (effect.duration !== undefined && effect.duration > 0) {
    parts.push(`${effect.duration}t`);
  }
  return parts.join(" · ");
}
