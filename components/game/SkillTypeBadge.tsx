import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { SKILL_TYPE_CHIP, skillTypeCategory } from "@/lib/game/skillTypeStyle";
import { cn } from "@/lib/utils";

/**
 * A skill's slot as a chip in its class's hue, ink on it (ruling #133 for the
 * hue, ruling #154 for ink-on-fill). `KitDetails` and `SkillDocument` each
 * wrote this by hand (audit 3.4); both render it from here now.
 */
export default function SkillTypeBadge({
  skill,
  className,
  children,
}: {
  /** The skill whose class sets the hue. */
  skill: Parameters<typeof skillTypeCategory>[0];
  className?: string;
  /** The slot's label: "S1", "ULT". */
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Badge
      variant="fill"
      className={cn(
        "h-auto py-0.5",
        SKILL_TYPE_CHIP[skillTypeCategory(skill)],
        className,
      )}
    >
      {children}
    </Badge>
  );
}
