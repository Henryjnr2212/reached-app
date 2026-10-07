import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../Button';
import { Avatar, EmptyState } from '../Feedback';
import { SosShield } from '../SosShield';
import { dark, light } from '@reached/core';

describe('SosShield', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a short tap only shows "Hold to send SOS"', async () => {
    const onTrigger = jest.fn();
    await render(<SosShield onTrigger={onTrigger} />);
    const shield = screen.getByTestId('sos-shield');
    await fireEvent(shield, 'pressIn');
    await fireEvent(shield, 'pressOut');
    await fireEvent.press(shield);
    expect(screen.getByText('Hold to send SOS')).toBeTruthy();
    expect(onTrigger).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(2500));
    expect(screen.queryByText('Hold to send SOS')).toBeNull();
  });

  it('holding for the full time triggers SOS', async () => {
    const onTrigger = jest.fn();
    await render(<SosShield onTrigger={onTrigger} holdSeconds={3} />);
    await fireEvent(screen.getByTestId('sos-shield'), 'pressIn');
    await act(() => jest.advanceTimersByTime(3200));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('screen readers can trigger it with an action', async () => {
    const onTrigger = jest.fn();
    await render(<SosShield onTrigger={onTrigger} />);
    await fireEvent(screen.getByLabelText('SOS'), 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
    expect(onTrigger).toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('calls onPress and is at least 48dp tall', async () => {
    const onPress = jest.fn();
    await render(<Button label="Start a trip" onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Start a trip' });
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalled();
    const flat = [btn.props.style].flat(Infinity).filter(Boolean).reduce((a: object, s: object) => ({ ...a, ...s }), {}) as { minHeight?: number; height?: number };
    expect(Math.max(flat.minHeight ?? 0, flat.height ?? 0)).toBeGreaterThanOrEqual(48);
  });

  it('does nothing while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Feedback', () => {
  it('Avatar shows initials', async () => {
    await render(<Avatar name="Ama Mensah" />);
    expect(screen.getByText('AM', { includeHiddenElements: true })).toBeTruthy();
  });

  it('EmptyState shows its title', async () => {
    await render(<EmptyState icon="people" title="No contacts yet" body="Add someone to tell when you arrive." />);
    expect(screen.getByText('No contacts yet')).toBeTruthy();
  });
});

describe('theme', () => {
  const ratio = (a: string, b: string) => {
    const lum = (hex: string) => {
      const n = hex.replace('#', '');
      const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };

  it.each(['light', 'dark'] as const)('%s text colours meet WCAG AA', (scheme) => {
    const c = scheme === 'dark' ? dark : light;
    expect(ratio(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c.textMuted, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c.onDanger, c.danger)).toBeGreaterThanOrEqual(4.5);
  });
});
