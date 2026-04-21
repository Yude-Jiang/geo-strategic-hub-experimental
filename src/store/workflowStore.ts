import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UILang } from '../i18n/translations';

export type Ecosystem = 'global' | 'cn' | 'jp' | 'kr';

export interface WorkflowState {
  targetEcosystem: Ecosystem;
  setTargetEcosystem: (ecosystem: Ecosystem) => void;

  uiLang: UILang;
  setUiLang: (lang: UILang) => void;

  customRegion: string;
  setCustomRegion: (region: string) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      targetEcosystem: 'global',
      setTargetEcosystem: (ecosystem) => set({ targetEcosystem: ecosystem }),

      uiLang: 'en' as UILang,
      setUiLang: (lang) => set({ uiLang: lang }),

      customRegion: '',
      setCustomRegion: (region) => set({ customRegion: region }),
    }),
    { name: 'content-automation-storage' }
  )
);
