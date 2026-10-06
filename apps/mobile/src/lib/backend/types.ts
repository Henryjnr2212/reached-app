import type {
  Channel,
  DeliveryStatus,
  EventKind,
  FeedbackKey,
  Language,
  LatLng,
  PaymentMethod,
  PlanId,
  Relationship,
  RuleEvent,
  TransportType,
  TripStatus,
} from '@reached/core';

/** App-side models (camelCase) mirroring the database tables. */
export interface Profile {
  id: string;
  firstName: string | null;
  phone: string;
  email: string | null;
  photoUri: string | null;
  arrivalMode: 'auto' | 'ask';
  askTimeoutMin: 5 | 10 | null;
  defaultMessage: string | null;
  graceMinutes: number;
  autoDetect: boolean;
  headingOutPrompts: boolean;
  sosHoldSeconds: number;
  sosCountdownSeconds: 5 | 10;
  alsoAlertPolice: boolean;
  notifyArrivals: boolean;
  notifyRequests: boolean;
  notifyTips: boolean;
  retentionDays: 7 | 30;
  language: Language;
  appearance: 'light' | 'dark' | 'system';
  plan: PlanId;
  onboardedAt: string | null;
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'phone' | 'plan'>>;

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: Relationship;
  channel: Channel;
  language: Language;
  isDefault: boolean;
  isEmergency: boolean;
  canRequestLocation: boolean;
  optedOut: boolean;
  lastFailedAt: string | null;
  createdAt: string;
}

export interface ContactInput {
  name: string;
  phone: string;
  relationship: Relationship;
  channel: Channel;
  isDefault?: boolean;
  isEmergency?: boolean;
}

export interface Place extends LatLng {
  id: string;
  name: string;
  icon: string;
  radius: number;
  address: string | null;
  ghanaPostGps: string | null;
}

export type PlaceInput = Omit<Place, 'id'>;

export interface Rule {
  id: string;
  placeId: string;
  event: RuleEvent;
  contactIds: string[];
  days: number[];
  windowStart: string | null;
  windowEnd: string | null;
  message: string | null;
  enabled: boolean;
}

export type RuleInput = Omit<Rule, 'id'> & { id?: string };

export interface TripDetails {
  transportType?: TransportType | null;
  plate?: string | null;
  platePhotoUri?: string | null;
  driverName?: string | null;
  car?: string | null;
  rideProvider?: 'uber' | 'bolt' | 'yango' | null;
  rideLink?: string | null;
}

export interface Trip extends TripDetails {
  id: string;
  placeId: string | null;
  destName: string | null;
  dest: LatLng | null;
  radius: number;
  status: TripStatus;
  startedAt: string;
  expectedAt: string | null;
  graceMinutes: number;
  checkOnMe: boolean;
  overduePromptedAt: string | null;
  contactIds: string[];
  liveToken: string;
  lastCheckinAt: string | null;
  last: LatLng | null;
}

export interface StartTripInput extends TripDetails {
  placeId?: string | null;
  destName?: string | null;
  dest?: LatLng | null;
  radius?: number;
  contactIds: string[];
  message?: string | null;
  contactMessages?: Record<string, string>;
  tellLeaving: boolean;
  checkOnMe: boolean;
  expectedAt: string | null;
  graceMinutes: number;
  here?: LatLng | null;
  source?: 'manual' | 'heading_out' | 'request';
}

export interface MessageRow {
  id: string;
  contactId: string | null;
  contactName: string;
  channel: 'sms' | 'whatsapp';
  status: DeliveryStatus | 'held' | 'cancelled';
  body: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  kind: EventKind;
  status: 'pending_confirmation' | 'sent' | 'cancelled';
  placeName: string | null;
  point: LatLng | null;
  createdAt: string;
  feedback: FeedbackKey | null;
  tripId: string | null;
  messages: MessageRow[];
  /** Exact text sent (first rendered message), for the event detail. */
  previewBody: string | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, string>;
  createdAt: string;
  readAt: string | null;
}

export interface SosAlert {
  id: string;
  status: 'sent' | 'cleared';
  sentAt: string;
  liveToken: string;
}

export interface ContactRequest {
  id: string;
  contactId: string;
  contactName: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
}

