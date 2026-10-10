import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PersonMemory } from '@echo/core';
import { deletePerson, getPerson, listMemories, Person } from '../../src/lib/store';
import { colors, radius, space, type } from '../../src/ui/theme';
import { Avatar, Button, Card, GradientButton, SectionLabel } from '../../src/ui/components';

const KIND: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  summary: { label: 'Summary', color: colors.accent, icon: 'document-text' },
  tone: { label: 'Relationship tone', color: colors.alternative, icon: 'pulse' },
  pattern: { label: 'Recurring pattern', color: colors.interpretation, icon: 'repeat' },
  unresolved: { label: 'Unresolved', color: colors.warn, icon: 'help-circle' },
  positive: { label: 'Positive signal', color: colors.evidence, icon: 'heart' },
  stress: { label: 'Possible stress point', color: colors.danger, icon: 'flash' },
};

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<Person | null>(null);
  const [memories, setMemories] = useState<PersonMemory[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getPerson(id).then(setPerson);
      listMemories(id).then(setMemories);
    }, [id])
  );

  const confirmDelete = () => {
    Alert.alert('Delete person?', 'This removes their conversations, messages and memories from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePerson(id!); router.replace('/'); } },
    ]);
  };

  if (!person) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <View style={{ alignItems: 'center', marginBottom: space.lg }}>
        <Avatar name={person.name} size={72} />
        <Text style={[type.h1, { marginTop: 12 }]}>{person.name}</Text>
        <Text style={[type.dim, { textTransform: 'capitalize' }]}>
          {person.relationshipType}
          {person.notes ? ` · ${person.notes}` : ''}
        </Text>
      </View>

      <GradientButton label="Reflect" icon="sparkles" onPress={() => router.push({ pathname: '/chat', params: { id } })} />
      <Button label="Import a conversation" icon="cloud-upload-outline" style={{ marginTop: space.sm }} onPress={() => router.push({ pathname: '/import', params: { id } })} />

      <SectionLabel style={{ marginTop: space.xl }}>Memory</SectionLabel>
      {memories.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Ionicons name="bulb-outline" size={30} color={colors.textMute} />
          <Text style={[type.dim, { textAlign: 'center', marginTop: 8 }]}>
            No memory yet. Import a conversation and tap “Generate memory” to build a grounded picture of this
            relationship.
          </Text>
        </Card>
      ) : (
        memories.map((m, i) => {
          const meta = KIND[m.kind] ?? KIND.summary;
          return (
            <Card key={m.id ?? i} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={meta.icon} size={14} color={meta.color} />
                  <Text style={[type.micro, { color: meta.color, textTransform: 'uppercase' }]}>{meta.label}</Text>
                </View>
                <Text style={type.micro}>{Math.round(m.confidence * 100)}% sure</Text>
              </View>
              {/* confidence bar */}
              <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(m.confidence * 100)}%`, height: 3, backgroundColor: meta.color }} />
              </View>
              <Text style={type.body}>{m.content}</Text>
              {!!m.evidence?.length && (
                <View style={{ marginTop: 8, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 10 }}>
                  <Text style={[type.small, { fontStyle: 'italic' }]}>“{m.evidence[0].quote}”</Text>
                </View>
              )}
            </Card>
          );
        })
      )}

      <Button label="Delete person" icon="trash-outline" variant="danger" style={{ marginTop: space.xl }} onPress={confirmDelete} />
    </ScrollView>
  );
}
