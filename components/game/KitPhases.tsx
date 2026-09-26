"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KitDetails, {
  PassiveProse,
  type KitPassiveView,
} from "@/components/game/KitDetails";
import SkillDocument from "@/components/game/SkillDocument";
import { PROSE } from "@/components/ui/prose";
import {
  getCharacterKit,
  getCharacterPhases,
  type CharacterData,
} from "@/lib/game/characterCatalog";

// Generic phase switcher for any multi-phase kit — boss phases now, and
// reusable for playable-character transformations later (Tanveer 2026-07-20).
// Each tab swaps the shown skills/ultimate/passives + a stat line for that
// phase. A single-phase character renders the plain kit with no tabs.

const STAT_LABEL =
  "font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground";

/**
 * `compact` is the boxed renderer used in battle overlays; `document` matches
 * the archive page's typographic layout, so a multi-phase boss doesn't render
 * as cards on a page where every single-phase character renders as a document.
 */
export type KitVariant = "compact" | "document";

function PhaseKit({
  kit,
  variant,
}: {
  kit: ReturnType<typeof getCharacterKit>;
  variant: KitVariant;
}): React.JSX.Element {
  if (variant === "compact") {
    return (
      <KitDetails
        skills={kit.skills}
        spSkill={kit.spSkill}
        ultimate={kit.ultimate}
        passives={kit.passives as KitPassiveView[]}
      />
    );
  }
  const passives = kit.passives as KitPassiveView[];
  return (
    <div>
      {kit.skills.map((skill, index) => (
        <SkillDocument
          key={skill.skillName}
          skill={skill}
          slot={`S${index + 1}`}
        />
      ))}
      {kit.spSkill ? (
        <SkillDocument skill={kit.spSkill} slot="SP" ranked={false} />
      ) : null}
      {kit.ultimate ? (
        <SkillDocument skill={kit.ultimate} slot="ULT" />
      ) : null}
      {passives.map((passive, index) => (
        <div key={passive.name ?? index} className="mt-5">
          <h3 className={PROSE.h3}>
            {passive.name ? `Passive — ${passive.name}` : "Passive"}
          </h3>
          <PassiveProse passive={passive} showName={false} bare />
        </div>
      ))}
    </div>
  );
}

export default function KitPhases({
  character,
  labels,
  variant = "compact",
}: {
  character: CharacterData;
  /** Optional per-phase names (e.g. transformation states). Defaults to "Phase N". */
  labels?: string[];
  variant?: KitVariant;
}): React.JSX.Element {
  const phaseCount = getCharacterPhases(character).length;
  const [phase, setPhase] = React.useState(0);

  if (phaseCount <= 1) {
    return <PhaseKit kit={getCharacterKit(character, 0)} variant={variant} />;
  }

  const kit = getCharacterKit(character, phase);
  const tabLabel = (i: number) => labels?.[i] ?? `Phase ${i + 1}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* The shadcn tabs, `line` because the phases sit on the archive's
            paper sheet (ruling #154). */}
        <Tabs value={String(phase)} onValueChange={(value) => setPhase(Number(value))}>
          <TabsList variant="line">
            {Array.from({ length: phaseCount }).map((_, i) => (
              <TabsTrigger
                key={i}
                value={String(i)}
                className="flex-none text-caption uppercase tracking-label"
              >
                {tabLabel(i)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto flex gap-3">
          {(
            [
              ["ATK", kit.atk],
              ["DEF", kit.def],
              ["HP", kit.hp],
            ] as const
          ).map(([label, value]) => (
            <span key={label} className={STAT_LABEL}>
              {label}{" "}
              <span className="font-heading text-sm text-card-foreground">
                {value}
              </span>
            </span>
          ))}
        </div>
      </div>

      <PhaseKit kit={kit} variant={variant} />
    </div>
  );
}
