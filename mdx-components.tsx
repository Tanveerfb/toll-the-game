import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2.5 border-l-4 border-amber-500 pl-2.5 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-amber-400">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="font-body text-sm leading-relaxed text-zinc-300">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1.5 pl-5 font-body text-sm leading-relaxed text-zinc-300">
      {children}
    </ul>
  ),
  table: ({ children }) => (
    <table className="mt-1.5 w-full border-collapse font-body text-[13px]">
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th className="border-b border-zinc-700 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-zinc-800 px-2 py-1.5 text-zinc-200">{children}</td>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
