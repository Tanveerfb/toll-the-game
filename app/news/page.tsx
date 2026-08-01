import { getAllUpdates, getAllNotices, getLatestNewsDate } from "@/lib/news/posts";
import NewsFeedTabs from "@/components/news/NewsFeedTabs";

export default async function NewsPage() {
  const [updates, notices, latestNewsDate] = await Promise.all([
    getAllUpdates(),
    getAllNotices(),
    getLatestNewsDate(),
  ]);

  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="mb-6 font-heading text-4xl tracking-[0.08em] text-zinc-100">News</h1>
        <NewsFeedTabs updates={updates} notices={notices} latestNewsDate={latestNewsDate} />
      </div>
    </main>
  );
}
