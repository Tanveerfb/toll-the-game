"use client";

import { LazyMotion, domAnimation } from "framer-motion";

// Loads only the animation/exit feature set framer-motion actually needs
// here (no layout, drag, or SVG motion anywhere in the app) instead of the
// full sync bundle `motion.*` ships unconditionally. Consumers must use `m`,
// not `motion`, to get the lazy-loaded bundle.
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
