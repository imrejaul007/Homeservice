import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type FontSize = 'small' | 'medium' | 'large';

interface ThemeState {
  theme: Theme;
  fontSize: FontSize;
  reducedMotion: boolean;
  highContrast: boolean;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      fontSize: 'medium',
      reducedMotion: false,
      highContrast: false,

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      setFontSize: (fontSize) => {
        set({ fontSize });
        applyFontSize(fontSize);
      },

      setReducedMotion: (reducedMotion) => {
        set({ reducedMotion });
        applyReducedMotion(reducedMotion);
      },

      setHighContrast: (highContrast) => {
        set({ highContrast });
        applyHighContrast(highContrast);
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

// Apply theme to document
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', systemTheme);
    root.classList.remove('light', 'dark');
    root.classList.add(systemTheme);
  } else {
    root.setAttribute('data-theme', theme);
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }
};

// Apply font size
const applyFontSize = (fontSize: FontSize) => {
  const root = document.documentElement;
  root.setAttribute('data-font-size', fontSize);
};

// Apply reduced motion
const applyReducedMotion = (enabled: boolean) => {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
};

// Apply high contrast
const applyHighContrast = (enabled: boolean) => {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
};

// Initialize theme on load
export const initializeTheme = () => {
  const store = useThemeStore.getState();
  applyTheme(store.theme);
  applyFontSize(store.fontSize);
  applyReducedMotion(store.reducedMotion);
  applyHighContrast(store.highContrast);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') {
      applyTheme('system');
    }
  });
};

// Theme toggle hook
export const useTheme = () => {
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return { theme, setTheme, toggleTheme };
};

export default useThemeStore;
