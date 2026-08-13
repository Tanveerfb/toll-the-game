"use client";

import type { ReactNode } from "react";

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
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${backdropClassName}`}
      onClick={onClose}
    >
      <div
        className={`max-h-[80vh] w-full ${maxWidth === "lg" ? "max-w-lg" : "max-w-md"} overflow-y-auto border ${borderClassName} bg-panel p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
