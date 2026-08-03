"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GAME_ROUTES, isRouteActive } from "@/lib/nav/routes";

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      {/* Fixed h-11: the battle screen sizes itself to 100dvh minus this bar */}
      <div className="mx-auto flex h-11 w-full max-w-6xl items-center gap-4 px-4 md:gap-6 md:px-8">
        <Link
          href="/"
          className="shrink-0 font-heading text-xl tracking-[0.2em] text-amber-300"
        >
          TOLL
        </Link>
        {/* 8 routes don't fit a phone width — the row scrolls horizontally
            rather than wrapping, which would break the fixed h-11 the battle
            shell measures against. */}
        <div className="flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GAME_ROUTES.map((route) => {
            const active = isRouteActive(route.href, pathname);
            return (
              <Link
                key={route.href}
                href={route.href}
                className={`shrink-0 font-body text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {route.navLabel ?? route.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
