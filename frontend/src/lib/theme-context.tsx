'use client';

// Dark Mode (finalized requirement — world-class polish, item 4).
// Deliberately implemented via CSS custom properties rather than
// touching every page's inline styles: brand-theme.tsx's COLORS object
// now resolves to var(--color-xxx) instead of hardcoded hex values, and
// this provider just flips which set of variable definitions is active
// (data-theme="dark" on <html>). Every existing page that already does
// `style={{ color: COLORS.ink }}` picks up the correct theme automatically
// -- no page-by-page changes needed.

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'light',
  toggleTheme: () => {},
});

const STORAGE_KEY = 'ponna-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
