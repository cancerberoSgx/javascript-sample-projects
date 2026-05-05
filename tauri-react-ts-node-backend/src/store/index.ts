import { create } from 'zustand';
import { BackendInfo } from '@/lib/backend';
import { Connection } from '@/lib/api';

type View =
  | { type: 'welcome' }
  | { type: 'new-connection'; profileId: number }
  | { type: 'edit-connection'; connection: Connection };

interface AppState {
  backendInfo: BackendInfo | null;
  setBackendInfo: (info: BackendInfo) => void;

  expandedProfileIds: number[];
  toggleProfile: (id: number) => void;
  ensureExpanded: (id: number) => void;

  view: View;
  openNewConnection: (profileId: number) => void;
  openEditConnection: (connection: Connection) => void;
  resetView: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  backendInfo: null,
  setBackendInfo: (info) => set({ backendInfo: info }),

  expandedProfileIds: [],
  toggleProfile: (id) =>
    set((state) => ({
      expandedProfileIds: state.expandedProfileIds.includes(id)
        ? state.expandedProfileIds.filter((p) => p !== id)
        : [...state.expandedProfileIds, id],
    })),
  ensureExpanded: (id) =>
    set((state) => ({
      expandedProfileIds: state.expandedProfileIds.includes(id)
        ? state.expandedProfileIds
        : [...state.expandedProfileIds, id],
    })),

  view: { type: 'welcome' },
  openNewConnection: (profileId) => set({ view: { type: 'new-connection', profileId } }),
  openEditConnection: (connection) => set({ view: { type: 'edit-connection', connection } }),
  resetView: () => set({ view: { type: 'welcome' } }),
}));
