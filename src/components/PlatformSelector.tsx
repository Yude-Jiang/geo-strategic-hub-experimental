import React from 'react';
import { ChevronDown, Globe, Share2, BookOpen, Code, Terminal, MessageSquare, Layout, MessageCircle, FileText, AlignLeft, Layers, Columns } from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

const PLATFORMS: Platform[] = [
  { id: 'zhihu', name: 'Zhihu (知乎)', desc: 'High-authority technical article', icon: <Share2 />, color: 'text-blue-500' },
  { id: 'wechat', name: 'WeChat (微信)', desc: 'Vertical ecosystem newsletter', icon: <MessageCircle />, color: 'text-emerald-500' },
  { id: 'github', name: 'GitHub MD', desc: 'Technical documentation & README', icon: <Code />, color: 'text-slate-800' },
  { id: 'xiaohongshu', name: 'XHS (小红书)', desc: 'Concise tech lifestyle/notes', icon: <Layout />, color: 'text-red-500' },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Professional global B2B content', icon: <Globe />, color: 'text-blue-700' },
  { id: 'reddit', name: 'Reddit / Forum', desc: 'Community-driven tech discussion', icon: <MessageSquare />, color: 'text-orange-500' },
  { id: 'blog', name: 'Tech Blog', desc: 'Detailed technical analysis', icon: <BookOpen />, color: 'text-indigo-500' },
];

const FORMATS: Platform[] = [
  { id: 'long_form', name: '📝 Deep Dive (长文详析/教程)', desc: '>2000 words. Comprehensive and logic-heavy.', icon: <AlignLeft />, color: 'text-slate-600' },
  { id: 'short_social', name: '⚡ Social Post (短帖/引流)', desc: '<500 words. High impact, scannable.', icon: <FileText />, color: 'text-amber-500' },
  { id: 'comparison', name: '📊 Matrix/Review (横评/避坑)', desc: 'Structured Pros/Cons or Tables.', icon: <Columns />, color: 'text-indigo-600' },
  { id: 'api_docs', name: '🔧 Dev Tutorial (开发者指南)', desc: 'Code-first API or architecture guide.', icon: <Terminal />, color: 'text-emerald-500' },
  { id: 'news', name: '📰 Newsletter (快报/PR)', desc: 'Polished B2B corporate update.', icon: <Layers />, color: 'text-blue-400' },
];

interface Props {
  selectedPlatform: string;
  onPlatformChange: (id: string) => void;
  selectedFormat: string;
  onFormatChange: (id: string) => void;
}

const PlatformSelector: React.FC<Props> = ({ selectedPlatform, onPlatformChange, selectedFormat, onFormatChange }) => {
  const pData = PLATFORMS.find(p => p.id === selectedPlatform) || PLATFORMS[0];
  const fData = FORMATS.find(f => f.id === selectedFormat) || FORMATS[0];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="relative group flex-1">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Distribution Target (环境阵地)</div>
        <div className="relative">
          <select
            value={selectedPlatform}
            onChange={(e) => onPlatformChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-10 py-4 text-sm font-black text-[#03234b] appearance-none cursor-pointer hover:border-[#3cb4e6] hover:bg-white transition-all outline-none"
          >
            {PLATFORMS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${pData.color}`}>
            {React.cloneElement(pData.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
          </div>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none group-hover:text-[#3cb4e6] transition-colors" />
        </div>
        <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">{pData.desc}</p>
      </div>

      <div className="relative group flex-1">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Content Format (表达载体)</div>
        <div className="relative">
          <select
            value={selectedFormat}
            onChange={(e) => onFormatChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-10 py-4 text-sm font-black text-[#03234b] appearance-none cursor-pointer hover:border-[#3cb4e6] hover:bg-white transition-all outline-none"
          >
            {FORMATS.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${fData.color}`}>
            {React.cloneElement(fData.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
          </div>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none group-hover:text-[#3cb4e6] transition-colors" />
        </div>
        <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">{fData.desc}</p>
      </div>
    </div>
  );
};

export default PlatformSelector;
