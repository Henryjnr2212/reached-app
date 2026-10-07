import { contrastRatio, dark, light, textPairs } from '../src/tokens.ts';

describe('WCAG AA contrast for every text pair', () => {
  for (const [scheme, colors] of [['light', light], ['dark', dark]] as const) {
    for (const [name, fg, bg] of textPairs(colors)) {
      it(`${scheme}: ${name} ≥ 4.5`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});
