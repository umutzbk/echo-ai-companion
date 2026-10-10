import Constants from 'expo-constants';
import type {
  GroundedReflection,
  Message,
  PersonMemory,
  ReflectMode,
  ReplyDraft,
  SafetyResult,
} from '@echo/core';
import { cloudAllowed, getSettings } from './settings';

const BASE = (Constants.expoConfig?.extra as any)?.apiBaseUrl ?? 'http://localhost:4000';

export interface PersonContext {
  person: { name: string; relationshipType: string; notes?: string };
  memories: PersonMemory[];
  recentMessages: Message[];
  summaries: string[];
}

export interface ReflectResponse {
  answer: string;
  safety: SafetyResult;
  model: string;
  drafts?: ReplyDraft[];
  grounded?: GroundedReflection;
}

export class CloudDisabledError extends Error {
  constructor() {
    super('Cloud analysis is off. Enable it in Settings to use AI features.');
    this.name = 'CloudDisabledError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? 'request_failed');
  return json.data as T;
}

/** Safety classify can run regardless of cloud setting (no message content is required). */
export function classify(question: string): Promise<SafetyResult> {
  return post<SafetyResult>('/v1/safety/classify', { question });
}

/** Guard: every message-context call checks the cloud toggle before leaving the device. */
async function ensureCloud(): Promise<void> {
  const s = await getSettings();
  if (!cloudAllowed(s)) throw new CloudDisabledError();
}

export async function reflect(
  mode: ReflectMode,
  question: string,
  context: PersonContext
): Promise<ReflectResponse> {
  await ensureCloud();
  const s = await getSettings();
  return post<ReflectResponse>('/v1/reflect', { mode, question, context, tier: s.modelTier });
}

export async function grounded(question: string, context: PersonContext): Promise<ReflectResponse> {
  await ensureCloud();
  const s = await getSettings();
  return post<ReflectResponse>('/v1/grounded', { question, context, tier: s.modelTier });
}

export async function realityCheck(question: string, context: PersonContext): Promise<ReflectResponse> {
  await ensureCloud();
  return post<ReflectResponse>('/v1/reality-check', { question, context });
}

export async function replyDrafts(question: string, context: PersonContext): Promise<ReflectResponse> {
  await ensureCloud();
  return post<ReflectResponse>('/v1/reply-drafts', { question, context });
}

export async function summarize(
  person: PersonContext['person'],
  messages: Message[]
): Promise<{ memories: PersonMemory[] }> {
  await ensureCloud();
  return post<{ memories: PersonMemory[] }>('/v1/memory/summarize', { person, messages });
}
