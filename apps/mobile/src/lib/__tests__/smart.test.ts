import { EMPTY_SMART, stepSmart } from '../smart';
import type { Place } from '../backend/types';

const HOME: Place = { id: 'home', name: 'Home', icon: 'home', lat: 5.635, lng: -0.16, radius: 150, address: null, ghanaPostGps: null };
const ON = { autoDetect: true, headingOutPrompts: true };

describe('stepSmart', () => {
  it('offers "heading out" when leaving a saved place with no trip running', () => {
    const r = stepSmart(EMPTY_SMART, { lat: 5.6, lng: -0.2, at: 1 }, [{ type: 'place_leave', placeId: 'home' }], [HOME], ON, null);
    expect(r.effects).toEqual([{ type: 'heading_out', place: HOME }]);
  });

  it('stays quiet when heading-out prompts are off', () => {
    const r = stepSmart(EMPTY_SMART, { lat: 5.6, lng: -0.2, at: 1 }, [{ type: 'place_leave', placeId: 'home' }], [HOME], { ...ON, headingOutPrompts: false }, null);
    expect(r.effects).toEqual([]);
  });

  it('keeps at most two hours of samples', () => {
    let s = EMPTY_SMART;
    for (let i = 0; i < 30; i++) s = stepSmart(s, { lat: 5.6, lng: -0.2, at: i * 10 * 60_000 }, [], [], null, null).state;
    const span = s.samples[s.samples.length - 1]!.at - s.samples[0]!.at;
    expect(span).toBeLessThanOrEqual(2 * 60 * 60_000);
  });

  it('reports a stop somewhere new once, not at saved places', () => {
    let s = EMPTY_SMART;
    const effects = [];
    const minute = 60_000;
    // 20 minutes at home, a 15-minute drive, then 25 minutes at a new spot.
    for (let m = 0; m <= 20; m += 2) {
      const r = stepSmart(s, { lat: HOME.lat, lng: HOME.lng, at: m * minute }, [], [HOME], ON, null);
      s = r.state;
      effects.push(...r.effects);
    }
    for (let m = 22; m <= 35; m += 2) {
      const r = stepSmart(s, { lat: HOME.lat - (m - 20) * 0.003, lng: HOME.lng - (m - 20) * 0.003, at: m * minute, speed: 10 }, [], [HOME], ON, null);
      s = r.state;
      effects.push(...r.effects);
    }
    for (let m = 36; m <= 60; m += 2) {
      const r = stepSmart(s, { lat: 5.58, lng: -0.21, at: m * minute }, [], [HOME], ON, null);
      s = r.state;
      effects.push(...r.effects);
    }
    const autos = effects.filter((e) => e.type === 'auto_arrival');
    expect(autos).toHaveLength(1);
    expect(autos[0]).toMatchObject({ at: { lat: expect.closeTo(5.58, 4), lng: expect.closeTo(-0.21, 4) } });
  });

  it('leaves stops inside a saved place to the place rules', () => {
    const work: Place = { ...HOME, id: 'work', name: 'Work', lat: 5.58, lng: -0.21 };
    let s = EMPTY_SMART;
    const effects = [];
    for (let m = 0; m <= 60; m += 2) {
      const at = m <= 20 ? HOME : m <= 35 ? { lat: HOME.lat - (m - 20) * 0.003, lng: HOME.lng - (m - 20) * 0.003 } : work;
      const r = stepSmart(s, { lat: at.lat, lng: at.lng, at: m * 60_000 }, [], [HOME, work], ON, null);
      s = r.state;
      effects.push(...r.effects);
    }
    expect(effects.filter((e) => e.type === 'auto_arrival')).toEqual([]);
  });
});
