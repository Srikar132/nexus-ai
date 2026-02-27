"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Pipeline v2: Only code panel (no plan)
export type RightSidebarState = 
  | "idle"           // Empty state
  | "code";          // Code viewer (file tree + code)

// No complex payloads needed — code store manages its own state
export type RightSidebarPayload = null;

// Store interface
export interface RightSidebarStore {
  currentState: RightSidebarState;
  payload: RightSidebarPayload;
  isVisible: boolean;
  
  showCode: () => void;
  setIdle: () => void;
  hide: () => void;
  toggle: () => void;
  
  isState: (state: RightSidebarState) => boolean;
}

// Create the store
export const useRightSidebar = create<RightSidebarStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentState: "idle",
      payload: null,
      isVisible: false,

      showCode: () =>
        set(
          { 
            currentState: "code", 
            payload: null, 
            isVisible: true 
          },
          false,
          "showCode"
        ),

      setIdle: () =>
        set(
          { 
            currentState: "idle", 
            payload: null, 
            isVisible: true 
          },
          false,
          "setIdle"
        ),

      hide: () =>
        set(
          { 
            isVisible: false 
          },
          false,
          "hide"
        ),

      toggle: () =>
        set(
          (state) => ({ 
            isVisible: !state.isVisible 
          }),
          false,
          "toggle"
        ),

      // Utility functions
      isState: (state) => get().currentState === state,
    }),
    {
      name: "right-sidebar-store",
    }
  )
);

// Selector hooks for easier usage
export const useRightSidebarState = () => useRightSidebar((state) => state.currentState);
export const useRightSidebarVisible = () => useRightSidebar((state) => state.isVisible);

// Action hooks
export const useRightSidebarActions = () => {
  const {
    showCode,
    setIdle,
    hide,
    toggle,
  } = useRightSidebar();

  return {
    showCode,
    setIdle,
    hide,
    toggle,
  };
};
