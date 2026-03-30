import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import type { StrategicPlaybookItem } from '../types';
import type { TranslationKeys } from '../i18n/translations';
import {
  BookOpen, ChevronRight, Edit3, Check, Shield,
  Zap, Swords, ChevronDown, ChevronUp, Lock, RefreshCcw, Save, Trash2,
  Lightbulb, AlertTriangle, Target, Sparkles
} from 'lucide-react';

interface StepStrategyProps {
  t: TranslationKeys;
}

const StepStrategy: React.FC<StepStrategyProps> = ({ t }) => {
  const diagnosisResult = useWorkflowStore(state => state.diagnosisResult);
  const selectedMonitoringQuestions = useWorkflowStore(state => state.selectedMonitoringQuestions);
  const setSelectedPlaybooks = useWorkflowStore(state => state.setSelectedPlaybooks);
  const setStrategyConfirmed = useWorkflowStore(state => state.setStrategyConfirmed);
  const setStep = useWorkflowStore(state => state.setStep);

  const [localPlaybooks, setLocalPlaybooks] = useState<StrategicPlaybookItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (diagnosisResult?.marketStrategy) {
      const allStrats = [
        ...(diagnosisResult.marketStrategy.implicitIntentStrategy || []),
        ...(diagnosisResult.marketStrategy.competitorStrategy || [])
      ].map(s => ({ ...s }));
      setLocalPlaybooks(allStrats);
      setSelectedIndices(new Set(allStrats.map((_, i) => i)));
    }
  }, [diagnosisResult]);

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const updateLocalPlaybook = (idx: number, updates: Partial<StrategicPlaybookItem>) => {
    setLocalPlaybooks(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleConfirm = () => {
    const confirmed = localPlaybooks.filter((_, i) => selectedIndices.has(i));
    setSelectedPlaybooks(confirmed);
    setStrategyConfirmed(true);
    setStep(3);
  };

  const getTacticsIcon = (type: string) => {
    if (type.includes('Authority') || type.includes('🛡️')) return <Shield className="w-4 h-4 text-blue-500" />;
    if (type.includes('Scenario') || type.includes('⚡')) return <Zap className="w-4 h-4 text-amber-500" />;
    if (type.includes('Competitor') || type.includes('⚔️')) return <Swords className="w-4 h-4 text-red-500" />;
    return <BookOpen className="w-4 h-4 text-slate-500" />;
  };

  const getTacticsBg = (type: string) => {
    if (type.includes('Authority') || type.includes('🛡️')) return 'bg-blue-50 border-blue-100 text-blue-700';
    if (type.includes('Scenario') || type.includes('⚡')) return 'bg-amber-50 border-amber-100 text-amber-700';
    if (type.includes('Competitor') || type.includes('⚔️')) return 'bg-red-50 border-red-100 text-red-700';
    return 'bg-slate-50 border-slate-100 text-slate-700';
  };

  if (!diagnosisResult || localPlaybooks.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-xl animate-fade-in">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-[#03234b] mb-2">{t.strategy.noPlaybooks}</h3>
        <p className="text-slate-400 max-w-sm mx-auto mb-8 leading-relaxed">{t.strategy.noPlaybooksHint}</p>
        <button
          onClick={() => setStep(1)}
          className="bg-[#03234b] text-white font-black text-xs px-8 py-4 rounded-xl hover:bg-[#0a3d7a] transition-all flex items-center gap-2 mx-auto"
        >
          <RefreshCcw className="w-4 h-4" /> {t.strategy.backDiagnosis}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-32">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-r from-[#03234b] to-[#0a3d7a] rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-6 mb-3">
            <BookOpen className="w-8 h-8 text-[#ffd200]" />
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{t.strategy.title}</h2>
              <p className="text-[#8191a5] text-xs font-bold uppercase mt-1">{t.strategy.subtitle}</p>
            </div>
          </div>
          <p className="text-[11px] text-[#3cb4e6] font-medium leading-relaxed max-w-2xl">
            {(t.strategy as any).desc || 'Review each AI-generated playbook below, editing the logic or golden snippet as needed. Deselect any tactics that do not fit your current campaign priorities.'}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 flex flex-col justify-center text-center">
          <span className="text-3xl font-black text-[#3cb4e6] leading-none mb-1">{selectedMonitoringQuestions.length}</span>
          <span className="text-[10px] text-slate-400 font-black uppercase">{t.strategy.inherited}</span>
        </div>
      </div>

      {/* Advisor Note from Diagnosis */}
      {diagnosisResult?.marketStrategy?.comprehensiveInsight && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100/40 rounded-bl-full" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" /> {(t.strategy as any).advisorNote || '诊断师洞察 (Advisor Note)'}
              </h4>
              <p className="text-sm text-amber-900 font-medium leading-relaxed mb-3">
                {diagnosisResult.marketStrategy.comprehensiveInsight.aiPerception}
              </p>
              <p className="text-xs text-amber-700 font-bold leading-relaxed bg-white/60 p-3 rounded-xl border border-amber-100">
                <span className="text-amber-500 mr-1">▸</span> {diagnosisResult.marketStrategy.comprehensiveInsight.marketGapAnalysis}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Added Data Flow Visualization: Showing the interception targets */}
      {selectedMonitoringQuestions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden mb-8">
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center gap-3">
             <Target className="w-5 h-5 text-indigo-500" />
             <h3 className="text-sm font-black text-[#03234b] uppercase tracking-widest">
               {(t.strategy as any).activeTargets || '战略拦截目标 (Active Interception Targets)'}
             </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {selectedMonitoringQuestions.map((q) => (
              <div key={q.id} className="p-5 flex flex-col md:flex-row gap-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Monitoring Prompt</span>
                  <p className="text-sm font-bold text-[#03234b] leading-relaxed">{q.userPrompt}</p>
                </div>
                <div className="flex-1">
                   <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 block">Expected AI Anchor</span>
                   <div className="bg-emerald-50 text-emerald-700 text-xs font-mono font-bold px-4 py-3 rounded-xl border border-emerald-100/50 break-words">
                     {q.expectedAnchor}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {localPlaybooks.map((strategy, idx) => {
          const isSelected = selectedIndices.has(idx);
          const isEditing = editingIdx === idx;
          const isExpanded = expandedIdx === idx;

          return (
            <div
              key={idx}
              className={`bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-[#3cb4e6]/40 shadow-xl' : 'border-slate-50 opacity-60 grayscale-[0.5]'}`}
            >
              <div className={`p-6 flex items-start gap-6 ${isEditing ? 'bg-[#3cb4e6]/5' : ''}`}>
                <button
                  onClick={() => toggleSelect(idx)}
                  className={`mt-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${isSelected ? 'bg-[#3cb4e6] border-[#3cb4e6] text-white' : 'border-slate-300'}`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </button>

                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getTacticsBg(strategy.tacticsType)}`}>
                      {getTacticsIcon(strategy.tacticsType)} {strategy.tacticsType}
                    </div>
                    {selectedMonitoringQuestions.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase bg-indigo-50 border border-indigo-100 text-indigo-600 animate-pulse">
                        <Sparkles className="w-3 h-3" /> GEO Strategy Aligned
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-[#03234b]"
                        value={strategy.sourceLogic}
                        onChange={e => updateLocalPlaybook(idx, { sourceLogic: e.target.value })}
                      />
                      <textarea
                        className="w-full h-24 bg-white border border-slate-200 rounded-xl p-3 text-xs"
                        value={strategy.geoAction}
                        onChange={e => updateLocalPlaybook(idx, { geoAction: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="cursor-pointer" onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                      <h4 className="text-lg font-black text-[#03234b] leading-tight mb-2">{strategy.sourceLogic}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{strategy.geoAction}</p>
                    </div>
                  )}

                  <div className={`rounded-2xl p-4 ${isEditing ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50/50 border border-slate-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className={`w-3.5 h-3.5 ${isEditing ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isEditing ? 'text-amber-700' : 'text-slate-400'}`}>{t.strategy.targetSnippet}</span>
                    </div>
                    {isEditing ? (
                      <textarea
                        className="w-full h-32 bg-white border border-amber-200 rounded-xl p-3 text-[11px] font-mono leading-relaxed"
                        value={strategy.targetSnippet}
                        onChange={e => updateLocalPlaybook(idx, { targetSnippet: e.target.value })}
                      />
                    ) : (
                      <p className="text-[11px] text-slate-600 font-mono leading-relaxed">{strategy.targetSnippet}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={() => isEditing ? setEditingIdx(null) : setEditingIdx(idx)} className="p-3 bg-white text-slate-400 hover:text-[#3cb4e6] rounded-2xl transition-all shadow-sm">
                    {isEditing ? <Save className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className={`p-3 bg-white rounded-2xl transition-all shadow-sm ${isExpanded ? 'text-[#3cb4e6]' : 'text-slate-400'}`}>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { setLocalPlaybooks(prev => prev.filter((_, i) => i !== idx)); setSelectedIndices(prev => { const n = new Set(prev); n.delete(idx); return n; }); }} className="p-3 bg-white text-slate-200 hover:text-red-500 rounded-2xl transition-all shadow-sm">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50">
        <div className="bg-[#03234b] text-white rounded-2xl shadow-xl p-6 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button onClick={() => setStep(1)} className="text-xs font-black uppercase tracking-widest text-[#3cb4e6] hover:text-[#ffd200]">{t.strategy.backDiagnosis}</button>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Lock className="w-4 h-4 text-[#3cb4e6]" />{selectedIndices.size} {t.strategy.selected}</p>
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={selectedIndices.size === 0}
            className="bg-[#ffd200] text-[#03234b] font-black text-sm uppercase px-10 py-4 rounded-xl hover:bg-[#ffe24d] disabled:opacity-30 transition-all flex items-center gap-3 shadow-lg"
          >
            {t.strategy.deployBtn} <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepStrategy;
