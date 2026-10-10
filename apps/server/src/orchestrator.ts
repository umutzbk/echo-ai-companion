import {
  GroundedReflection,
  GroundedReflectionSchema,
  ReflectRequest,
  ReplyDraft,
  SafetyResult,
  buildReflectUserPrompt,
  classifySafety,
  providerFromEnv,
  requiresSafeResponse,
  safeResponseFor,
  SYSTEM_SAFETY,
} from '@echo/core';
import { ModelProvider } from '@echo/core';

/**
 * The orchestration spine shared by every reflective route:
 *   classify safety -> route -> build prompt -> model -> post-process.
 * Returns both the user-facing answer and a non-sensitive safety record for telemetry.
 */

const provider: ModelProvider = providerFromEnv();

export interface ReflectOutput {
  answer: string;
  safety: SafetyResult;
  model: string;
  /** Present only for reply_drafts mode. */
  drafts?: ReplyDraft[];
  /** Present only for grounded mode. */
  grounded?: GroundedReflection;
}

function parseGrounded(text: string): GroundedReflection | undefined {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return undefined;
    const parsed = GroundedReflectionSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Remove the most common over-certain phrasings as a cheap post-process guardrail. */
function softenCertainty(text: string): string {
  return text
    .replace(/\bthey (definitely|certainly|obviously|clearly) (hate|love|despise)\b/gi, 'they may $2')
    .replace(/\byou(?:'re| are) (definitely|certainly|obviously) (right|wrong)\b/gi, 'you might be $2');
}

function parseDrafts(text: string): ReplyDraft[] | undefined {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return undefined;
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (Array.isArray(parsed.drafts)) return parsed.drafts as ReplyDraft[];
  } catch {
    /* fall through */
  }
  return undefined;
}

export async function runReflect(req: ReflectRequest): Promise<ReflectOutput> {
  const safety = classifySafety(req.question);

  // High-risk: return a deterministic safe response WITHOUT an analytical model call.
  if (requiresSafeResponse(safety) || safety.action === 'reframe') {
    return {
      answer: safeResponseFor(safety),
      safety,
      model: 'safety-template',
    };
  }

  const grounds = req.mode === 'grounded' || req.mode === 'reality_check';
  const isJson = req.mode === 'reply_drafts' || grounds;
  const userPrompt = buildReflectUserPrompt(req.mode, req.question, req.context);

  const result = await provider.complete({
    system: SYSTEM_SAFETY,
    user: userPrompt,
    tier: req.tier,
    json: isJson,
    maxTokens: grounds ? 1400 : 900,
    temperature: req.mode === 'reply_drafts' ? 0.6 : 0.4,
  });

  if (grounds) {
    return { answer: result.text, safety, model: result.model, grounded: parseGrounded(result.text) };
  }

  if (req.mode === 'reply_drafts') {
    return { answer: result.text, safety, model: result.model, drafts: parseDrafts(result.text) };
  }

  return {
    answer: softenCertainty(result.text),
    safety,
    model: result.model,
  };
}

export { provider };
