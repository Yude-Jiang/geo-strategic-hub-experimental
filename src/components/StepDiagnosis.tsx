import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import { analyzeContent, withRetry, refineStrategy, verifyModelClaims, verifyAnchors } from '../services/geminiService';
import { runMultiModelVerification } from '../services/multiModelService';
import type { TranslationKeys } from '../i18n/translations';
import { 
  Search, Loader2, CheckCircle2, ChevronRight, 
  BarChart3, Lock, AlertCircle, HelpCircle, Info, Download,
  Activity, ShieldAlert, Navigation, Lightbulb, Target, AlertTriangle, Zap
} from 'lucide-react';

const EXAMPLE_SEEDS: Record<string, string> = {
  global: `STM32WBA Matter Thread\nnRF52832 Alternative Low Power\nBluetooth LE PSA Level 3 Certification\nMatter Smart Lock Single Chip Solution\nIndustrial Temp Bluetooth SoC Selection for EMEA`,
  cn: `800V SiC MOSFET\nBMS 均衡策略\n车规级 MCU 选型\nIGBT 热失控保护\n氮化镓充电器原理`,
  jp: `STM32H7 モーター制御\nBLE メッシュ 省電力設計\nSiC インバータ 車載向け`,
  kr: `STM32 Matter 스마트홈\n산업용 BLE SoC 선택 가이드\nNaver CUE: 최적화 전략`,
};

interface Props {
  t: TranslationKeys;
}

