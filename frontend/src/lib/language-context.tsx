'use client';

// LanguageProvider — the app's UI language is fixed to English everywhere
// (finalized requirement). This is a SEPARATE thing from Practice Setup's
// own "Language" step, which chooses which language the QUESTION CONTENT
// is shown in (Tamil or English) — that stays a real per-student choice,
// stored in their Practice Preference, completely untouched by this file.
//
// useLanguage()/t still exists site-wide so every page keeps using the
// same `t.xxx` calls without a large rewrite — it just always resolves to
// the English translations now. setLang is kept as a no-op (rather than
// removed) so nothing that still calls it breaks; there is no UI control
// left anywhere that calls it.

import { createContext, useContext, ReactNode } from 'react';
import { Lang, translations } from './translations';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (typeof translations)[Lang];
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const value: LanguageContextValue = { lang: 'en', setLang: () => {}, t: translations.en };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

