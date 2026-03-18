/**
 * LAYOUT EDITOR HUD CONTEXT
 * =========================
 * Bridges layout-editor state (inside Canvas) to the builder toolbar (HUD)
 * so the "Drag to add/remove tiles" message and Cancel/Apply live in the right panel.
 *
 * USAGE:
 * - Provider wraps OfficeSimulation content that includes both OfficeScene and BuilderToolbar.
 * - OfficeLayoutEditor calls useLayoutEditorHudRegistration() and pushes state + callbacks.
 * - BuilderToolbar uses useLayoutEditorHud() to read state and render message + Cancel/Apply.
 */

"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface LayoutEditorHudState {
  previewCount: number;
  error: string | null;
  isSaving: boolean;
  paintMode: "add" | "remove" | null;
  onCancel: () => void;
  onApply: () => void;
}

const defaultState: LayoutEditorHudState = {
  previewCount: 0,
  error: null,
  isSaving: false,
  paintMode: null,
  onCancel: () => {},
  onApply: () => {},
};

type SetLayoutEditorHud = (state: Partial<LayoutEditorHudState> | ((prev: LayoutEditorHudState) => Partial<LayoutEditorHudState>)) => void;

const LayoutEditorHudContext = createContext<{
  state: LayoutEditorHudState;
  setState: SetLayoutEditorHud;
} | null>(null);

export function LayoutEditorHudProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setStateRaw] = useState<LayoutEditorHudState>(defaultState);
  const setState = useCallback<SetLayoutEditorHud>((update) => {
    setStateRaw((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      return { ...prev, ...next };
    });
  }, []);
  const value = useMemo(() => ({ state, setState }), [state, setState]);
  return (
    <LayoutEditorHudContext.Provider value={value}>
      {children}
    </LayoutEditorHudContext.Provider>
  );
}

export function useLayoutEditorHud(): LayoutEditorHudState {
  const ctx = useContext(LayoutEditorHudContext);
  return ctx?.state ?? defaultState;
}

export function useLayoutEditorHudRegistration(): SetLayoutEditorHud {
  const ctx = useContext(LayoutEditorHudContext);
  return ctx?.setState ?? (() => {});
}
