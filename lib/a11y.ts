import type React from "react";

/**
 * Props for a large surface that acts as one button — a full-screen "tap to
 * continue", a card, a tile.
 *
 * These exist because the element genuinely can't be a `<button>`: it either
 * fills the viewport, or it contains a control of its own and a button inside a
 * button is invalid HTML.
 *
 * What this fixes, found by the full `jsx-a11y` ruleset on 2026-08-21: three
 * such surfaces — the story scene reader, the chapter title card and the versus
 * splash — carried `role="button"`, `tabIndex={0}` and an `aria-label`, and
 * **no key handler at all**. So a keyboard user could tab to them, see them
 * take focus, press Enter, and have nothing happen. Announced as a button,
 * shaped like a button, inert as a button — worse than an element that had
 * never claimed to be one.
 *
 * Enter and Space both fire, because that is what a real `<button>` does and
 * the point of `role="button"` is to be indistinguishable from one. Space is
 * `preventDefault`ed or the page scrolls underneath the press.
 */
export function tapSurfaceProps(
  onActivate: () => void,
  label: string,
): {
  role: "button";
  tabIndex: 0;
  "aria-label": string;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
} {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onActivate();
    },
  };
}
