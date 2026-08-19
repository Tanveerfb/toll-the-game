import {
  getAllUpdates,
  getAllNotices,
  getLatestNewsDate,
} from "@/lib/news/posts";
import NewsFeed from "@/components/news/NewsFeed";

export default async function NewsPage() {
  const [updates, notices, latestNewsDate] = await Promise.all([
    getAllUpdates(),
    getAllNotices(),
    getLatestNewsDate(),
  ]);

  return (
    <main className="terminal-grid min-h-dvh bg-void">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <header className="border-l-2 border-signal pl-3">
          <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
            Patch notes and service notices
          </span>
          <h1 className="font-heading text-4xl leading-none tracking-[0.1em] text-readout-strong">
            News
          </h1>
        </header>

        <div className="mt-5">
          <NewsFeed
            updates={updates}
            notices={notices}
            latestNewsDate={latestNewsDate}
          />
        </div>
      </div>
    </main>
  );
}
