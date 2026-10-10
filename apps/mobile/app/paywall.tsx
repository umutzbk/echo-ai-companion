import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { activatePro, FREE_DAILY_LIMIT, PRICING } from '../src/lib/subscription';
import { colors, radius, shadow, space, type } from '../src/ui/theme';
import { GradientButton } from '../src/ui/components';

const FEATURES = [
  { icon: 'infinite', text: 'Unlimited evidence-grounded reflections' },
  { icon: 'eye', text: 'Reality Check mode — facts vs. interpretation' },
  { icon: 'chatbubbles', text: 'Reply drafts in three calm styles' },
  { icon: 'time', text: 'Timeline insights across your whole history' },
  { icon: 'lock-closed', text: 'Your raw chats stay private on your device' },
] as const;

export default function Paywall() {
  const router = useRouter();
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');

  const subscribe = async () => {
    // Real billing (App Store / RevenueCat) needs a native dev build — not Expo Go.
    // For the MVP this grants Pro locally so you can test the full experience.
    await activatePro();
    Alert.alert('Welcome to Echo Pro', 'Everything is unlocked. (Test mode — no charge.)', [
      { text: 'Start reflecting', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={colors.gradientWarm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.xl, paddingTop: 64, paddingBottom: 36 }}>
        <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: 56, right: 20 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Ionicons name="sparkles" size={34} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 12, letterSpacing: -0.5 }}>
          Echo Pro
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 6, lineHeight: 21 }}>
          Stop overthinking. Understand every conversation with an AI that knows the context.
        </Text>
      </LinearGradient>

      <View style={{ padding: space.lg, gap: space.md }}>
        {FEATURES.map((f) => (
          <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={f.icon as any} size={17} color={colors.accent} />
            </View>
            <Text style={[type.body, { flex: 1 }]}>{f.text}</Text>
          </View>
        ))}

        <View style={{ height: space.sm }} />

        {(['annual', 'monthly'] as const).map((p) => {
          const info = PRICING[p];
          const active = plan === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPlan(p)}
              style={[
                {
                  borderWidth: 1.5,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.surface,
                  borderRadius: radius.lg,
                  padding: space.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                active && shadow(8),
              ]}
            >
              <View>
                <Text style={[type.h3, { textTransform: 'capitalize' }]}>{p}</Text>
                {'note' in info && info.note && (
                  <Text style={[type.micro, { color: colors.evidence, marginTop: 2 }]}>{info.note}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[type.h2]}>{info.price}</Text>
                <Text style={type.small}>per {info.period}</Text>
              </View>
            </Pressable>
          );
        })}

        <GradientButton label="Start Echo Pro" icon="sparkles" onPress={subscribe} style={{ marginTop: space.sm }} />
        <Text style={[type.small, { textAlign: 'center' }]}>
          Free includes {FREE_DAILY_LIMIT} reflections per day. Cancel anytime.
        </Text>
        <Text style={[type.micro, { textAlign: 'center', color: colors.textMute }]}>
          Test mode in Expo Go — no real charge. Real billing requires a native build.
        </Text>
      </View>
    </ScrollView>
  );
}
