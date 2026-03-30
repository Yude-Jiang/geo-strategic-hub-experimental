import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import { analyzeContent, withRetry, refineStrategy } from '../services/geminiService';
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
    } catch (err: any) {
      let msg = err.message || 'Analysis failed.';
      if (msg.includes('Failed to fetch')) {
        msg = 'Failed to fetch. 您的网络可能无法直连 Google API，请检查全局代理或 VPN 状态。';
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
      try {
        const refinedStrategy = await withRetry(
          () => refineStrategy(confirmed, uiLang),
          () => {
             // Handle retry if needed
          }
        );
        updateDiagnosisResultStrategy(refinedStrategy);
      } catch (err) {
        console.error("Strategy refinement failed, proceeding with default", err);
      } finally {
        setIsRefiningStrategy(false);
      }
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
                国家/区域 {t.diagnosis.regionLabel && `(${t.diagnosis.regionLabel})`}
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
                <div key={cIdx} className="bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col md:flex-row overflow-hidden hover:shadow-2xl transition-all">
                  <div className="w-full md:w-80 bg-slate-50 p-8 border-r border-slate-100">
                    <h4 className="text-xl font-black text-[#03234b] mb-4 uppercase">{cluster.intentName}</h4>
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
                          <div className="col-span-5 text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100/50 font-mono break-words">{q.expectedAnchor}</div>
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
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-3 text-center">战役指挥室设计中...</h2>
          <p className="text-[#8191a5] font-bold text-sm max-w-md text-center leading-relaxed">
            正在为您勾选的 <span className="text-[#3cb4e6] font-black">{selectedMonitoringQuestions.length}</span> 个战略拦截靶标定制专属战术剧本。
            <br />
            精确對齐 GEO 框架中...
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
