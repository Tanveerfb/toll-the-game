import { getCharacterById } from "@/lib/game/characterCatalog";
import { materialLabel } from "@/lib/game/materials";

/**
 * One reward, split into the parts a screen draws: an icon, a name, a number.
 *
 * Rewards were formatted three ways (audit 3.5, 2026-10-03): the Orders board
 * built `"1 ticket"` strings by hand, the boss results screen built
 * `[icon, "Permanent Ticket", n]` rows, and the pull reveal had its own. This
 * is the one place a bundle becomes parts, so a new currency is added once and
 * the word for it ("Tickets") is spelled once.
 */

/** What a part is, so a list can group them without re-deriving it. */
export type RewardPartKind = "character" | "currency" | "material" | "xp";

export interface RewardPart {
  kind: RewardPartKind;
  /** What `ItemIcon` resolves art from. Empty when there is nothing to draw —
   *  a character prize is a name, and Account XP is a number, not a thing you
   *  hold. */
  iconId: string;
  /** The category name: "Gems", "Coin", "Tickets", a material's label, or a
   *  character's name. */
  label: string;
  amount: number;
}

/** Everything a reward can contain. Orders and boss clears both fit it. */
export interface RewardBundle {
  character?: string;
  gems?: number;
  coin?: number;
  permanentTicket?: number;
  accountXp?: number;
  materials?: Record<string, number>;
}

/**
 * A bundle's parts, zeroes dropped, in the order a player reads them: the
 * character first (the only reward worth changing your plans for), then
 * currencies, then Account XP, then materials.
 */
export function rewardParts(bundle: RewardBundle): RewardPart[] {
  const parts: RewardPart[] = [];
  if (bundle.character) {
    parts.push({
      kind: "character",
      iconId: "",
      label: getCharacterById(bundle.character)?.name ?? bundle.character,
      amount: 1,
    });
  }
  if (bundle.gems) {
    parts.push({ kind: "currency", iconId: "gems", label: "Gems", amount: bundle.gems });
  }
  if (bundle.coin) {
    parts.push({ kind: "currency", iconId: "coin", label: "Coin", amount: bundle.coin });
  }
  if (bundle.permanentTicket) {
    parts.push({
      kind: "currency",
      iconId: "permanent_ticket",
      label: "Tickets",
      amount: bundle.permanentTicket,
    });
  }
  if (bundle.accountXp) {
    parts.push({ kind: "xp", iconId: "", label: "Account XP", amount: bundle.accountXp });
  }
  for (const [id, count] of Object.entries(bundle.materials ?? {})) {
    if (count > 0) {
      parts.push({ kind: "material", iconId: id, label: materialLabel(id), amount: count });
    }
  }
  return parts;
}

/** "ticket" or "tickets" for a count: one word, singular when it is one. */
export function ticketNoun(count: number): string {
  return count === 1 ? "ticket" : "tickets";
}

/**
 * A part as one inline phrase: "5 gems", "1,200 coin", "1 ticket",
 * "2× Training manual". A character is just its name.
 */
export function describeRewardPart(part: RewardPart): string {
  const amount = part.amount.toLocaleString();
  switch (part.kind) {
    case "character":
      return part.label;
    case "material":
      return `${amount}× ${part.label}`;
    case "xp":
      return `${amount} xp`;
    case "currency":
      return part.iconId === "permanent_ticket"
        ? `${amount} ${ticketNoun(part.amount)}`
        : `${amount} ${part.label.toLowerCase()}`;
  }
}
