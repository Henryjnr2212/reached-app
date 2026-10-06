import { safeEqual } from './crypto.ts';
import type { Env } from './db.ts';

/**
 * Africa's Talking callbacks carry no signature, so the callback URLs include
 * a shared ?token= that must equal AFRICASTALKING_CALLBACK_TOKEN. An unset
 * token rejects everything.
 */
export function callbackTokenOk(req: Request, env: Env): Promise<boolean> {
  const token = new URL(req.url).searchParams.get('token');
  return safeEqual(token, env.AFRICASTALKING_CALLBACK_TOKEN);
}
