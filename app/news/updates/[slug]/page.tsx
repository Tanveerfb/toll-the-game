import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import {
  getPostContext,
  listUpdateSlugs,
  type NewsPostMetadata,
} from "@/lib/news/posts";
import NewsPostLayout from "@/components/news/NewsPostLayout";

interface UpdateDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listUpdateSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export default async function UpdateDetailPage({ params }: UpdateDetailPageProps) {
  const { slug } = await params;

  if (!listUpdateSlugs().includes(slug)) {
    notFound();
  }

  const { default: Post, metadata } = (await import(
    `@/content/news/updates/${slug}.mdx`
  )) as {
    default: ComponentType;
    metadata: NewsPostMetadata;
  };

  const { readingMinutes, older, newer } = await getPostContext(
    "update",
    slug,
  );

  return (
    <NewsPostLayout
      title={metadata.title}
      date={metadata.date}
      summary={metadata.summary}
      kind="update"
      readingMinutes={readingMinutes}
      older={older}
      newer={newer}
    >
      <Post />
    </NewsPostLayout>
  );
}
