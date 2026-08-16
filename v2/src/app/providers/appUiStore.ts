import { create } from "zustand";

interface AppUiState {
  secondaryMenuOpen: boolean;
  openSecondaryMenu: () => void;
  closeSecondaryMenu: () => void;
  toggleSecondaryMenu: () => void;
}

/** Example/first Zustand store: purely transient UI state (a menu's
 * open/closed state), never persisted business data. Feature stores for
 * selected IDs/filters follow this same narrow, single-purpose pattern -
 * see ARCHITECTURE.md §5. */
export const useAppUiStore = create<AppUiState>((set) => ({
  secondaryMenuOpen: false,
  openSecondaryMenu: () => set({ secondaryMenuOpen: true }),
  closeSecondaryMenu: () => set({ secondaryMenuOpen: false }),
  toggleSecondaryMenu: () => set((state) => ({ secondaryMenuOpen: !state.secondaryMenuOpen }))
}));
