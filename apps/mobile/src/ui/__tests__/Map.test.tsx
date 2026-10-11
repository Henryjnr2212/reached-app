import { render, screen } from '@testing-library/react-native';
import { Platform, type View as RNView } from 'react-native';
import { Map } from '../Map';

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual<{ View: typeof RNView }>('react-native');
  const Mock = (props: object) => <View testID="google-map" {...props} />;
  return { __esModule: true, default: Mock, Circle: Mock, Marker: Mock, PROVIDER_GOOGLE: 'google' };
});
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { android: { config: { googleMaps: { apiKey: '' } } } } } }));

describe('Map on Android without a Google Maps key', () => {
  it('shows the sketch map instead of Google Maps, which would crash', async () => {
    Platform.OS = 'android';
    await render(<Map center={{ lat: 5.6037, lng: -0.187 }} testID="map" />);
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.queryByTestId('google-map')).toBeNull();
  });
});
