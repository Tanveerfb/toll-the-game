/**
 * Turning `data/kit.template.json` into a new kit file. Pure, so the newkit
 * script stays thin and `tests/kitSchema.test.ts` can prove the template
 * materialises into something the catalog accepts.
 */

/** The template's commentary keys; a kit never carries them. */
const TEMPLATE_ONLY_KEYS = new Set(["$schema", "$comment"]);

/** The sim-placeholder range; never handed out as a real card number. */
const PLACEHOLDER_FLOOR = 999000;

export type NewKitOptions = {
  id: string;
  name: string;
  color: "light" | "red" | "blue" | "green" | "dark";
  heading?: string;
  cardNumber: number;
};

/** Deep copy without the template's `$comment` / `$schema` keys. */
export function stripTemplateKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTemplateKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !TEMPLATE_ONLY_KEYS.has(key))
        .map(([key, item]) => [key, stripTemplateKeys(item)]),
    );
  }
  return value;
}

/**
 * The next card number: one past the highest real number in use. Never
 * reuses a gap (a deleted kit's number stays retired, ruling #187) and never
 * reaches the 999xxx placeholder range.
 */
export function nextFreeCardNumber(inUse: readonly number[]): number {
  const real = inUse.filter((n) => n < PLACEHOLDER_FLOOR);
  return (real.length > 0 ? Math.max(...real) : 100000) + 1;
}

/** A kit object from the template and his choices; `unreleased` until the art lands. */
export function materialiseKit(
  template: Record<string, unknown>,
  options: NewKitOptions,
): Record<string, unknown> {
  const kit = stripTemplateKeys(template) as Record<string, unknown>;
  const stamp = (card: unknown) =>
    card && typeof card === "object" ? { ...(card as object), characterId: options.id } : card;
  const skills = Array.isArray(kit.skills) ? kit.skills.map(stamp) : kit.skills;
  const result: Record<string, unknown> = {
    ...kit,
    id: options.id,
    cardNumber: options.cardNumber,
    name: options.name,
    color: options.color,
    skills,
    ultimate: stamp(kit.ultimate),
    unreleased: true,
  };
  if (options.heading) result.heading = options.heading;
  else delete result.heading;
  return result;
}
