import React from 'react';
import { Eye, FileCode, BarChart3, Copy, Download, Sparkles, Languages, Check, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  analysis: string;
  schema: string;
  schemaStatus: 'idle' | 'loading' | 'success' | 'error';
  schemaError: string | null;
  onHumanize: () => void;
  onTranslate: (lang: string) => void;
  isHumanizing: boolean;
  isTranslating: boolean;
  t: any;
}

const ProductOutputTabs: React.FC<Props> = ({ 
  content, analysis, schema, 
  schemaStatus, schemaError,
  onHumanize, onTranslate, 
  isHumanizing, isTranslating, t 
}) => {
  const [activeTab, setActiveTab] = React.useState<'preview' | 'analysis' | 'schema'>('preview');
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = activeTab === 'schema' ? schema : activeTab === 'analysis' ? analysis : content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[700px] animate-fade-in relative">
      {/* Tab Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-white text-[#03234b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-white text-[#03234b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BarChart3 className="w-4 h-4" /> Analysis
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'schema' ? 'bg-white text-[#03234b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FileCode className="w-4 h-4" /> JSON-LD
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'preview' && (
            <>
              <button
                onClick={onHumanize}
                disabled={isHumanizing || !content}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#03234b] to-[#0a3d7a] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100"
              >
                {isHumanizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#ffd200]" />}
                {t.production.humanizeBtn}
              </button>
              
              <div className={`relative flex items-center gap-2 px-4 py-2 bg-slate-100 text-[#03234b] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(isTranslating || !content) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer'}`}>
                <Languages className="w-3.5 h-3.5" /> 
                {isTranslating ? t.production.translating : t.production.translateBtn}
                <select 
                  disabled={isTranslating || !content}
                  onChange={(e) => {
                    if(e.target.value) {
                      onTranslate(e.target.value);
                      e.target.value = ''; // Reset select state
                    }
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="">Select Target...</option>
                  <option value="zh">中文 (Chinese)</option>
                  <option value="en">English (English)</option>
                  <option value="jp">日本語 (Japanese)</option>
                  <option value="kr">한국어 (Korean)</option>
                </select>
              </div>
            </>
          )}

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <button
            onClick={handleCopy}
            className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-[#3cb4e6]/10 hover:text-[#3cb4e6] transition-all relative"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content Viewport */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 custom-scrollbar">
        {activeTab === 'preview' && (
          <article className="prose prose-slate max-w-none prose-base prose-p:mb-5 prose-p:leading-loose prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:mt-10 prose-headings:mb-4 prose-h2:text-xl prose-h3:text-lg prose-a:text-[#3cb4e6] prose-code:bg-slate-100 prose-pre:bg-[#03234b] prose-pre:text-white prose-pre:rounded-2xl prose-pre:shadow-lg prose-li:mb-2 prose-ul:my-4 prose-ol:my-4 prose-strong:text-[#03234b] prose-blockquote:border-[#3cb4e6] prose-blockquote:bg-slate-50 prose-blockquote:rounded-xl prose-hr:my-10">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || t.production.emptyHint || 'Content will appear here after generation...'}</ReactMarkdown>
          </article>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <article className="prose prose-slate max-w-none prose-base prose-p:mb-5 prose-p:leading-loose prose-headings:font-black prose-headings:text-[#03234b] prose-headings:uppercase prose-headings:tracking-tight prose-headings:mt-8 prose-headings:mb-4 prose-h2:text-xl prose-h3:text-lg prose-li:mb-2 prose-ul:my-4 prose-ol:my-4 prose-strong:text-[#03234b] prose-blockquote:border-[#3cb4e6] prose-blockquote:bg-blue-50 prose-blockquote:rounded-xl prose-hr:my-10">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis || t.production.emptyHint || 'Strategic analysis not found in model output.'}</ReactMarkdown>
            </article>
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="space-y-4 h-full flex flex-col">
            {schemaStatus === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Generating JSON-LD Schema...</p>
              </div>
            )}
            
            {schemaStatus === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center text-red-500">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">{schemaError || 'Schema Generation Failed'}</p>
              </div>
            )}

            {schemaStatus === 'success' && (
              <pre className="flex-1 bg-slate-900 text-emerald-400 p-6 rounded-2xl font-mono text-[11px] overflow-auto shadow-inner">
                {schema}
              </pre>
            )}

            {schemaStatus === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <FileCode className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Schema appears after generation</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-white px-6 py-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{(t.production as any).footerNote || 'Verified Grounding Content • RAG Hybrid Strategy'}</span>
        </div>
        <button className="flex items-center gap-1 text-[9px] font-black text-[#3cb4e6] uppercase tracking-widest hover:underline">
          <Download className="w-3 h-3" /> {t.production.export}
        </button>
      </div>
    </div>
  );
};

export default ProductOutputTabs;
