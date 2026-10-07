import { parseDriverCard, type DriverCard } from '@reached/core';
import { Platform } from 'react-native';

/**
 * Reads a ride-app driver card screenshot on the phone (ML Kit, no upload)
 * and returns a first guess the user confirms. Web has no on-device OCR.
 */
export async function recognizeDriverCard(uri: string): Promise<DriverCard | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
    const result = await TextRecognition.recognize(uri);
    const lines = result.blocks.flatMap((b) => b.lines.map((l) => l.text));
    const card = parseDriverCard(lines);
    return card.plate || card.driverName || card.car ? card : null;
  } catch {
    return null;
  }
}
