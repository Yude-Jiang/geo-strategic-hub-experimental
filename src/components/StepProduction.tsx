import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import { 
  generateContentStream, 
  generateJsonLdSchema, 
  humanizeContent, 
  translateContent,
  deepEvidenceGrounding,
  withRetry
} from '../services/geminiService';
import type { TranslationKeys } from '../i18n/translations';
import { 
  ArrowLeft, Loader2, Zap, 
  ShieldCheck, Sword, Lightbulb, Target,
  Search as SearchIcon
} from 'lucide-react';

import RagSourcePanel from './RagSourcePanel';
import PlatformSelector from './PlatformSelector';
import ProductOutputTabs from './ProductOutputTabs';

const ANALYSIS_REGEX = /={2,}\s*GEO_ANALYSIS\s*={2,}/i;
const END_REGEX = /={2,}\s*END\s*={2,}/i;

const StepProduction: React.FC<{ t: TranslationKeys }> = ({ t }) => {
  const uiLang = useWorkflowStore(state => state.uiLang);
  const selectedPlaybooks = useWorkflowStore(state => state.selectedPlaybooks);
  const selectedMonitoringQuestions = useWorkflowStore(state => state.selectedMonitoringQuestions);
  const setStep = useWorkflowStore(state => state.setStep);

  const [sources, setSources] = useState<any[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('zhihu');
  const [selectedFormat, setSelectedFormat] = useState('long_form');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [fullOutput, setFullOutput] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [pastedAnalysis, setPastedAnalysis] = useState('');
  
  const [schemaContent, setSchemaContent] = useState('');
  const [schemaStatus, setSchemaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [systemSources, setSystemSources] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  const parseModelOutput = (text: string) => {
    const analysisMatch = text.match(ANALYSIS_REGEX);
    const endMatch = text.match(END_REGEX);
    if (!analysisMatch) return { content: text.trim(), analysis: '' };
    const splitIdx = text.indexOf(analysisMatch[0]);
    const endIdx = endMatch ? text.indexOf(endMatch[0]) : text.length;
    return {
      content: text.substring(0, splitIdx).trim(),
      analysis: text.substring(splitIdx + analysisMatch[0].length, endIdx).trim(),
    };
  };

  useEffect(() => {
    const { content, analysis } = parseModelOutput(fullOutput);
    setPastedContent(content);
    setPastedAnalysis(analysis);
  }, [fullOutput]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setFullOutput('');
    setSchemaStatus('idle');
    setSchemaContent('');
    setGenerateError(null);
    setRetryCountdown(null);

    let accumulated = '';
    try {
      // 1. Deep Evidence Grounding (Step 3 mandatory check)
      let combinedSources = [...sources];
      
      if (selectedMonitoringQuestions && selectedMonitoringQuestions.length > 0) {
        setIsDeepSearching(true);
        try {
          const anchors = selectedMonitoringQuestions.map(q => q.expectedAnchor).filter(Boolean);
          const deepRes = await deepEvidenceGrounding(anchors);
          setSystemSources(deepRes);
          combinedSources = [...combinedSources, ...deepRes];
        } catch (searchErr) {
          console.warn("Deep search failed, continuing with available sources:", searchErr);
        } finally {
          setIsDeepSearching(false);
        }
      }

      const sourceContext = combinedSources.map(s => `[Source: ${s.name}]\n${s.content}`).join('\n\n');

      // generateContentStream uses withRetry internally for streaming
      const stream = await withRetry(
        () => generateContentStream(selectedPlatform, selectedFormat, selectedPlaybooks, selectedMonitoringQuestions, customPrompt, sourceContext, uiLang),
        (s) => setRetryCountdown(s > 0 ? s : null)
      );

      for await (const chunk of stream) {
        const text = chunk || '';
        accumulated += text;
        setFullOutput(prev => prev + text);
      }

      setRetryCountdown(null);
      const { content } = parseModelOutput(accumulated);
      if (content.trim()) {
        // Also wrap JSON-LD with retry
        withRetry(
          () => generateJsonLdSchema(content, uiLang, selectedPlatform)
            .then(schema => { setSchemaContent(schema || ''); setSchemaStatus('success'); }),
          () => {}
        ).catch(err => { setSchemaStatus('error'); setSchemaError(err?.message || 'Schema failed'); });
      }
    } catch (err: any) {
      console.error(err);
      let userMessage = err?.message || 'Generation failed. Please check your API key.';
      try {
        const raw = JSON.parse(err?.message || '{}');
        const inner = raw?.error?.message || '';
        if (raw?.error?.code === 429 || raw?.error?.status === 'RESOURCE_EXHAUSTED') {
          userMessage = 'API 配额已达上限，已达到最大重试次数。请稍候再试。';
        } else if (inner) {
          userMessage = inner.split('\n')[0];
        }
      } catch (_) {}
      setGenerateError(userMessage);
      setRetryCountdown(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerSchema = async (text: string) => {
    if (!text.trim()) return;
    setSchemaStatus('loading');
    setSchemaError(null);
    try {
      const schema = await generateJsonLdSchema(text, uiLang, selectedPlatform);
      setSchemaContent(schema || '');
      setSchemaStatus('success');
    } catch (err: any) {
      setSchemaStatus('error');
      setSchemaError(err.message || 'JSON-LD Generation Failed');
    }
  };

  const handleHumanize = async () => {
    if (!pastedContent) return;
    setIsHumanizing(true);
    try {
      const human = await humanizeContent(pastedContent, uiLang);
      setPastedContent(human || '');
      triggerSchema(human || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsHumanizing(false);
    }
  };

  const handleTranslate = async (lang: string) => {
    if (!pastedContent) return;
    setIsTranslating(true);
    try {
      const trans = await translateContent(pastedContent, lang);
      setPastedContent(trans || '');
      triggerSchema(trans || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => setStep(2)} className="p-3 bg-slate-50 text-slate-400 hover:text-[#03234b] rounded-2xl transition-all group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1" />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#03234b] flex items-center gap-2"><Zap className="w-5 h-5 text-[#ffd200]" /> {t.production.title}</h2>
            <p className="text-[#8191a5] text-[10px] font-black uppercase tracking-[0.2em]">
              {selectedPlaybooks.length > 0 
                ? `${selectedPlaybooks.length} ${t.production.inherited}`
                : ((t.production as any).freeformMode || '自由创作模式 (Freeform Mode)')}
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-8">
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
             <ShieldCheck className="w-4 h-4" /> {(t.production as any).cognitiveReady || 'GEO Ready'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Inherited Pillars UI */}
          {selectedPlaybooks.length > 0 && (
            <div className="bg-gradient-to-br from-[#03234b] to-[#0a3d7a] rounded-2xl p-5 shadow-lg border border-[#3cb4e6]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#3cb4e6]/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="text-[10px] font-black text-[#ffd200] uppercase tracking-widest mb-3 flex items-center gap-2 relative z-10">
                <Lightbulb className="w-4 h-4" /> {(t as any).production?.inheritedPillars || 'Active Strategy Pillars'} ({selectedPlaybooks.length})
              </div>
              <div className="flex flex-wrap gap-2 relative z-10">
                {selectedPlaybooks.map((pb, idx) => (
                  <span key={idx} className="bg-white/10 text-white border border-white/20 px-3 py-1.5 rounded-lg text-xs font-bold leading-tight">
                    <span className="text-[#ffd200] mr-1">[{pb.tacticsType}]</span> {pb.geoAction || `Strategy 0${idx + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <RagSourcePanel onSourcesChange={(s) => setSources(s)} systemSources={systemSources} />
          
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-6">
            <PlatformSelector 
              selectedPlatform={selectedPlatform} 
              onPlatformChange={setSelectedPlatform} 
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Target className="w-3 h-3 text-[#3cb4e6]" /> {(t as any).production?.customPromptLabel || 'Human Directive'}
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={(t as any).production?.customPromptPlaceholder || 'E.g. "Draft the second iteration focused exclusively on cold-weather battery drainage, using an aggressive tone against EU competitors."'}
                className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-[#03234b] placeholder-slate-400 focus:bg-white focus:border-[#3cb4e6] focus:ring-4 focus:ring-[#3cb4e6]/10 outline-none transition-all resize-none shadow-inner"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || isDeepSearching}
              className={`w-full font-black text-sm uppercase py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg group ${
                retryCountdown 
                  ? 'bg-amber-500 text-white cursor-wait' 
                  : isDeepSearching
                    ? 'bg-emerald-600 text-white cursor-wait'
                    : 'bg-[#03234b] text-white hover:bg-[#0a3d7a] disabled:opacity-40'
              }`}
            >
              {retryCountdown ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Rate Limit — 重试倒计时: {retryCountdown}s
                </>
              ) : isDeepSearching ? (
                <>
                  <SearchIcon className="w-5 h-5 animate-pulse text-[#ffd200]" />
                  Deep Grounding... (深度溯源中)
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.production.generatingBtn}
                </>
              ) : (
                <>
                  <Sword className="w-5 h-5 text-[#ffd200] group-hover:rotate-12" />
                  {t.production.generateBtn}
                </>
              )}
            </button>
          </div>
        </div>
        <div className="lg:col-span-8">
          {generateError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <p className="text-red-800 font-black text-xs uppercase tracking-widest">Generation Failed</p>
                <p className="text-red-700 text-sm mt-1 font-mono">{generateError}</p>
              </div>
            </div>
          )}
          <ProductOutputTabs 
            content={pastedContent}
            analysis={pastedAnalysis}
            schema={schemaContent}
            schemaStatus={schemaStatus}
            schemaError={schemaError}
            onHumanize={handleHumanize}
            onTranslate={handleTranslate}
            isHumanizing={isHumanizing}
            isTranslating={isTranslating}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};

export default StepProduction;
