import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Lets Next treat .md/.mdx files as importable modules (content/ dir here,
  // not routable pages — nothing under app/ uses these extensions).
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  experimental: {
    // components/ui/*.tsx import lucide-react barrel-style throughout;
    // this rewrites those to per-icon imports so the whole icon set doesn't
    // ship to the client.
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Character art URLs carry a cache-busting ?v=N (see lib/game/characterArt.ts).
    // Next 16 blocks query strings on local images unless allowed here.
    // search is omitted on purpose so ART_VERSION bumps don't require a config edit.
    localPatterns: [
      {
        pathname: "/characters/**",
      },
      {
        // NPC / enemy / boss art lives in public/npc/ (see characterArt.ts).
        pathname: "/npc/**",
      },
      {
        // Gacha banner splash art (see lib/gacha/banners.ts + components/gacha).
        pathname: "/banners/**",
      },
    ],
    // Banner splash art ships as a hand-written placeholder SVG (no query
    // string, no external source) — safe to allow through the optimizer.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
  },
});

export default withMDX(nextConfig);
