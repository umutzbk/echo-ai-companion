import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GroundedReflection, Message, ObservationKind } from '@echo/core';
import { colors, radius, space, type } from './theme';
import { Card } from './components';
import { relativeBetween, shortTime } from '../lib/relativeTime';

/** Resolve "m3" style refs against the message window the client sent. */
function resolveRefs(refs: string[], messages: Message[]): Message[] {
  return refs
    .map((r) => {
      const idx = parseInt(r.replace(/^m/, ''), 10);
      return Number.isNaN(idx) ? undefined : messages[idx];
    })
    .filter((m): m is Message => !!m);
}

const KIND_META: Record<ObservationKind, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  evidence: { label: 'What the messages show', color: colors.evidence, icon: 'checkmark-circle' },
  interpretation: { label: 'A possible reading', color: colors.interpretation, icon: 'help-circle' },
  alternative: { label: 'Another explanation', color: colors.alternative, icon: 'swap-horizontal' },
  missing_context: { label: "What we can't see", color: colors.missing, icon: 'eye-off' },
};

/** A single cited message rendered as a quoted chat bubble. */
function MessageQuote({ m, latestIso }: { m: Message; latestIso: string | null }) {
  const isMe = m.senderRole === 'me';
  const rel = relativeBetween(m.timestamp, latestIso);
  return (
    <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start', marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <Text style={[type.micro, { color: isMe ? colors.accent : colors.textDim }]}>
          {isMe ? 'You' : m.sender}
        </Text>
        <Text style={[type.micro, { color: colors.textMute }]}>{shortTime(m.timestamp)}</Text>
        {rel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="time-outline" size={10} color={colors.textMute} />
            <Text style={[type.micro, { color: colors.textMute }]}>{rel}</Text>
          </View>
        )}
      </View>
      <View
        style={{
          maxWidth: '88%',
          backgroundColor: isMe ? colors.meBubble : colors.themBubble,
          borderRadius: radius.md,
          borderTopRightRadius: isMe ? 4 : radius.md,
          borderTopLeftRadius: isMe ? radius.md : 4,
          paddingHorizontal: 13,
          paddingVertical: 9,
        }}
      >
        <Text style={[type.body, { fontSize: 14 }]}>{m.mediaOmitted ? '[media omitted]' : m.text}</Text>
      </View>
    </View>
  );
}

function ObservationRow({
  kind,
  text,
  refs,
  messages,
  latestIso,
}: {
  kind: ObservationKind;
  text: string;
  refs: string[];
  messages: Message[];
  latestIso: string | null;
}) {
  const meta = KIND_META[kind];
  const cited = resolveRefs(refs, messages);
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 3, borderRadius: 2, backgroundColor: meta.color, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <Ionicons name={meta.icon} size={13} color={meta.color} />
            <Text style={[type.micro, { color: meta.color, textTransform: 'uppercase' }]}>{meta.label}</Text>
          </View>
          <Text style={type.body}>{text}</Text>
          {cited.map((m, i) => (
            <MessageQuote key={i} m={m} latestIso={latestIso} />
          ))}
        </View>
      </View>
    </View>
  );
}

const OVERTHINK_META = {
  likely_overthinking: { label: 'Likely overthinking', color: colors.evidence, icon: 'leaf' as const },
  mixed: { label: 'A mix', color: colors.interpretation, icon: 'contrast' as const },
  worth_attention: { label: 'Worth attention', color: colors.warn, icon: 'alert-circle' as const },
};

export function GroundedResult({
  data,
  messages,
  title = 'Reflection',
  icon = 'sparkles',
}: {
  data: GroundedReflection;
  messages: Message[];
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const latestIso = messages.length ? messages[messages.length - 1].timestamp : null;
  const ot = data.overthinking ? OVERTHINK_META[data.overthinking.level] : null;

  return (
    <View style={{ gap: space.md }}>
      {/* Empathy header */}
      <Card style={{ borderColor: colors.accent + '44', backgroundColor: colors.accentSoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <Ionicons name={icon} size={15} color={colors.accent} />
          <Text style={[type.micro, { color: colors.accent, textTransform: 'uppercase' }]}>{title}</Text>
        </View>
        <Text style={[type.body, { fontSize: 15.5, lineHeight: 23 }]}>{data.empathy}</Text>
      </Card>

      {/* Observations with cited messages */}
      {data.observations.length > 0 && (
        <Card>
          {data.observations.map((o, i) => (
            <ObservationRow
              key={i}
              kind={o.kind}
              text={o.text}
              refs={o.refs}
              messages={messages}
              latestIso={latestIso}
            />
          ))}
        </Card>
      )}

      {/* Timeline insight */}
      {data.timeline && (
        <Card style={{ borderColor: colors.alternative + '33' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <Ionicons name="git-commit" size={15} color={colors.alternative} />
            <Text style={[type.micro, { color: colors.alternative, textTransform: 'uppercase' }]}>
              Zooming out across time
            </Text>
          </View>
          <Text style={type.body}>{data.timeline.text}</Text>
          {resolveRefs(data.timeline.refs, messages).map((m, i) => (
            <MessageQuote key={i} m={m} latestIso={latestIso} />
          ))}
        </Card>
      )}

      {/* Overthinking gauge */}
      {data.overthinking && ot && (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderColor: ot.color + '33' }}>
          <Ionicons name={ot.icon} size={20} color={ot.color} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[type.h3, { color: ot.color, marginBottom: 3 }]}>{ot.label}</Text>
            <Text style={type.dim}>{data.overthinking.text}</Text>
          </View>
        </Card>
      )}

      {/* Suggestion */}
      {data.suggestion && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <Ionicons name="chatbubble-ellipses" size={15} color={colors.evidence} />
            <Text style={[type.micro, { color: colors.evidence, textTransform: 'uppercase' }]}>A calm next step</Text>
          </View>
          <Text style={type.body}>{data.suggestion}</Text>
        </Card>
      )}

      {/* Grounding question */}
      {data.question && (
        <View style={{ paddingHorizontal: space.sm, paddingVertical: space.sm }}>
          <Text style={[type.dim, { fontStyle: 'italic', textAlign: 'center' }]}>{data.question}</Text>
        </View>
      )}
    </View>
  );
}
