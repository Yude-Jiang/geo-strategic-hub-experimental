import React, { useState, useEffect } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';

export const GEO_GEMINI_KEY = 'geo_gemini_api_key';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  t: any;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, t }) => {
  const [inputKey, setInputKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [storedKey, setStoredKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const k = localStorage.getItem(GEO_GEMINI_KEY) || '';
      setInputKey(k);
      setStoredKey(k);
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const s = t.settings;

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (trimmed) {
      localStorage.setItem(GEO_GEMINI_KEY, trimmed);
      setStoredKey(trimmed);
    } else {
      localStorage.removeItem(GEO_GEMINI_KEY);
      setStoredKey('');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    localStorage.removeItem(GEO_GEMINI_KEY);
    setInputKey('');
    setStoredKey('');
    setSaved(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md mx-4 rounded-2xl shadow-2xl border border-slate-100 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="bg-[#03234b] p-1.5 rounded-lg">
              <Key className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[#03234b]">{s.modalTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-[#03234b] hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.keyStatus}</span>
            {storedKey ? (
              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                <Check className="w-3 h-3" /> {s.keySet}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-black text-red-400">
                <AlertCircle className="w-3 h-3" /> {s.keyMissing}
              </span>
            )}
          </div>

          {/* Input */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              {s.geminiKeyLabel}
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              placeholder={s.geminiKeyPlaceholder}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3cb4e6]/30 focus:border-[#3cb4e6] font-mono"
            />
          </div>

          {/* Hint */}
          <p className="text-[10px] text-slate-400 leading-relaxed">{s.hint}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            {s.clearBtn}
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-[#03234b] text-white hover:bg-[#0a3d7a]'
            }`}
          >
            {saved ? <><Check className="w-3 h-3" /> {s.savedMsg}</> : s.saveBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
