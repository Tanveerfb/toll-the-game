import type { KitPassiveView } from "@/components/game/KitDetails";

/**
 * Passive Details content pattern (2026-07-24 battle UI overhaul, spec §5):
 * categorized condition headers (e.g. "Basic effect(s)", "When attacking",
 * "Every turn") each followed by a bulleted effect list — a legible template
 * for multi-effect passives (Molvarr-style boss passives) instead of one
 * dense paragraph.
 *
 * Grouped from EXISTING structured data only (each mechanic's own
 * `triggerText`/`trigger`, falling back to the passive's own), never by
 * re-parsing/rewriting description text — a presentation reorganization,
 * not a content rewrite.
 */

export interface PassiveDetailSection {
  header: string;
  bullets: string[];
}

const TRIGGER_LABELS: Record<string, string> = {
  always: "Basic effect(s)",
  afterSkill: "After using a skill",
  beforeSkill: "Before using a skill",
  onAllySkill: "When an ally uses a skill",
  onAttackReceived: "When attacked",
  onDamageDealt: "When dealing damage",
  onDamageTaken: "When taking damage",
  onBattleStart: "At battle start",
  onFirstAction: "On this unit's first action",
  onIgniteConsume: "When Ignite is consumed",
  onLethalDamage: "When taking lethal damage",
  onNewTurn: "At the start of turn",
  onRoundEnd: "At the end of turn",
  onTurnStart: "At the start of turn",
  onTurnEnd: "At the end of turn",
  aura: "Basic effect(s)",
};

function humanizeTrigger(trigger?: string): string {
  if (!trigger) return "Basic effect(s)";
  if (TRIGGER_LABELS[trigger]) return TRIGGER_LABELS[trigger];
  return trigger
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Resolve one mechanic's (or the passive's own) header label: an explicit
 * display-only `triggerText` wins, else the structured `trigger` is
 * humanized, else the passive's own trigger, else the generic fallback.
 */
function resolveHeader(
  mechanicTriggerText: string | undefined,
  mechanicTrigger: string | undefined,
  passive: KitPassiveView,
): string {
  if (mechanicTriggerText) return mechanicTriggerText;
  if (mechanicTrigger) return humanizeTrigger(mechanicTrigger);
  return humanizeTrigger(passive.trigger);
}

export function buildPassiveDetailSections(
  passive: KitPassiveView,
): PassiveDetailSection[] {
  const mechanics = passive.mechanics ?? [];

  if (mechanics.length === 0) {
    return [
      {
        header: humanizeTrigger(passive.trigger),
        bullets: [passive.description?.trim() || "To be added."],
      },
    ];
  }

  const sections: PassiveDetailSection[] = [];
  const bulletsWithoutDescription: string[] = [];

  for (const mechanic of mechanics) {
    const header = resolveHeader(mechanic.triggerText, mechanic.trigger, passive);
    const bullet = mechanic.description?.trim();
    if (!bullet) {
      // Track headers that ended up with no real bullet (e.g. a synergy
      // mechanic with no own description) so we know whether to fall back.
      if (!bulletsWithoutDescription.includes(header)) {
        bulletsWithoutDescription.push(header);
      }
      continue;
    }
    const existing = sections.find((s) => s.header === header);
    if (existing) {
      existing.bullets.push(bullet);
    } else {
      sections.push({ header, bullets: [bullet] });
    }
  }

  // Every mechanic lacked its own description — fall back to the passive's
  // top-level description as a single bullet rather than an empty section.
  if (sections.length === 0) {
    return [
      {
        header: humanizeTrigger(passive.trigger),
        bullets: [passive.description?.trim() || "To be added."],
      },
    ];
  }

  return sections;
}
