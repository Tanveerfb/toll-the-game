"use client";

import type { ReactNode } from "react";

import { scrimProps, useEscapeKey } from "@/hooks/useEscapeKey";

interface ModalShellProps {
  onClose: () => void;
  maxWidth?: "md" | "lg";
  backdropClassName?: string;
  borderClassName?: string;
  children: ReactNode;
}

export default function ModalShell({
  onClose,
  maxWidth = "md",
  backdropClassName = "bg-black/80",
  borderClassName = "border-edge-strong",
  children,
}: ModalShellProps) {
  // Clicking the scrim was the only way out of this shell until 2026-08-21 —
  // which is no way out at all without a pointer.
  useEscapeKey(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      // The scrim's click is a pointer convenience; Escape above is the
      // accessible path out.
      className={`fixed inset-0 z-50 flex items-center justify-center ${backdropClassName}`}
      {...scrimProps(onClose)}
    >
      <div
        className={`max-h-[80dvh] w-full ${maxWidth === "lg" ? "max-w-lg" : "max-w-md"} overflow-y-auto border ${borderClassName} bg-panel p-5`}
      >
        {children}
      </div>
    </div>
  );
}
