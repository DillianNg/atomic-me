import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  theme: Theme;
  /** Set theme va lap tuc ap class .dark len <html> de chuyen mode tuc thi. */
  setTheme: (theme: Theme) => void;
  /** Re-apply theme hien tai (vd luc system prefers-color-scheme thay doi). */
  applyTheme: () => void;
}

/** Tinh class .dark dua tren theme + system preference roi ap len documentElement. */
function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && sysDark);
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * UI store (client-only state). Persist vao localStorage qua zustand persist,
 * key 'atomic-me-ui'. KHONG bao gio chua server state o day (TanStack Query lo).
 */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyThemeClass(theme);
      },
      applyTheme: () => {
        applyThemeClass(get().theme);
      },
    }),
    {
      name: 'atomic-me-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        // Sau khi rehydrate xong, dam bao class .dark khop voi theme da luu.
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);
