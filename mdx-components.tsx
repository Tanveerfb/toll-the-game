import type { MDXComponents } from "mdx/types";
import { PROSE } from "@/components/ui/prose";

// The styles themselves live in components/ui/prose.tsx so the archive
// character pages can render the same document look on ordinary JSX — see the
// note there. This file just maps them onto MDX's element overrides.
const components: MDXComponents = {
  h2: ({ children }) => <h2 className={PROSE.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={PROSE.h3}>{children}</h3>,
  p: ({ children }) => <p className={PROSE.p}>{children}</p>,
  ul: ({ children }) => <ul className={PROSE.ul}>{children}</ul>,
  table: ({ children }) => <table className={PROSE.table}>{children}</table>,
  th: ({ children }) => <th className={PROSE.th}>{children}</th>,
  td: ({ children }) => <td className={PROSE.td}>{children}</td>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
