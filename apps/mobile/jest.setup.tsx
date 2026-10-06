/* Jest setup for apps/mobile: native modules the tests touch are mocked here. */
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const Stub = ({ children }: { children?: unknown }) => children ?? null;
  return { __esModule: true, default: View, Svg: View, Circle: Stub, Path: Stub, G: Stub, Defs: Stub, LinearGradient: Stub, Stop: Stub, Rect: Stub };
});

jest.mock('@expo/vector-icons/Ionicons', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <View /> };
});
