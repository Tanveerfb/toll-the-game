"use client";

import Link from "next/link";
import React from "react";
import type { NewsPostSummary } from "@/lib/news/posts";
import { markNewsViewed } from "@/lib/news/readTracking";

interface NewsFeedTabsProps {
  updates: NewsPostSummary[];
  notices: NewsPostSummary[];
  latestNewsDate: string | null;
}

type Tab = "updates" | "notices";

function FeedCard({ post, href }: { post: NewsPostSummary; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-stretch overflow-hidden border border-zinc-800 bg-black/40 transition-colors hover:border-amber-400/60"
    >
      <div className="w-1 shrink-0 bg-amber-500" />
      <div className="flex-1 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-lg tracking-[0.04em] text-zinc-100">
            {post.title}
          </h3>
          <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            {post.date}
          </span>
        </div>
        <p className="mt-1.5 font-body text-sm text-zinc-400">{post.summary}</p>
      </div>
    </Link>
  );
}

export default function NewsFeedTabs({ updates, notices, latestNewsDate }: NewsFeedTabsProps) {
  const [tab, setTab] = React.useState<Tab>("updates");

  React.useEffect(() => {
    if (latestNewsDate) markNewsViewed(latestNewsDate);
  }, [latestNewsDate]);

  const active = tab === "updates" ? updates : notices;
  const basePath = tab === "updates" ? "/news/updates" : "/news/notices";

  return (
    <div>
      <div className="mb-4 flex border-b-2 border-zinc-800">
        {(["updates", "notices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-0.5 border-b-2 px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
              tab === t
                ? "border-amber-400 text-amber-200"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "updates" ? "Updates" : "Notices"}
          </button>
        ))}
      </div>

      {active.length === 0 ? (
        <p className="font-body text-sm text-zinc-500">Nothing here yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {active.map((post) => (
            <FeedCard key={post.slug} post={post} href={`${basePath}/${post.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}
