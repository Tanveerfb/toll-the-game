import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";

/**
 * The news page is closed (Tanveer, 2026-10-03, ruling #179): *"we are in
 * the middle of overhauling the game so posts are not valid until we are
 * stable and ready with the game. just put a 'Coming soon' on posts page for
 * now."* The MDX feed, its loaders and the post routes were removed on
 * 2026-10-13 (his call) rather than kept behind a switch; the page's
 * overhaul is on `docs/ROADMAP.md`.
 */
export default function NewsPage() {
  return (
    <Screen width="read">
      <SectionHeader eyebrow="Patch notes and service notices" title="News" />
      <p className="mt-4 font-body text-caption font-bold uppercase tracking-label text-muted-foreground">
        Coming soon
      </p>
    </Screen>
  );
}