const StepDiagnosis: React.FC<Props> = ({ t }) => {
  const targetEcosystem = useWorkflowStore(state => state.targetEcosystem);
  const uiLang = useWorkflowStore(state => state.uiLang);
  const diagnosisResult = useWorkflowStore(state => state.diagnosisResult);
  const seedKeywords = useWorkflowStore(state => state.seedKeywords);
  
  const setSeedKeywords = useWorkflowStore(state => state.setSeedKeywords);
  const setDiagnosisResult = useWorkflowStore(state => state.setDiagnosisResult);
  const selectedMonitoringQuestions = useWorkflowStore(state => state.selectedMonitoringQuestions);
  const setSelectedMonitoringQuestions = useWorkflowStore(state => state.setSelectedMonitoringQuestions);
  const setDiagnosisConfirmed = useWorkflowStore(state => state.setDiagnosisConfirmed);
  const setStep = useWorkflowStore(state => state.setStep);
  const isRefiningStrategy = useWorkflowStore(state => state.isRefiningStrategy);
  const setIsRefiningStrategy = useWorkflowStore(state => state.setIsRefiningStrategy);
  const updateDiagnosisResultStrategy = useWorkflowStore(state => state.updateDiagnosisResultStrategy);
  const setRefinementStatus = useWorkflowStore(state => state.setRefinementStatus);
  const updateDiagnosisResultVerification = useWorkflowStore(state => state.updateDiagnosisResultVerification);
  const updateDiagnosisResultMultiModel = useWorkflowStore(state => state.updateDiagnosisResultMultiModel);
  const updateAnchorVerifications = useWorkflowStore(state => state.updateAnchorVerifications);

  const [inputText, setInputText] = useState(seedKeywords.join('\n'));
  const [regionOverride, setRegionOverride] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (diagnosisResult) {
      const allIds = new Set<string>();
      diagnosisResult.intentClusters?.forEach(cluster => {
        cluster.monitoringQuestions?.forEach(q => allIds.add(q.id));
      });
      setSelectedItems(allIds);
    }
  }, [diagnosisResult]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setLoadingStage('Initializing grounding search...');
    const keywords = inputText.split('\n').filter(k => k.trim().length > 0);
    setSeedKeywords(keywords);

    try {
      const data = await withRetry(
        () => analyzeContent(inputText, [], uiLang, regionOverride, targetEcosystem),
        (secondsLeft) => {
          if (secondsLeft > 0) {
            setLoadingStage(`API Rate Limit Hit. Retrying in ${secondsLeft}s...`);
          } else {
            setLoadingStage('Resuming analysis...');
          }
        }
      );
      setDiagnosisResult(data);

      // ── Background verification (non-blocking, best-effort) ──────────────
      // 1. Gemini-grounded claim check (Google Search evidence)
      verifyModelClaims(
        data.strategyReport?.executiveSummary?.marketPulse || '',
        targetEcosystem
      ).then(v => updateDiagnosisResultVerification(v)).catch(() => {});

      // 2. Real CN model parallel probe — only for CN ecosystem
      if (targetEcosystem === 'cn') {
        runMultiModelVerification(inputText, uiLang)
          .then(r => updateDiagnosisResultMultiModel(r))
          .catch(() => {});
      }
      // ─────────────────────────────────────────────────────────────────────

    } catch (err: any) {
      let msg = err.message || 'Analysis failed.';
      if (msg.includes('Failed to fetch')) {
        msg = `Failed to fetch. ${t.diagnosis.fetchError}`;
      }
      setError({ message: msg, code: err.code });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmDiagnosis = async () => {
    if (!diagnosisResult) return;
    const confirmed = diagnosisResult.intentClusters.flatMap(cluster => 
      cluster.monitoringQuestions.filter(q => selectedItems.has(q.id))
    );
    setSelectedMonitoringQuestions(confirmed);
    
    // Only refine if something is chosen, otherwise skip
    if (confirmed.length > 0) {
      setIsRefiningStrategy(true);
      setRefinementStatus('pending');
      try {
        const refinedStrategy = await withRetry(
          () => refineStrategy(confirmed, uiLang),
          () => {}
        );
        updateDiagnosisResultStrategy(refinedStrategy);
        setRefinementStatus('success');
      } catch (err) {
        console.error('Strategy refinement failed, proceeding with default strategy', err);
        setRefinementStatus('failed');
      } finally {
        setIsRefiningStrategy(false);
      }
    } else {
      setRefinementStatus('skipped');
    }

    // Kick off anchor verification in background — results appear in Step 2 monitoring list
    if (confirmed.length > 0) {
      verifyAnchors(confirmed)
        .then(v => updateAnchorVerifications(v))
        .catch(() => {});
    }

    setDiagnosisConfirmed(true);
    setStep(2);
  };

  const handleExportCSV = () => {
    if (!diagnosisResult) return;
    
    let csvContent = "\uFEFFStrategic Pillar,Core Proposition,Monitoring Prompt,Expected AI Anchor\n";
    
    diagnosisResult.intentClusters.forEach(cluster => {
      cluster.monitoringQuestions.forEach(q => {
        if (selectedItems.has(q.id)) {
          const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
          csvContent += `${escapeCSV(cluster.intentName)},${escapeCSV(cluster.coreProposition)},${escapeCSV(q.userPrompt)},${escapeCSV(q.expectedAnchor)}\r\n`;
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const firstKeyword = seedKeywords[0] ? seedKeywords[0].replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '').trim() || 'keyword' : 'keyword';
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    link.setAttribute("download", `${firstKeyword}_GEO-intention_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="bg-gradient-to-br from-[#03234b] to-[#0a3d7a] rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
        <h2 className="text-2xl font-black uppercase tracking-tight mb-1">{t.diagnosis.title}</h2>
        <p className="text-[#8191a5] text-sm mb-6">
          {t.diagnosis.subtitle} <span className="text-[#ffd200] font-bold">{targetEcosystem.toUpperCase()}</span> {t.diagnosis.subtitleSuffix}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <textarea
              className="w-full h-48 bg-[#0a3d7a]/60 border border-[#3cb4e6]/20 rounded-xl p-4 text-white placeholder-[#8191a5]/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#3cb4e6] transition-all resize-none shadow-inner"
              placeholder={EXAMPLE_SEEDS[targetEcosystem] || EXAMPLE_SEEDS.global}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-[#8191a5] uppercase tracking-wider mb-2">
                {t.diagnosis.regionLabel}
              </label>
              <input
                className="w-full bg-[#0a3d7a]/60 border border-[#3cb4e6]/20 rounded-xl p-3 text-white placeholder-[#8191a5]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cb4e6]"
                placeholder={t.diagnosis.regionPlaceholder}
                value={regionOverride}
                onChange={e => setRegionOverride(e.target.value)}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !inputText.trim()}
              className="w-full bg-[#ffd200] text-[#03234b] font-black text-sm uppercase tracking-wider py-4 rounded-xl hover:bg-[#ffe24d] transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {isLoading ? t.diagnosis.runningBtn : t.diagnosis.runBtn}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h4 className="text-red-900 font-black uppercase text-sm">Error</h4>
            <p className="text-red-700 text-sm">{error.message}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100 flex flex-col items-center">
          <Loader2 className="w-16 h-16 text-[#3cb4e6] animate-spin mb-4" />
          <p className="text-[#8191a5] text-sm">{loadingStage}</p>
        </div>
      )}

      {diagnosisResult && !isLoading && (
        <div className="space-y-8 pb-32">
          {/* 4-Quadrant Executive Summary */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#03234b] to-[#0a3d7a] p-6 text-white">
              <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-[#ffd200]" /> 
                {(t.diagnosis as any).strategyInsight}
              </h3>
              <p className="text-[11px] text-[#3cb4e6] font-medium opacity-90 leading-relaxed max-w-2xl">
                {(t.diagnosis as any).execSummaryDesc}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="p-6 md:p-8 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-extrabold text-[#03234b] text-sm uppercase">{(t.diagnosis as any).execSummary.marketPulse}</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{diagnosisResult.strategyReport.executiveSummary.marketPulse}</p>
              </div>
              <div className="p-6 md:p-8 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  <h4 className="font-extrabold text-[#03234b] text-sm uppercase">{(t.diagnosis as any).execSummary.coreRoadblocks}</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{diagnosisResult.strategyReport.executiveSummary.coreRoadblocks}</p>
              </div>
              <div className="p-6 md:p-8 hover:bg-slate-50 transition-colors border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="w-5 h-5 text-[#3cb4e6]" />
                  <h4 className="font-extrabold text-[#03234b] text-sm uppercase">{(t.diagnosis as any).execSummary.strategicPivot}</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{diagnosisResult.strategyReport.executiveSummary.strategicPivot}</p>
              </div>
              <div className="p-6 md:p-8 hover:bg-slate-50 transition-colors border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-indigo-500" />
                  <h4 className="font-extrabold text-[#03234b] text-sm uppercase">{(t.diagnosis as any).execSummary.keyInsight}</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{diagnosisResult.strategyReport.executiveSummary.keyInsight}</p>
              </div>
            </div>
          </div>

          {/* ── Multi-Model Real Verification Panel ───────────────────── */}
          {(() => {
            const mmv = diagnosisResult.multiModelVerification;
            const mv  = diagnosisResult.modelVerification;

            // Colour coding for consensus level
            const consensusColor: Record<string, string> = {
              full:        'bg-emerald-50 border-emerald-200 text-emerald-700',
              partial:     'bg-amber-50 border-amber-200 text-amber-700',
              divergent:   'bg-rose-50 border-rose-200 text-rose-700',
              insufficient:'bg-slate-50 border-slate-200 text-slate-500',
            };
            const confidenceColor: Record<string, string> = {
              high:       'text-emerald-600',
              medium:     'text-amber-600',
              low:        'text-rose-600',
              unverified: 'text-slate-400',
            };

            return (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#0a3d7a] to-[#03234b] p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#ffd200]" />
                    <h3 className="font-black uppercase tracking-widest text-sm text-white">
                      CN 生态认知探针
                    </h3>
                  </div>
                  {/* Disclaimer badge */}
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-1 rounded-full uppercase tracking-wider">
                    Simulated + Real
                  </span>
                </div>

                <div className="p-6 space-y-5">
                  {/* Disclaimer */}
                  {mv && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider mb-1">
                          Simulation Disclaimer
                        </p>
                        <p className="text-xs text-amber-800 leading-relaxed">{mv.disclaimer}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold text-amber-600 uppercase">Google Search Confidence:</span>
                          <span className={`text-[11px] font-black uppercase ${confidenceColor[mv.confidence] || 'text-slate-400'}`}>
                            {mv.confidence}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Real model responses */}
                  {mmv ? (
                    <>
                      {/* Consensus badge */}
                      <div className={`flex items-center justify-between border rounded-xl px-4 py-3 ${consensusColor[mmv.consensusLevel] || consensusColor.insufficient}`}>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider mb-0.5">跨模型认知共识</p>
                          <p className="text-xs font-semibold leading-snug">{mmv.consensusSummary}</p>
                        </div>
                        <span className="text-xs font-black uppercase px-3 py-1 rounded-full border ml-4 flex-shrink-0
                          border-current opacity-80">
                          {mmv.consensusLevel}
                        </span>
                      </div>

                      {/* Per-model cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mmv.snapshots.map(snap => (
                          <div key={snap.modelId} className={`rounded-xl border p-4 ${snap.error ? 'border-slate-200 bg-slate-50' : 'border-[#3cb4e6]/20 bg-[#f0f9ff]'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-[#03234b] uppercase">{snap.modelName}</span>
                              {snap.error
                                ? <span className="text-[10px] text-rose-500 font-bold">⚠ {snap.error}</span>
                                : <span className="text-[10px] text-slate-400 font-medium">{snap.latencyMs}ms</span>
                              }
                            </div>
                            {snap.error ? (
                              <p className="text-xs text-slate-400 italic">No response — check API key in .env.local</p>
                            ) : (
                              <>
                                <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 mb-3">
                                  {snap.rawResponse}
                                </p>
                                {snap.keyEntities.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {snap.keyEntities.slice(0, 8).map(e => (
                                      <span key={e} className="text-[10px] bg-[#3cb4e6]/10 text-[#0a3d7a] border border-[#3cb4e6]/20 px-2 py-0.5 rounded-full font-bold">
                                        {e}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Sentiment: <span className={
                                    snap.sentiment === 'positive' ? 'text-emerald-500'
                                    : snap.sentiment === 'negative' ? 'text-rose-500'
                                    : snap.sentiment === 'mixed' ? 'text-amber-500'
                                    : 'text-slate-400'
                                  }>{snap.sentiment}</span>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] text-slate-400 text-right">
                        Verified at {new Date(mmv.verifiedAt).toLocaleTimeString()}
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Querying DeepSeek &amp; Qwen in background...
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {/* ── End Multi-Model Panel ────────────────────────────────── */}

          {/* Competitor AI Threat Matrix */}
          {diagnosisResult.competitorAnalysis && diagnosisResult.competitorAnalysis.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="mb-6 px-2">
                <h3 className="text-[#03234b] font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-rose-500" />
                  {(t.diagnosis as any).competitorIntel.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-3xl">
                  {(t.diagnosis as any).competitorIntel.desc}
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {diagnosisResult.competitorAnalysis.map((comp, idx) => (
                  <div key={idx} className="bg-white rounded-3xl p-6 shadow-lg border border-rose-100 hover:shadow-2xl transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-10 group-hover:bg-rose-100 transition-colors" />
                    <div className="flex justify-between items-start mb-6">
                      <h4 className="text-xl font-black text-[#03234b] uppercase">{comp.competitorName}</h4>
                      <div className="flex items-center gap-1 bg-white border border-rose-200 text-rose-600 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                        <AlertTriangle className="w-3 h-3" />
                        {comp.threatLevel}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Info className="w-3 h-3"/> AI Perception</h5>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed italic bg-slate-50 p-2 rounded-lg border-l-2 border-[#3cb4e6]">"{comp.aiPerception}"</p>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-amber-500"/> {(t.diagnosis as any).competitorIntel.corpusAdvantage}</h5>
                        <p className="text-xs text-amber-900 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-100">{comp.corpusAdvantage}</p>
                      </div>
                      <div className="pt-2">
                         <h5 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> {(t.diagnosis as any).competitorIntel.strategicOpening}</h5>
                         <p className="text-xs text-[#03234b] font-bold leading-relaxed">{comp.strategicOpening}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intent Cluster / Intercept Matrix */}
          <div className="space-y-4 pt-4">
            <div className="mb-6 px-2">
              <h3 className="text-[#03234b] font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-indigo-500" />
                {(t.diagnosis as any).intentCluster.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-3xl">
                {(t.diagnosis as any).intentCluster.desc}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {diagnosisResult.intentClusters?.map((cluster, cIdx) => (
                <div key={cIdx} className={`bg-white rounded-3xl shadow-xl border flex flex-col md:flex-row overflow-hidden hover:shadow-2xl transition-all ${
                  cluster.failureDiagnosis?.severity === 'critical' ? 'border-red-200' :
                  cluster.failureDiagnosis?.severity === 'high'     ? 'border-orange-200' :
                  'border-slate-100'
                }`}>
                  <div className="w-full md:w-80 bg-slate-50 p-8 border-r border-slate-100">
                    <h4 className="text-xl font-black text-[#03234b] mb-3 uppercase">{cluster.intentName}</h4>

                    {/* ── Failure Diagnosis Badge ── */}
                    {cluster.failureDiagnosis && (() => {
                      const fd = cluster.failureDiagnosis;
                      const FAILURE_COLORS: Record<string, string> = {
                        CORPUS_ABSENCE:       'bg-red-100 text-red-700 border-red-200',
                        ATTRIBUTE_MISMATCH:   'bg-orange-100 text-orange-700 border-orange-200',
                        COMPETITOR_DOMINANCE: 'bg-red-50 text-red-600 border-red-100',
                        BURIED_ANSWER:        'bg-yellow-100 text-yellow-700 border-yellow-200',
                        SEMANTIC_IRRELEVANCE: 'bg-purple-100 text-purple-700 border-purple-200',
                        OUTDATED_CONTENT:     'bg-blue-100 text-blue-700 border-blue-200',
                        TRUST_CREDIBILITY:    'bg-slate-100 text-slate-600 border-slate-200',
                        STRUCTURAL_WEAKNESS:  'bg-amber-100 text-amber-700 border-amber-200',
                        UNKNOWN:              'bg-slate-50  text-slate-400 border-slate-100',
                      };
                      const SEVERITY_DOT: Record<string, string> = {
                        critical: 'bg-red-500',
                        high:     'bg-orange-400',
                        medium:   'bg-yellow-400',
                        low:      'bg-slate-300',
                      };
                      const colorClass = FAILURE_COLORS[fd.primaryFailure] ?? FAILURE_COLORS.UNKNOWN;
                      const dotClass   = SEVERITY_DOT[fd.severity] ?? 'bg-slate-300';
                      const urgencyBar = Math.round((fd.repairUrgency / 10) * 100);
                      return (
                        <div className="mb-4 space-y-2">
                          {/* Category badge + urgency */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border tracking-widest ${colorClass}`}>
                              {fd.primaryFailure.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {fd.severity}
                              </span>
                            </div>
                          </div>
                          {/* Repair urgency bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${fd.repairUrgency >= 8 ? 'bg-red-500' : fd.repairUrgency >= 5 ? 'bg-orange-400' : 'bg-emerald-400'}`}
                                style={{ width: `${urgencyBar}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-black text-slate-500 whitespace-nowrap">
                              Urgency {fd.repairUrgency}/10
                            </span>
                          </div>
                          {/* One-line explanation */}
                          <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            {fd.explanation}
                          </p>
                        </div>
                      );
                    })()}

                    <div>
                      <h5 className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Core Proposition</h5>
                      <p className="text-xs text-[#03234b] font-bold leading-relaxed">{cluster.coreProposition}</p>
                    </div>
                  </div>
                  <div className="flex-1 p-0 bg-white">
                    <div className="hidden md:grid grid-cols-12 gap-4 bg-slate-50/50 p-4 border-b border-slate-100 items-center">
                       <div className="col-span-1" />
                       <div className="col-span-6 text-[10px] font-black text-slate-400 uppercase tracking-widest"><HelpCircle className="w-3 h-3 inline mr-1"/> Monitoring Prompt</div>
                       <div className="col-span-5 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Target className="w-3 h-3 inline mr-1"/> Expected AI Anchor</div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {cluster.monitoringQuestions?.map((q) => (
                        <label
                          key={q.id}
                          className={`group flex flex-col md:grid md:grid-cols-12 gap-4 p-5 md:items-center cursor-pointer transition-colors ${selectedItems.has(q.id) ? 'bg-[#3cb4e6]/5' : 'hover:bg-slate-50/50'}`}
                        >
                          <div className="col-span-1 flex justify-center mt-2 md:mt-0">
                            <input type="checkbox" className="hidden" checked={selectedItems.has(q.id)} onChange={() => toggleItem(q.id)} />
                            {selectedItems.has(q.id) ? <CheckCircle2 className="w-5 h-5 text-[#3cb4e6]" /> : <div className="border-2 border-slate-200 rounded-full w-5 h-5 group-hover:border-[#3cb4e6]/50 transition-colors" />}
                          </div>
                          <div className="col-span-6 text-sm font-black text-[#03234b] leading-snug">{q.userPrompt}</div>
                          <div className="col-span-5 flex flex-col gap-1.5">
                            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100/50 font-mono break-words">
                              {q.expectedAnchor}
                            </div>
                            {(() => {
                              const av = diagnosisResult.anchorVerifications?.find(v => v.anchorId === q.id);
                              if (!av) return (
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying anchor...
                                </span>
                              );
                              const cfg = {
                                verified:   { cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: '✓', label: `Verified (${Math.round(av.confidence * 100)}%)` },
                                partial:    { cls: 'text-amber-600 bg-amber-50 border-amber-200',   icon: '~', label: `Partial match (${Math.round(av.confidence * 100)}%)` },
                                unverified: { cls: 'text-rose-600 bg-rose-50 border-rose-200',       icon: '✗', label: 'Unverified — use with caution' },
                              }[av.status];
                              return (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border w-fit ${cfg.cls}`}>
                                  {cfg.icon} {cfg.label}
                                </span>
                              );
                            })()}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating Confirm Bar */}
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50">
            <div className="bg-[#03234b] text-white rounded-2xl shadow-xl p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest"><Lock className="w-4 h-4 inline mr-2 text-[#3cb4e6]" />{selectedItems.size} Selected</p>
                <p className="text-[10px] text-[#8191a5] font-bold">Lock selection to proceed</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCSV}
                  disabled={selectedItems.size === 0}
                  className="bg-[#0a3d7a] border border-[#3cb4e6]/30 text-[#3cb4e6] font-black text-xs uppercase px-6 py-4 rounded-xl hover:bg-[#3cb4e6] hover:text-[#03234b] transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={handleConfirmDiagnosis}
                  disabled={selectedItems.size === 0}
                  className="bg-[#ffd200] text-[#03234b] font-black text-sm uppercase px-10 py-4 rounded-xl hover:bg-[#ffe24d] transition-all flex items-center gap-3"
                >
                  {t.diagnosis.confirmBtn} <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Refinement Loading Overlay */}
      {isRefiningStrategy && (
        <div className="fixed inset-0 z-[100] bg-[#03234b]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-fade-in shadow-2xl">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-[#3cb4e6]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#ffd200] rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-10 h-10 text-[#ffd200] animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-3 text-center">
            {(t.diagnosis as any).battleRoomTitle}
          </h2>
          <p className="text-[#8191a5] font-bold text-sm max-w-md text-center leading-relaxed">
            {(t.diagnosis as any).battleRoomSub.split('{count}').map((part: string, index: number, array: string[]) => (
              <React.Fragment key={index}>
                {part}
                {index < array.length - 1 && (
                  <span className="text-[#3cb4e6] font-black">{selectedMonitoringQuestions.length}</span>
                )}
              </React.Fragment>
            ))}
            <br />
            {(t.diagnosis as any).battleRoomAlign}
          </p>
          <div className="mt-8 flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-[#3cb4e6] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StepDiagnosis;
