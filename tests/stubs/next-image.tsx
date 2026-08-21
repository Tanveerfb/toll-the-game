import React from "react";

/**
 * `next/image` for browser-mode tests.
 *
 * The real component needs Next's build pipeline for its loader and does not
 * render standalone. Nothing under test depends on image *optimisation* — the
 * portraits are there to be looked at, not asserted on — so this renders a
 * plain `<img>` and drops the Next-only props that would otherwise land on the
 * DOM node and produce React warnings.
 */
export default function NextImageStub({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  priority,
  quality,
  loader,
  placeholder,
  blurDataURL,
  unoptimized,
  ...rest
}: Record<string, unknown> & {
  src?: string | { src: string };
  alt?: string;
}): React.JSX.Element {
  void fill;
  void sizes;
  void priority;
  void quality;
  void loader;
  void placeholder;
  void blurDataURL;
  void unoptimized;

  const resolved = typeof src === "object" && src !== null ? src.src : src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt ?? ""}
      width={width as number | undefined}
      height={height as number | undefined}
      {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
}
