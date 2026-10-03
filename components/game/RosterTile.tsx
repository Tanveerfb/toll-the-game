import React from "react";
import Link from "next/link";
import UnitTileFace, { unitTileWrapperClass } from "@/components/game/UnitTileFace";

/**
 * The archive's roster tile: `UnitTileFace` (the "Ink burst" frame break,
 * ruling #172 - see it for what the tile shows) as a link to the unit's page.
 * The name is in the link's accessible label, since the tile carries none;
 * search still finds by name.
 */
export interface RosterTileProps {
  id: string;
  name: string;
  href: string;
  hue: string;
  code: string;
  /** null hides the plate: before hydration, or on a page with no ownership. */
  status: { owned: true; level: number; ultLevel: number } | { owned: false } | null;
}

export default function RosterTile({ id, name, href, hue, code, status }: RosterTileProps): React.JSX.Element {
  const label = !status
    ? name
    : status.owned
      ? `${name}, level ${status.level}, ultimate level ${status.ultLevel}`
      : `${name}, not yet recruited`;

  return (
    <Link href={href} aria-label={label} className={unitTileWrapperClass}>
      <UnitTileFace id={id} name={name} hue={hue} code={code} status={status} />
    </Link>
  );
}
