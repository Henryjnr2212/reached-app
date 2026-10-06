import { BATTERY_GUIDES } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { openBatterySettings, phoneBrand } from '@/lib/device/battery';
import { getLocationAccess, requestBackgroundLocation, requestForegroundLocation } from '@/lib/device/location';
import { getNotificationAccess, requestNotifications } from '@/lib/device/notifications';
import { errorMessage, keys } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Button, Card, Icon, IconTile, Screen, Text, useTheme } from '@/ui';

function Row({ title, ok, body, onFix, testID }: { title: string; ok: boolean; body: string; onFix: () => void; testID: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 }} testID={testID}>
      <IconTile icon={ok ? 'checkmark' : 'alert'} tint={ok ? 'primary' : 'danger'} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
      {ok ? <Icon name="checkmark-circle" size={22} color={t.colors.success} /> : <Button label="Fix" size="md" full={false} onPress={onFix} />}
    </View>
  );
}

export default function Permissions() {
  const b = useBackend();
  const qc = useQueryClient();
  const { location, notifications, battery, contactsAccess, set } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixLocation = async () => {
    if (location === 'undetermined') await requestForegroundLocation();
    else if (location === 'foreground') {
      if (!(await requestBackgroundLocation())) await Linking.openSettings();
    } else await Linking.openSettings();
    set({ location: await getLocationAccess() });
  };

  return (
    <Screen title="Permissions and battery" testID="permissions-screen">
      <Card padded={false}>
        <Row
          testID="perm-location"
          title="Location"
          ok={location === 'always'}
          body={location === 'always' ? 'Allowed all the time' : location === 'foreground' ? 'Needs "Allow all the time"' : 'Off. Arrivals won\'t be detected.'}
          onFix={fixLocation}
        />
        <Row
          testID="perm-notifications"
          title="Notifications"
          ok={notifications === 'granted'}
          body={notifications === 'granted' ? 'On' : "Off. We can't check on you."}
          onFix={async () => {
            if (!(await requestNotifications())) await Linking.openSettings();
            set({ notifications: await getNotificationAccess() });
          }}
        />
        {Platform.OS === 'android' ? (
          <Row
            testID="perm-battery"
            title="Battery"
            ok={battery !== 'restricted'}
            body={battery === 'restricted' ? 'Restricted. Your phone may stop Reached.' : 'Unrestricted'}
            onFix={() => void openBatterySettings()}
          />
        ) : null}
        <Row testID="perm-contacts" title="Contacts access" ok={contactsAccess !== 'denied'} body="Only used when you choose someone" onFix={() => void Linking.openSettings()} />
      </Card>
      {Platform.OS === 'android' ? (
        <Card tone="muted">
          <Text variant="headline">Extra steps on {BATTERY_GUIDES[phoneBrand()].label}</Text>
          {BATTERY_GUIDES[phoneBrand()].steps.map((s, i) => (
            <Text key={s} style={{ marginTop: 6 }}>{`${i + 1}. ${s}`}</Text>
          ))}
        </Card>
      ) : null}
      <Card>
        <Text variant="headline">Run a test</Text>
        <Text tone="muted" style={{ marginTop: 4 }}>
          Pretends you arrived and texts the message to you only.
        </Text>
        <Button
          label="Run a test"
          icon="flask"
          variant="secondary"
          style={{ marginTop: 12 }}
          loading={busy}
          testID="run-test"
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              const id = await b.runSelfTest();
              await qc.invalidateQueries({ queryKey: keys.events });
              router.push({ pathname: '/event/[id]', params: { id } });
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        {error ? <Text tone="danger">{error}</Text> : null}
      </Card>
    </Screen>
  );
}
