import { SafetyAction, SafetyCategory, SafetyResult, SafetySeverity } from '../types';

/**
 * Heuristic safety pre-classifier.
 *
 * This is a fast, deterministic FIRST pass that runs before any LLM call (and can run
 * on-device). It is intentionally conservative: it errs toward routing borderline cases
 * to a safer path. A model-based classifier can refine `normal` results server-side, but
 * a heuristic `high`/`crisis` hit should never be downgraded silently.
 *
 * It does NOT store or log the raw text — callers should pass `result.reason` (a category
 * label) to telemetry, never the user's words.
 */

interface Rule {
  category: SafetyCategory;
  severity: SafetySeverity;
  action: SafetyAction;
  patterns: RegExp[];
  reason: string;
}

// Order matters: earlier rules win. Crisis/self-harm first.
const RULES: Rule[] = [
  {
    category: 'self_harm',
    severity: 'high',
    action: 'safe_response',
    reason: 'self_harm_language',
    patterns: [
      /\bkill myself\b/i,
      /\bend (my|it all|my life)\b/i,
      /\bsuicid/i,
      /\bself[-\s]?harm/i,
      /\bcut(ting)? myself\b/i,
      /\bdon'?t want to (be alive|live)\b/i,
      /\bno reason to live\b/i,
    ],
  },
  {
    category: 'crisis',
    severity: 'high',
    action: 'safe_response',
    reason: 'acute_crisis_language',
    patterns: [/\bin danger\b/i, /\bgoing to hurt (someone|them|him|her)\b/i, /\bemergency\b/i],
  },
  {
    category: 'abuse_coercive_control',
    severity: 'high',
    action: 'safe_response',
    reason: 'possible_abuse',
    patterns: [
      /\b(hits?|hit me|beat me|punch(ed)?|strangl)/i,
      /\bthreaten(ed|s|ing)?\b/i,
      /\bwon'?t let me (leave|see|talk)/i,
      /\bcontrols? (everything|who i|what i)/i,
      /\bafraid (of|for) (him|her|them|my)/i,
      /\bisolat(e|ing|ed) me\b/i,
    ],
  },
  {
    category: 'stalking_harassment',
    severity: 'medium',
    action: 'reframe',
    reason: 'monitoring_or_harassment_request',
    patterns: [
      /\btrack (his|her|their|my ex)/i,
      /\bfind out where (he|she|they) (is|are|live)/i,
      /\bhack (his|her|their|into)/i,
      /\bsee (his|her|their) (messages|location|dms)\b/i,
      /\bshow up (where|at) (he|she|they)/i,
      /\bkeep (texting|messaging|calling) (him|her|them) until/i,
      /\bget revenge\b/i,
    ],
  },
  {
    category: 'manipulation_request',
    severity: 'medium',
    action: 'reframe',
    reason: 'manipulation_request',
    patterns: [
      /\bmanipulat/i,
      /\bguilt[-\s]?trip/i,
      /\bgaslight\b/i,
      /\bmake (him|her|them) jealous\b/i,
      /\bhow (do|can) i make (him|her|them) (feel bad|want me|do)/i,
      /\btrick (him|her|them)/i,
      /\bget (him|her|them) back\b(?!.*together)/i,
    ],
  },
  {
    category: 'medical_request',
    severity: 'low',
    action: 'reframe',
    reason: 'diagnosis_request',
    patterns: [
      /\bdiagnos/i,
      /\bdo (i|they|you think (he|she|they)) have (depression|bipolar|bpd|npd|anxiety disorder|adhd|autism)/i,
      /\bis (he|she|they|this) (a )?(narcissist|sociopath|psychopath)\b/i,
    ],
  },
];

export function classifySafety(text: string): SafetyResult {
  const input = text ?? '';
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(input))) {
      return {
        category: rule.category,
        severity: rule.severity,
        action: rule.action,
        reason: rule.reason,
      };
    }
  }
  return {
    category: 'normal',
    severity: 'none',
    action: 'proceed',
    reason: 'normal_reflection',
  };
}

/** Whether the orchestrator should skip the analytical LLM call entirely. */
export function requiresSafeResponse(result: SafetyResult): boolean {
  return result.action === 'safe_response' || result.action === 'block';
}
