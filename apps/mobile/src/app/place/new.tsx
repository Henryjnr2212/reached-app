import { useLocalSearchParams } from 'expo-router';
import { PlaceForm } from '@/features/PlaceForm';

/** Add place; a suggested place arrives with its name and position filled in. */
export default function NewPlace() {
  const { name, lat, lng } = useLocalSearchParams<{ name?: string; lat?: string; lng?: string }>();
  const initial = name && lat && lng && Number.isFinite(+lat) && Number.isFinite(+lng) ? { name, lat: +lat, lng: +lng } : undefined;
  return <PlaceForm initial={initial} />;
}
