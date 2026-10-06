import { DEMO_OTP, DemoBackend } from '../backend/demo';

const WORK = { lat: 5.6037, lng: -0.187 };

async function signedIn() {
  const b = new DemoBackend({ persist: false, tick: false });
  b.sendDelayMs = 0;
  b.deliverDelayMs = 0;
  await b.verifyOtp('024 123 4567', DEMO_OTP);
  await b.updateProfile({ firstName: 'Ama', onboardedAt: new Date().toISOString() });
  const mom = await b.addContact({ name: 'Mom', phone: '020 111 2222', relationship: 'Mom', channel: 'sms' });
  return { b, mom };
}

// Runs the simulated provider's Sending → Sent → Delivered timers to the end.
const flush = () => jest.runAllTimersAsync();

describe('DemoBackend', () => {
  let b: DemoBackend;
  beforeEach(() => jest.useFakeTimers({ now: Date.UTC(2026, 9, 6, 9, 0) }));
  afterEach(() => {
    b?.dispose();
    jest.useRealTimers();
  });

  it('rejects a wrong code and a non-Ghana number', async () => {
    b = new DemoBackend({ persist: false, tick: false });
    await expect(b.verifyOtp('0241234567', '000000')).rejects.toMatchObject({ code: 'bad_code' });
    await expect(b.sendOtp('+44 7700 900123')).rejects.toMatchObject({ code: 'bad_phone' });
  });

  it('stores contacts in +233 E.164 and sends them an intro text', async () => {
    let mom;
    ({ b, mom } = await signedIn());
    expect(mom.phone).toBe('+233201112222');
    await flush();
    const sent = b.debugMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ template: 'intro', toPhone: '+233201112222', status: 'delivered' });
    expect(sent[0]!.body!.length).toBeLessThanOrEqual(160);
    await expect(b.addContact({ name: 'Mom again', phone: '0201112222', relationship: 'Mom', channel: 'sms' })).rejects.toMatchObject({ code: 'duplicate' });
  });

  it('marks texts to unreachable numbers as failed and lets them be resent', async () => {
    ({ b } = await signedIn());
    await b.addContact({ name: 'Kofi', phone: '0240000000', relationship: 'Friend', channel: 'sms' });
    await flush();
    const failed = b.debug.state.messages.find((m) => m.contactName === 'Kofi')!;
    expect(failed.status).toBe('failed');
    expect((await b.listNotifications()).some((n) => n.kind === 'message_failed')).toBe(true);
    await b.resendMessage(failed.id);
    expect(failed.status).toBe('sending');
    await flush();
    // A number that keeps failing fails again and the user is told again.
    expect(failed.status).toBe('failed');
    expect((await b.listNotifications()).filter((n) => n.kind === 'message_failed')).toHaveLength(2);
    await expect(b.resendMessage(b.debug.state.messages[0]!.id)).rejects.toMatchObject({ code: 'cannot_resend' });
  });

  it('tells contacts on arrival and ends the trip', async () => {
    let mom;
    ({ b, mom } = await signedIn());
    await expect(b.startTrip({ destName: 'Work', dest: WORK, contactIds: [mom.id], tellLeaving: false, checkOnMe: true, expectedAt: null, graceMinutes: 15 })).rejects.toMatchObject({
      code: 'bad_expected_time',
    });
    const trip = await b.startTrip({ destName: 'Work', dest: WORK, contactIds: [mom.id], tellLeaving: false, checkOnMe: false, expectedAt: null, graceMinutes: 15 });
    await expect(b.startTrip({ destName: 'Work', dest: WORK, contactIds: [mom.id], tellLeaving: false, checkOnMe: false, expectedAt: null, graceMinutes: 15 })).rejects.toMatchObject({
      code: 'trip_in_progress',
    });
    await b.arriveTrip(trip.id, WORK, 'manual');
    await flush();
    expect(await b.getLiveTrip()).toBeNull();
    const arrival = b.debugMessages().find((m) => m.template === 'arrived');
    expect(arrival?.body).toMatch(/^Ama has arrived safely at Work/);
  });

  it('asks "Are you okay?" when overdue and alerts emergency contacts 5 minutes later', async () => {
    let mom;
    ({ b, mom } = await signedIn());
    const expectedAt = new Date(b.now() + 30 * 60_000).toISOString();
    const trip = await b.startTrip({ destName: 'Work', dest: WORK, contactIds: [mom.id], tellLeaving: false, checkOnMe: true, expectedAt, graceMinutes: 15 });
    b.advance(46);
    expect((await b.getLiveTrip())?.status).toBe('overdue');
    expect(b.debugMessages().some((m) => m.template === 'overdue_alert')).toBe(false);
    b.advance(6);
    expect((await b.getLiveTrip())?.status).toBe('alerted');
    await flush();
    const alert = b.debugMessages().find((m) => m.template === 'overdue_alert');
    expect(alert?.body?.length).toBeLessThanOrEqual(160);
    await b.imSafe();
    await flush();
    expect(b.debugMessages().some((m) => m.template === 'all_clear')).toBe(true);
    expect((await b.getLiveTrip())?.id ?? null).not.toBe(trip.id);
  });

  it('"Need more time" pushes the expected time without alerting anyone', async () => {
    let mom;
    ({ b, mom } = await signedIn());
    const expectedAt = new Date(b.now() + 10 * 60_000).toISOString();
    const trip = await b.startTrip({ destName: 'Work', dest: WORK, contactIds: [mom.id], tellLeaving: false, checkOnMe: true, expectedAt, graceMinutes: 15 });
    b.advance(26);
    expect((await b.getLiveTrip())?.status).toBe('overdue');
    await b.respondOverdue(trip.id, 'more_time', 30);
    expect((await b.getLiveTrip())?.status).toBe('active');
    b.advance(6);
    expect(b.debugMessages().some((m) => m.template === 'overdue_alert')).toBe(false);
  });

  it('stops texting a contact who replies STOP', async () => {
    let mom;
    ({ b, mom } = await signedIn());
    b.inbound(mom.phone, 'stop');
    expect((await b.listContacts())[0]!.optedOut).toBe(true);
    expect((await b.listNotifications()).some((n) => n.kind === 'opted_out')).toBe(true);
  });

  it('SOS alerts emergency contacts, and I\'m safe now closes it', async () => {
    ({ b } = await signedIn());
    await b.triggerSos(WORK, 80);
    await flush();
    expect(b.debugMessages().some((m) => m.template === 'sos')).toBe(true);
    expect(await b.getOpenSos()).not.toBeNull();
    await b.imSafe();
    expect(await b.getOpenSos()).toBeNull();
  });

  it('delete my activity clears events but keeps contacts', async () => {
    ({ b } = await signedIn());
    await b.sendReachedNow((await b.listContacts()).map((c) => c.id), 'East Legon', WORK);
    expect((await b.listEvents()).length).toBeGreaterThan(0);
    await b.deleteActivity();
    expect(await b.listEvents()).toEqual([]);
    expect(await b.listContacts()).toHaveLength(1);
  });
});

describe('DemoBackend contacts and rules', () => {
  beforeEach(() => jest.useFakeTimers({ now: Date.UTC(2026, 9, 6, 9, 0) }));
  afterEach(() => jest.useRealTimers());

  it('removing a contact removes them from every rule', async () => {
    const { b, mom } = await signedIn();
    const work = await b.addPlace({ name: 'Work', icon: 'work', lat: 5.6037, lng: -0.187, radius: 150, address: null, ghanaPostGps: null });
    await b.saveRule({ placeId: work.id, event: 'arrive', contactIds: [mom.id], days: [1, 2, 3, 4, 5], windowStart: null, windowEnd: null, message: null, enabled: true });
    await b.removeContact(mom.id);
    expect((await b.listRules())[0]!.contactIds).toEqual([]);
    b.dispose();
  });
});
