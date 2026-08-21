"use client";

import React from "react";
import { Coins, Gem, Ticket } from "lucide-react";
import DetailOverlay from "@/components/game/DetailOverlay";
import ItemIcon from "@/components/game/ItemIcon";
import { usePlayerStore } from "@/store/playerStore";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { MATERIAL_IDS, materialLabel } from "@/lib/game/materials";
import { rankProgress, MAX_ACCOUNT_RANK } from "@/lib/game/accountRank";
import { worldLevelCapForRank, MAX_WORLD_LEVEL } from "@/lib/game/worldLevel";
import { ASCENSION_BANDS, LEVEL_CAP } from "@/lib/game/progression";

/**
 * Everything the account holds, in one place.
 *
 * The profile page used to render `MATERIAL_LABELS` in full, so a fresh
 * account met a wall of zeroes and a stocked one had to find the non-zero
 * cells inside it. Here, held materials are listed and unheld ones are
 * counted — the count still tells you the catalogue is bigger than your
 * shelf, without spending a row per empty slot.
 */

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 border border-hairline bg-panel px-3 py-2">
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-readout-muted">
        {label}
      </span>
      <span className="font-heading text-xl leading-none tracking-[0.04em] text-readout-strong tabular-nums">
        {value}
      </span>
      {hint ? (
        <span className="font-body text-[10px] text-readout-muted">{hint}</span>
      ) : null}
    </div>
  );
}

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
    <div className="flex items-center gap-2 border border-hairline bg-panel px-3 py-2">
      <ItemIcon
        id={id}
        size={28}
        alt=""
        fallback={
          <Fallback
            className="h-4 w-4 shrink-0 text-readout-muted"
            strokeWidth={2.2}
          />
        }
      />
      <span className="min-w-0">
        <span className="block font-heading text-lg leading-none text-readout-strong tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="block font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-muted">
          {label}
        </span>
      </span>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
      {children}
    </p>
  );
}

export default function InventoryModal({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const roster = usePlayerStore((s) => s.roster);
  const currencies = usePlayerStore((s) => s.currencies);
  const inventory = usePlayerStore((s) => s.inventory);
  const characters = usePlayerStore((s) => s.characters);
  const account = usePlayerStore((s) => s.account);
  const worldLevel = usePlayerStore((s) => s.worldLevel);

  const held = MATERIAL_IDS.filter((id) => (inventory[id] ?? 0) > 0);
  const unheld = MATERIAL_IDS.length - held.length;

  const progress = rankProgress(account, account.clearedWalls);
  const cap = worldLevelCapForRank(account.rank);

  // Investment across the roster — the "have I actually built anything"
  // readout that no screen answered before.
  const invested = roster.reduce(
    (acc, id) => {
      const p = characters[id];
      const level = p?.level ?? 1;
      const ascension = p?.ascension ?? 0;
      const ultLevel = p?.ultLevel ?? 1;
      return {
        levels: acc.levels + (level - 1),
        ascensions: acc.ascensions + ascension,
        ultLevels: acc.ultLevels + (ultLevel - 1),
        best:
          level > acc.best.level ? { id, level } : acc.best,
      };
    },
    { levels: 0, ascensions: 0, ultLevels: 0, best: { id: "", level: 0 } },
  );
  const bestName = invested.best.id
    ? (getCharacterById(invested.best.id)?.name ?? invested.best.id)
    : null;

  return (
    <DetailOverlay title="Inventory" subtitle="Everything this account holds" size="wide" onClose={onClose}>
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
            <p className="border border-dashed border-edge px-3 py-4 text-center font-body text-xs text-readout-muted">
              Nothing held yet — World Boss runs and story clears drop these.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {held.map((id) => (
                <div
                  key={id}
                  className="flex items-center gap-2 border border-hairline bg-panel px-3 py-2"
                >
                  <ItemIcon id={id} size={28} alt="" />
                  <span className="min-w-0 flex-1 truncate font-body text-xs text-readout-dim">
                    {materialLabel(id)}
                  </span>
                  <span className="shrink-0 font-heading text-lg leading-none text-readout-strong tabular-nums">
                    {inventory[id]}
                  </span>
                </div>
              ))}
            </div>
          )}
          {unheld > 0 ? (
            <p className="mt-2 font-body text-[11px] text-readout-muted">
              {unheld} further material {unheld === 1 ? "kind" : "kinds"} exist
              and aren&rsquo;t held yet.
            </p>
          ) : null}
        </section>

        <section>
          <SectionHead>Account</SectionHead>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure
              label="Rank"
              value={`${account.rank}`}
              hint={`of ${MAX_ACCOUNT_RANK}`}
            />
            <Figure
              label="XP to next"
              value={progress ? `${progress.required - progress.current}` : "—"}
              hint={progress ? `of ${progress.required}` : "trial required"}
            />
            <Figure
              label="World level"
              value={`${worldLevel}`}
              hint={`cap ${cap} of ${MAX_WORLD_LEVEL}`}
            />
            <Figure label="Roster" value={`${roster.length}`} hint="recruited" />
          </div>
        </section>

        <section>
          <SectionHead>Investment</SectionHead>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure
              label="Levels gained"
              value={`${invested.levels}`}
              hint={`cap ${LEVEL_CAP} each`}
            />
            <Figure
              label="Ascensions"
              value={`${invested.ascensions}`}
              hint={`cap ${ASCENSION_BANDS} each`}
            />
            <Figure label="Ult ranks" value={`${invested.ultLevels}`} />
            <Figure
              label="Highest"
              value={invested.best.level > 0 ? `Lv ${invested.best.level}` : "—"}
              hint={bestName ?? undefined}
            />
          </div>
        </section>
      </div>
    </DetailOverlay>
  );
}
