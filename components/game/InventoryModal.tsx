"use client";

import React from "react";
import { Coins, Gem, Ticket } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import MountedDialog from "@/components/ui/MountedDialog";
import ItemIcon from "@/components/game/ItemIcon";
import { usePlayerStore } from "@/store/playerStore";
import { MATERIAL_IDS, materialLabel } from "@/lib/game/materials";

/**
 * Everything the account holds, in one place.
 *
 * The profile page used to render `MATERIAL_LABELS` in full, so a fresh
 * account met a wall of zeroes and a stocked one had to find the non-zero
 * cells inside it. Here, only held materials are listed.
 */

/** A held currency: icon, count, name. The icon comes from `public/items/` and
 *  falls back to the lucide glyph this panel carried before the art landed. */
function Currency({
  id,
  fallback: Fallback,
  label,
  value,
}: {
  id: string;
  fallback: React.ElementType;
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 border border-rule bg-muted px-3 py-2">
      <ItemIcon
        id={id}
        size={28}
        alt=""
        fallback={
          <Fallback
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2.2}
          />
        }
      />
      <span className="min-w-0">
        <span className="block font-heading text-lg leading-none tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="block font-body text-label font-bold uppercase tracking-label text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 border-b border-rule pb-1.5 font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
      {children}
    </p>
  );
}

export default function InventoryModal({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const currencies = usePlayerStore((s) => s.currencies);
  const inventory = usePlayerStore((s) => s.inventory);

  const held = MATERIAL_IDS.filter((id) => (inventory[id] ?? 0) > 0);

  return (
    <MountedDialog
      title="Inventory"
      description="Everything this account holds"
      onClose={onClose}
      className="sm:max-w-2xl"
    >
      <div className="space-y-5">
        <section>
          <SectionHead>Currencies</SectionHead>
          <div className="grid grid-cols-3 gap-2">
            <Currency
              id="gems"
              fallback={Gem}
              label="Gems"
              value={currencies.gems}
            />
            <Currency
              id="coin"
              fallback={Coins}
              label="Coin"
              value={currencies.coin}
            />
            <Currency
              id="permanent_ticket"
              fallback={Ticket}
              label="Tickets"
              value={currencies.permanentTicket}
            />
          </div>
        </section>

        <section>
          <SectionHead>Materials</SectionHead>
          {held.length === 0 ? (
            <EmptyState>Nothing held yet — World Boss runs drop these.</EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {held.map((id) => (
                <div
                  key={id}
                  className="flex items-center gap-2 border border-rule bg-muted px-3 py-2"
                >
                  <ItemIcon id={id} size={28} alt="" />
                  <span className="min-w-0 flex-1 truncate font-body text-xs">
                    {materialLabel(id)}
                  </span>
                  <span className="shrink-0 font-heading text-lg leading-none tabular-nums">
                    {inventory[id]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MountedDialog>
  );
}
