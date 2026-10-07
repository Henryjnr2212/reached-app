import { create } from 'zustand';
import type { LatLng } from '@reached/core';
import type { LocationAccess } from '@/lib/device/location';

export type Access = 'granted' | 'denied' | 'undetermined';

/** Device state the UI reacts to (permissions, last position). Server data lives in TanStack Query. */
interface AppState {
  location: LocationAccess;
  notifications: Access;
  /** Android battery optimisation: 'restricted' means the OS may kill background work. */
  battery: 'ok' | 'restricted' | 'unknown';
  contactsAccess: Access;
  online: boolean;
  here: LatLng | null;
  /** Phone number between the phone and verify screens. */
  pendingPhone: string | null;
  /** Banners the user dismissed this session. */
  dismissed: string[];
  /** Phase 2: "Looks like you're heading out" card. */
  headingOut: { from: string; at: number } | null;
  set: (patch: Partial<Omit<AppState, 'set' | 'dismiss'>>) => void;
  dismiss: (id: string) => void;
}

export const useApp = create<AppState>((set) => ({
  location: 'undetermined',
  notifications: 'undetermined',
  battery: 'unknown',
  contactsAccess: 'undetermined',
  online: true,
  here: null,
  pendingPhone: null,
  dismissed: [],
  headingOut: null,
  set: (patch) => set(patch),
  dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),
}));
