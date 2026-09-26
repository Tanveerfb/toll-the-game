import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's own font sizes. It read the game's
 * three below `text-xs` (`styles/globals.css`, ruling #154) as COLOURS, so
 * `text-caption` beside `text-secondary-foreground` silently dropped the
 * colour, and `text-label` before a variant's colour dropped the size.
 * Registering them as sizes keeps both. `tests/cn.test.ts` holds it: add a
 * step here in the same change that adds one to `@theme`.
 */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["micro", "label", "caption"] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
