import { useCallback, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, setSettings, type Settings } from '../src/lib/settings';
import { deactivatePro, getSubscription, type SubscriptionState } from '../src/lib/subscription';
import { IS_TEST } from '../src/lib/config';
import { colors, space, type } from '../src/ui/theme';
import { Button, Card, Chip, GradientButton, SectionLabel } from '../src/ui/components';

export default function SettingsScreen() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setLocal);
      getSubscription().then(setSub);
    }, [])
  );

  const update = async (patch: Partial<Settings>) => setLocal(await setSettings(patch));

  if (!settings || !sub) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const isPro = sub.plan === 'pro';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <SectionLabel>Subscription</SectionLabel>
      {IS_TEST ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="flask" size={22} color={colors.evidence} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>Test mode</Text>
              <Text style={type.small}>All features unlocked · no plan or billing</Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card style={{ borderColor: isPro ? colors.accent + '55' : colors.borderSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={isPro ? 'sparkles' : 'sparkles-outline'} size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{isPro ? 'Echo Pro' : 'Free plan'}</Text>
              <Text style={type.small}>
                {isPro ? 'Unlimited reflections unlocked' : `${sub.reflectionsToday} reflections used today`}
              </Text>
            </View>
          </View>
          {isPro ? (
            <Button label="Switch back to Free (test)" style={{ marginTop: space.md }} onPress={async () => setSub(await deactivatePro().then(getSubscription))} />
          ) : (
            <GradientButton label="Upgrade to Pro" icon="sparkles" style={{ marginTop: space.md }} onPress={() => router.push('/paywall')} />
          )}
        </Card>
      )}

      <SectionLabel style={{ marginTop: space.xl }}>Privacy</SectionLabel>
      <Card>
        <Row
          label="Cloud analysis"
          desc="Allow Echo to send the small, relevant pieces of a conversation to the AI for reflections and memory. Off = everything stays on device."
          value={settings.cloudAnalysis}
          onChange={(v) => update({ cloudAnalysis: v })}
        />
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />
        <Row
          label="Privacy mode"
          desc="Stricter: keeps all data on device and disables every cloud feature, even if cloud analysis is on."
          value={settings.privacyMode}
          onChange={(v) => update({ privacyMode: v })}
        />
      </Card>

      <SectionLabel style={{ marginTop: space.xl }}>AI model</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row' }}>
          {(['deep', 'light'] as const).map((t) => (
            <Chip key={t} label={t === 'deep' ? 'Deep · stronger' : 'Light · faster'} active={settings.modelTier === t} onPress={() => update({ modelTier: t })} />
          ))}
        </View>
      </Card>

      <SectionLabel style={{ marginTop: space.xl }}>Your data</SectionLabel>
      <Card>
        <Text style={type.dim}>
          Raw conversations never leave this device unless you turn on cloud analysis. Echo doesn’t train on your data.
          Delete any person from their profile to wipe their messages and memory.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Row(props: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={type.h3}>{props.label}</Text>
        <Switch value={props.value} onValueChange={props.onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#fff" />
      </View>
      <Text style={[type.small, { marginTop: 4 }]}>{props.desc}</Text>
    </View>
  );
}
