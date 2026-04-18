import React from 'react';
import { useWorkflowStore } from './store/workflowStore';
import type { Ecosystem } from './store/workflowStore';
import type { UILang } from './i18n/translations';
import { translations } from './i18n/translations';
import { Globe, Target, BookOpen, PenTool, Cpu, Languages, Zap } from 'lucide-react';
import StepDiagnosis from './components/StepDiagnosis';
import StepStrategy from './components/StepStrategy';
import StepProduction from './components/StepProduction';
import StandaloneMode from './components/StandaloneMode';
import ChatAssistant from './components/ChatAssistant';

const App: React.FC = () => {
  const { currentStep, targetEcosystem, setTargetEcosystem, setStep, diagnosisConfirmed, strategyConfirmed, uiLang, setUiLang, standaloneMode, setStandaloneMode } = useWorkflowStore();
  const t = translations[uiLang];

  const ecosystems: { id: Ecosystem; label: string }[] = [
    { id: 'global', label: t.ecosystems.global },
    { id: 'cn',     label: t.ecosystems.cn },
    { id: 'jp',     label: t.ecosystems.jp },
    { id: 'kr',     label: t.ecosystems.kr },
  ];

  const uiLangs: { id: UILang; label: string }[] = [
    { id: 'zh', label: '中文' },
    { id: 'en', label: 'EN' },
    { id: 'jp', label: '日本語' },
  ];

  const canGoToStep = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return diagnosisConfirmed;
    if (step === 3) return strategyConfirmed;
    return false;
  };

  const handleStepClick = (step: 1 | 2 | 3) => {
    if (canGoToStep(step)) setStep(step);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-[#03234b] text-white shadow-xl z-20 sticky top-0">
        <div className="max-w-[98%] mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="bg-[#3cb4e6] p-1.5 rounded-sm shadow-inner">
              <Cpu className="w-5 h-5 text-[#03234b]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-black tracking-tight leading-tight uppercase">{t.appTitle}</h1>
              <p className="text-[9px] text-[#8191a5] font-bold uppercase tracking-[0.15em]">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Standalone Mode Toggle */}
            <button
              onClick={() => setStandaloneMode(!standaloneMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest border transition-all ${
                standaloneMode
                  ? 'bg-[#ffd200] text-[#03234b] border-[#ffd200]'
                  : 'bg-[#2a4060] text-white/70 border-[#8191a5]/30 hover:text-white hover:border-white/30'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {standaloneMode ? t.standalone.backToWizard : t.standalone.modeLabel}
            </button>

            {/* UI Language Switcher */}
            <div className="flex items-center bg-[#2a4060] rounded p-0.5 border border-[#8191a5]/20">
              <Languages className="w-3.5 h-3.5 text-[#8191a5] mx-1.5" />
              {uiLangs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setUiLang(l.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                    uiLang === l.id
                      ? 'bg-white text-[#03234b] shadow-sm'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Ecosystem Switcher */}
            <div className="flex items-center bg-[#425a78] rounded p-0.5 border border-[#8191a5]/30">
              <div className="px-2 text-[10px] font-black text-[#c0c8d2] uppercase flex items-center gap-1 border-r border-[#8191a5]/30 mr-0.5 pr-2">
                <Globe className="w-3 h-3" /> {t.ecosystemLabel}
              </div>
              {ecosystems.map((eco) => (
                <button
                  key={eco.id}
                  onClick={() => setTargetEcosystem(eco.id as Ecosystem)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                    targetEcosystem === eco.id
                      ? 'bg-[#ffd200] text-[#03234b] shadow-md scale-105'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {eco.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Wizard Progress Bar — hidden in standalone mode */}
      {!standaloneMode && (
        <div className="bg-white border-b border-slate-200 py-5 shadow-sm z-10 relative">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-[16.6%] right-[16.6%] h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 left-[16.6%] h-0.5 bg-[#3cb4e6] -translate-y-1/2 z-0 transition-all duration-700 ease-in-out"
                style={{ width: `${(currentStep - 1) * 33.3}%` }}
              />
              {[
                { num: 1 as const, label: t.steps.diagnosis, icon: Target },
                { num: 2 as const, label: t.steps.strategy, icon: BookOpen },
                { num: 3 as const, label: t.steps.production, icon: PenTool },
              ].map((step) => {
                const isActive = currentStep === step.num;
                const isPast = currentStep > step.num;
                const canClick = canGoToStep(step.num);
                return (
                  <div key={step.num} className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-3">
                    <button
                      onClick={() => handleStepClick(step.num)}
                      disabled={!canClick && !isActive}
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                        isActive ? 'bg-[#03234b] text-white shadow-lg ring-4 ring-[#3cb4e6]/20 scale-110'
                        : isPast  ? 'bg-[#3cb4e6] text-white hover:bg-[#2090bf] cursor-pointer'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <step.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                    </button>
                    <span className={`text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${
                      isActive ? 'text-[#03234b]' : isPast ? 'text-[#3cb4e6]' : 'text-slate-300'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[95%] mx-auto px-4 py-8">
        {standaloneMode
          ? <StandaloneMode t={t} />
          : <>
              {currentStep === 1 && <StepDiagnosis t={t} />}
              {currentStep === 2 && <StepStrategy t={t} />}
              {currentStep === 3 && <StepProduction t={t} />}
            </>
        }
      </main>

      <footer className="border-t border-slate-200 py-6 text-center bg-white">
        <p className="text-[10px] text-[#8191a5] font-bold uppercase tracking-[0.15em]">{t.footer}</p>
        <p className="text-[10px] text-[#c0c8d2] mt-1 tracking-wide">Created by <a href="mailto:Yude.jiang@st.com" className="hover:text-[#3cb4e6] transition-colors">Yude.jiang@st.com</a></p>
      </footer>
      
      <ChatAssistant />
    </div>
  );
};

export default App;
