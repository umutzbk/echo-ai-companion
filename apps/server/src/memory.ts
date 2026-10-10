import { Message, PersonMemory, SYSTEM_SAFETY } from '@echo/core';
import { provider } from './orchestrator';

/**
 * Person-memory generation. Consumes a window of parsed messages and emits structured
 * PersonMemory objects with confidence + evidence — never raw overclaiming.
 */

const MEMORY_INSTRUCTIONS = `From the conversation below, produce a small set of grounded memory notes about this relationship, as JSON ONLY:
{"memories":[{"kind":"summary|tone|pattern|unresolved|positive|stress","content":"...","confidence":0.0,"evidence":[{"quote":"short verbatim snippet"}]}]}

Rules:
- "content" must be observational, not a verdict. Describe what the messages suggest, not what the other person "really" feels.
- "confidence" reflects how strongly the messages support the note (0..1). Use low values when evidence is thin.
- Every note needs at least one short evidence quote drawn from the messages.
- Include at most one of each kind. Prefer fewer, well-supported notes over many speculative ones.
- Never label anyone with a diagnosis or an absolute character judgment.`;

function renderMessages(messages: Message[]): string {
  return messages
    .map((m) => {
      const who = m.senderRole === 'me' ? 'ME' : m.senderRole === 'system' ? 'SYSTEM' : m.sender;
      const body = m.mediaOmitted ? '[media omitted]' : m.text;
      const when = m.timestamp ? m.timestamp.slice(0, 16).replace('T', ' ') : '??';
      return `[${when}] ${who}: ${body}`;
    })
    .join('\n');
}

export async function summarizePerson(
  person: { name: string; relationshipType: string; notes?: string },
  messages: Message[],
  tier: 'light' | 'deep'
): Promise<PersonMemory[]> {
  const user = [
    MEMORY_INSTRUCTIONS,
    `\nPERSON: ${person.name} (relationship: ${person.relationshipType})`,
    person.notes ? `USER NOTES: ${person.notes}` : '',
    '\n--- MESSAGES ---',
    renderMessages(messages),
  ].join('\n');

  const res = await provider.complete({
    system: SYSTEM_SAFETY,
    user,
    tier,
    json: true,
    maxTokens: 1000,
    temperature: 0.3,
  });

  try {
    const start = res.text.indexOf('{');
    const end = res.text.lastIndexOf('}');
    const parsed = JSON.parse(res.text.slice(start, end + 1));
    const memories: PersonMemory[] = (parsed.memories ?? []).map((m: any) => ({
      personId: '', // assigned by caller when persisting
      kind: m.kind,
      content: m.content,
      confidence: typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0.4,
      evidence: Array.isArray(m.evidence) ? m.evidence : [],
      model: res.model,
    }));
    return memories;
  } catch {
    return [];
  }
}
