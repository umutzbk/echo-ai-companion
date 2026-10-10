import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { getSettings } from '../src/lib/settings';
import { colors } from '../src/ui/theme';

/**
 * Root layout. Gates the app behind onboarding/consent: until the user accepts,
 * every route redirects to /onboarding.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [consented, setConsented] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    getSettings().then((s) => {
      setConsented(s.consentAccepted);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onOnboarding = segments[0] === 'onboarding';
    if (!consented && !onOnboarding) router.replace('/onboarding');
    if (consented && onOnboarding) router.replace('/');
  }, [ready, consented, segments]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Echo' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="person/add" options={{ title: 'Add person' }} />
        <Stack.Screen name="person/[id]" options={{ title: 'Person' }} />
        <Stack.Screen name="import" options={{ title: 'Import conversation' }} />
        <Stack.Screen name="chat" options={{ title: 'Reflect' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </>
  );
}
