import React from 'react';
import { X, Download, Loader2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  isGenerating: boolean;
  t: any;
}

const ReportModal: React.FC<Props> = ({ isOpen, onClose, content, isGenerating, t }) => {
  if (!isOpen) return null;

  const p = t.production;

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `GEO_Report_${date}.md`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white w-full max-w-4xl mx-4 rounded-3xl shadow-2xl border border-slate-100 flex flex-col animate-fade-in"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#ffd200] p-2 rounded-xl">
              <FileText className="w-4 h-4 text-[#03234b]" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[#03234b]">
              {p.reportTitle}
            </h3>
            {isGenerating && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-[#3cb4e6] uppercase tracking-widest ml-2">
                <Loader2 className="w-3 h-3 animate-spin" /> {p.reportGenerating}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-[#03234b] hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
          {!content && isGenerating && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest">{p.reportGenerating}</p>
            </div>
          )}
          {content && (
            <article className="prose prose-slate max-w-none prose-lg prose-p:mb-6 prose-p:leading-[1.8] prose-headings:font-black prose-headings:text-[#03234b] prose-headings:tracking-tight prose-h1:text-2xl prose-h1:mb-2 prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-base prose-a:text-[#3cb4e6] prose-table:text-sm prose-th:bg-slate-50 prose-th:font-black prose-strong:text-[#03234b] prose-blockquote:border-[#3cb4e6] prose-blockquote:bg-blue-50 prose-blockquote:rounded-xl prose-hr:my-10 prose-li:mb-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              © 2026 GEO Strategic Hub • Yude.jiang@st.com
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#03234b] border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              {p.reportCloseBtn}
            </button>
            <button
              onClick={handleDownload}
              disabled={!content || isGenerating}
              className="flex items-center gap-2 px-5 py-2 bg-[#03234b] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#0a3d7a] disabled:opacity-30 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> {p.reportDownloadBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
