import React, { createContext, useContext, useState, ReactNode } from "react";
import type { ParsedUnit } from "@/types/units";

interface CompareContextType {
  compareUnits: ParsedUnit[];
  addToCompare: (unit: ParsedUnit) => void;
  removeFromCompare: (unitId: number) => void;
  clearCompare: () => void;
  isInCompare: (unitId: number) => boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareUnits, setCompareUnits] = useState<ParsedUnit[]>([]);

  const addToCompare = (unit: ParsedUnit) => {
    if (compareUnits.length < 2 && !compareUnits.find((u) => u.id === unit.id)) {
      setCompareUnits([...compareUnits, unit]);
    }
  };

  const removeFromCompare = (unitId: number) => {
    setCompareUnits(compareUnits.filter((u) => u.id !== unitId));
  };

  const clearCompare = () => {
    setCompareUnits([]);
  };

  const isInCompare = (unitId: number) => {
    return compareUnits.some((u) => u.id === unitId);
  };

  return (
    <CompareContext.Provider value={{ compareUnits, addToCompare, removeFromCompare, clearCompare, isInCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
}
