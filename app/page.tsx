import HomeMenu from "@/components/HomeMenu";
import { getLatestNewsDate } from "@/lib/news/posts";

export default async function Home() {
  // Unlike sibling pages (e.g. /profile, /story), this page needs a
  // Server/Client split: getLatestNewsDate() does a server-side filesystem
  // read that a "use client" component (needed here for useAuth/useGameStore/
  // useRouter) can't perform directly.
  // This also makes "/" static-generation-eligible, which is fine: news posts
  // are content files committed to the repo, so a new post always ships with
  // a rebuild/redeploy — the static snapshot can never be stale relative to
  // what's actually deployed.
  const latestNewsDate = await getLatestNewsDate();
  return <HomeMenu latestNewsDate={latestNewsDate} />;
}
