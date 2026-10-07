import { formatGhanaPhone, formatGhanaPhoneLocal, ghanaNetwork, isE164Ghana, maskPhone, normalizeGhanaPhone } from '../src/phone.ts';

describe('normalizeGhanaPhone', () => {
  it.each([
    ['0241234567', '+233241234567'],
    ['024 123 4567', '+233241234567'],
    ['241234567', '+233241234567'],
    ['+233 24 123 4567', '+233241234567'],
    ['+233241234567', '+233241234567'],
    ['00233241234567', '+233241234567'],
    ['233241234567', '+233241234567'],
    ['(020) 123-4567', '+233201234567'],
    ['0551234567', '+233551234567'],
    ['0591234567', '+233591234567'],
    ['0261234567', '+233261234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeGhanaPhone(input)).toBe(expected);
  });

  it.each(['', '12345', '0211234567', '0301234567', '+2342412345678', '+44 7700 900123', '02412345678', 'abc', '0991234567'])(
    'rejects %p',
    (input) => {
      expect(normalizeGhanaPhone(input)).toBeNull();
    },
  );
});

describe('formatting', () => {
  it('formats international and local', () => {
    expect(formatGhanaPhone('+233241234567')).toBe('+233 24 123 4567');
    expect(formatGhanaPhoneLocal('+233241234567')).toBe('024 123 4567');
    expect(maskPhone('+233241234567')).toBe('+233 24 ••• 4567');
  });
  it('identifies networks', () => {
    expect(ghanaNetwork('+233241234567')).toBe('MTN');
    expect(ghanaNetwork('+233501234567')).toBe('Telecel');
    expect(ghanaNetwork('+233571234567')).toBe('AT');
    expect(ghanaNetwork('+233231234567')).toBe('Glo');
    expect(ghanaNetwork('nope')).toBeNull();
  });
  it('validates canonical form', () => {
    expect(isE164Ghana('+233241234567')).toBe(true);
    expect(isE164Ghana('0241234567')).toBe(false);
  });
});
