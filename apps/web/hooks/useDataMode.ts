/**
 * Data Mode Hook
 * 
 * Provides a global toggle between mock data (for demos) and real data (from database)
 * Persists preference in localStorage
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DataMode = 'mock' | 'real';

interface DataModeState {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  toggleMode: () => void;
}

export const useDataMode = create<DataModeState>()(
  persist(
    (set) => ({
      mode: 'mock', // Default to mock for demos
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((state) => ({ 
        mode: state.mode === 'mock' ? 'real' : 'mock' 
      })),
    }),
    {
      name: 'data-mode-storage',
    }
  )
);
