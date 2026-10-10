import * as SecureStore from 'expo-secure-store';
import { IS_TEST } from './config';

/**
 * Subscription / entitlement state.
 *
 * Echo Pro unlocks unlimited reflections + Reality Check + reply drafts. Free users get
 * a few reflections per day. Real billing (App Store / RevenueCat) requires a native dev
 * build and store setup — it does NOT work in Expo Go — so the purchase action here is a
 * stub that grants entitlement locally for testing. The gating logic is real and ships.
 */
export type Plan = 'free' | 'pro';

export interface SubscriptionState {
  plan: Plan;
  /** ISO date (yyyy-mm-dd) of the counted day. */
  day: string;
  reflectionsToday: number;
}

const KEY = 'echo.subscription.v1';
export const FREE_DAILY_LIMIT = 5;

export const PRICING = {
  monthly: { id: 'echo_pro_monthly', price: '$7.99', period: 'month' },
  annual: { id: 'echo_pro_annual', price: '$49.99', period: 'year', note: 'Save 48%' },
};

const today = () => new Date().toISOString().slice(0, 10);

export async function getSubscription(): Promise<SubscriptionState> {
  const raw = await SecureStore.getItemAsync(KEY);
  let state: SubscriptionState = { plan: 'free', day: today(), reflectionsToday: 0 };
  if (raw) {
    try {
      state = { ...state, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
  }
  if (state.day !== today()) {
    state = { ...state, day: today(), reflectionsToday: 0 };
    await save(state);
  }
  return state;
}

async function save(state: SubscriptionState) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(state));
}

export async function isPro(): Promise<boolean> {
  if (IS_TEST) return true;
  return (await getSubscription()).plan === 'pro';
}

export interface ReflectAllowance {
  allowed: boolean;
  pro: boolean;
  remaining: number;
}

export async function checkAllowance(): Promise<ReflectAllowance> {
  if (IS_TEST) return { allowed: true, pro: true, remaining: Infinity };
  const s = await getSubscription();
  if (s.plan === 'pro') return { allowed: true, pro: true, remaining: Infinity };
  const remaining = Math.max(0, FREE_DAILY_LIMIT - s.reflectionsToday);
  return { allowed: remaining > 0, pro: false, remaining };
}

export async function recordReflection(): Promise<void> {
  const s = await getSubscription();
  if (s.plan === 'pro') return;
  await save({ ...s, reflectionsToday: s.reflectionsToday + 1 });
}

/** Grant Pro. In production this runs after a verified store purchase. */
export async function activatePro(): Promise<void> {
  const s = await getSubscription();
  await save({ ...s, plan: 'pro' });
}

export async function deactivatePro(): Promise<void> {
  const s = await getSubscription();
  await save({ ...s, plan: 'free' });
}
