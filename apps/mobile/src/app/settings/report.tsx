import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';
import { useBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Button, Card, Screen, SwitchRow, Text, TextField, useToast } from '@/ui';

/** Report a problem. Logs never include precise locations. */
export default function Report() {
  const b = useBackend();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [logs, setLogs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = useApp.getState();
      const info = {
        app: Application.nativeApplicationVersion,
        build: Application.nativeBuildVersion,
        os: `${Platform.OS} ${Platform.Version}`,
        device: `${Device.manufacturer ?? ''} ${Device.modelName ?? ''}`.trim(),
        location: s.location,
        notifications: s.notifications,
        battery: s.battery,
        online: s.online,
      };
      await b.reportProblem(body.trim(), logs ? JSON.stringify(info) : null);
      toast('Thanks. We read every report.');
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Report a problem" footer={<Button label="Send report" onPress={send} disabled={body.trim().length < 5} loading={busy} />}>
      <TextField label="What happened?" value={body} onChangeText={setBody} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} placeholder="e.g. Mom didn't get my text when I reached work" />
      <Card padded={false}>
        <SwitchRow title="Attach app logs" subtitle="Phone model, app version and permission status. Never your location." value={logs} onChange={setLogs} icon="document-attach" tint="neutral" />
      </Card>
      {error ? <Text tone="danger">{error}</Text> : null}
    </Screen>
  );
}
