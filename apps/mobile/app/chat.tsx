import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Message, PersonMemory } from '@echo/core';
import { getPerson, listMemories, recentMessages, Person } from '../src/lib/store';
import {
  CloudDisabledError,
  grounded as apiGrounded,
  realityCheck,
  replyDrafts,
  type PersonContext,
  type ReflectResponse,
} from '../src/lib/api';
import { checkAllowance, recordReflection } from '../src/lib/subscription';
import { colors, radius, space, type } from '../src/ui/theme';
import { Button, Card, Chip, GradientButton, IconCircle, SectionLabel } from '../src/ui/components';
import { GroundedResult } from '../src/ui/GroundedResult';

const CHIPS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Why did they act like that?', icon: 'help-circle-outline' },
  { label: 'Am I overthinking this?', icon: 'leaf-outline' },
  { label: 'Was I wrong here?', icon: 'scale-outline' },
  { label: 'What changed recently?', icon: 'trending-up-outline' },
  { label: 'Give me a reality check', icon: 'eye-outline' },
];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<PersonMemory[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ReflectResponse | null>(null);
  const [resultKind, setResultKind] = useState<'grounded' | 'reality' | 'drafts'>('grounded');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    getPerson(id).then(setPerson);
    recentMessages(id, 40).then(setMessages);
    listMemories(id).then(setMemories);
  }, [id]);

  const ctx = (): PersonContext => ({
    person: { name: person!.name, relationshipType: person!.relationshipType, notes: person!.notes },
    memories,
    recentMessages: messages,
    summaries: [],
  });

  const run = async (kind: 'grounded' | 'reality' | 'drafts', q: string) => {
    if (!person || !q.trim()) return;

    const allow = await checkAllowance();
    if (!allow.allowed) {
      router.push('/paywall');
      return;
    }

    setBusy(kind);
    setResult(null);
    setResultKind(kind);
    try {
      const res =
        kind === 'reality' ? await realityCheck(q, ctx())
        : kind === 'drafts' ? await replyDrafts(q, ctx())
        : await apiGrounded(q, ctx());
      setResult(res);
      await recordReflection();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      if (e instanceof CloudDisabledError) {
        setResult({ answer: e.message, safety: { category: 'normal' } as any, model: 'local' });
      } else {
        setResult({ answer: 'Could not reach the server. Check that the backend is running.', safety: {} as any, model: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  if (!person) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const safetyHigh =
    result?.safety && ['self_harm', 'crisis', 'abuse_coercive_control'].includes(result.safety.category as string);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <IconCircle icon="sparkles" size={34} />
        <View>
          <Text style={type.h2}>Reflect on {person.name}</Text>
          <Text style={type.small}>
            Using {messages.length} recent messages · {memories.length} memory notes
          </Text>
        </View>
      </View>

      <SectionLabel>Quick questions</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CHIPS.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            icon={c.icon}
            onPress={() => {
              setQuestion(c.label);
              run(c.label.includes('reality') ? 'reality' : 'grounded', c.label);
            }}
          />
        ))}
      </View>

      <TextInput
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          color: colors.text,
          padding: space.lg,
          fontSize: 15,
          minHeight: 92,
          textAlignVertical: 'top',
          marginTop: space.sm,
        }}
        multiline
        placeholder="Tell me what's on your mind about this conversation…"
        placeholderTextColor={colors.textMute}
        value={question}
        onChangeText={setQuestion}
      />

      <View style={{ marginTop: space.md, gap: space.sm }}>
        <GradientButton
          label="Reflect with evidence"
          icon="sparkles"
          loading={busy === 'grounded'}
          onPress={() => run('grounded', question)}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            label="Reality check"
            icon="eye-outline"
            style={{ flex: 1 }}
            onPress={() => run('reality', question || 'Give me a reality check')}
          />
          <Button
            label="Draft replies"
            icon="chatbubbles-outline"
            style={{ flex: 1 }}
            onPress={() => run('drafts', question || 'What should I reply?')}
          />
        </View>
      </View>

      {busy && (
        <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: 10 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={type.small}>Reading the conversation…</Text>
        </View>
      )}

      {result && !busy && (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {safetyHigh && (
            <Card style={{ borderColor: colors.warn + '55', backgroundColor: colors.warn + '14' }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Ionicons name="heart" size={18} color={colors.warn} style={{ marginTop: 2 }} />
                <Text style={[type.dim, { flex: 1, color: colors.text }]}>
                  This sounds serious. Echo isn't a crisis service — if you might be in danger, please reach out to
                  someone you trust or your local emergency number.
                </Text>
              </View>
            </Card>
          )}

          {result.grounded ? (
            <GroundedResult
              data={result.grounded}
              messages={messages}
              title={resultKind === 'reality' ? 'Reality check' : 'Reflection'}
              icon={resultKind === 'reality' ? 'eye' : 'sparkles'}
            />
          ) : result.drafts ? (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="color-wand" size={14} color={colors.accent} />
                <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>Reply drafts · in your voice</SectionLabel>
              </View>
              {result.drafts.map((d) => (
                <Card key={d.style}>
                  <Text style={[type.micro, { color: colors.accent, textTransform: 'uppercase', marginBottom: 5 }]}>
                    {d.style.replace(/_/g, ' ')}
                  </Text>
                  <Text style={type.body}>{d.text}</Text>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <Text style={type.body}>{result.answer}</Text>
            </Card>
          )}

          <Text style={[type.micro, { textAlign: 'center', color: colors.textMute }]}>
            {result.model === 'mock' ? 'demo response · add an API key for real analysis' : `model: ${result.model}`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
