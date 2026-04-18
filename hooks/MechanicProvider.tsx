"use client";

import React, { createContext, useContext } from "react";

interface MechanicState {
  // Mechanic functions and logic will go here
}

const MechanicContext = createContext<MechanicState | undefined>(undefined);

export function useMechanicContext() {
  const context = useContext(MechanicContext);
  if (!context) {
    throw new Error("useMechanicContext must be used within a MechanicProvider");
  }
  return context;
}

export default function MechanicProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MechanicContext.Provider value={{}}>
      {children}
    </MechanicContext.Provider>
  );
}
