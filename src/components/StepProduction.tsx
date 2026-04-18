import React, { useState, useMemo } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import {
  generateContentStream,
  generateJsonLdSchema,
  humanizeContent,
  translateContent,
  deepEvidenceGrounding,
  withRetry,
  generateWorkflowReportStream,
} from '../services/geminiService';
import type { TranslationKeys } from '../i18n/translations';
import type { PlaybookAnchorBundle } from '../types';
import {
  ArrowLeft, Loader2, Zap,
  ShieldCheck, Sword, Lightbulb, Target,
  Search as SearchIcon, CheckCircle2, Circle, ChevronDown, FileText,
} from 'lucide-react';

import RagSourcePanel from './RagSourcePanel';
import PlatformSelector from './PlatformSelector';
import ProductOutputTabs from './ProductOutputTabs';
import ReportModal from './ReportModal';
import { buildAnnotatedContext, getParseStats, computeGeoSignals } from '../services/structuralParser';
import type { GeoSignals } from '../services/structuralParser';
import { GEO_METHODS, RECOMMENDED_COMBOS } from '../services/geoMethods';
import type { GeoMethodId } from '../services/geoMethods';

const ANALYSIS_REGEX = /={2,}\s*GEO_ANALYSIS\s*={2,}/i;
const END_REGEX = /={2,}\s*END\s*={2,}/i;
// Strip the PRE-FLIGHT step plan block from article content (it belongs in Analysis)
const STEP_PLAN_REGEX = /STEP PLAN:[\s\S]*?---END STEP PLAN---\n*/i;
const MAX_STREAM_CHARS = 18000;

// ─── Per-bundle output state ─────────────────────────────────────────────────

type BundleOutput = {
  content: string;
  analysis: string;
  schema: string;
  schemaStatus: 'idle' | 'loading' | 'success' | 'error';
  schemaError: string | null;
  generateError: string | null;
  isGenerating: boolean;
  isDeepSearching: boolean;
  retryCountdown: number | null;
  streamTruncated: boolean;
  /** GEO signals computed from source material BEFORE generation */
  geoSignalsBefore: GeoSignals | null;
  /** GEO signals computed from generated article AFTER generation */
  geoSignalsAfter: GeoSignals | null;
};

const emptyOutput = (): BundleOutput => ({
  content: '', analysis: '', schema: '',
  schemaStatus: 'idle', schemaError: null,
  generateError: null, isGenerating: false,
  isDeepSearching: false, retryCountdown: null,
  streamTruncated: false,
  geoSignalsBefore: null, geoSignalsAfter: null,
});

// ─── Component ───────────────────────────────────────────────────────────────

