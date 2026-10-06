import { useLocalSearchParams } from 'expo-router';
import { PlaceForm } from '@/features/PlaceForm';
import { usePlaces } from '@/lib/hooks/queries';
import { Screen, SkeletonList } from '@/ui';

export default function EditPlace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const places = usePlaces();
  const place = places.data?.find((p) => p.id === id);
  if (!place)
    return (
      <Screen title="Edit place">
        <SkeletonList />
      </Screen>
    );
  return <PlaceForm place={place} />;
}
