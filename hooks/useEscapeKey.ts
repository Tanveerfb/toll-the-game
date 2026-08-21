"use client";

import React from "react";

/**
 * Escape closes.
 *
 * Every modal in this game can be dismissed by clicking its scrim, and a scrim
 * is a pointer-only affordance: there is no way to "click the background" with
 * a keyboard. Escape is what makes the dismissal reachable, which is also what
 * makes it defensible to leave the scrim's own click handler on a plain `<div>`
 * — the accessible paths are this key and the panel's close button, not the
 * backdrop.
 *
 * `active` rather than mounting-and-unmounting the caller: a modal that renders
 * conditionally would otherwise have to hoist this hook above its own guard.
 */
export function useEscapeKey(onEscape: () => void, active = true): void {
  React.useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape, active]);
}

/**
 * Props for a modal scrim: click the backdrop to dismiss, but *only* the
 * backdrop.
 *
 * This replaces the `onClick={(e) => e.stopPropagation()}` that used to sit on
 * the panel inside. Comparing target to currentTarget says the same thing with
 * one handler instead of two, and — the reason it matters here — it stops the
 * panel from being a second static element with a click handler on it, which
 * is a real lint finding for a handler that never did anything but block.
 */
export function scrimProps(onDismiss: () => void): {
  onClick: (event: React.MouseEvent) => void;
} {
  return {
    onClick: (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) onDismiss();
    },
  };
}
