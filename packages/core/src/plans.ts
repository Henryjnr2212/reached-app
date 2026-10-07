/**
 * Phase 3 plans. Limits are a sensible starting point recorded in
 * DECISIONS.md; the server enforces them, the app only explains them.
 */
export type PlanId = 'free' | 'premium' | 'family';

export interface Plan {
  id: PlanId;
  name: string;
  priceGhsMonthly: number;
  maxContacts: number;
  maxPlaces: number;
  /** Arrival / on-the-way / late SMS per month. Safety messages are never counted. */
  smsPerMonth: number;
  familyMembers: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceGhsMonthly: 0,
    maxContacts: 5,
    maxPlaces: 10,
    smsPerMonth: 30,
    familyMembers: 0,
    features: ['Arrival texts', 'Overdue alerts', 'SOS', '5 people · 10 places'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceGhsMonthly: 15,
    maxContacts: 15,
    maxPlaces: 15,
    smsPerMonth: 300,
    familyMembers: 0,
    features: ['Everything in Free', '15 people · 15 places', '300 arrival texts a month', 'Live location links'],
  },
  family: {
    id: 'family',
    name: 'Family',
    priceGhsMonthly: 40,
    maxContacts: 15,
    maxPlaces: 15,
    smsPerMonth: 1000,
    familyMembers: 5,
    features: ['Everything in Premium', 'Up to 5 family members', 'Shared emergency contacts'],
  },
};

export type PaymentMethod = 'mtn_momo' | 'telecel_cash' | 'at_money' | 'card';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'mtn_momo', label: 'MTN MoMo' },
  { id: 'telecel_cash', label: 'Telecel Cash' },
  { id: 'at_money', label: 'AT Money' },
  { id: 'card', label: 'Card' },
];

export type MessageKind = 'arrival' | 'safety' | 'system';

/**
 * SPEC §13 "Free SMS allowance used": arrivals switch to WhatsApp where the
 * contact accepts it; overdue and SOS always go out by SMS.
 */
export function chooseChannel(args: {
  kind: MessageKind;
  contactChannel: 'sms' | 'whatsapp' | 'both';
  smsUsedThisMonth: number;
  plan: PlanId;
}): 'sms' | 'whatsapp' | 'both' | 'none' {
  const { kind, contactChannel, smsUsedThisMonth, plan } = args;
  if (kind !== 'arrival') return contactChannel;
  const overAllowance = smsUsedThisMonth >= PLANS[plan].smsPerMonth;
  if (!overAllowance) return contactChannel;
  if (contactChannel === 'sms') return 'none';
  return 'whatsapp';
}

export function canAdd(kind: 'contact' | 'place', current: number, plan: PlanId): boolean {
  const p = PLANS[plan];
  return current < (kind === 'contact' ? p.maxContacts : p.maxPlaces);
}
