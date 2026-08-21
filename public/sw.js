/*
 * Service worker — hand-written, on purpose.
 *
 * `next-pwa` needs webpack and Next 16 defaults to Turbopack. `@serwist/next`
 * turned out to have the same limitation despite what its docs imply: it
 * printed a Turbopack warning and silently produced no worker at all. Its
 * "configurator mode" does support Turbopack, but at the cost of three more
 * dependencies and rewriting both `build` and `dev` — and `build` is what
 * Vercel runs on every push to master, which is not a thing to make more
 * fragile to cache an app shell.
 *
 * So: no build step, no dependency, no generated precache manifest. This file
 * is source, it ships as-is, and everything it does is visible here.
 *
 * WHAT IT IS FOR: making the game installable to a home screen, and making an
 * installed copy open instantly. Chrome will not offer the install prompt
 * without a worker that handles `fetch`, which is the main reason this exists.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: cache anything about game state. Progress
 * lives in Firestore and the persisted stores; a worker holding its own copy
 * would be a second, staler source of truth for a save file. Only static
 * assets and the shell are touched.
 */

/* global self, caches, Response, fetch, URL */

/**
 * Bump to invalidate everything. Old caches are deleted on activate, so this
 * is the one lever needed when a release must not be served a stale asset.
 */
const VERSION = "v1";
const ASSET_CACHE = `toll-assets-${VERSION}`;

/** Directories whose contents are content-addressed or effectively immutable:
 *  character art, backgrounds, icons, audio, and Next's hashed build output. */
const CACHEABLE = [
  "/_next/static/",
  "/characters/",
  "/npc/",
  "/backgrounds/",
  "/banners/",
  "/items/",
  "/audio/",
];

self.addEventListener("install", (event) => {
  // Nothing is precached: the asset list is large, mostly art the player may
  // never see, and precaching it would spend a phone's data on install.
  // Assets enter the cache as they are actually used.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("toll-") && name !== ASSET_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Same origin only. A cross-origin response here would mean caching
  // Firebase and Vercel Analytics traffic, which is both useless and wrong.
  if (url.origin !== self.location.origin) return;

  // Navigations go to the network first. The alternative — serving a cached
  // shell — means a push to master does not reach anyone who has the game
  // installed until they clear storage, and this repo deploys on every push.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(request)) ??
          (await caches.match("/")) ??
          Response.error(),
      ),
    );
    return;
  }

  if (!CACHEABLE.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Cache-first for assets. These are hashed or versioned by a query string
  // (`?v=` on art, see lib/game/characterArt.ts), so a stale hit is a hit on
  // something that genuinely has not changed.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Opaque and error responses are not worth keeping; caching a 404
        // makes a missing asset permanent for that client.
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Offline and never fetched. Let the caller's own fallback handle it —
        // the art layer already resolves a missing image to a placeholder.
        return Response.error();
      }
    })(),
  );
});
