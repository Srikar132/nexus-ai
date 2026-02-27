"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Plan } from "@/types/workflow";

// Define all possible right sidebar states (simplified to only idle and plan for now)
export type RightSidebarState = 
  | "idle"           // Empty state
  | "plan";          // Plan details

// Define payload interfaces for each state
export type PlanPayload = Plan

// Union type for all possible payloads (simplified to only null and PlanPayload)
export type RightSidebarPayload = 
  | null
  | PlanPayload;

// Store interface
export interface RightSidebarStore {
  // Current state
  currentState: RightSidebarState;
  payload: RightSidebarPayload;
  isVisible: boolean;
  
  // Actions (simplified to only plan and idle)
  showPlan: (plan: PlanPayload) => void;
  setIdle: () => void;
  hide: () => void;
  toggle: () => void;
  
  // Utility functions
  isState: (state: RightSidebarState) => boolean;
  getPayload: <T extends RightSidebarPayload>() => T | null;
  updatePayload: (updater: (current: RightSidebarPayload) => RightSidebarPayload) => void;
}

// Create the store
export const useRightSidebar = create<RightSidebarStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentState: "idle",
      payload: null,
      isVisible: false,

      // Actions (simplified to only plan and idle)
      showPlan: (plan) =>
        set(
          { 
            currentState: "plan", 
            payload: plan, 
            isVisible: true 
          },
          false,
          "showPlan"
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

      getPayload: <T extends RightSidebarPayload>(): T | null => {
        const payload = get().payload;
        return payload as T | null;
      },

      updatePayload: (updater) =>
        set(
          (state) => ({
            payload: updater(state.payload),
          }),
          false,
          "updatePayload"
        ),
    }),
    {
      name: "right-sidebar-store",
    }
  )
);

// Selector hooks for easier usage
export const useRightSidebarState = () => useRightSidebar((state) => state.currentState);
export const useRightSidebarPayload = <T extends RightSidebarPayload>() => 
  useRightSidebar((state) => state.payload as T | null);
export const useRightSidebarVisible = () => useRightSidebar((state) => state.isVisible);

// Action hooks (simplified)
export const useRightSidebarActions = () => {
  const {
    showPlan,
    setIdle,
    hide,
    toggle,
    updatePayload,
  } = useRightSidebar();

  return {
    showPlan,
    setIdle,
    hide,
    toggle,
    updatePayload,
  };
};
