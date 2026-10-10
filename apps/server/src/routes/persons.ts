import { Router } from 'express';
import { z } from 'zod';

/**
 * Persistence routes (persons, memories, delete/export). These require Postgres +
 * a generated Prisma client. To keep the server runnable for AI-only development
 * without a database, Prisma is loaded lazily and these routes return 503 when
 * DATABASE_URL is not configured.
 *
 * Privacy note: there is intentionally no route that stores raw messages. The client
 * sends only derived memories/summaries here.
 */

export const personsRouter = Router();

let prisma: any | null = null;
let prismaTried = false;

async function getPrisma(): Promise<any | null> {
  if (prisma) return prisma;
  if (prismaTried) return null;
  prismaTried = true;
  if (!process.env.DATABASE_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    return prisma;
  } catch {
    return null;
  }
}

personsRouter.use(async (_req, res, next) => {
  const db = await getPrisma();
  if (!db) {
    return res
      .status(503)
      .json({ ok: false, error: 'persistence_unavailable', hint: 'Set DATABASE_URL and run prisma migrate.' });
  }
  (res.locals as any).db = db;
  next();
});

// For MVP we accept a userId header; real auth comes later.
function userId(req: any): string {
  return (req.header('x-user-id') as string) || 'demo-user';
}

const PersonInput = z.object({
  name: z.string().min(1),
  relationshipType: z.string().min(1),
  notes: z.string().optional(),
});

personsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PersonInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_person' });
    const db = (res.locals as any).db;
    const uid = userId(req);
    await db.user.upsert({ where: { id: uid }, update: {}, create: { id: uid } });
    const person = await db.person.create({ data: { userId: uid, ...parsed.data } });
    res.json({ ok: true, data: person });
  } catch (e) {
    next(e);
  }
});

personsRouter.get('/', async (req, res, next) => {
  try {
    const db = (res.locals as any).db;
    const persons = await db.person.findMany({ where: { userId: userId(req) }, orderBy: { createdAt: 'desc' } });
    res.json({ ok: true, data: persons });
  } catch (e) {
    next(e);
  }
});

personsRouter.get('/:id', async (req, res, next) => {
  try {
    const db = (res.locals as any).db;
    const person = await db.person.findFirst({
      where: { id: req.params.id, userId: userId(req) },
      include: { memories: true, summaries: true, imports: true },
    });
    if (!person) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, data: person });
  } catch (e) {
    next(e);
  }
});

// Save derived memories for a person (not raw messages).
personsRouter.post('/:id/memories', async (req, res, next) => {
  try {
    const db = (res.locals as any).db;
    const memories = z.array(z.any()).parse(req.body?.memories ?? []);
    const created = await db.$transaction(
      memories.map((m: any) =>
        db.personMemory.create({
          data: {
            personId: req.params.id,
            kind: m.kind,
            content: m.content,
            confidence: m.confidence ?? 0.4,
            evidence: m.evidence ?? [],
            model: m.model,
          },
        })
      )
    );
    res.json({ ok: true, data: created });
  } catch (e) {
    next(e);
  }
});

// Person-level deletion (cascades memories/summaries/imports).
personsRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = (res.locals as any).db;
    await db.person.deleteMany({ where: { id: req.params.id, userId: userId(req) } });
    res.json({ ok: true, data: { deleted: req.params.id } });
  } catch (e) {
    next(e);
  }
});

// Export all of a user's server-side data (memories/summaries — never raw chat).
personsRouter.get('/export/all', async (req, res, next) => {
  try {
    const db = (res.locals as any).db;
    const persons = await db.person.findMany({
      where: { userId: userId(req) },
      include: { memories: true, summaries: true, imports: true },
    });
    res.json({ ok: true, data: { exportedAt: new Date().toISOString(), persons } });
  } catch (e) {
    next(e);
  }
});
