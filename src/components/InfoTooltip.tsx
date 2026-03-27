import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center ml-2 align-middle"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <HelpCircle className="w-4 h-4 text-slate-400 hover:text-[#3cb4e6] transition-colors cursor-help" />
      
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl pointer-events-none animate-in fade-in slide-in-from-bottom-1 font-normal normal-case tracking-normal">
          <div className="relative leading-relaxed">
            {content}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
