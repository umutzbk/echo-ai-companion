/**
 * Provider abstraction so the LLM vendor/model can be swapped without touching
 * orchestration code. Deep reasoning -> strong model; light chat/classify -> cheap model.
 */

export type ModelTier = 'light' | 'deep';

export interface CompletionParams {
  system: string;
  user: string;
  tier: ModelTier;
  maxTokens?: number;
  temperature?: number;
  /** Hint that the response should be JSON; providers may enable a JSON mode. */
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  model: string;
  /** Non-sensitive usage metadata for telemetry. */
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface ModelProvider {
  readonly name: string;
  complete(params: CompletionParams): Promise<CompletionResult>;
}

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Strong model for deep reasoning. */
  deepModel?: string;
  /** Cheap/fast model for light chat + classification. */
  lightModel?: string;
}

/**
 * Anthropic-backed provider. Imports the SDK lazily so @echo/core stays usable
 * (parser/safety/prompts) in environments without the SDK installed.
 */
export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  private opts: Required<AnthropicProviderOptions>;
  private client: any | null = null;

  constructor(opts: AnthropicProviderOptions) {
    this.opts = {
      deepModel: 'claude-opus-4-8',
      lightModel: 'claude-haiku-4-5-20251001',
      ...opts,
    };
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import('@anthropic-ai/sdk');
    const Anthropic = mod.default ?? (mod as any).Anthropic;
    this.client = new Anthropic({ apiKey: this.opts.apiKey });
    return this.client;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const client = await this.getClient();
    const model = params.tier === 'deep' ? this.opts.deepModel : this.opts.lightModel;
    const res = await client.messages.create({
      model,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.4,
      system: params.system,
      messages: [{ role: 'user', content: params.user }],
    });
    const text = (res.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    return {
      text,
      model,
      usage: {
        inputTokens: res.usage?.input_tokens,
        outputTokens: res.usage?.output_tokens,
      },
    };
  }
}

export interface OpenAIProviderOptions {
  apiKey: string;
  /** Strong model for deep reasoning. */
  deepModel?: string;
  /** Cheap/fast model for light chat. */
  lightModel?: string;
  baseUrl?: string;
}

/**
 * OpenAI-backed provider via the REST API (no SDK dependency needed — Node has fetch).
 * Uses JSON response_format when a structured reply is requested.
 */
export class OpenAIProvider implements ModelProvider {
  readonly name = 'openai';
  private apiKey: string;
  private deepModel: string;
  private lightModel: string;
  private baseUrl: string;

  constructor(opts: OpenAIProviderOptions) {
    this.apiKey = opts.apiKey;
    // Defensive defaults: never let an undefined env var blank out the model.
    this.deepModel = opts.deepModel || 'gpt-4o-mini';
    this.lightModel = opts.lightModel || 'gpt-4o-mini';
    this.baseUrl = opts.baseUrl || 'https://api.openai.com/v1';
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const model = params.tier === 'deep' ? this.deepModel : this.lightModel;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.4,
        ...(params.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`openai_${res.status}: ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    return {
      text,
      model,
      usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
    };
  }
}

/**
 * Deterministic mock provider so the whole stack runs (and tests pass) with no API key.
 * It echoes a clearly-labeled placeholder shaped per mode.
 */
export class MockProvider implements ModelProvider {
  readonly name = 'mock';
  async complete(params: CompletionParams): Promise<CompletionResult> {
    let text: string;
    if (params.json && /"observations"/.test(params.user)) {
      // Grounded reflection prompt → return a grounded-shaped mock citing early ids.
      text = JSON.stringify({
        empathy:
          "[mock] I can see why that landed the way it did — you reached out warmly and the reply back felt shorter than you hoped.",
        observations: [
          { kind: 'evidence', text: '[mock] You opened the conversation and they did reply, just briefly.', refs: ['m0', 'm1'] },
          { kind: 'interpretation', text: "[mock] The brevity *might* read as distance — but that's a guess, not something the messages confirm.", refs: ['m1'] },
          { kind: 'alternative', text: '[mock] It could equally be that they were busy or typing on the move.', refs: ['m1'] },
          { kind: 'missing_context', text: "[mock] We can't see tone of voice or what was happening on their side.", refs: [] },
        ],
        timeline: { text: '[mock] Earlier in the thread the mood was lighter; the later message is where things felt cooler.', refs: ['m0', 'm2'] },
        overthinking: { level: 'mixed', text: '[mock] There may be a little overthinking here, but the shift is real enough to be worth a gentle check-in.' },
        suggestion: '[mock] You could send something light and direct, like: "Hey, all good with us? Felt a bit quiet."',
        question: '[mock] What would feel like reassurance to you right now?',
      });
    } else if (params.json && /"memories"/.test(params.user)) {
      // Memory-summarization prompt → return a memories-shaped mock.
      text = JSON.stringify({
        memories: [
          {
            kind: 'tone',
            content: '[mock] The exchange reads as polite and professional, with the other person being responsive.',
            confidence: 0.4,
            evidence: [{ quote: 'teşekkür ederim' }],
          },
          {
            kind: 'unresolved',
            content: '[mock] There may be an open question about expectations or follow-up; the messages do not fully resolve it.',
            confidence: 0.3,
            evidence: [{ quote: '?' }],
          },
        ],
      });
    } else if (params.json) {
      text = JSON.stringify({
        drafts: [
          { style: 'calm_direct', text: '[mock] Hey, can we talk about earlier when you have a sec?' },
          { style: 'warm_empathetic', text: '[mock] I really value you — I felt a bit off earlier and wanted to check in.' },
          { style: 'short_casual', text: '[mock] hey, all good? felt a bit weird earlier' },
        ],
      });
    } else {
      text =
        '[mock response — no API key configured]\n' +
        'This is where the model’s balanced reflection would appear, grounded in the ' +
        'provided context and following the safety system prompt.';
    }
    return { text, model: 'mock', usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

/**
 * Factory: build a provider from env. Prefers OpenAI, then Anthropic, then a Mock
 * fallback so the stack always runs.
 */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): ModelProvider {
  if (env.OPENAI_API_KEY) {
    return new OpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      deepModel: env.OPENAI_MODEL_DEEP,
      lightModel: env.OPENAI_MODEL_LIGHT,
    });
  }
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      deepModel: env.MODEL_DEEP,
      lightModel: env.MODEL_LIGHT,
    });
  }
  return new MockProvider();
}
