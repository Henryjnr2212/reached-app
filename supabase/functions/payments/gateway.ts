import type { Env } from '../_shared/db.ts';
import type { FetchFn } from '../_shared/providers.ts';

/**
 * Payment provider contract (MTN MoMo / Telecel Cash / AT Money / card via an
 * aggregator such as Paystack or Hubtel). A charge only starts the payment:
 * the customer approves it on their phone and the provider later calls
 * POST /payments/webhook with { reference, status }.
 */
export interface ChargeRequest {
  reference: string;
  amountGhs: number;
  method: 'mtn_momo' | 'telecel_cash' | 'at_money' | 'card';
  phone: string | null;
  callbackUrl: string;
}

export type ChargeResult = { status: 'pending'; redirectUrl?: string } | { status: 'failed'; message: string };

export interface PaymentGateway {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

/** Generic HTTP gateway: POST PAYMENTS_API_URL with Bearer PAYMENTS_API_KEY. */
export class HttpPaymentGateway implements PaymentGateway {
  constructor(private url: string, private apiKey: string, private fetchFn: FetchFn = fetch) {}

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    let res: Response;
    try {
      res = await this.fetchFn(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: req.reference,
          amount: req.amountGhs,
          currency: 'GHS',
          method: req.method,
          phone: req.phone,
          callback_url: req.callbackUrl,
        }),
      });
    } catch (e) {
      return { status: 'failed', message: `Network error: ${(e as Error).message}` };
    }
    const body = await res.json().catch(() => ({})) as { redirect_url?: string; message?: string };
    if (!res.ok) return { status: 'failed', message: body.message ?? `Payment provider HTTP ${res.status}` };
    return { status: 'pending', redirectUrl: body.redirect_url };
  }
}

export function getGateway(env: Env, fetchFn: FetchFn = fetch): PaymentGateway {
  if (!env.PAYMENTS_API_URL || !env.PAYMENTS_API_KEY) throw new Error('Payments are not configured');
  return new HttpPaymentGateway(env.PAYMENTS_API_URL, env.PAYMENTS_API_KEY, fetchFn);
}
