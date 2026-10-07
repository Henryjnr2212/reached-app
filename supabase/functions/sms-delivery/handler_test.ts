import { assertEquals } from '@std/assert';
import { silent } from '../_shared/log.ts';
import { FakeDb } from '../_shared/testing.ts';
import { createHandler, mapDeliveryReport } from './handler.ts';

const TOKEN = 'cb-token-2';

function report(form: Record<string, string>, token = TOKEN): Request {
  return new Request(`http://localhost/sms-delivery?token=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
}

function handler(db: FakeDb) {
  return createHandler({ db, env: { AFRICASTALKING_CALLBACK_TOKEN: TOKEN }, log: silent });
}

Deno.test('delivery mapping: Success → delivered, failures → plain-language reasons, others ignored', () => {
  assertEquals(mapDeliveryReport('Success'), { status: 'delivered' });
  assertEquals(mapDeliveryReport('Failed', 'UserInBlacklist'), {
    status: 'failed',
    reason: "They've blocked messages from Reached",
  });
  assertEquals(mapDeliveryReport('Rejected', 'UserInBlackList'), {
    status: 'failed',
    reason: "They've blocked messages from Reached",
  });
  assertEquals(mapDeliveryReport('Failed', 'InsufficientCredit'), {
    status: 'failed',
    reason: "Reached couldn't send right now",
  });
  assertEquals(mapDeliveryReport('Failed', 'AbsentSubscriber'), {
    status: 'failed',
    reason: 'Their phone was off or out of coverage',
  });
  assertEquals(mapDeliveryReport('Expired'), { status: 'failed', reason: 'Their phone was off or out of coverage' });
  assertEquals(mapDeliveryReport('Failed', 'SomethingNew'), { status: 'failed', reason: "It wasn't delivered" });
  for (const s of ['Sent', 'Submitted', 'Buffered', '']) assertEquals(mapDeliveryReport(s), null);
});

Deno.test('sms-delivery: bad token is rejected', async () => {
  const db = new FakeDb();
  assertEquals((await handler(db)(report({ id: 'ATXid_1', status: 'Success' }, 'x'))).status, 401);
  assertEquals(db.rpcCalls.length, 0);
});

Deno.test('sms-delivery: Success calls update_message_status delivered', async () => {
  const db = new FakeDb();
  const res = await handler(db)(
    report({ id: 'ATXid_1', status: 'Success', phoneNumber: '+233241234567', networkCode: '62001' }),
  );
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('update_message_status'), [{
    p_provider_id: 'ATXid_1',
    p_status: 'delivered',
    p_reason: null,
  }]);
});

Deno.test('sms-delivery: Failed with a reason calls update_message_status failed', async () => {
  const db = new FakeDb();
  await handler(db)(report({ id: 'ATXid_2', status: 'Failed', failureReason: 'AbsentSubscriber' }));
  assertEquals(db.callsTo('update_message_status'), [{
    p_provider_id: 'ATXid_2',
    p_status: 'failed',
    p_reason: 'Their phone was off or out of coverage',
  }]);
});

Deno.test('sms-delivery: in-transit statuses are acknowledged and ignored', async () => {
  const db = new FakeDb();
  for (const status of ['Sent', 'Submitted', 'Buffered']) {
    const res = await handler(db)(report({ id: 'ATXid_3', status }));
    assertEquals(res.status, 200);
  }
  assertEquals(db.rpcCalls.length, 0);
  assertEquals((await handler(db)(report({ status: 'Success' }))).status, 400);
});
