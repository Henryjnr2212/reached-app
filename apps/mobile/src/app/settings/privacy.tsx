import { RETENTION_OPTIONS } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform } from 'react-native';
import { legalUrl } from '@/features/links';
import { useBackend } from '@/lib/backend';
import { errorMessage, keys, useAction, useProfile } from '@/lib/hooks/queries';
import { Card, ConfirmSheet, ListRow, Screen, SectionTitle, Segmented, Text, useToast } from '@/ui';

export default function PrivacySettings() {
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfile();
  const update = useAction((bk, days: 7 | 30) => bk.updateProfile({ retentionDays: days }), [keys.profile]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    try {
      const data = JSON.stringify(await b.exportData(), null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reached-data.json';
        a.click();
        return;
      }
      const path = `${FileSystem.cacheDirectory}reached-data.json`;
      await FileSystem.writeAsStringAsync(path, data);
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Your Reached data' });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen title="Privacy and data" testID="privacy-settings">
      <Card padded={false}>
        <ListRow title="Privacy Policy" icon="document-text" tint="info" chevron onPress={() => void WebBrowser.openBrowserAsync(`${legalUrl('privacy')}?embed=1`)} />
        <ListRow title="Terms of Use" icon="document" tint="info" chevron onPress={() => void WebBrowser.openBrowserAsync(`${legalUrl('terms')}?embed=1`)} />
        <ListRow title="Who can see my location" icon="eye" tint="primary" chevron onPress={() => router.push('/settings/who-sees')} />
      </Card>
      <SectionTitle>Activity</SectionTitle>
      <Segmented<number>
        label="Keep my activity for"
        options={RETENTION_OPTIONS.map((d) => ({ value: d, label: `${d} days` }))}
        value={profile.data?.retentionDays ?? 30}
        onChange={(v) => update.mutate(v as 7 | 30)}
      />
      <Card padded={false}>
        <ListRow title="Delete my activity now" icon="trash" tint="danger" destructive onPress={() => setConfirm(true)} testID="delete-activity" />
        <ListRow title="Download my data" icon="download" tint="neutral" chevron onPress={download} testID="download-data" />
        <ListRow title="Delete account" icon="person-remove" tint="danger" destructive chevron onPress={() => router.push('/settings/delete-account')} testID="delete-account" />
      </Card>
      {error ? <Text tone="danger">{error}</Text> : null}
      <ConfirmSheet
        visible={confirm}
        title="Delete all your activity?"
        body="Your trips, arrival history and location points are deleted. Your contacts and places stay."
        confirmLabel="Delete activity"
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await b.deleteActivity();
          await qc.invalidateQueries({ queryKey: keys.events });
          setConfirm(false);
          toast('Activity deleted');
        }}
      />
    </Screen>
  );
}
