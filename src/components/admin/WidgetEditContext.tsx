"use client";

import { createContext, useContext, useRef, useState, type MutableRefObject } from "react";

/**
 * Shares "Move Widgets" mode between the button in the applicant header and
 * the widget board on the Overview tab. The board registers its save handler.
 */
interface WidgetEditState {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  saveRef: MutableRefObject<(() => Promise<boolean>) | null>;
}

const WidgetEditContext = createContext<WidgetEditState | null>(null);

export function WidgetEditProvider({ children }: { children: React.ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);
  return (
    <WidgetEditContext.Provider value={{ isEditing, setIsEditing, saveRef }}>
      {children}
    </WidgetEditContext.Provider>
  );
}

export function useWidgetEdit() {
  const ctx = useContext(WidgetEditContext);
  if (!ctx) throw new Error("useWidgetEdit must be used inside WidgetEditProvider");
  return ctx;
}
