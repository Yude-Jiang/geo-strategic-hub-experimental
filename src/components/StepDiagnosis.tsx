import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import { analyzeContent } from '../services/geminiService';
import type { TranslationKeys } from '../i18n/translations';
import { 
  Search, Loader2, CheckCircle2, XCircle, ChevronRight, 
  BarChart3, Lock, Upload, AlertCircle, HelpCircle, Info,
  Activity, ShieldAlert, Navigation, Lightbulb, Target, AlertTriangle
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
  const setSelectedPainPoints = useWorkflowStore(state => state.setSelectedPainPoints);
  const setDiagnosisConfirmed = useWorkflowStore(state => state.setDiagnosisConfirmed);
  const setStep = useWorkflowStore(state => state.setStep);

  const [inputText, setInputText] = useState(seedKeywords.join('\n'));
  const [regionOverride, setRegionOverride] = useState('');
  const [images, setImages] = useState<{ mimeType: string; data: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (diagnosisResult) {
      const allIds = new Set<string>();
      diagnosisResult.intentClusters.forEach(cluster => {
        cluster.painPoints.forEach(p => allIds.add(p.userPainPoint));
      });
      setSelectedItems(allIds);
    }
  }, [diagnosisResult]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setImages(prev => [...prev, { mimeType: file.type, data: base64 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setLoadingStage('Initializing grounding search...');
    const keywords = inputText.split('\n').filter(k => k.trim().length > 0);
    setSeedKeywords(keywords);

    try {
      const data = await analyzeContent(inputText, images, uiLang, regionOverride, targetEcosystem);
      setDiagnosisResult(data);
    } catch (err: any) {
      setError({ message: err.message || 'Analysis failed.', code: err.code });
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

  const handleConfirmDiagnosis = () => {
    if (!diagnosisResult) return;
    const confirmed = diagnosisResult.intentClusters.flatMap(cluster => 
      cluster.painPoints.filter(p => selectedItems.has(p.userPainPoint))
    );
    setSelectedPainPoints(confirmed);
    setDiagnosisConfirmed(true);
    setStep(2);
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
            <input
              className="w-full bg-[#0a3d7a]/60 border border-[#3cb4e6]/20 rounded-xl p-3 text-white placeholder-[#8191a5]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cb4e6]"
              placeholder={t.diagnosis.regionPlaceholder}
              value={regionOverride}
              onChange={e => setRegionOverride(e.target.value)}
            />
            <label className="flex items-center gap-3 bg-[#0a3d7a]/40 border-2 border-dashed border-[#3cb4e6]/20 rounded-xl p-3 cursor-pointer hover:bg-[#0a3d7a]/60 transition-all">
              <Upload className="w-5 h-5 text-[#3cb4e6]" />
              <span className="text-[#3cb4e6] text-xs">{images.length > 0 ? `${images.length} files attached` : t.diagnosis.attachPlaceholder}</span>
              <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={handleImageUpload} />
            </label>
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
                  <h4 className="text-xl font-black text-[#03234b] mb-4 uppercase">{cluster.intentTitle}</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-[9px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Core</h5>
                      <p className="text-xs text-[#03234b] font-bold">{cluster.coreProposition}</p>
                    </div>
                    <div className="pt-2">
                    <div className="flex items-center gap-1 mb-2 relative group">
                      <h5 className="text-[9px] font-black text-slate-400 uppercase"><Info className="w-3 h-3 inline-block mr-1" /> {(t.diagnosis as any).monitorQuestions}</h5>
                      <span className="text-slate-300 w-3 h-3 flex items-center justify-center rounded-full border border-slate-300 text-[8px] font-bold cursor-help bg-white">?</span>
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-[#03234b] text-white text-[10px] p-3 rounded-xl shadow-2xl z-20">
                        {(t.diagnosis as any).monitorTooltip}
                        <div className="absolute top-full left-4 w-2 h-2 bg-[#03234b] rotate-45 -mt-1" />
                      </div>
                    </div>
                    </div>
                    <div>
                      <h5 className="text-[9px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> Bias</h5>
                      <p className="text-[11px] text-amber-900 leading-relaxed bg-amber-50 p-3 rounded-xl">{cluster.aiPerceptionBias}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-8 bg-white">
                  <div className="grid grid-cols-1 gap-3">
                    {cluster.painPoints.map((p, pIdx) => (
                      <label
                        key={pIdx}
                        className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedItems.has(p.userPainPoint) ? 'border-[#3cb4e6] bg-[#3cb4e6]/5' : 'border-slate-50 bg-slate-50'}`}
                      >
                        <input type="checkbox" className="hidden" checked={selectedItems.has(p.userPainPoint)} onChange={() => toggleItem(p.userPainPoint)} />
                        {selectedItems.has(p.userPainPoint) ? <CheckCircle2 className="w-5 h-5 text-[#3cb4e6]" /> : <div className="border-2 border-slate-200 rounded-full w-5 h-5" />}
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-[#03234b] text-sm uppercase">{p.searchTerm}</span>
                          <p className="text-xs text-[#03234b] font-bold opacity-80">{p.userPainPoint}</p>
                          <p className="text-xs text-amber-700 font-medium">{p.aiKnowledgeGap}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <h5 className="text-[9px] font-black text-indigo-400 uppercase mb-4 flex items-center gap-2"><HelpCircle className="w-4 h-4" /> Monitoring Questions</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {cluster.simulatedQuestions.map((q, i) => (
                        <div key={i} className="bg-indigo-50/30 text-indigo-800 text-[11px] font-bold px-4 py-3 rounded-xl border border-indigo-100">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50">
            <div className="bg-[#03234b] text-white rounded-2xl shadow-xl p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest"><Lock className="w-4 h-4 inline mr-2 text-[#3cb4e6]" />{selectedItems.size} Selected</p>
                <p className="text-[10px] text-[#8191a5] font-bold">Lock selection to proceed</p>
              </div>
              <button
                onClick={handleConfirmDiagnosis}
                disabled={selectedItems.size === 0}
                className="bg-[#ffd200] text-[#03234b] font-black text-sm uppercase px-10 py-4 rounded-xl hover:bg-[#ffe24d] disabled:opacity-30 transition-all flex items-center gap-3"
              >
                {t.diagnosis.confirmBtn} <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepDiagnosis;
