"use client";

import * as React from "react";

/**
 * Hands focus back to whatever opened a dialog that has no single trigger.
 *
 * Radix returns focus to a `DialogTrigger` on close. A dialog opened from one
 * of many rows (a kit's abilities, a list of Auto Clear runs, a team's slots)
 * has no single trigger, and radix then drops focus onto `<body>`: a keyboard
 * or screen-reader user closing it lands at the top of the page. Measured in
 * the browser on 2026-09-26, the first time a dialog was opened that way.
 *
 * `remember(element)` on open; pass `onCloseAutoFocus` to `DialogContent`.
 */
export function useReturnFocus(): {
  remember: (element: HTMLElement | null) => void;
  onCloseAutoFocus: (event: Event) => void;
} {
  const opener = React.useRef<HTMLElement | null>(null);
  const remember = React.useCallback((element: HTMLElement | null) => {
    opener.current = element;
  }, []);
  const onCloseAutoFocus = React.useCallback((event: Event) => {
    event.preventDefault();
    opener.current?.focus();
  }, []);
  return { remember, onCloseAutoFocus };
}

/**
 * The same, for a dialog that is mounted only while open (the caller renders
 * it conditionally): whatever held focus when it mounted is the button that
 * opened it, so that is where focus goes back to.
 */
export function useFocusBackToOpener(): (event: Event) => void {
  const [opener] = React.useState<HTMLElement | null>(() =>
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );
  return React.useCallback(
    (event: Event) => {
      event.preventDefault();
      opener?.focus();
    },
    [opener],
  );
}
