/**
 * Reached design tokens — the single source for colour, spacing, radius and
 * type across the mobile app and the web pages. Change the brand here.
 *
 * Direction (from the sample screens): map-first layouts, floating round white
 * controls with soft shadows, a big red SOS button, pill chips, soft rounded
 * cards, and near-black pill buttons for the main action. Calm green brand.
 *
 * Every text/background pair used in the UI is checked for WCAG AA in
 * packages/core/test/tokens.test.ts.
 */
export const palette = {
  green50: '#ECF8F2',
  green100: '#D3F0E1',
  green200: '#A7E1C4',
  green400: '#3DDC97',
  green500: '#14B87A',
  green600: '#0B8A5C',
  green700: '#0A7550',
  green900: '#05301F',
  ink950: '#0B100E',
  ink900: '#111814',
  ink850: '#141B18',
  ink800: '#1C2521',
  ink700: '#26302C',
  ink500: '#5B6B65',
  ink400: '#8A9993',
  ink300: '#B7C2BD',
  ink200: '#E2E8E5',
  ink100: '#EEF3F1',
  ink50: '#F6F8F7',
  white: '#FFFFFF',
  red50: '#FEECEB',
  red500: '#EF4444',
  red600: '#D92D20',
  red700: '#B42318',
  amber50: '#FEF6E7',
  amber700: '#9A5B05',
  blue50: '#EAF2FF',
  blue700: '#1D4ED8',
  lilac50: '#F1EEFD',
} as const;

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  onPrimarySoft: string;
  accent: string;
  onAccent: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  onDangerSoft: string;
  warningSoft: string;
  onWarningSoft: string;
  infoSoft: string;
  onInfoSoft: string;
  success: string;
  mapWater: string;
  mapLand: string;
  mapRoad: string;
  overlay: string;
  shadow: string;
}

export const light: ColorScheme = {
  background: palette.ink50,
  surface: palette.white,
  surfaceMuted: palette.ink100,
  surfaceRaised: palette.white,
  text: palette.ink900,
  textMuted: palette.ink500,
  textSubtle: '#6B7A74',
  border: palette.ink200,
  primary: palette.green700,
  onPrimary: palette.white,
  primarySoft: palette.green50,
  onPrimarySoft: palette.green700,
  accent: palette.ink900,
  onAccent: palette.white,
  danger: palette.red600,
  onDanger: palette.white,
  dangerSoft: palette.red50,
  onDangerSoft: palette.red700,
  warningSoft: palette.amber50,
  onWarningSoft: palette.amber700,
  infoSoft: palette.blue50,
  onInfoSoft: palette.blue700,
  success: palette.green600,
  mapWater: '#CFE6F5',
  mapLand: '#EEF2EC',
  mapRoad: '#FFFFFF',
  overlay: 'rgba(11,16,14,0.45)',
  shadow: 'rgba(17,24,20,0.12)',
};

export const dark: ColorScheme = {
  background: palette.ink950,
  surface: palette.ink850,
  surfaceMuted: palette.ink800,
  surfaceRaised: palette.ink800,
  text: '#F1F5F3',
  textMuted: '#A3B1AB',
  textSubtle: '#8E9C96',
  border: palette.ink700,
  primary: palette.green400,
  onPrimary: palette.green900,
  primarySoft: '#123526',
  onPrimarySoft: '#7BE9B9',
  accent: '#F1F5F3',
  onAccent: palette.ink900,
  danger: '#F25A50',
  onDanger: '#1A0503',
  dangerSoft: '#3A1513',
  onDangerSoft: '#FFB4AD',
  warningSoft: '#33240A',
  onWarningSoft: '#F8C66B',
  infoSoft: '#122340',
  onInfoSoft: '#9CC0FF',
  success: palette.green400,
  mapWater: '#1A2A36',
  mapLand: '#151C19',
  mapRoad: '#25302B',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: 'rgba(0,0,0,0.5)',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

/** Minimum touch target in dp (Android) / pt (iOS). */
export const TOUCH_TARGET = 48;

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const typeScale = {
  display: { fontSize: 30, lineHeight: 36, fontFamily: fontFamily.extrabold, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontFamily: fontFamily.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.semibold },
  label: { fontSize: 14, lineHeight: 18, fontFamily: fontFamily.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.medium },
  small: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.medium },
} as const;

export type TypeVariant = keyof typeof typeScale;

/** WCAG relative luminance contrast ratio for two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Text/background pairs the UI actually uses; all must reach 4.5:1. */
export function textPairs(c: ColorScheme): [string, string, string][] {
  return [
    ['text on background', c.text, c.background],
    ['text on surface', c.text, c.surface],
    ['text on surfaceMuted', c.text, c.surfaceMuted],
    ['muted on background', c.textMuted, c.background],
    ['muted on surface', c.textMuted, c.surface],
    ['subtle on surface', c.textSubtle, c.surface],
    ['onPrimary on primary', c.onPrimary, c.primary],
    ['onPrimarySoft on primarySoft', c.onPrimarySoft, c.primarySoft],
    ['onAccent on accent', c.onAccent, c.accent],
    ['onDanger on danger', c.onDanger, c.danger],
    ['onDangerSoft on dangerSoft', c.onDangerSoft, c.dangerSoft],
    ['onWarningSoft on warningSoft', c.onWarningSoft, c.warningSoft],
    ['onInfoSoft on infoSoft', c.onInfoSoft, c.infoSoft],
    ['primary text on surface', c.primary, c.surface],
    ['danger text on surface', c.danger, c.surface],
  ];
}
