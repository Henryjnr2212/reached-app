import { callbackTokenOk } from '../_shared/callback.ts';
import { type DbClient, type Env, rpc } from '../_shared/db.ts';
import { error, json, readForm } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';

/**
 * sms-delivery — Africa's Talking delivery report callback (form fields id,
 * status, failureReason, phoneNumber, networkCode, retryCount).
 */

export interface SmsDeliveryDeps {
  db: DbClient;
  env: Env;
  log: Logger;
}

/** Africa's Talking failureReason → plain words shown to the user in the app. */
const FAILURE_REASONS: Record<string, string> = {
  userinblacklist: "They've blocked messages from Reached",
  insufficientcredit: "Reached couldn't send right now",
  absentsubscriber: 'Their phone was off or out of coverage',
  userisinactive: "Their number isn't active",
  useraccountsuspended: "Their number isn't active",
  invalidphonenumber: "That number doesn't exist",
  notnetworksubscriber: "That number doesn't exist",
  usermemorycapacityexceeded: 'Their phone inbox is full',
  usernotsubscribedtoproduct: "They've blocked messages from Reached",
  deliveryfailure: "Their network didn't deliver it",
  systemerror: "Reached couldn't send right now",
  invalidsenderid: "Reached couldn't send right now",
  invalidlinkid: "Reached couldn't send right now",
  rejectedbygateway: "Their network didn't deliver it",
  unknownerror: "Their network didn't deliver it",
};

export function plainFailureReason(failureReason: string | undefined, status: string): string {
  const key = (failureReason ?? '').replace(/[^a-z]/gi, '').toLowerCase();
  if (FAILURE_REASONS[key]) return FAILURE_REASONS[key];
  if (status === 'Expired') return 'Their phone was off or out of coverage';
  return "It wasn't delivered";
}

export type DeliveryMapping = { status: 'delivered' } | { status: 'failed'; reason: string } | null;

/** Success → delivered; Rejected/Failed/Expired → failed; Sent/Submitted/Buffered → still in transit (ignored). */
export function mapDeliveryReport(status: string, failureReason?: string): DeliveryMapping {
  switch (status) {
    case 'Success':
      return { status: 'delivered' };
    case 'Rejected':
    case 'Failed':
    case 'Expired':
      return { status: 'failed', reason: plainFailureReason(failureReason, status) };
    default:
      return null;
  }
}

export function createHandler(deps: SmsDeliveryDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    if (!(await callbackTokenOk(req, deps.env))) return error(401, 'unauthorized', 'Bad callback token');
    const form = await readForm(req);
    const id = form.id;
    if (!id) return error(400, 'bad_request', 'Missing id');
    const mapped = mapDeliveryReport(form.status ?? '', form.failureReason);
    if (!mapped) return json({ ok: true, ignored: true });
    try {
      await rpc(deps.db, 'update_message_status', {
        p_provider_id: id,
        p_status: mapped.status,
        p_reason: mapped.status === 'failed' ? mapped.reason : null,
      });
    } catch (e) {
      deps.log('delivery_update_failed', { id, reason: (e as Error).message });
      return error(500, 'update_failed', 'Could not record the delivery report');
    }
    deps.log('delivery_report', { id, status: mapped.status });
    return json({ ok: true, status: mapped.status });
  };
}
