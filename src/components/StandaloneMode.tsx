import React, { useState } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import {
  optimizeContentForGeoStream,
  generateJsonLdSchema,
  humanizeContent,
  translateContent,
  fetchUrlContent,
  withRetry,
} from '../services/geminiService';
import type { TranslationKeys } from '../i18n/translations';
import type { PersistedRagSource } from '../types';
import {
  FileText, Globe, Upload, X, Loader2, Zap,
  Link as LinkIcon, AlignLeft, Target, ShieldCheck,
} from 'lucide-react';

import PlatformSelector from './PlatformSelector';
import ProductOutputTabs from './ProductOutputTabs';
import { computeGeoSignals } from '../services/structuralParser';
import type { GeoSignals } from '../services/structuralParser';
import { GEO_METHODS, RECOMMENDED_COMBOS } from '../services/geoMethods';
import type { GeoMethodId } from '../services/geoMethods';

// ─── Types (mirrored from StepProduction) ─────────────────────────────────────

type BundleOutput = {
  content: string;
  analysis: string;
  schema: string;
  schemaStatus: 'idle' | 'loading' | 'success' | 'error';
  schemaError: string | null;
  generateError: string | null;
  isGenerating: boolean;
  retryCountdown: number | null;
  streamTruncated: boolean;
  geoSignalsBefore: GeoSignals | null;
  geoSignalsAfter: GeoSignals | null;
};

const emptyOutput = (): BundleOutput => ({
  content: '', analysis: '', schema: '',
  schemaStatus: 'idle', schemaError: null,
  generateError: null, isGenerating: false,
  retryCountdown: null, streamTruncated: false,
  geoSignalsBefore: null, geoSignalsAfter: null,
});

// ─── Output parsing (same regexes as StepProduction) ──────────────────────────

const ANALYSIS_REGEX = /={2,}\s*GEO_ANALYSIS\s*={2,}/i;
const END_REGEX = /={2,}\s*END\s*={2,}/i;
const MAX_STREAM_CHARS = 18000;

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

// ─── Local source type (extends PersistedRagSource with UI-only preview) ─────

type LocalSource = PersistedRagSource & { preview?: string };

// ─── Component ────────────────────────────────────────────────────────────────

type InputTab = 'text' | 'url' | 'file';

