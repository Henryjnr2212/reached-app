import { customMessageBudget, DEFAULT_CUSTOM_MESSAGE, MESSAGE_TOKENS, renderCustom } from '@reached/core';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Card, Chip, ChipRow, Text, TextField } from '@/ui';

const TOKEN_LABELS: Record<(typeof MESSAGE_TOKENS)[number], string> = { '{name}': 'Your name', '{place}': 'Place', '{time}': 'Time' };

/** Message editor: insert name/place/time, live preview and a 160-character budget. */
export function MessageEditor({
  visible,
  title = 'Edit message',
  value,
  sample,
  onSave,
  onClose,
  allowReset = true,
}: {
  visible: boolean;
  title?: string;
  value: string | null;
  sample: { name: string; place: string; time: string };
  onSave: (v: string | null) => void;
  onClose: () => void;
  allowReset?: boolean;
}) {
  const [text, setText] = useState(value ?? DEFAULT_CUSTOM_MESSAGE);
  useEffect(() => {
    if (visible) setText(value ?? DEFAULT_CUSTOM_MESSAGE);
  }, [visible, value]);
  const left = customMessageBudget(text, sample);
  const preview = renderCustom(text, sample);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID="message-editor">
      <View style={{ gap: 14 }}>
        <TextField label="Message" value={text} onChangeText={setText} multiline maxLength={200} testID="message-input" hint={left >= 0 ? `${left} characters left` : undefined} error={left < 0 ? `${-left} characters too long for one text` : null} />
        <ChipRow>
          {MESSAGE_TOKENS.map((tk) => (
            <Chip key={tk} label={`+ ${TOKEN_LABELS[tk]}`} onPress={() => setText((s) => `${s}${s.endsWith(' ') || !s ? '' : ' '}${tk}`)} />
          ))}
        </ChipRow>
        <Card tone="muted">
          <Text variant="small" tone="muted">
            PREVIEW
          </Text>
          <Text style={{ marginTop: 4 }} testID="message-preview">
            {preview}
          </Text>
        </Card>
        <Button label="Save message" disabled={left < 0 || !text.trim()} onPress={() => onSave(text.trim() === DEFAULT_CUSTOM_MESSAGE ? null : text.trim())} testID="message-save" />
        {allowReset ? <Button label="Use the standard message" variant="ghost" onPress={() => onSave(null)} /> : null}
      </View>
    </BottomSheet>
  );
}
