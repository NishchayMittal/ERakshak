import React from "react";
import { useTranslation } from "react-i18next";
import Sanscript from "@indic-transliteration/sanscript";

interface TransliterateProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

const normalizeForITRANS = (text: string) => {
  if (!text) return text;
  return text.split(' ').map(word => {
    // 1. Lowercase for uniform processing, except first letter for aesthetics if needed, 
    // but itrans is case-sensitive! (I = ई, i = इ, U = ऊ, u = उ).
    // Better to map specific common English phonetics to ITRANS equivalents.
    let w = word.toLowerCase();
    
    // Map common english vowels to ITRANS
    w = w.replace(/ee/g, 'I');
    w = w.replace(/oo/g, 'U');
    w = w.replace(/au/g, 'au'); // औ
    
    // Fix endings: if a word ends in a consonant (and not a halant-intended word), append 'a'
    // so it doesn't render with a halant. (e.g. Rahul -> Rahula -> राहुल)
    if (/[bcdfghjklmnpqrstvwxyz]$/i.test(w)) {
        w += 'a';
    }
    
    return w;
  }).join(' ');
};

export function useTransliterate() {
  const { i18n } = useTranslation();

  return (text: string) => {
    if (!text || typeof text !== "string") return text;
    const lang = i18n.language || "en";
    const normalized = normalizeForITRANS(text);

    if (lang === "hi") {
      return Sanscript.t(normalized, "itrans", "devanagari");
    } else if (lang === "gu") {
      return Sanscript.t(normalized, "itrans", "gujarati");
    }
    return text;
  };
}

export function Transliterate({
  children,
  className,
  style,
}: TransliterateProps) {
  const transliterate = useTransliterate();
  const transliteratedText = transliterate(children);

  return (
    <span className={className} style={style}>
      {transliteratedText}
    </span>
  );
}

// Utility hook for non-JSX contexts
// eslint-disable-next-line react-refresh/only-export-components
export function useTransliteration() {
  const { i18n } = useTranslation();

  return (text: string) => {
    if (!text || typeof text !== "string") return text;

    const lang = i18n.language || "en";
    const normalized = normalizeForITRANS(text);
    
    if (lang === "hi") return Sanscript.t(normalized, "itrans", "devanagari");
    if (lang === "gu") return Sanscript.t(normalized, "itrans", "gujarati");
    return text;
  };
}
