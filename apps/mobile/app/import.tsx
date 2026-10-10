import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
// SDK 54 turned the legacy readAsStringAsync into a throwing error on the main import;
// the legacy subpath keeps the same API working as a drop-in.
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { parseWhatsApp, type ParseResult } from '@echo/core';
import { recentMessages, saveImport, saveMemories } from '../src/lib/store';
import { summarize } from '../src/lib/api';
import { CloudDisabledError } from '../src/lib/api';
import { getPerson } from '../src/lib/store';
import { colors, radius, space, type } from '../src/ui/theme';
import { Button, Card, GradientButton, SectionLabel } from '../src/ui/components';

type Step = 'choose' | 'pickName' | 'preview';

/**
 * Read the picked file as a WhatsApp chat .txt. WhatsApp exports on iOS/Android are
 * usually a .zip containing `_chat.txt` (plus any media), so we transparently unzip and
 * pull out the first .txt. Plain .txt files are read directly.
 */
async function extractConversationText(uri: string, name: string): Promise<string> {
  const isZip = /\.zip$/i.test(name);
  if (!isZip) {
    return FileSystem.readAsStringAsync(uri);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const entries = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const txtName =
    entries.find((n) => /_chat\.txt$/i.test(n)) ?? entries.find((n) => /\.txt$/i.test(n));
  if (!txtName) {
    throw new Error('No .txt chat file found inside the zip.');
  }
  return zip.files[txtName].async('string');
}

export default function ImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [raw, setRaw] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Parse first WITHOUT myName so we can ask which participant is "me".
  const ingest = (text: string, name: string | null) => {
    const result = parseWhatsApp(text);
    setRaw(text);
    setFileName(name);
    setParsed(result);
    setStep('pickName');
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/zip', '*/*'] });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      const text = await extractConversationText(asset.uri, asset.name);
      ingest(text, asset.name);
    } catch (e: any) {
      Alert.alert('Could not read that file', e?.message ?? 'Try a WhatsApp .txt export or paste the text.');
    }
  };

  const chooseMe = (name: string) => {
    const result = parseWhatsApp(raw, { myName: name });
    setParsed(result);
    setStep('preview');
  };

  const confirmSave = async () => {
    if (!parsed || !id) return;
    setBusy(true);
    try {
      await saveImport(id, 'whatsapp', fileName, parsed.messages);
      // Offer to generate memory (cloud) right away.
      Alert.alert('Imported', `${parsed.messages.length} messages saved on this device.`, [
        { text: 'Done', onPress: () => router.replace(`/person/${id}`) },
        { text: 'Generate memory', onPress: generateMemory },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const generateMemory = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const person = await getPerson(id);
      const msgs = await recentMessages(id, 80);
      const { memories } = await summarize(
        { name: person!.name, relationshipType: person!.relationshipType, notes: person!.notes },
        msgs
      );
      await saveMemories(id, memories);
      router.replace(`/person/${id}`);
    } catch (e: any) {
      if (e instanceof CloudDisabledError) {
        Alert.alert('Cloud analysis is off', 'Your import is saved locally. Turn on Cloud Analysis in Settings to generate memory.', [
          { text: 'OK', onPress: () => router.replace(`/person/${id}`) },
        ]);
      } else {
        Alert.alert('Could not generate memory', 'Saved locally. Try again later.');
        router.replace(`/person/${id}`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={type.small}>Working…</Text>
      </View>
    );
  }

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: space.lg,
    fontSize: 14,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 50 }}>
      <Card style={{ flexDirection: 'row', gap: 12, borderColor: colors.accent + '33', backgroundColor: colors.accentSoft }}>
        <Ionicons name="lock-closed" size={18} color={colors.accent} style={{ marginTop: 2 }} />
        <Text style={[type.dim, { flex: 1, color: colors.text }]}>
          Importing brings a conversation you already own onto this device. Raw messages stay local — only enable cloud
          analysis if you want AI memory & reflections.
        </Text>
      </Card>

      <View style={{ height: space.lg }} />

      {step === 'choose' && (
        <>
          <SectionLabel>Choose a source</SectionLabel>
          <GradientButton label="WhatsApp export (.txt or .zip)" icon="logo-whatsapp" onPress={pickFile} />
          <Text style={[type.small, { textAlign: 'center', marginVertical: space.md }]}>— or paste a conversation —</Text>
          <TextInput
            style={[inputStyle, { minHeight: 150, textAlignVertical: 'top' }]}
            multiline
            placeholder={'[07/03/2024, 14:05] Ömer: hey\n[07/03/2024, 14:06] Me: hi'}
            placeholderTextColor={colors.textMute}
            onChangeText={setRaw}
            value={raw}
          />
          <Button label="Parse pasted text" icon="text-outline" style={{ marginTop: space.sm }} onPress={() => raw.trim() && ingest(raw, null)} />
        </>
      )}

      {step === 'pickName' && parsed && (
        <>
          <SectionLabel>Which name is you?</SectionLabel>
          <Text style={[type.dim, { marginBottom: space.md }]}>So Echo knows which messages are yours.</Text>
          {parsed.participants.map((name) => (
            <Pressable
              key={name}
              onPress={() => chooseMe(name)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.lg,
                marginBottom: 10,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={type.body}>{name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
            </Pressable>
          ))}
          {parsed.participants.length === 0 && (
            <Text style={type.dim}>No participants detected — this may not be a WhatsApp export. Try paste mode.</Text>
          )}
        </>
      )}

      {step === 'preview' && parsed && (
        <>
          <SectionLabel>Preview</SectionLabel>
          <Text style={[type.dim, { marginBottom: space.md }]}>
            {parsed.messages.length} messages · {parsed.unparsedLines.length} unparsed lines
          </Text>
          {parsed.messages.filter((m) => m.senderRole !== 'system').slice(-6).map((m, i) => {
            const isMe = m.senderRole === 'me';
            return (
              <View key={i} style={{ alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <Text style={[type.micro, { color: isMe ? colors.accent : colors.textDim, marginBottom: 2 }]}>
                  {isMe ? 'You' : m.sender}
                </Text>
                <View style={{ maxWidth: '85%', backgroundColor: isMe ? colors.meBubble : colors.themBubble, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 9 }}>
                  <Text style={[type.body, { fontSize: 14 }]}>{m.mediaOmitted ? '[media omitted]' : m.text}</Text>
                </View>
              </View>
            );
          })}
          <GradientButton label="Save to device" icon="save-outline" style={{ marginTop: space.md }} onPress={confirmSave} />
        </>
      )}
    </ScrollView>
  );
}
