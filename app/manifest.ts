import type { MetadataRoute } from "next";

/**
 * PWA manifest — what the game becomes when it's installed to a home screen.
 *
 * Worth having specifically because of ruling #107: the game is designed at
 * 390×844 and spends real effort on `dvh` because browser chrome eats the
 * viewport and changes height as you scroll. Installed, that chrome is gone —
 * the layout gets the screen it was drawn for, and `dvh` stops being a moving
 * target.
 *
 * A route rather than a static `public/manifest.json` so the fields stay typed.
 *
 * The icon is a real file, not the generated route it started as: a generated
 * route's URL carries a build hash, and an icon already sitting on someone's
 * home screen should not change URL on every deploy. `scripts/logo_candidates.py
 * --ship` writes it; `app/icon.png` is the same image, which Next serves as the
 * favicon by filename convention.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toll",
    short_name: "Toll",
    description: "A turn-based card battle game.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // The Combat Terminal void, so the splash and the app shell match the game
    // rather than flashing white on launch.
    background_color: "#06090c",
    theme_color: "#06090c",
    // The same file declared twice, which is the shape Next's typed manifest
    // wants — `purpose` takes one value, not the space-separated pair the web
    // manifest spec allows.
    //
    // It can be both because the mark is drawn inside an 80% safe zone, so a
    // launcher cropping to a circle or a squircle takes only ground. That is a
    // property of how it is drawn rather than a promise — see `SAFE` in
    // scripts/logo_candidates.py.
    icons: [
      { src: "/icons/app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
