import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { setSettings } from '../src/lib/settings';
import { colors, radius, space, type } from '../src/ui/theme';
import { GradientButton } from '../src/ui/components';

const CARDS: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }[] = [
  {
    icon: 'sparkles',
    color: colors.accent,
    title: 'What Echo does',
    body: 'Import a chat you already have, organize it by person, and ask things like “Why did they react like that?” — Echo answers with the actual messages as evidence.',
  },
  {
    icon: 'shield-checkmark',
    color: colors.evidence,
    title: 'What Echo is not',
    body: 'Not therapy, not medical advice, not a diagnosis. It won’t read your other apps, track anyone, or tell you for certain what someone else is thinking.',
  },
  {
    icon: 'lock-closed',
    color: colors.alternative,
    title: 'Your privacy',
    body: 'Your raw chats stay on your device by default. We never train on your data, and you can delete any person or conversation anytime.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const accept = async () => {
    await setSettings({ consentAccepted: true });
    router.replace('/');
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={colors.gradientWarm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 80, paddingBottom: 40, paddingHorizontal: space.xl }}>
          <Ionicons name="sparkles" size={36} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 14, letterSpacing: -0.5, lineHeight: 36 }}>
            Stop overthinking your messages.
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16, marginTop: 8, lineHeight: 22 }}>
            Talk it through with an AI that actually knows the context.
          </Text>
        </LinearGradient>

        <View style={{ padding: space.lg, gap: space.md }}>
          {CARDS.map((c) => (
            <View
              key={c.title}
              style={{ flexDirection: 'row', gap: 14, backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.lg, padding: space.lg }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={c.icon} size={20} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{c.title}</Text>
                <Text style={[type.dim, { marginTop: 4 }]}>{c.body}</Text>
              </View>
            </View>
          ))}

          <Text style={[type.small, { textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.md }]}>
            By continuing you confirm you’re 18+, that you have the right to import the conversations you add, and that you
            accept the Terms & Privacy Policy.
          </Text>
          <GradientButton label="I understand — get started" icon="arrow-forward" onPress={accept} style={{ marginTop: space.sm }} />
        </View>
      </ScrollView>
    </View>
  );
}
