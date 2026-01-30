// Dark Mode Hook
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      isDark: false,

      setTheme: (theme: Theme) => {
        const isDark = getIsDark(theme);
        applyTheme(isDark);
        set({ theme, isDark });
      },

      toggleTheme: () => {
        const { theme } = get();
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        const isDark = newTheme === 'dark';
        applyTheme(isDark);
        set({ theme: newTheme, isDark });
      },
    }),
    {
      name: 'agentsmith-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = getIsDark(state.theme);
          applyTheme(isDark);
          state.isDark = isDark;
        }
      },
    }
  )
);

function getIsDark(theme: Theme): boolean {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
}

function applyTheme(isDark: boolean) {
  const root = window.document.documentElement;

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#1f2937' : '#ffffff');
  }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const isDark = e.matches;
      applyTheme(isDark);
      useThemeStore.setState({ isDark });
    }
  });
}

// React hook for using dark mode
export function useDarkMode() {
  const { theme, isDark, setTheme, toggleTheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme on mount
    const isDark = getIsDark(theme);
    applyTheme(isDark);
  }, [theme]);

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    isLight: !isDark,
    isSystem: theme === 'system',
  };
}

export default useDarkMode;
