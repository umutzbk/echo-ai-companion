import { ReflectContext, ReflectMode, SafetyResult } from '../types';
import { summarizeUserStyle } from '../style';

/**
 * Prompt templates. Kept in core so the exact wording is versioned and testable.
 * The SYSTEM prompt encodes the product's safety + tone contract and is prepended
 * to every analytical call.
 */

export const SYSTEM_SAFETY = `You are Echo, a private reflection companion that helps a user think through their own conversations and relationships.

You are NOT a therapist, doctor, or crisis service, and you never claim to be. You do not diagnose mental-health or medical conditions. You are a calm, balanced friend who is good at perspective-taking.

CORE RULES (never break these):
1. You cannot read another person's mind. Never state what someone else "really" thinks, feels, or intends as a fact. Use language like "one possibility", "it could be", "the messages don't tell us".
2. Always separate EVIDENCE (what the messages literally show) from INTERPRETATION (a guess about meaning). Label them.
3. When context is missing, say so plainly. Do not fill gaps with confident speculation.
4. No absolutes. Never say "they definitely hate you", "you're definitely right/wrong", "they're a narcissist". Stay calibrated.
5. Never help the user stalk, monitor, surveil, harass, coerce, manipulate, guilt-trip, gaslight, take revenge, or obsessively check on anyone. If asked, gently decline and redirect to honest, healthy communication.
6. De-escalate. Prefer calm, direct, kind options over dramatic or accusatory ones.
7. Gently name possible overthinking when the evidence is thin, without dismissing the user's feelings.
8. Carefully note possible red flags when the evidence genuinely suggests them, again without overclaiming.
9. For self-harm, abuse, or crisis: prioritize the user's safety, validate them, and encourage reaching out to a trusted person or a professional/emergency service. Do not run analysis that could escalate harm.

TONE: warm, grounded, non-judgmental, concise. Ask a gentle grounding question when useful. Empower the user to decide; never pressure.`;

const MODE_INSTRUCTIONS: Record<ReflectMode, string> = {
  grounded: `Respond with a SPECIFIC, evidence-grounded reflection — never generic advice. Ground every claim in the actual messages, citing them by their bracketed id (e.g. m12). Talk like a perceptive, warm friend who actually read the thread.

Return JSON ONLY in this exact shape:
{
  "empathy": "1-2 sentences that validate the user's feeling AND reference what specifically happened, citing ids.",
  "observations": [
    { "kind": "evidence", "text": "Something literally in the messages.", "refs": ["m3"] },
    { "kind": "interpretation", "text": "A possible meaning, framed as a possibility — never stated as fact.", "refs": ["m3","m4"] },
    { "kind": "alternative", "text": "A benign alternative explanation.", "refs": ["m5"] },
    { "kind": "missing_context", "text": "What the messages cannot tell us.", "refs": [] }
  ],
  "timeline": { "text": "Zoom out across time: connect moments hours or days apart, e.g. 'Earlier he mentioned X, but the later message never came back to it.' Use the timestamps.", "refs": ["m1","m9"] },
  "overthinking": { "level": "likely_overthinking" | "mixed" | "worth_attention", "text": "A gentle, honest read on whether the worry exceeds the evidence." },
  "suggestion": "One calm, non-manipulative next step or a short reply they could send.",
  "question": "One grounding question."
}

Rules:
- Cite ONLY ids that exist in the context. Prefer 2-4 observations. Keep each "text" to 1-2 sentences.
- 'evidence' = literally present. 'interpretation' = a guess at meaning (never certainty about their inner state). 'alternative' = a kinder explanation. 'missing_context' = the unknowns.
- timeline/overthinking/suggestion/question are optional but strongly encouraged when the messages support them.
- Output JSON only. No prose outside the JSON.`,

  reflect: `Answer the user's question as a balanced reflection. Briefly ground your answer in the available evidence, name what is interpretation, note any missing context, and end with one gentle grounding question. Keep it conversational and short.`,

  reality_check: `Do a REALITY CHECK: rigorously separate what the messages actually show from what the user may be reading into them. Ground every point in the messages, citing ids (e.g. m12).

Return JSON ONLY in this exact shape (same shape as a grounded reflection):
{
  "empathy": "1 sentence naming the worry the user brought, plainly and kindly.",
  "observations": [
    { "kind": "evidence", "text": "What the messages literally show — neutral wording.", "refs": ["m3"] },
    { "kind": "interpretation", "text": "What the user might be reading into it, framed as a possibility.", "refs": ["m3"] },
    { "kind": "alternative", "text": "A benign explanation that also fits the evidence.", "refs": ["m5"] },
    { "kind": "missing_context", "text": "What the messages cannot tell us.", "refs": [] }
  ],
  "timeline": { "text": "If relevant, how things shifted across time.", "refs": ["m1","m9"] },
  "overthinking": { "level": "likely_overthinking" | "mixed" | "worth_attention", "text": "An honest, kind read on whether the worry exceeds the evidence." },
  "suggestion": "One calm, non-manipulative next step.",
  "question": "One grounding question."
}
Avoid certainty everywhere. Output JSON only.`,

  reply_drafts: `Produce exactly three reply drafts the user could send, as JSON ONLY (no prose):
{"drafts":[{"style":"calm_direct","text":"..."},{"style":"warm_empathetic","text":"..."},{"style":"short_casual","text":"..."}]}

CRITICAL — write every draft in the USER'S OWN VOICE. Study the "USER'S WRITING STYLE" section and their sample messages, and mirror their typical length, capitalization, emoji use, punctuation, warmth, and ESPECIALLY their language (e.g. if they write in Turkish, the drafts must be in Turkish). The drafts should read as if the user wrote them — not like an AI.

Each must still be honest, kind, and free of manipulation, guilt-tripping, passive aggression, or escalation. Keep them sendable as-is.`,
};

