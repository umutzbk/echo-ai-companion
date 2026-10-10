import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { RelationshipType } from '@echo/core';
import { createPerson } from '../../src/lib/store';
import { colors, radius, space, type } from '../../src/ui/theme';
import { Chip, GradientButton, SectionLabel } from '../../src/ui/components';

const TYPES: RelationshipType[] = ['friend', 'partner', 'family', 'roommate', 'manager', 'coworker', 'dating', 'other'];

export default function AddPerson() {
  const [name, setName] = useState('');
  const [relationshipType, setType] = useState<RelationshipType>('friend');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  const save = async () => {
    if (!name.trim()) return;
    const p = await createPerson({ name: name.trim(), relationshipType, notes: notes.trim() || undefined });
    router.replace(`/person/${p.id}`);
  };

  const input = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: space.lg,
    fontSize: 15,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg }}>
      <SectionLabel>Their name</SectionLabel>
      <TextInput style={input} value={name} onChangeText={setName} placeholder="e.g. Ömer" placeholderTextColor={colors.textMute} />

      <SectionLabel style={{ marginTop: space.lg }}>Relationship</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {TYPES.map((t) => (
          <Chip key={t} label={t} active={relationshipType === t} onPress={() => setType(t)} />
        ))}
      </View>

      <SectionLabel style={{ marginTop: space.lg }}>Context (optional)</SectionLabel>
      <TextInput
        style={[input, { minHeight: 100, textAlignVertical: 'top' }]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Anything that helps — e.g. my mentee, we’ve been working together 2 months on a training plan."
        placeholderTextColor={colors.textMute}
      />

      <GradientButton label="Create" icon="checkmark" onPress={save} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}
