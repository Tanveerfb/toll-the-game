import Link from "next/link";
import type { ReactNode } from "react";

interface NewsPostLayoutProps {
  title: string;
  date: string;
  children: ReactNode;
}

export default function NewsPostLayout({ title, date, children }: NewsPostLayoutProps) {
  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href="/news"
          className="font-body text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-amber-200"
        >
          ← Back to News
        </Link>
        <h1 className="mt-3 font-heading text-4xl tracking-[0.08em] text-zinc-100">
          {title}
        </h1>
        <p className="mt-1 border-b-2 border-zinc-800 pb-4 font-body text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          Updated on {date}
        </p>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}