export interface PoliceStation extends LatLng {
  id: string;
  name: string;
  region: string;
  district: string | null;
  phone: string | null;
  verified: boolean;
  distanceM: number;
}

export interface Subscription {
  id: string;
  plan: PlanId;
  status: 'pending' | 'active' | 'cancelled' | 'failed';
  providerRef: string;
  amountGhs: number;
  currentPeriodEnd: string | null;
}

export type OverdueAnswer = 'arrived' | 'still_going' | 'more_time' | 'get_help';

export class BackendError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Everything the app asks of the server. Two implementations:
 * SupabaseBackend (production) and DemoBackend (in-memory, for the web
 * preview, e2e tests and screenshots).
 */
export interface Backend {
  readonly kind: 'supabase' | 'demo';

  // Auth
  getSessionUserId(): Promise<string | null>;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<{ isNew: boolean }>;
  signOut(): Promise<void>;

  // Profile
  getProfile(): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;

  // Contacts
  listContacts(): Promise<Contact[]>;
  addContact(input: ContactInput): Promise<Contact>;
  updateContact(id: string, patch: Partial<ContactInput> & { language?: Language; canRequestLocation?: boolean }): Promise<Contact>;
  removeContact(id: string): Promise<void>;
  sendTestMessage(contactId: string): Promise<string>;

  // Places and rules
  listPlaces(): Promise<Place[]>;
  addPlace(input: PlaceInput): Promise<Place>;
  updatePlace(id: string, input: Partial<PlaceInput>): Promise<Place>;
  removePlace(id: string): Promise<void>;
  listRules(): Promise<Rule[]>;
  saveRule(rule: RuleInput): Promise<Rule>;
  deleteRule(id: string): Promise<void>;
  reportPlaceEvent(placeId: string, event: RuleEvent, at?: LatLng | null): Promise<string | null>;
  reportAutoArrival(area: string, at: LatLng): Promise<string | null>;

  // Trips
  getLiveTrip(): Promise<Trip | null>;
  startTrip(input: StartTripInput): Promise<Trip>;
  arriveTrip(tripId: string, at?: LatLng | null, source?: 'manual' | 'auto'): Promise<string>;
  extendTrip(tripId: string, minutes: number, tell: boolean): Promise<Trip>;
  cancelTrip(tripId: string, tell: boolean): Promise<void>;
  checkin(tripId: string, at: LatLng, accuracy?: number | null, battery?: number | null): Promise<TripStatus>;
  respondOverdue(tripId: string, answer: OverdueAnswer, minutes?: number): Promise<{ eventId?: string; sosId?: string }>;

  // Activity
  listEvents(): Promise<ActivityEvent[]>;
  getEvent(id: string): Promise<ActivityEvent | null>;
  resendMessage(messageId: string): Promise<void>;
  eventFeedback(eventId: string, feedback: FeedbackKey): Promise<void>;
  confirmEvent(eventId: string, send: boolean): Promise<void>;
  sendReachedNow(contactIds: string[], area: string, at?: LatLng | null): Promise<string>;
  runSelfTest(): Promise<string>;

  // Safety
  getOpenSos(): Promise<SosAlert | null>;
  triggerSos(at: LatLng | null, battery: number | null, trigger?: string): Promise<SosAlert>;
  sosPing(sosId: string, at: LatLng, battery: number | null): Promise<void>;
  imSafe(): Promise<string>;

  // Notifications and requests
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  registerPushToken(token: string, platform: 'android' | 'ios' | 'web'): Promise<void>;
  listRequests(): Promise<ContactRequest[]>;
  respondRequest(id: string, accept: boolean, trip?: Partial<StartTripInput> | null): Promise<void>;

  // Privacy
  deleteActivity(): Promise<void>;
  exportData(): Promise<unknown>;
  /** Re-verifies the OTP, then deletes the account. */
  deleteAccount(code: string): Promise<void>;

  // Phase 2/3
  lookupGhanaPost(code: string): Promise<(LatLng & { address: string }) | null>;
  nearestPolice(at: LatLng): Promise<PoliceStation[]>;
  startSubscription(plan: Exclude<PlanId, 'free'>, method: PaymentMethod, payPhone: string | null): Promise<Subscription>;
  confirmPayment(providerRef: string): Promise<Subscription>;
  reportProblem(body: string, logs: string | null): Promise<void>;
}
