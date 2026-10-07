import type { LatLng } from '@reached/core';
import type { StyleProp, ViewStyle } from 'react-native';

export interface MapMarker extends LatLng {
  id: string;
  label: string;
  kind: 'me' | 'place' | 'destination' | 'police' | 'alert';
}

export interface MapProps {
  center: LatLng;
  /** Approximate span shown, in metres. */
  span?: number;
  zone?: (LatLng & { radius: number }) | null;
  markers?: MapMarker[];
  me?: LatLng | null;
  onPressMap?: (p: LatLng) => void;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export const DEFAULT_SPAN = 1500;
