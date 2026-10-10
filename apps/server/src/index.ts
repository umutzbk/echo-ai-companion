import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import {
  ReflectContextSchema,
  ReflectRequestSchema,
  classifySafety,
} from '@echo/core';
import { logger } from './logger';
import { runReflect } from './orchestrator';
import { summarizePerson } from './memory';
import { personsRouter } from './routes/persons';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

const ok = (res: express.Response, data: unknown) => res.json({ ok: true, data });

/** Validate a body with Zod, returning a 400 on failure (without echoing content). */
function validate<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown
): { data?: z.output<S>; error?: string } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.path.join('.')).join(', ') };
  return { data: parsed.data as z.output<S> };
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'echo', ts: Date.now() }));

// ── Safety pre-classification (can be called directly by the client) ────────────
app.post('/v1/safety/classify', (req, res) => {
  const schema = z.object({ question: z.string().min(1) });
  const { data, error } = validate(schema, req.body);
  if (!data) return res.status(400).json({ ok: false, error });
  const result = classifySafety(data.question);
  return ok(res, result);
});

// ── Generic reflection (any mode) ───────────────────────────────────────────────
app.post('/v1/reflect', async (req, res, next) => {
  const { data, error } = validate(ReflectRequestSchema, req.body);
  if (!data) return res.status(400).json({ ok: false, error });
  try {
    const out = await runReflect(data);
    req.log.info({ event: 'reflect', mode: data.mode, safety: out.safety.category, model: out.model });
    return ok(res, out);
  } catch (e) {
    next(e);
  }
});

// ── Grounded reflection (the signature, evidence-cited mode) ────────────────────
app.post('/v1/grounded', async (req, res, next) => {
  const schema = z.object({ question: z.string().min(1), context: ReflectContextSchema, tier: z.enum(['light', 'deep']).default('deep') });
  const { data, error } = validate(schema, req.body);
  if (!data) return res.status(400).json({ ok: false, error });
  try {
    const out = await runReflect({ mode: 'grounded', ...data });
    req.log.info({ event: 'grounded', safety: out.safety.category, model: out.model, grounded: !!out.grounded });
    return ok(res, out);
  } catch (e) {
    next(e);
  }
});

// ── Reality Check (mode shortcut) ───────────────────────────────────────────────
app.post('/v1/reality-check', async (req, res, next) => {
  const schema = z.object({ question: z.string().min(1), context: ReflectContextSchema, tier: z.enum(['light', 'deep']).default('deep') });
  const { data, error } = validate(schema, req.body);
  if (!data) return res.status(400).json({ ok: false, error });
  try {
    const out = await runReflect({ mode: 'reality_check', ...data });
    return ok(res, out);
  } catch (e) {
    next(e);
  }
});

// ── Reply drafts (mode shortcut) ────────────────────────────────────────────────
app.post('/v1/reply-drafts', async (req, res, next) => {
  const schema = z.object({ question: z.string().min(1), context: ReflectContextSchema, tier: z.enum(['light', 'deep']).default('deep') });
  const { data, error } = validate(schema, req.body);
  if (!data) return res.status(400).json({ ok: false, error });
  try {
    const out = await runReflect({ mode: 'reply_drafts', ...data });
    return ok(res, out);
  } catch (e) {
    next(e);
  }
});

// ── Person memory summarization ─────────────────────────────────────────────────
app.post('/v1/memory/summarize', async (req, res, next) => {
  const schema = z.object({
    person: z.object({ name: z.string(), relationshipType: z.string(), notes: z.string().optional() }),
    messages: ReflectContextSchema.shape.recentMessages,
    tier: z.enum(['light', 'deep']).default('deep'),
  });
  const { data, error } = validate(schema, req.body);
  if (!data) return res.status(400).json({ ok: false, error });
  try {
    const memories = await summarizePerson(data.person, data.messages, data.tier);
    req.log.info({ event: 'summarize', count: memories.length, messages: data.messages.length });
    return ok(res, { memories });
  } catch (e) {
    next(e);
  }
});

// ── Persistence routes (lazy Prisma; 503 if DATABASE_URL not configured) ────────
app.use('/v1/persons', personsRouter);

// ── Error handler — never leak content into the response/logs ───────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log?.error({ event: 'error', name: err?.name, msg: err?.message });
  res.status(500).json({ ok: false, error: 'internal_error' });
});

const port = Number(process.env.PORT ?? 4000);
const providerName = process.env.OPENAI_API_KEY
  ? 'openai'
  : process.env.ANTHROPIC_API_KEY
    ? 'anthropic'
    : 'mock';
app.listen(port, () => logger.info({ event: 'listening', port, provider: providerName }));

export { app };
