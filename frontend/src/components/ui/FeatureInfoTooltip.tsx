import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { useTransliterate } from './Transliterate';

interface FeatureInfoTooltipProps {
  content: string;
  className?: string;
}

export function FeatureInfoTooltip({ content, className = '' }: FeatureInfoTooltipProps) {
  const transliterate = useTransliterate();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        left: rect.left + rect.width / 2,
        top: rect.top - 8 // 8px above the icon
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div 
      className={`relative inline-flex items-center ml-1.5 cursor-pointer align-middle ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      ref={iconRef}
    >
      <div className={`transition-colors p-1 -m-1 ${isOpen ? 'text-[#39ff14]' : 'text-gray-500'}`}>
        <Info size={13} />
      </div>
      
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[100000] w-[220px] p-2.5 rounded shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            background: 'rgba(8, 13, 22, 0.98)',
            border: '1px solid rgba(57, 255, 20, 0.3)',
            color: 'rgba(230, 237, 243, 0.9)',
            fontSize: "calc(10px * var(--font-scale))",
            fontFamily: 'var(--font-mono)',
            textTransform: 'none',
            letterSpacing: '0.05em',
            lineHeight: '1.4',
            wordWrap: 'break-word',
            whiteSpace: 'normal',
            textAlign: 'left',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8), 0 0 10px rgba(57, 255, 20, 0.1)',
            backdropFilter: 'blur(12px)'
          }}
        >
          {transliterate(content)}
        </div>,
        document.body
      )}
    </div>
  );
}