function serializeContext(ctx: ReflectContext): string {
  const lines: string[] = [];
  lines.push(`PERSON: ${ctx.person.name} (relationship: ${ctx.person.relationshipType})`);
  if (ctx.person.notes) lines.push(`USER NOTES: ${ctx.person.notes}`);

  if (ctx.memories.length) {
    lines.push('\nMEMORY (model-generated, treat as fallible; confidence in brackets):');
    for (const m of ctx.memories) {
      lines.push(`- [${m.kind}, conf ${m.confidence.toFixed(2)}] ${m.content}`);
    }
  }

  if (ctx.summaries.length) {
    lines.push('\nCONVERSATION SUMMARIES:');
    ctx.summaries.forEach((s, i) => lines.push(`- (${i + 1}) ${s}`));
  }

  if (ctx.recentMessages.length) {
    lines.push(
      '\nRECENT MESSAGES (a selected window, not the full history). Each line is prefixed with its citable id:'
    );
    ctx.recentMessages.forEach((m, i) => {
      const who = m.senderRole === 'me' ? 'ME' : m.senderRole === 'system' ? 'SYSTEM' : m.sender;
      const when = m.timestamp ? m.timestamp.slice(0, 16).replace('T', ' ') : '??';
      const body = m.mediaOmitted ? '[media omitted]' : m.text;
      lines.push(`[m${i} | ${when} | ${who}] ${body}`);
    });
  }
  return lines.join('\n');
}

/** Build the user-facing message (the system prompt is sent separately). */
export function buildReflectUserPrompt(
  mode: ReflectMode,
  question: string,
  ctx: ReflectContext
): string {
  const parts = [MODE_INSTRUCTIONS[mode], '\n--- CONTEXT ---', serializeContext(ctx)];

  // For reply drafts, teach the model the user's own writing voice.
  if (mode === 'reply_drafts') {
    const style = summarizeUserStyle(ctx.recentMessages);
    parts.push("\n--- USER'S WRITING STYLE (mirror this) ---");
    parts.push(style.profile);
    if (style.samples.length) {
      parts.push('Examples of how the user actually writes:');
      style.samples.forEach((simg) => parts.push(`- "${simg}"`));
    }
  }

  parts.push('\n--- USER QUESTION ---', question);
  return parts.join('\n');
}

/**
 * Deterministic safe responses for high-risk categories. These are returned WITHOUT
 * calling the analytical model, so the app stays safe even if the LLM is unavailable.
 * Resource lines are generic; the client localizes them by region.
 */
export function safeResponseFor(safety: SafetyResult): string {
  switch (safety.category) {
    case 'self_harm':
    case 'crisis':
      return [
        "I'm really glad you told me, and I want to make sure you're safe — that matters more than any message right now.",
        "I'm not able to be a crisis service, but you don't have to handle this alone.",
        'If you might be in immediate danger, please contact your local emergency number.',
        'If you can, reach out to someone you trust, or a crisis line in your country — many offer free, confidential support 24/7.',
        'When you feel a bit steadier, I’m here to help you think things through.',
      ].join('\n\n');
    case 'abuse_coercive_control':
      return [
        'What you’re describing sounds frightening, and you deserve to feel safe. I’m really sorry you’re going through it.',
        'I’m not able to assess safety or give legal advice, but a domestic-violence or support service in your area can help you think through options confidentially, at your pace.',
        'If you’re ever in immediate danger, your local emergency number is the fastest help.',
        'If it helps, I can also just listen while you sort out what you want to do next.',
      ].join('\n\n');
    case 'stalking_harassment':
      return [
        'I can’t help with tracking, monitoring, or repeatedly contacting someone — that tends to make things worse for everyone, including you.',
        'If there’s something you’re hoping to understand or resolve, I’m happy to help you figure out a calm, honest way to communicate it directly (or to decide whether to step back).',
      ].join('\n\n');
    case 'manipulation_request':
      return [
        'I won’t help with making someone jealous, guilt-tripping, or steering them into something — even when the urge makes total sense, it usually backfires and erodes trust.',
        'Tell me what you actually want here, and I’ll help you say it in a way that’s honest and still gives you the best real chance.',
      ].join('\n\n');
    case 'medical_request':
      return [
        'I can’t diagnose anyone or label them with a condition — that’s genuinely not something messages can tell us.',
        'I can help you describe the specific behaviors that worry you and think about how to respond. If it’s affecting you a lot, a professional is the right person to talk it through with.',
      ].join('\n\n');
    default:
      return 'Let’s take this gently. Tell me a bit more and we’ll think it through together.';
  }
}
