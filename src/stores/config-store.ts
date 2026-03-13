'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { ModelConfig } from '@/types/config';

interface ConfigState {
  models: ModelConfig[];
  maxRounds: number;
  exportFormat: 'pdf' | 'png';

  addModel: (model: Omit<ModelConfig, 'id' | 'order'>) => void;
  removeModel: (modelId: string) => void;
  toggleModel: (modelId: string) => void;
  reorderModels: (activeId: string, overId: string) => void;
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => void;
  getEnabledModels: () => ModelConfig[];
  setMaxRounds: (n: number) => void;
  setExportFormat: (format: 'pdf' | 'png') => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      models: [],
      maxRounds: 2,
      exportFormat: 'png' as const,

      addModel: (model) =>
        set((state) => ({
          models: [
            ...state.models,
            { ...model, id: nanoid(), order: state.models.length },
          ],
        })),

      removeModel: (modelId) =>
        set((state) => ({
          models: state.models
            .filter((m) => m.id !== modelId)
            .map((m, i) => ({ ...m, order: i })),
        })),

      toggleModel: (modelId) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === modelId ? { ...m, enabled: !m.enabled } : m
          ),
        })),

      reorderModels: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.models.findIndex((m) => m.id === activeId);
          const newIndex = state.models.findIndex((m) => m.id === overId);
          if (oldIndex === -1 || newIndex === -1) return state;

          const newModels = [...state.models];
          const [moved] = newModels.splice(oldIndex, 1);
          newModels.splice(newIndex, 0, moved);
          return {
            models: newModels.map((m, i) => ({ ...m, order: i })),
          };
        }),

      updateModel: (modelId, updates) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === modelId ? { ...m, ...updates } : m
          ),
        })),

      getEnabledModels: () =>
        get()
          .models.filter((m) => m.enabled)
          .sort((a, b) => a.order - b.order),

      setMaxRounds: (n) => set({ maxRounds: n }),

      setExportFormat: (format) => set({ exportFormat: format }),
    }),
    {
      name: 'llmconclave-config',
    }
  )
);
