import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import {
  getPostContext,
  listNoticeSlugs,
  type NewsPostMetadata,
} from "@/lib/news/posts";
import NewsPostLayout from "@/components/news/NewsPostLayout";

interface NoticeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listNoticeSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { slug } = await params;

  if (!listNoticeSlugs().includes(slug)) {
    notFound();
  }

  const { default: Post, metadata } = (await import(
    `@/content/news/notices/${slug}.mdx`
  )) as {
    default: ComponentType;
    metadata: NewsPostMetadata;
  };

  const { readingMinutes, older, newer } = await getPostContext(
    "notice",
    slug,
  );

  return (
    <NewsPostLayout
      title={metadata.title}
      date={metadata.date}
      summary={metadata.summary}
      kind="notice"
      readingMinutes={readingMinutes}
      older={older}
      newer={newer}
    >
      <Post />
    </NewsPostLayout>
  );
}
