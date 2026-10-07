import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { palette } from '@reached/core';

/** Reached mark: a location pin with a check, on a calm green tile. */
export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Reached">
      <Rect x={0} y={0} width={64} height={64} rx={20} fill={palette.green700} />
      <Path d="M32 12c-8.3 0-15 6.5-15 14.6C17 37.5 32 52 32 52s15-14.5 15-25.4C47 18.5 40.3 12 32 12z" fill={palette.white} />
      <Circle cx={32} cy={27} r={9} fill={palette.green700} />
      <Path d="M28 27.2l3 3 5.4-6" stroke={palette.white} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
