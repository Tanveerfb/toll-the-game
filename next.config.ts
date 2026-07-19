import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
