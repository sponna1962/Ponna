'use client';

// LanguageProvider — implements §4.5 (UI toggle between Tamil and English).
// Wraps the whole app (see layout.tsx) so every page reads the same language
// state via useLanguage(). Selection persists in localStorage so it's
// remembered across visits without needing a logged-in user.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Lang, translations } from './translations';

const STORAGE_KEY = 'ponna_lang';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
t: (typeof translations)[Lang];
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ta'); // Tamil is the default per requirements ("launch mainly with Tamil")

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Lang | null) : null;
    if (saved === 'ta' || saved === 'en') setLangState(saved);
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
