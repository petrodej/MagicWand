import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

const stored = localStorage.getItem('theme') as Theme | null;
const initial: Theme = stored || 'dark';

// Apply on load
document.documentElement.classList.toggle('dark', initial === 'dark');
document.documentElement.classList.toggle('light', initial === 'light');

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.classList.toggle('light', next === 'light');
      return { theme: next };
    });
  },
}));