const StepProduction: React.FC<{ t: TranslationKeys }> = ({ t }) => {
  const uiLang = useWorkflowStore(state => state.uiLang);
  const targetEcosystem = useWorkflowStore(state => state.targetEcosystem);
  const customRegion = useWorkflowStore(state => state.customRegion);
  const selectedPlaybooks = useWorkflowStore(state => state.selectedPlaybooks);
  const selectedMonitoringQuestions = useWorkflowStore(state => state.selectedMonitoringQuestions);
  const diagnosisResult = useWorkflowStore(state => state.diagnosisResult);
  const setStep = useWorkflowStore(state => state.setStep);
  const persistedSources = useWorkflowStore(state => state.persistedSources);
  const setPersistedSources = useWorkflowStore(state => state.setPersistedSources);

  // ── Playbook → Anchor bundles (computed once at mount) ────────────────────
  const coveredIds = useMemo(
    () => new Set(selectedPlaybooks.flatMap(p => p.anchorIds || [])),
    [selectedPlaybooks]
  );
  const bundles: PlaybookAnchorBundle[] = useMemo(
    () => selectedPlaybooks.map(playbook => ({
      playbook,
      anchors: (playbook.anchorIds || [])
        .map(id => selectedMonitoringQuestions.find(q => q.id === id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q)),
    })),
    [selectedPlaybooks, selectedMonitoringQuestions]
  );
  const globalOrphanAnchors = useMemo(
    () => selectedMonitoringQuestions.filter(q => !coveredIds.has(q.id)),
    [selectedMonitoringQuestions, coveredIds]
  );

  const isFreeform = selectedPlaybooks.length === 0;
  const bundleCount = isFreeform ? 1 : bundles.length;

  // ── Per-bundle outputs ────────────────────────────────────────────────────
  const [bundleOutputs, setBundleOutputs] = useState<BundleOutput[]>(() =>
    Array.from({ length: bundleCount }, emptyOutput)
  );
  const [activeBundleIdx, setActiveBundleIdx] = useState(0);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [sources, setSources] = useState<any[]>(persistedSources);
  const [selectedPlatform, setSelectedPlatform] = useState('zhihu');
  const [selectedFormat, setSelectedFormat] = useState('long_form');
  const [customPrompt, setCustomPrompt] = useState('');
  const [systemSources, setSystemSources] = useState<any[]>([]);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState<GeoMethodId[]>(
    RECOMMENDED_COMBOS.semiconductor_technical.ids
  );
  const [methodsExpanded, setMethodsExpanded] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const parseModelOutput = (text: string) => {
    const analysisMatch = text.match(ANALYSIS_REGEX);
    const endMatch = text.match(END_REGEX);

    // Extract step plan from PRE-FLIGHT block (move it to analysis, strip from article)
    const stepPlanMatch = text.match(STEP_PLAN_REGEX);
    const stepPlanBlock = stepPlanMatch
      ? `### 🧭 Pre-flight Step Plan\n\`\`\`\n${stepPlanMatch[0].trim()}\n\`\`\`\n\n`
      : '';
    const cleanText = stepPlanMatch ? text.replace(STEP_PLAN_REGEX, '') : text;

    if (!analysisMatch) return { content: cleanText.trim(), analysis: stepPlanBlock };
    const splitIdx = cleanText.indexOf(analysisMatch[0]);
    const endIdx = endMatch ? cleanText.indexOf(endMatch[0]) : cleanText.length;
    return {
      content: cleanText.substring(0, splitIdx).trim(),
      analysis: stepPlanBlock + cleanText.substring(splitIdx + analysisMatch[0].length, endIdx).trim(),
    };
  };

  const updateBundle = (idx: number, updates: Partial<BundleOutput>) =>
    setBundleOutputs(prev => prev.map((o, i) => i === idx ? { ...o, ...updates } : o));

  // ── Core: generate for a single bundle index ──────────────────────────────
  const handleGenerate = async (targetIdx: number) => {
    setBundleOutputs(prev =>
      prev.map((o, i) => i === targetIdx ? { ...emptyOutput(), isGenerating: true } : o)
    );

    let accumulated = '';

    try {
      let combinedSources = [...sources];

      // Deep evidence search — scoped to this bundle's anchors for focused grounding
      const bundle = isFreeform ? undefined : bundles[targetIdx];
      const anchorsForSearch = bundle
        ? bundle.anchors.map(a => a.expectedAnchor).filter(Boolean)
        : selectedMonitoringQuestions.map(q => q.expectedAnchor).filter(Boolean);

      if (anchorsForSearch.length > 0) {
        updateBundle(targetIdx, { isDeepSearching: true });
        try {
          const deepRes = await deepEvidenceGrounding(anchorsForSearch);
          setSystemSources(deepRes);
          combinedSources = [...combinedSources, ...deepRes];
        } catch (searchErr) {
          console.warn('Deep search failed, continuing with available sources:', searchErr);
        } finally {
          updateBundle(targetIdx, { isDeepSearching: false });
        }
      }

      // GEO Signal Audit — BEFORE: compute signals on raw source material
      const rawSourceText = combinedSources.map(s => s.content).join('\n\n');
      const geoSignalsBefore = computeGeoSignals(rawSourceText);
      updateBundle(targetIdx, { geoSignalsBefore });

      // Structural parsing: each source is individually parsed into typed chunks
      // (spec_table, dense_fact, code_example…) so the LLM can prioritise
      // citable data over narrative prose. Stats logged for debugging.
      const sourceContext = combinedSources
        .map(s => {
          const annotated = buildAnnotatedContext(s.content, 6000);
          const stats = getParseStats(s.content);
          const label = `[Source: ${s.name} | chunks: ${stats.total} | high-value: ${stats.topWeightChunks}]`;
          return `${label}\n${annotated}`;
        })
        .join('\n\n===SOURCE_BOUNDARY===\n\n');

      // In focused mode: pass only this bundle; in freeform: pass orphans only
      const singleBundles = bundle ? [bundle] : [];
      const orphans = isFreeform ? selectedMonitoringQuestions : globalOrphanAnchors;

      const stream = await withRetry(
        () => generateContentStream(
          selectedPlatform, selectedFormat,
          singleBundles, orphans,
          customPrompt, sourceContext, uiLang,
          !isFreeform,  // focusedMode = true whenever a real playbook is selected
          selectedMethods,
          targetEcosystem,
          customRegion
        ),
        (s) => updateBundle(targetIdx, { retryCountdown: s > 0 ? s : null })
      );

      for await (const chunk of stream) {
        const text = chunk || '';
        if (accumulated.length + text.length > MAX_STREAM_CHARS) {
          const safe = text.slice(0, MAX_STREAM_CHARS - accumulated.length);
          accumulated += safe;
          const parsed = parseModelOutput(accumulated);
          updateBundle(targetIdx, {
            content: parsed.content,
            analysis: parsed.analysis,
            streamTruncated: true,
          });
          break;
        }
        accumulated += text;
        const parsed = parseModelOutput(accumulated);
        updateBundle(targetIdx, { content: parsed.content, analysis: parsed.analysis });
      }

      updateBundle(targetIdx, { retryCountdown: null });

      // GEO Signal Audit — AFTER: compute signals on generated article
      const { content } = parseModelOutput(accumulated);
      if (content.trim()) {
        updateBundle(targetIdx, { geoSignalsAfter: computeGeoSignals(content) });
      }

      // Kick off JSON-LD schema generation
      if (content.trim()) {
        updateBundle(targetIdx, { schemaStatus: 'loading' });
        withRetry(
          () => generateJsonLdSchema(content, uiLang, selectedPlatform).then(schema =>
            updateBundle(targetIdx, { schema: schema || '', schemaStatus: 'success' })
          ),
          () => {}
        ).catch(err =>
          updateBundle(targetIdx, { schemaStatus: 'error', schemaError: err?.message || 'Schema failed' })
        );
      }
    } catch (err: any) {
      let userMessage = err?.message || 'Generation failed. Please check your API key.';
      try {
        const raw = JSON.parse(err?.message || '{}');
        if (raw?.error?.code === 429 || raw?.error?.status === 'RESOURCE_EXHAUSTED') {
          userMessage = (t.production as any).quotaError;
        } else if (raw?.error?.message) {
          userMessage = raw.error.message.split('\n')[0];
        }
      } catch { /* intentional: parse failure is non-fatal */ }
      updateBundle(targetIdx, { generateError: userMessage, retryCountdown: null });
    } finally {
      updateBundle(targetIdx, { isGenerating: false });
    }
  };

  // ── Generate all bundles sequentially ────────────────────────────────────
  const handleGenerateAll = async () => {
    for (let i = 0; i < bundleCount; i++) {
      setActiveBundleIdx(i);
      await handleGenerate(i);
    }
  };

  // ── Post-processing: humanize / translate (active bundle) ─────────────────
  const triggerSchemaRegen = (idx: number, text: string) => {
    if (!text) return;
    updateBundle(idx, { schemaStatus: 'loading' });
    generateJsonLdSchema(text, uiLang, selectedPlatform)
      .then(schema => updateBundle(idx, { schema: schema || '', schemaStatus: 'success' }))
      .catch(err => updateBundle(idx, { schemaStatus: 'error', schemaError: err?.message }));
  };

  const handleHumanize = async () => {
    const ao = bundleOutputs[activeBundleIdx];
    if (!ao?.content) return;
    setIsHumanizing(true);
    try {
      const human = await humanizeContent(ao.content, uiLang);
      updateBundle(activeBundleIdx, { content: human || '' });
      triggerSchemaRegen(activeBundleIdx, human || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsHumanizing(false);
    }
  };

  const handleTranslate = async (lang: string) => {
    const ao = bundleOutputs[activeBundleIdx];
    if (!ao?.content) return;
    setIsTranslating(true);
    try {
      const trans = await translateContent(ao.content, lang);
      updateBundle(activeBundleIdx, { content: trans || '' });
      triggerSchemaRegen(activeBundleIdx, trans || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  // ── Report generation ─────────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    const ao = bundleOutputs[activeBundleIdx];
    if (!ao?.content) return;
    setReportContent('');
    setIsGeneratingReport(true);
    setShowReport(true);
    try {
      const stream = await generateWorkflowReportStream({
        diagnosisResult: diagnosisResult || undefined,
        selectedPlaybooks: selectedPlaybooks.length > 0 ? selectedPlaybooks : undefined,
        selectedMonitoringQuestions: selectedMonitoringQuestions.length > 0 ? selectedMonitoringQuestions : undefined,
        generatedContent: ao.content,
        geoAnalysis: ao.analysis,
        geoSignalsBefore: ao.geoSignalsBefore,
        geoSignalsAfter: ao.geoSignalsAfter,
        ecosystem: targetEcosystem,
        customRegion,
        uiLang,
      });
      for await (const chunk of stream) {
        setReportContent(prev => prev + chunk);
      }
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const activeOutput = bundleOutputs[activeBundleIdx] ?? emptyOutput();
  const activeBundle = isFreeform ? undefined : bundles[activeBundleIdx];
  const anyGenerating = bundleOutputs.some(o => o.isGenerating);
  const doneCount = bundleOutputs.filter(o => o.content.length > 0).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-6 animate-fade-in pb-20">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setStep(2)}
            className="p-3 bg-slate-50 text-slate-400 hover:text-[#03234b] rounded-2xl transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1" />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#03234b] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#ffd200]" /> {t.production.title}
            </h2>
            <p className="text-[#8191a5] text-[10px] font-black uppercase tracking-[0.2em]">
              {isFreeform
                ? t.production.freeformMode
                : `Intent ${activeBundleIdx + 1} / ${bundles.length} · ${activeBundle?.playbook.tacticsType || ''}`
              }
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          {/* Progress dots — one per bundle */}
          {!isFreeform && (
            <div className="flex items-center gap-1.5" title={`${doneCount}/${bundles.length} generated`}>
              {bundleOutputs.map((o, i) => (
                <button
                  key={i}
                  onClick={() => setActiveBundleIdx(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    o.isGenerating ? 'bg-[#3cb4e6] animate-pulse scale-125' :
                    o.content     ? 'bg-emerald-500' :
                    i === activeBundleIdx ? 'bg-slate-400 ring-2 ring-offset-1 ring-slate-300' :
                    'bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>
          )}
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
            <ShieldCheck className="w-4 h-4" /> {t.production.cognitiveReady}
          </div>
        </div>
      </div>

      {/* ── Body grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left panel ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Intent navigation tabs (only in non-freeform mode) */}
          {!isFreeform && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-[#ffd200]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t.production.inheritedPillars} ({bundles.length})
                </span>
                {doneCount > 0 && (
                  <span className="ml-auto text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    {doneCount}/{bundles.length} done
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-50">
                {bundles.map((bundle, idx) => {
                  const output = bundleOutputs[idx];
                  const isActive = activeBundleIdx === idx;
                  const isDone = output.content.length > 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveBundleIdx(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-l-4 ${
                        isActive
                          ? 'border-[#3cb4e6] bg-[#3cb4e6]/5'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      {/* Status icon */}
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        {output.isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#3cb4e6]" />
                        ) : isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300" />
                        )}
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-black text-[#ffd200] uppercase tracking-widest">
                          {bundle.playbook.tacticsType}
                        </div>
                        <div className="text-xs font-bold text-[#03234b] truncate leading-snug mt-0.5">
                          {bundle.playbook.geoAction || `Strategy ${idx + 1}`}
                        </div>
                        {bundle.anchors.length > 0 && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {bundle.anchors.length} anchor{bundle.anchors.length !== 1 ? 's' : ''} bound
                          </div>
                        )}
                      </div>

                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3cb4e6] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <RagSourcePanel
            initialSources={persistedSources}
            onSourcesChange={(s) => { setSources(s); setPersistedSources(s); }}
            systemSources={systemSources}
          />

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-6">
            <PlatformSelector
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />

            {/* ── GEO Method Selector ── */}
            <div className="space-y-3">
              <button
                onClick={() => setMethodsExpanded(prev => !prev)}
                className="w-full flex items-center justify-between group"
              >
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer">
                  <Zap className="w-3 h-3 text-[#ffd200]" /> {t.production.geoMethodsLabel}
                  <span className="text-slate-300 font-medium normal-case tracking-normal">(max 3)</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedMethods.length > 0 && (
                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {selectedMethods.length} selected · +{(() => {
                        const lifts = selectedMethods.slice(0, 3).map(id => parseInt(GEO_METHODS.find(m => m.id === id)?.liftEstimate || '10'));
                        return Math.round(lifts.reduce((acc, l) => acc + Math.sqrt(l * 10), 0));
                      })()}%
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${methodsExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {methodsExpanded && (
                <>
                  {/* Recommended combos */}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(RECOMMENDED_COMBOS).map(([key, combo]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedMethods(combo.ids)}
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                          JSON.stringify(selectedMethods) === JSON.stringify(combo.ids)
                            ? 'bg-[#03234b] text-white border-[#03234b]'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#3cb4e6] hover:text-[#3cb4e6]'
                        }`}
                      >
                        {combo.label}
                      </button>
                    ))}
                  </div>

                  {/* Individual method toggles */}
                  <div className="space-y-1.5">
                    {GEO_METHODS.map(method => {
                      const isSelected = selectedMethods.includes(method.id);
                      const isDisabled = !isSelected && selectedMethods.length >= 3;
                      return (
                        <button
                          key={method.id}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMethods(prev => prev.filter(id => id !== method.id));
                            } else if (selectedMethods.length < 3) {
                              setSelectedMethods(prev => [...prev, method.id]);
                            }
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-[#3cb4e6]/8 border-[#3cb4e6] text-[#03234b]'
                              : isDisabled
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex-shrink-0 border-2 transition-all ${
                            isSelected ? 'bg-[#3cb4e6] border-[#3cb4e6]' : 'border-slate-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black leading-none">{method.label}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 leading-snug truncate">{method.description}</div>
                          </div>
                          <span className={`text-[9px] font-black flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {method.liftEstimate}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Target className="w-3 h-3 text-[#3cb4e6]" /> {t.production.customPromptLabel}
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={t.production.customPromptPlaceholder}
                className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-[#03234b] placeholder-slate-400 focus:bg-white focus:border-[#3cb4e6] focus:ring-4 focus:ring-[#3cb4e6]/10 outline-none transition-all resize-none shadow-inner"
              />
            </div>

            {/* Primary: Generate current intent */}
            <button
              onClick={() => handleGenerate(activeBundleIdx)}
              disabled={activeOutput.isGenerating || activeOutput.isDeepSearching}
              className={`w-full font-black text-sm uppercase py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg group ${
                activeOutput.retryCountdown
                  ? 'bg-amber-500 text-white cursor-wait'
                  : activeOutput.isDeepSearching
                    ? 'bg-emerald-600 text-white cursor-wait'
                    : 'bg-[#03234b] text-white hover:bg-[#0a3d7a] disabled:opacity-40'
              }`}
            >
              {activeOutput.retryCountdown ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t.production.rateLimitPrefix} {activeOutput.retryCountdown}s</>
              ) : activeOutput.isDeepSearching ? (
                <><SearchIcon className="w-5 h-5 animate-pulse text-[#ffd200]" /> {t.production.deepGrounding}</>
              ) : activeOutput.isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t.production.generatingBtn}</>
              ) : (
                <><Sword className="w-5 h-5 text-[#ffd200] group-hover:rotate-12" /> {t.production.generateBtn}</>
              )}
            </button>

            {/* Secondary: Generate all (only when multiple intents exist) */}
            {!isFreeform && bundles.length > 1 && (
              <button
                onClick={handleGenerateAll}
                disabled={anyGenerating}
                className="w-full font-black text-xs uppercase py-3 rounded-xl transition-all flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-500 hover:border-[#3cb4e6] hover:text-[#3cb4e6] disabled:opacity-30"
              >
                <Zap className="w-3.5 h-3.5" />
                {t.production.generateAllBtn}
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel: output for active bundle ── */}
        <div className="lg:col-span-8">
          {activeOutput.content && (
            <div className="flex justify-end mb-3">
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#ffd200] to-[#f5c400] text-[#03234b] text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-md transition-all disabled:opacity-50"
              >
                {isGeneratingReport
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t.production.reportGenerating}</>
                  : <><FileText className="w-3.5 h-3.5" /> {t.production.reportBtn}</>
                }
              </button>
            </div>
          )}
          {activeOutput.generateError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <p className="text-red-800 font-black text-xs uppercase tracking-widest">{t.production.generationFailed}</p>
                <p className="text-red-700 text-sm mt-1 font-mono">{activeOutput.generateError}</p>
              </div>
            </div>
          )}

          {activeOutput.streamTruncated && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
              <p className="text-xs font-bold text-amber-800 leading-relaxed">
                {t.production.streamTruncatedMsg}
              </p>
            </div>
          )}

          <ProductOutputTabs
            content={activeOutput.content}
            analysis={activeOutput.analysis}
            schema={activeOutput.schema}
            schemaStatus={activeOutput.schemaStatus}
            schemaError={activeOutput.schemaError}
            onHumanize={handleHumanize}
            onTranslate={handleTranslate}
            isHumanizing={isHumanizing}
            isTranslating={isTranslating}
            t={t}
            geoSignalsBefore={activeOutput.geoSignalsBefore}
            geoSignalsAfter={activeOutput.geoSignalsAfter}
          />
        </div>
      </div>
    </div>
    <ReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      content={reportContent}
      isGenerating={isGeneratingReport}
      t={t}
    />
    </>
  );
};

export default StepProduction;
