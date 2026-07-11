"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Main Menu" },
  { href: "/practice", label: "Practice" },
  { href: "/archive", label: "Archive" },
  { href: "/profile", label: "Profile" },
] as const;

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      {/* Fixed h-11: the battle screen sizes itself to 100dvh minus this bar */}
      <div className="mx-auto flex h-11 w-full max-w-6xl items-center gap-6 px-4 md:px-8">
        <Link
          href="/"
          className="font-heading text-xl tracking-[0.2em] text-amber-300"
        >
          TOLL
        </Link>
        <div className="flex items-center gap-4">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-body text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
