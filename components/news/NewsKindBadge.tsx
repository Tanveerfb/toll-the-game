import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { NewsKind } from "@/lib/news/feed";

/** What each kind of post is called. The feed's filter reads it too. */
export const NEWS_KIND_LABEL: Record<NewsKind, string> = {
  update: "Update",
  notice: "Notice",
};

/**
 * A post's kind, as a badge.
 *
 * Both the feed and the post page used to define this separately, as blue and
 * gold text: element hues, which the design system reserves for units
 * (docs/design-system.md). Since ruling #154 an update is the ink badge (the
 * routine stream) and a notice the yellow one (the post to stop for), defined
 * here once.
 */
export default function NewsKindBadge({
  kind,
}: {
  kind: NewsKind;
}): React.JSX.Element {
  return (
    <Badge variant={kind === "notice" ? "default" : "ink"}>
      {NEWS_KIND_LABEL[kind]}
    </Badge>
  );
}
