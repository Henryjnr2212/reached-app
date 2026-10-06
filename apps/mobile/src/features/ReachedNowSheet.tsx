import { formatClock, renderSms } from '@reached/core';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { backendNow } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { areaAt, currentPosition } from '@/lib/device/location';
import { keys, TRIP_KEYS, useAction, useContacts, useProfile } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { BottomSheet, Button, Card, Chip, ChipRow, Text, useToast } from '@/ui';

/** Send "I've reached" now: default contacts ticked, preview with the current area. */
export function ReachedNowSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const contacts = useContacts();
  const profile = useProfile();
  const here = useApp((s) => s.here);
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [area, setArea] = useState('your area');
  const send = useAction(
    async (b, args: { ids: string[]; area: string }) => b.sendReachedNow(args.ids, args.area, here ?? (await currentPosition())),
    [...TRIP_KEYS, keys.events],
  );

  useEffect(() => {
    if (!visible) return;
    setSelected((contacts.data ?? []).filter((c) => c.isDefault && !c.optedOut).map((c) => c.id));
    void (async () => {
      const p = here ?? (await currentPosition());
      if (p) setArea(await areaAt(p));
    })();
    send.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const preview = renderSms('arrived', { name: profile.data?.firstName ?? 'You', place: area, time: formatClock(new Date(backendNow())) });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Send "I've reached" now`} testID="reached-now-sheet">
      <View style={{ gap: 16 }}>
        <ChipRow>
          {(contacts.data ?? []).map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={selected.includes(c.id) ? 'checkmark' : 'add'}
              selected={selected.includes(c.id)}
              onPress={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
              testID={`reached-now-${c.name}`}
            />
          ))}
        </ChipRow>
        <Card tone="muted">
          <Text variant="small" tone="muted">
            THEY'LL GET
          </Text>
          <Text style={{ marginTop: 4 }} testID="reached-now-preview">
            {preview}
          </Text>
        </Card>
        {send.error ? <Text tone="danger">{send.error.message}</Text> : null}
        <Button
          label="Send"
          icon="paper-plane"
          disabled={!selected.length}
          loading={send.isPending}
          testID="reached-now-send"
          onPress={async () => {
            await send.mutateAsync({ ids: selected, area });
            haptic.success();
            toast('Sent. Your people know you have reached.');
            onClose();
          }}
        />
      </View>
    </BottomSheet>
  );
}
