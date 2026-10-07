import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { DemoBackend } from './demo';
import { SupabaseBackend } from './supabase';
import type { Backend } from './types';

export * from './types';
export { DEMO_OTP, DemoBackend } from './demo';

let instance: Backend | null = null;

/** Which backend this build talks to. Demo is used when Supabase isn't configured. */
export function backendKind(): 'demo' | 'supabase' {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.EXPO_PUBLIC_BACKEND === 'demo' || !url || !key) return 'demo';
  return 'supabase';
}

/**
 * The app-wide backend singleton. Background tasks (geofencing, trip
 * tracking) run outside React and use this directly.
 */
export function getBackend(): Backend {
  if (!instance) {
    instance =
      backendKind() === 'demo'
        ? new DemoBackend({ persist: Platform.OS === 'web', tick: true })
        : new SupabaseBackend(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);
    if (instance instanceof DemoBackend && Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      (globalThis as { __reachedDemo?: DemoBackend }).__reachedDemo = instance;
    }
  }
  return instance;
}

/** Test hook: swap the backend (RNTL tests use a fresh DemoBackend). */
export function setBackend(b: Backend | null) {
  instance = b;
}

/** Current time as the backend sees it (the demo clock can be advanced in tests). */
export function backendNow(): number {
  const b = getBackend();
  return b instanceof DemoBackend ? b.now() : Date.now();
}

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ backend, children }: { backend?: Backend; children: ReactNode }) {
  const b = backend ?? getBackend();
  const qc = useQueryClient();
  // The demo backend changes state on its own (delivery receipts, overdue
  // checks); refresh queries whenever it does. Supabase screens refetch on
  // focus and on an interval instead.
  useEffect(() => {
    if (!(b instanceof DemoBackend)) return;
    const off = b.subscribe(() => {
      void qc.invalidateQueries();
    });
    return () => {
      off();
    };
  }, [b, qc]);
  return <BackendContext.Provider value={b}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const b = useContext(BackendContext);
  if (!b) throw new Error('useBackend outside BackendProvider');
  return b;
}
