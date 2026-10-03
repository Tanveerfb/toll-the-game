"use client";

import React from "react";

/** Any radix dialog, sheet or popover that is currently open. The selector
 *  matches on `data-state`, which the coach card (a plain `role="dialog"`)
 *  does not carry, so it can never count itself. */
export const OPEN_OVERLAY_SELECTOR = '[role="dialog"][data-state="open"]';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-state"],
  });
  return () => observer.disconnect();
}

function snapshot(): boolean {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

/**
 * True while any sheet, dialog or popover is open on the page.
 *
 * Generic on purpose: detecting the DOM state means a new overlay is covered
 * without being listed anywhere. Used by the tutorial coach to stand down.
 */
export function useOverlayOpen(): boolean {
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
