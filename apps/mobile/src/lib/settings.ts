import * as SecureStore from 'expo-secure-store';
import { IS_TEST } from './config';

/**
 * App settings + consent, stored in the OS secure store. `cloudAnalysis` gates whether
 * ANY message-derived content may leave the device. `privacyMode` is a stricter switch
 * that keeps everything local (AI cloud features disabled).
 */
export interface Settings {
  consentAccepted: boolean;
  cloudAnalysis: boolean;
  privacyMode: boolean;
  modelTier: 'light' | 'deep';
}

const KEY = 'echo.settings.v1';

const DEFAULTS: Settings = {
  consentAccepted: false,
  // Local-by-default for privacy; in test builds we default it on for frictionless testing.
  cloudAnalysis: IS_TEST,
  privacyMode: false,
  modelTier: 'deep',
};

export async function getSettings(): Promise<Settings> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  return next;
}

/** Cloud calls are only allowed when cloud analysis is on AND privacy mode is off. */
export function cloudAllowed(s: Settings): boolean {
  return s.cloudAnalysis && !s.privacyMode;
}
