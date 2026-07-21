import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'hi', label: 'हिंदी', flag: 'हिं' },
  { code: 'gu', label: 'ગુજરાતી', flag: 'ગુ' }
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold tracking-wider text-gray-300 hover:text-[#39ff14] hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
        title="Change Language"
      >
        <Globe size={12} />
        <span>{current.flag}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-[#0a0f18]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-[9999] min-w-[140px]">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-[10px] font-mono tracking-wider flex items-center gap-2 transition-all ${
                i18n.language === lang.code
                  ? 'text-[#39ff14] bg-[#39ff14]/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="font-bold text-[11px]">{lang.flag}</span>
              <span>{lang.label}</span>
              {i18n.language === lang.code && <span className="ml-auto text-[#39ff14]">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
