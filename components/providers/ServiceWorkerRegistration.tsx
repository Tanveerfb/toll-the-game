"use client";

import React from "react";

/**
 * Registers `public/sw.js`.
 *
 * **Production only.** A worker caching the app shell while you are editing it
 * serves yesterday's build and looks exactly like a bug in your own code — and
 * the dev server here is forwarded to a phone, which is precisely where that
 * confusion would be hardest to diagnose.
 *
 * Registration failing is not an error worth surfacing: an unsupported browser,
 * a private window, or a blocked worker all land here, and in every case the
 * game works — it just isn't installable.
 */
export default function ServiceWorkerRegistration(): null {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // After load, so registration never competes with the first paint on the
    // slow phone this whole pass was aimed at.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Not installable here. Nothing else changes. */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
