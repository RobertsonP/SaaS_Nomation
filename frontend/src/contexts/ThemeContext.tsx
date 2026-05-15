import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StorageKeys, storage } from '../lib/storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or default to light
    const savedTheme = storage.get(StorageKeys.THEME_PREFERENCE);
    return (savedTheme as Theme) || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;

    // Tailwind's class-based dark mode (`.dark` class) — used by existing pages.
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Verdant design tokens key off `data-theme` (see styles/verdant.css).
    // Both selectors stay in sync during the redesign rollout.
    root.setAttribute('data-theme', theme);

    storage.set(StorageKeys.THEME_PREFERENCE, theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
