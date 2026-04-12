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
  selectedMonitoringQuestions: import('../types').MonitoringQuestion[];
  setSelectedMonitoringQuestions: (questions: import('../types').MonitoringQuestion[]) => void;
  diagnosisConfirmed: boolean;
  setDiagnosisConfirmed: (confirmed: boolean) => void;
  isRefiningStrategy: boolean;
  setIsRefiningStrategy: (refining: boolean) => void;
  refinementStatus: 'idle' | 'pending' | 'success' | 'failed' | 'skipped';
  setRefinementStatus: (status: 'idle' | 'pending' | 'success' | 'failed' | 'skipped') => void;
  updateDiagnosisResultStrategy: (strategy: import('../types').MarketStrategy) => void;
  updateDiagnosisResultVerification: (verification: import('../types').ModelVerificationResult) => void;
  updateDiagnosisResultMultiModel: (result: import('../services/multiModelService').MultiModelVerificationResult) => void;
  updateAnchorVerifications: (verifications: import('../types').AnchorVerificationResult[]) => void;

  // Step 2: Strategy Data
  selectedPlaybooks: import('../types').StrategicPlaybookItem[]; 
  setSelectedPlaybooks: (playbooks: import('../types').StrategicPlaybookItem[]) => void;
  strategyConfirmed: boolean;
  setStrategyConfirmed: (confirmed: boolean) => void;

  // Step 3: Production Data
  uploadedAssets: File[]; // RAG payload (runtime only, not persisted)
  setUploadedAssets: (files: File[]) => void;
  persistedSources: import('../types').PersistedRagSource[]; // Serialisable RAG sources (persisted)
  setPersistedSources: (sources: import('../types').PersistedRagSource[]) => void;
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
      selectedMonitoringQuestions: [],
      setSelectedMonitoringQuestions: (questions) => set({ selectedMonitoringQuestions: questions }),
      diagnosisConfirmed: false,
      setDiagnosisConfirmed: (confirmed) => set({ diagnosisConfirmed: confirmed }),
      isRefiningStrategy: false,
      setIsRefiningStrategy: (refining) => set({ isRefiningStrategy: refining }),
      refinementStatus: 'idle',
      setRefinementStatus: (status) => set({ refinementStatus: status }),
      updateDiagnosisResultStrategy: (strategy) => set((state) => ({
        diagnosisResult: state.diagnosisResult ? { ...state.diagnosisResult, marketStrategy: strategy } : null
      })),
      updateDiagnosisResultVerification: (verification) => set((state) => ({
        diagnosisResult: state.diagnosisResult ? { ...state.diagnosisResult, modelVerification: verification } : null
      })),
      updateDiagnosisResultMultiModel: (result) => set((state) => ({
        diagnosisResult: state.diagnosisResult ? { ...state.diagnosisResult, multiModelVerification: result } : null
      })),
      updateAnchorVerifications: (verifications) => set((state) => ({
        diagnosisResult: state.diagnosisResult ? { ...state.diagnosisResult, anchorVerifications: verifications } : null
      })),

      selectedPlaybooks: [],
      setSelectedPlaybooks: (playbooks) => set({ selectedPlaybooks: playbooks }),
      strategyConfirmed: false,
      setStrategyConfirmed: (confirmed) => set({ strategyConfirmed: confirmed }),

      uploadedAssets: [],
      setUploadedAssets: (files) => set({ uploadedAssets: files }),
      persistedSources: [],
      setPersistedSources: (sources) => set({ persistedSources: sources }),
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
