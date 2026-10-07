import { fitsOneSms, gsm7Length, isGsm7, toGsm7 } from '../src/gsm7.ts';
import {
  customMessageBudget,
  LANGUAGES,
  parseInboundKeyword,
  renderCustom,
  renderSms,
  type Language,
  type MessageParams,
  type TemplateKey,
} from '../src/messages.ts';

const realistic: MessageParams = {
  name: 'Ama',
  place: 'Work',
  time: '8:42am',
  due: '6:30pm',
  lastSeen: '6:12pm',
  link: 'https://reached.app/l/7Hk2pQ9x',
  code: '482913',
  appHash: 'FA+9qCX9VSu',
  emergencyNumber: '112',
};

// Long but realistic Ghanaian names and places.
const long: MessageParams = {
  ...realistic,
  name: 'Oheneba Kwabena',
  place: 'Kotoka International Airport Terminal 3',
  phoneMayBeOff: true,
};

const ALL: TemplateKey[] = [
  'intro', 'arrived', 'left', 'on_the_way', 'running_late', 'plans_changed', 'overdue_alert',
  'sos', 'all_clear', 'request_accept', 'request_decline', 'request_unknown', 'request_pending', 'test', 'otp',
];

describe('SPEC §11 wording', () => {
  it('matches the spec exactly (with GSM-7 dash)', () => {
    expect(renderSms('intro', realistic)).toBe(
      "Hi, Ama added you as a safety contact on Reached. You'll get a text when Ama arrives safely. Reply STOP to opt out.",
    );
    expect(renderSms('arrived', realistic)).toBe('Ama has arrived safely at Work (8:42am). - Reached');
    expect(renderSms('on_the_way', realistic)).toBe('Ama is on the way to Work, expected around 6:30pm. - Reached');
    expect(renderSms('running_late', { ...realistic, due: '7:00pm' })).toBe(
      'Ama is running late. New expected arrival: 7:00pm. - Reached',
    );
    expect(renderSms('plans_changed', realistic)).toBe("Ama's trip to Work was cancelled. All is fine. - Reached");
    expect(renderSms('overdue_alert', realistic)).toBe(
      "ALERT: Ama hasn't arrived at Work (due 6:30pm) and isn't responding. Last seen 6:12pm: https://reached.app/l/7Hk2pQ9x. Please call Ama.",
    );
    expect(renderSms('sos', { ...realistic, time: '6:45pm' })).toBe(
      "EMERGENCY: Ama sent an SOS at 6:45pm. Live location: https://reached.app/l/7Hk2pQ9x. Call Ama now. If you can't reach Ama, call 112.",
    );
    expect(renderSms('all_clear', { ...realistic, time: '6:52pm' })).toBe('Ama is safe and confirmed at 6:52pm. - Reached');
    expect(renderSms('request_accept', realistic)).toBe('Ama will let you know when Ama reaches.');
    expect(renderSms('request_decline', realistic)).toBe("Ama can't share right now.");
    expect(renderSms('test', realistic)).toBe("This is a test from Reached on Ama's phone. No action needed.");
  });

  it('adds "phone may be off" when check-ins stopped', () => {
    expect(renderSms('overdue_alert', { ...realistic, phoneMayBeOff: true })).toMatch(/Ama's phone may be off\.$/);
  });
});

describe('160 GSM-7 limit (CLAUDE.md rule)', () => {
  const langs = LANGUAGES.map((l) => l.code) as Language[];
  for (const lang of langs) {
    for (const key of ALL) {
      it(`${lang}/${key} fits with realistic values`, () => {
        const text = renderSms(key, realistic, lang);
        expect(isGsm7(text)).toBe(true);
        expect(gsm7Length(text)).toBeLessThanOrEqual(160);
      });
      it(`${lang}/${key} fits with long names and places`, () => {
        const text = renderSms(key, long, lang);
        expect(isGsm7(text)).toBe(true);
        expect(fitsOneSms(text)).toBe(true);
      });
    }
  }

  it('only shortens when needed and keeps the link intact', () => {
    const text = renderSms('overdue_alert', long);
    expect(text).toContain('https://reached.app/l/7Hk2pQ9x');
    expect(text).toContain('..');
    expect(renderSms('arrived', long)).toContain('Kotoka International Airport Terminal 3');
  });

  it('transliterates names outside GSM-7 and drops emoji', () => {
    expect(renderSms('arrived', { ...realistic, name: 'Ɔkɔmfo 😀', place: 'Mum’s house' })).toBe(
      "Okomfo has arrived safely at Mum's house (8:42am). - Reached",
    );
  });
});

describe('gsm7', () => {
  it('counts extension characters as two', () => {
    expect(gsm7Length('a{b')).toBe(4);
    expect(gsm7Length('€')).toBe(2);
    expect(gsm7Length('😀')).toBe(Infinity);
    expect(toGsm7('“Hi” – ok…')).toBe('"Hi" - ok...');
  });
});

describe('custom messages', () => {
  it('fills tokens', () => {
    expect(renderCustom('{name} is home! ({time})', { name: 'Ama', place: 'Home', time: '9:01pm' })).toBe('Ama is home! (9:01pm)');
  });
  it('never exceeds 160', () => {
    const text = renderCustom('{name} '.repeat(40), { name: 'Ama', place: 'Home', time: '9:01pm' });
    expect(gsm7Length(text)).toBeLessThanOrEqual(160);
  });
  it('reports the remaining budget', () => {
    expect(customMessageBudget('{name} is home', { name: 'Ama' })).toBe(160 - 'Ama is home'.length);
  });
});

describe('inbound keywords', () => {
  it.each([
    ['STOP', 'STOP'], ['stop please', 'STOP'], ['Unsubscribe', 'STOP'], ['START', 'START'],
    ['reached', 'REACHED'], ['REACHED Ama', 'REACHED'], ['hello', null], ['', null],
  ])('%p → %p', (body, kw) => {
    expect(parseInboundKeyword(body)).toBe(kw);
  });
});
