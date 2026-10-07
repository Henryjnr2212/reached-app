import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useBackend } from '@/lib/backend';
import type { Backend } from '@/lib/backend/types';

/** Query keys in one place so mutations can invalidate precisely. */
export const keys = {
  session: ['session'] as const,
  profile: ['profile'] as const,
  contacts: ['contacts'] as const,
  places: ['places'] as const,
  rules: ['rules'] as const,
  liveTrip: ['liveTrip'] as const,
  events: ['events'] as const,
  event: (id: string) => ['event', id] as const,
  notifications: ['notifications'] as const,
  requests: ['requests'] as const,
  sos: ['sos'] as const,
};

/** Live data refreshes on an interval when talking to Supabase. */
const LIVE_MS = 15_000;

export function useSession() {
  const b = useBackend();
  return useQuery({ queryKey: keys.session, queryFn: () => b.getSessionUserId() });
}

export function useProfile(enabled = true) {
  const b = useBackend();
  return useQuery({ queryKey: keys.profile, queryFn: () => b.getProfile(), enabled });
}

export function useContacts() {
  const b = useBackend();
  return useQuery({ queryKey: keys.contacts, queryFn: () => b.listContacts() });
}

export function usePlaces() {
  const b = useBackend();
  return useQuery({ queryKey: keys.places, queryFn: () => b.listPlaces() });
}

export function useRules() {
  const b = useBackend();
  return useQuery({ queryKey: keys.rules, queryFn: () => b.listRules() });
}

export function useLiveTrip(enabled = true) {
  const b = useBackend();
  return useQuery({ queryKey: keys.liveTrip, queryFn: () => b.getLiveTrip(), refetchInterval: b.kind === 'supabase' ? LIVE_MS : false, enabled });
}

export function useEvents() {
  const b = useBackend();
  return useQuery({ queryKey: keys.events, queryFn: () => b.listEvents(), refetchInterval: b.kind === 'supabase' ? LIVE_MS : false });
}

export function useEvent(id: string | undefined) {
  const b = useBackend();
  return useQuery({
    queryKey: keys.event(id ?? ''),
    queryFn: () => b.getEvent(id!),
    enabled: !!id,
    refetchInterval: b.kind === 'supabase' ? 5_000 : false,
  });
}

export function useNotifications(enabled = true) {
  const b = useBackend();
  return useQuery({ queryKey: keys.notifications, queryFn: () => b.listNotifications(), refetchInterval: b.kind === 'supabase' ? LIVE_MS : false, enabled });
}

export function useRequests(enabled = true) {
  const b = useBackend();
  return useQuery({ queryKey: keys.requests, queryFn: () => b.listRequests(), refetchInterval: b.kind === 'supabase' ? LIVE_MS : false, enabled });
}

export function useOpenSos(enabled = true) {
  const b = useBackend();
  return useQuery({ queryKey: keys.sos, queryFn: () => b.getOpenSos(), enabled });
}

/**
 * A mutation that calls the backend and then refreshes the given queries.
 * Errors surface through `error` for inline display.
 */
export function useAction<TArgs, TResult>(fn: (b: Backend, args: TArgs) => Promise<TResult>, invalidate: QueryKey[] = []) {
  const b = useBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(b, args),
    onSuccess: async () => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
    },
  });
}

/** Everything a trip or event touches. */
export const TRIP_KEYS: QueryKey[] = [keys.liveTrip, keys.events, keys.notifications, keys.sos, keys.requests];

export function errorMessage(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Try again.';
}
