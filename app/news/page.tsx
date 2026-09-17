import {
  getAllUpdates,
  getAllNotices,
  getLatestNewsDate,
} from "@/lib/news/posts";
import NewsFeed from "@/components/news/NewsFeed";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function NewsPage() {
  const [updates, notices, latestNewsDate] = await Promise.all([
    getAllUpdates(),
    getAllNotices(),
    getLatestNewsDate(),
  ]);

  return (
    // `width="read"` is not a change of width: `--container-read` is 42rem,
    // which is exactly the `max-w-2xl` this page already used. What it replaces
    // is a hand-typed shell and a `px-6` gutter, the only two on the app's
    // pages (every other screen is `px-4 py-6 md:px-8`).
    <Screen width="read">
      <SectionHeader
        eyebrow="Patch notes and service notices"
        title="News"
      />
      <NewsFeed
        updates={updates}
        notices={notices}
        latestNewsDate={latestNewsDate}
      />
    </Screen>
  );
}
