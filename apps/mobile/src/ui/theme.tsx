import { dark, light, radius, spacing, typeScale, type ColorScheme } from '@reached/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type Appearance = 'light' | 'dark' | 'system';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof typeScale;
  /** Soft floating shadow used by map controls and cards. */
  shadow: object;
}

function buildTheme(scheme: 'light' | 'dark'): Theme {
  const colors = scheme === 'dark' ? dark : light;
  return {
    scheme,
    colors,
    spacing,
    radius,
    type: typeScale,
    shadow: {
      shadowColor: '#0B100E',
      shadowOpacity: scheme === 'dark' ? 0.45 : 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({ appearance, children }: { appearance: Appearance; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
