import { z } from 'zod';

/**
 * Shared domain types + Zod schemas used by both the mobile client and the server.
 * Keeping these in @echo/core guarantees that parsing, validation and prompt-building
 * behave identically everywhere.
 */

export type ImportSource = 'whatsapp' | 'instagram' | 'screenshot' | 'paste';

export type SenderRole = 'me' | 'them' | 'system';

export type RelationshipType =
  | 'friend'
  | 'partner'
  | 'family'
  | 'roommate'
  | 'manager'
  | 'coworker'
  | 'dating'
  | 'other';

/** A single parsed message. Raw Message rows live on the device by default. */
export const MessageSchema = z.object({
  /** Local id (uuid). Optional until persisted. */
  id: z.string().optional(),
  importId: z.string().optional(),
  personId: z.string().optional(),
  /** Raw display name as it appeared in the export. */
  sender: z.string(),
  /** Resolved at import time by asking the user "which name is you?". */
  senderRole: z.enum(['me', 'them', 'system']).default('them'),
  text: z.string(),
  /** ISO 8601 timestamp, or null if the source had none (e.g. paste). */
  timestamp: z.string().datetime().nullable(),
  source: z.enum(['whatsapp', 'instagram', 'screenshot', 'paste']),
  mediaOmitted: z.boolean().default(false),
});
export type Message = z.infer<typeof MessageSchema>;

/** Result of parsing a whole export/paste. */
export interface ParseResult {
  messages: Message[];
  /** Distinct display names found, so the UI can ask which one is "me". */
  participants: string[];
  /** Lines the parser could not attribute to a message (kept for transparency). */
  unparsedLines: string[];
  rangeStart: string | null;
  rangeEnd: string | null;
}

export type SafetyCategory =
  | 'self_harm'
  | 'abuse_coercive_control'
  | 'stalking_harassment'
  | 'manipulation_request'
  | 'crisis'
  | 'medical_request'
  | 'normal';

export type SafetySeverity = 'none' | 'low' | 'medium' | 'high';

/** action the orchestrator should take based on classification. */
export type SafetyAction = 'proceed' | 'reframe' | 'safe_response' | 'block';

export const SafetyResultSchema = z.object({
  category: z.enum([
    'self_harm',
    'abuse_coercive_control',
    'stalking_harassment',
    'manipulation_request',
    'crisis',
    'medical_request',
    'normal',
  ]),
  severity: z.enum(['none', 'low', 'medium', 'high']),
  action: z.enum(['proceed', 'reframe', 'safe_response', 'block']),
  /** Non-sensitive reason for logging/telemetry. Never echo raw user text here. */
  reason: z.string(),
});
export type SafetyResult = z.infer<typeof SafetyResultSchema>;

export type MemoryKind =
  | 'summary'
  | 'tone'
  | 'pattern'
  | 'unresolved'
  | 'positive'
  | 'stress';

export const PersonMemorySchema = z.object({
  id: z.string().optional(),
  personId: z.string(),
  kind: z.enum(['summary', 'tone', 'pattern', 'unresolved', 'positive', 'stress']),
  content: z.string(),
  /** 0..1 — how well the evidence supports this. Used to avoid overclaiming. */
  confidence: z.number().min(0).max(1),
  /** References to the messages this is grounded in. */
  evidence: z
    .array(z.object({ messageId: z.string().optional(), quote: z.string() }))
    .default([]),
  model: z.string().optional(),
});
export type PersonMemory = z.infer<typeof PersonMemorySchema>;

/** Minimal context the client ships to the cloud (never the full raw history). */
export const ReflectContextSchema = z.object({
  person: z.object({
    name: z.string(),
    relationshipType: z.string(),
    notes: z.string().optional(),
  }),
  memories: z.array(PersonMemorySchema).default([]),
  /** A windowed slice of recent/selected messages, not the whole transcript. */
  recentMessages: z.array(MessageSchema).default([]),
  summaries: z.array(z.string()).default([]),
});
export type ReflectContext = z.infer<typeof ReflectContextSchema>;

export type ReflectMode = 'grounded' | 'reflect' | 'reality_check' | 'reply_drafts';

export const ReflectRequestSchema = z.object({
  mode: z.enum(['grounded', 'reflect', 'reality_check', 'reply_drafts']),
  question: z.string().min(1),
  context: ReflectContextSchema,
  /** light = cheaper/faster model; deep = stronger reasoning model. */
  tier: z.enum(['light', 'deep']).default('deep'),
});
export type ReflectRequest = z.infer<typeof ReflectRequestSchema>;

export interface ReplyDraft {
  style: 'calm_direct' | 'warm_empathetic' | 'short_casual';
  text: string;
}

/**
 * Evidence-grounded reflection — the signature response. Every claim can cite specific
 * messages (by their `m{index}` id, matching the order of context.recentMessages) so the
 * UI can show the exact quotes behind "I think this because you said X and he said Y".
 */
export type ObservationKind = 'evidence' | 'interpretation' | 'alternative' | 'missing_context';

export const GroundedObservationSchema = z.object({
  kind: z.enum(['evidence', 'interpretation', 'alternative', 'missing_context']),
  text: z.string(),
  /** message ids being cited, e.g. ["m3","m7"]. */
  refs: z.array(z.string()).default([]),
});
export type GroundedObservation = z.infer<typeof GroundedObservationSchema>;

export const GroundedReflectionSchema = z.object({
  /** Warm, specific opening that validates the feeling and references what happened. */
  empathy: z.string(),
  observations: z.array(GroundedObservationSchema).default([]),
  /** The "zoom out across time" insight — connects moments hours/days apart. */
  timeline: z
    .object({ text: z.string(), refs: z.array(z.string()).default([]) })
    .nullable()
    .optional(),
  /** A gentle, honest read on whether the worry exceeds the evidence. */
  overthinking: z
    .object({
      level: z.enum(['likely_overthinking', 'mixed', 'worth_attention']),
      text: z.string(),
    })
    .nullable()
    .optional(),
  /** One calm, non-manipulative next step or short reply seed. */
  suggestion: z.string().nullable().optional(),
  /** One grounding question. */
  question: z.string().nullable().optional(),
});
export type GroundedReflection = z.infer<typeof GroundedReflectionSchema>;