const StandaloneMode: React.FC<{ t: TranslationKeys }> = ({ t }) => {
  const uiLang = useWorkflowStore(state => state.uiLang);

  // ── Input state ──────────────────────────────────────────────────────────
  const [inputTab, setInputTab] = useState<InputTab>('text');
  const [pastedText, setPastedText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [sources, setSources] = useState<LocalSource[]>([]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const [directive, setDirective] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('blog');
  const [selectedFormat, setSelectedFormat] = useState('long_form');
  const [selectedMethods, setSelectedMethods] = useState<GeoMethodId[]>(
    RECOMMENDED_COMBOS.semiconductor_technical.ids
  );

  // ── Output state ─────────────────────────────────────────────────────────
  const [output, setOutput] = useState<BundleOutput>(emptyOutput());
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // ── Source helpers ────────────────────────────────────────────────────────

  const addSource = (source: LocalSource) => {
    setSources(prev => [...prev, source]);
  };

  const removeSource = (idx: number) => {
    setSources(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddPastedText = () => {
    const text = pastedText.trim();
    if (!text) return;
    addSource({
      type: 'file',
      name: `Pasted text (${text.slice(0, 40).replace(/\n/g, ' ')}${text.length > 40 ? '…' : ''})`,
      content: text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      preview: text.replace(/\s+/g, ' ').slice(0, 120),
    });
    setPastedText('');
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setIsUrlLoading(true);
    setUrlError(null);
    try {
      const data = await fetchUrlContent(urlInput);
      // Use body (header-stripped) text for the preview so users can verify
      const previewText = (data.body || data.content).replace(/\s+/g, ' ').slice(0, 120);
      addSource({
        type: 'url',
        name: data.title || urlInput,
        content: data.content,
        wordCount: data.wordCount,
        preview: previewText,
      });
      setUrlInput('');
    } catch (err: any) {
      setUrlError(err.message || t.standalone.urlFetchError);
    } finally {
      setIsUrlLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        addSource({
          type: 'file',
          name: file.name,
          content: text,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          preview: text.replace(/\s+/g, ' ').slice(0, 120),
        });
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  // ── Core: optimize ────────────────────────────────────────────────────────

  const handleOptimize = async () => {
    const fullContent = sources.map(s => s.content).join('\n\n---\n\n');
    if (!fullContent.trim()) return;

    const geoSignalsBefore = computeGeoSignals(fullContent);
    setOutput({ ...emptyOutput(), isGenerating: true, geoSignalsBefore });

    let accumulated = '';
    try {
      const stream = await withRetry(
        () => optimizeContentForGeoStream(
          fullContent, selectedMethods, selectedPlatform, selectedFormat, directive, uiLang
        ),
        (s) => setOutput(prev => ({ ...prev, retryCountdown: s > 0 ? s : null }))
      );

      for await (const chunk of stream) {
        const text = chunk || '';
        if (accumulated.length + text.length > MAX_STREAM_CHARS) {
          accumulated += text.slice(0, MAX_STREAM_CHARS - accumulated.length);
          const parsed = parseModelOutput(accumulated);
          setOutput(prev => ({ ...prev, content: parsed.content, analysis: parsed.analysis, streamTruncated: true }));
          break;
        }
        accumulated += text;
        const parsed = parseModelOutput(accumulated);
        setOutput(prev => ({ ...prev, content: parsed.content, analysis: parsed.analysis }));
      }

      setOutput(prev => ({ ...prev, retryCountdown: null }));

      const { content } = parseModelOutput(accumulated);
      if (content.trim()) {
        const geoSignalsAfter = computeGeoSignals(content);
        setOutput(prev => ({ ...prev, geoSignalsAfter, isGenerating: false }));

        setOutput(prev => ({ ...prev, schemaStatus: 'loading' }));
        withRetry(
          () => generateJsonLdSchema(content, uiLang, selectedPlatform)
            .then(schema => setOutput(prev => ({ ...prev, schema: schema || '', schemaStatus: 'success' })))
        ).catch(err =>
          setOutput(prev => ({ ...prev, schemaStatus: 'error', schemaError: err?.message || 'Schema failed' }))
        );
      }
    } catch (err: any) {
      let userMessage = err?.message || 'Optimization failed. Please check your API key.';
      try {
        const raw = JSON.parse(err?.message || '{}');
        if (raw?.error?.code === 429 || raw?.error?.status === 'RESOURCE_EXHAUSTED') {
          userMessage = (t.production as any).quotaError;
        } else if (raw?.error?.message) {
          userMessage = raw.error.message.split('\n')[0];
        }
      } catch { /* intentional */ }
      setOutput(prev => ({ ...prev, generateError: userMessage, retryCountdown: null, isGenerating: false }));
    }
  };

  // ── Post-processing ────────────────────────────────────────────────────────

  const triggerSchemaRegen = (text: string) => {
    if (!text) return;
    setOutput(prev => ({ ...prev, schemaStatus: 'loading' }));
    generateJsonLdSchema(text, uiLang, selectedPlatform)
      .then(schema => setOutput(prev => ({ ...prev, schema: schema || '', schemaStatus: 'success' })))
      .catch(err => setOutput(prev => ({ ...prev, schemaStatus: 'error', schemaError: err?.message })));
  };

  const handleHumanize = async () => {
    if (!output.content) return;
    setIsHumanizing(true);
    try {
      const human = await humanizeContent(output.content, uiLang);
      setOutput(prev => ({ ...prev, content: human || '' }));
      triggerSchemaRegen(human || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsHumanizing(false);
    }
  };

  const handleTranslate = async (lang: string) => {
    if (!output.content) return;
    setIsTranslating(true);
    try {
      const trans = await translateContent(output.content, lang);
      setOutput(prev => ({ ...prev, content: trans || '' }));
      triggerSchemaRegen(trans || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  // ── Tab helpers ───────────────────────────────────────────────────────────

  const tabClass = (tab: InputTab) =>
    `px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-t-lg transition-all border-b-2 ${
      inputTab === tab
        ? 'text-[#03234b] border-[#3cb4e6] bg-white'
        : 'text-slate-400 border-transparent hover:text-[#03234b] hover:bg-slate-50'
    }`;

  const canOptimize = sources.length > 0 && !output.isGenerating;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-20">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-[#ffd200] p-3 rounded-xl">
            <Zap className="w-5 h-5 text-[#03234b]" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#03234b]">
              {t.standalone.pageTitle}
            </h2>
            <p className="text-[#8191a5] text-[10px] font-black uppercase tracking-[0.2em]">
              {t.standalone.pageSubtitle}
            </p>
          </div>
          <div className="ml-auto hidden lg:flex items-center gap-2">
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
              <ShieldCheck className="w-4 h-4" /> Zero Hallucination
            </div>
          </div>
        </div>
      </div>

      {/* ── Body grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left panel ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Content Source Panel */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="bg-[#03234b] px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#ffd200]" /> {t.standalone.contentSourceTitle}
              </h3>
              <span className="bg-[#3cb4e6] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {sources.length} {t.standalone.sourceCount}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50 px-4 pt-3 gap-1">
              <button className={tabClass('text')} onClick={() => setInputTab('text')}>
                <AlignLeft className="inline w-3 h-3 mr-1" />{t.standalone.textTab}
              </button>
              <button className={tabClass('url')} onClick={() => setInputTab('url')}>
                <Globe className="inline w-3 h-3 mr-1" />{t.standalone.urlTab}
              </button>
              <button className={tabClass('file')} onClick={() => setInputTab('file')}>
                <Upload className="inline w-3 h-3 mr-1" />{t.standalone.fileTab}
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Paste Text Tab */}
              {inputTab === 'text' && (
                <div className="space-y-3">
                  <textarea
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder={t.standalone.textPlaceholder}
                    className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-[#03234b] placeholder-slate-400 focus:bg-white focus:border-[#3cb4e6] focus:ring-4 focus:ring-[#3cb4e6]/10 outline-none transition-all resize-none"
                  />
                  <button
                    onClick={handleAddPastedText}
                    disabled={!pastedText.trim()}
                    className="w-full py-2.5 bg-[#3cb4e6] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#0a3d7a] disabled:opacity-30 transition-all"
                  >
                    {t.standalone.addTextBtn}
                  </button>
                </div>
              )}

              {/* URL Tab */}
              {inputTab === 'url' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#3cb4e6] outline-none transition-all"
                        placeholder="https://..."
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                      />
                    </div>
                    <button
                      onClick={handleAddUrl}
                      disabled={isUrlLoading || !urlInput.trim()}
                      className="px-4 py-2 bg-[#3cb4e6] text-white rounded-xl hover:bg-[#0a3d7a] disabled:opacity-30 transition-all shadow-md"
                    >
                      {isUrlLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <LinkIcon className="w-4 h-4" />}
                    </button>
                  </div>
                  {urlError && (
                    <p className="text-[10px] text-red-500 font-bold px-1">⚠️ {urlError}</p>
                  )}
                </div>
              )}

              {/* File Upload Tab */}
              {inputTab === 'file' && (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl py-8 hover:bg-slate-50 hover:border-[#3cb4e6]/30 cursor-pointer transition-all group">
                  <Upload className="w-6 h-6 text-slate-300 group-hover:text-[#3cb4e6] mb-2 transition-colors" />
                  <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-[#03234b]">
                    Upload .txt / .md / .pdf
                  </span>
                  <input type="file" className="hidden" multiple accept=".txt,.md,.pdf" onChange={handleFileUpload} />
                </label>
              )}

              {/* Source List */}
              {sources.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Added Sources</div>
                  {sources.map((s, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${s.type === 'url' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                          {s.type === 'url' ? <Globe className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#03234b] truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase">{s.wordCount} words</p>
                        </div>
                        <button
                          onClick={() => removeSource(idx)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {s.preview && (
                        <p className="text-[10px] text-slate-500 leading-relaxed pl-9 line-clamp-2">
                          {s.preview}…
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optimization Directive */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-5 space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Target className="w-3 h-3 text-[#3cb4e6]" /> {t.standalone.directiveLabel}
            </label>
            <textarea
              value={directive}
              onChange={e => setDirective(e.target.value)}
              placeholder={t.standalone.directivePlaceholder}
              className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-[#03234b] placeholder-slate-400 focus:bg-white focus:border-[#3cb4e6] focus:ring-4 focus:ring-[#3cb4e6]/10 outline-none transition-all resize-none"
            />
          </div>

          {/* Platform + Format + GEO Methods */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-6">
            <PlatformSelector
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />

            {/* GEO Method Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-[#ffd200]" /> GEO Methods
                  <span className="text-slate-300 font-medium normal-case tracking-normal">(max 3)</span>
                </label>
                {selectedMethods.length > 0 && (
                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    +{(() => {
                      const lifts = selectedMethods.slice(0, 3).map(id => parseInt(GEO_METHODS.find(m => m.id === id)?.liftEstimate || '10'));
                      return Math.round(lifts.reduce((acc, l) => acc + Math.sqrt(l * 10), 0));
                    })()}% lift est.
                  </span>
                )}
              </div>

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
            </div>

            {/* Optimize Button */}
            <button
              onClick={handleOptimize}
              disabled={!canOptimize}
              title={sources.length === 0 ? t.standalone.noSourceDisabled : undefined}
              className={`w-full font-black text-sm uppercase py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg group ${
                output.retryCountdown
                  ? 'bg-amber-500 text-white cursor-wait'
                  : 'bg-[#03234b] text-white hover:bg-[#0a3d7a] disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {output.retryCountdown ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {(t.production as any).rateLimitPrefix} {output.retryCountdown}s</>
              ) : output.isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t.standalone.optimizingBtn}</>
              ) : (
                <><Zap className="w-5 h-5 text-[#ffd200] group-hover:scale-110 transition-transform" /> {t.standalone.optimizeBtn}</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right panel: output ── */}
        <div className="lg:col-span-8">
          {output.generateError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <p className="text-red-800 font-black text-xs uppercase tracking-widest">Optimization Failed</p>
                <p className="text-red-700 text-sm mt-1 font-mono">{output.generateError}</p>
              </div>
            </div>
          )}

          {output.streamTruncated && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
              <p className="text-xs font-bold text-amber-800 leading-relaxed">
                输出已达到安全长度上限（18,000 字符）并自动截断。如需优化更长内容，请分段提交。
              </p>
            </div>
          )}

          <ProductOutputTabs
            content={output.content}
            analysis={output.analysis}
            schema={output.schema}
            schemaStatus={output.schemaStatus}
            schemaError={output.schemaError}
            onHumanize={handleHumanize}
            onTranslate={handleTranslate}
            isHumanizing={isHumanizing}
            isTranslating={isTranslating}
            t={t}
            geoSignalsBefore={output.geoSignalsBefore}
            geoSignalsAfter={output.geoSignalsAfter}
          />
        </div>
      </div>
    </div>
  );
};

export default StandaloneMode;
