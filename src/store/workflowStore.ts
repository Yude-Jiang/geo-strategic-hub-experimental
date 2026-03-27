import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UILang } from '../i18n/translations';

export type Ecosystem = 'global' | 'cn' | 'jp' | 'kr';

export interface WorkflowState {
  // Global Setup
  targetEcosystem: Ecosystem;
  setTargetEcosystem: (ecosystem: Ecosystem) => void;

  // UI Language
  uiLang: UILang;
  setUiLang: (lang: UILang) => void;
  
  // Navigation State
  currentStep: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3) => void;

  // Step 1: Diagnosis Data
  diagnosisResult: import('../types').AnalysisResult | null;
  setDiagnosisResult: (result: import('../types').AnalysisResult | null) => void;
  seedKeywords: string[];
  setSeedKeywords: (keywords: string[]) => void;
  selectedPainPoints: import('../types').AnalysisItem[];
  setSelectedPainPoints: (points: import('../types').AnalysisItem[]) => void;
  diagnosisConfirmed: boolean;
  setDiagnosisConfirmed: (confirmed: boolean) => void;

  // Step 2: Strategy Data
  selectedPlaybooks: import('../types').StrategicPlaybookItem[]; 
  setSelectedPlaybooks: (playbooks: import('../types').StrategicPlaybookItem[]) => void;
  strategyConfirmed: boolean;
  setStrategyConfirmed: (confirmed: boolean) => void;

  // Step 3: Production Data
  uploadedAssets: File[]; // RAG payload
  setUploadedAssets: (files: File[]) => void;
  finalContent: string;
  setFinalContent: (content: string) => void;

  // Chat Assistant State
  chatHistory: { role: 'user' | 'assistant', content: string }[];
  addChatMessage: (msg: { role: 'user' | 'assistant', content: string }) => void;
  clearChatHistory: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      targetEcosystem: 'global',
      setTargetEcosystem: (ecosystem) => set({ targetEcosystem: ecosystem }),

      uiLang: 'en' as UILang,
      setUiLang: (lang) => set({ uiLang: lang }),

      currentStep: 1,
      setStep: (step) => set({ currentStep: step }),

      diagnosisResult: null,
      setDiagnosisResult: (result) => set({ diagnosisResult: result }),
      seedKeywords: [],
      setSeedKeywords: (keywords) => set({ seedKeywords: keywords }),
      selectedPainPoints: [],
      setSelectedPainPoints: (points) => set({ selectedPainPoints: points }),
      diagnosisConfirmed: false,
      setDiagnosisConfirmed: (confirmed) => set({ diagnosisConfirmed: confirmed }),

      selectedPlaybooks: [],
      setSelectedPlaybooks: (playbooks) => set({ selectedPlaybooks: playbooks }),
      strategyConfirmed: false,
      setStrategyConfirmed: (confirmed) => set({ strategyConfirmed: confirmed }),

      uploadedAssets: [],
      setUploadedAssets: (files) => set({ uploadedAssets: files }),
      finalContent: '',
      setFinalContent: (content) => set({ finalContent: content }),

      chatHistory: [],
      addChatMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
      clearChatHistory: () => set({ chatHistory: [] }),
    }),
    {
      name: 'geo-hub-storage', // saves to localStorage
      // Skip File objects in persistence to avoid errors
      partialize: (state) => ({ ...state, uploadedAssets: [] }),
    }
  )
);
