import React from "react";
import { useTranslation } from "react-i18next";
import Sanscript from "@indic-transliteration/sanscript";

interface TransliterateProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Transliterate({
  children,
  className,
  style,
}: TransliterateProps) {
  const { i18n } = useTranslation();

  const getTransliteratedText = (text: string) => {
    if (!text || typeof text !== "string") return text;

    // Use current language or fallback to 'en'
    const lang = i18n.language || "en";

    if (lang === "hi") {
      return Sanscript.t(text, "itrans", "devanagari");
    } else if (lang === "gu") {
      return Sanscript.t(text, "itrans", "gujarati");
    }

    return text; // Default: 'en' or unsupported language
  };

  const transliteratedText = getTransliteratedText(children);

  return (
    <span className={className} style={style}>
      {transliteratedText}
    </span>
  );
}

// Utility hook for non-JSX contexts
export function useTransliteration() {
  const { i18n } = useTranslation();

  return (text: string) => {
    if (!text || typeof text !== "string") return text;

    const lang = i18n.language || "en";
    if (lang === "hi") return Sanscript.t(text, "itrans", "devanagari");
    if (lang === "gu") return Sanscript.t(text, "itrans", "gujarati");
    return text;
  };
}
