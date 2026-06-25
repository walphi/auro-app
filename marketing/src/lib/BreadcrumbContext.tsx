import React, { createContext, useContext, useState } from "react";
import type { InsightCategory } from "../types/content.ts";

interface BreadcrumbState {
  category?: InsightCategory;
  articleTitle?: string;
}

interface BreadcrumbContextValue {
  state: BreadcrumbState;
  setState: (state: BreadcrumbState) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  state: {},
  setState: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BreadcrumbState>({});
  return (
    <BreadcrumbContext.Provider value={{ state, setState }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
