import * as SQLite from 'expo-sqlite';
import type { Message, PersonMemory } from '@echo/core';

/**
 * Local-first store. RAW MESSAGES live here on the device only — they are never written
 * to the server. Person memories are cached locally too (and may optionally be synced
 * to the server when cloud analysis is enabled).
 *
 * For production, open with SQLCipher (encryption key from expo-secure-store). expo-sqlite
 * supports an encryption key on supported platforms; wire `key` once you ship.
 */

export interface Person {
  id: string;
  name: string;
  relationshipType: string;
  notes?: string;
  createdAt: number;
}

let _db: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('echo.db');
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, relationshipType TEXT NOT NULL,
      notes TEXT, createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY, personId TEXT NOT NULL, source TEXT NOT NULL,
      fileName TEXT, messageCount INTEGER, createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, importId TEXT NOT NULL, personId TEXT NOT NULL,
      sender TEXT NOT NULL, senderRole TEXT NOT NULL, text TEXT NOT NULL,
      timestamp TEXT, source TEXT NOT NULL, mediaOmitted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, personId TEXT NOT NULL, kind TEXT NOT NULL,
      content TEXT NOT NULL, confidence REAL NOT NULL, evidence TEXT, model TEXT,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_person ON messages(personId);
    CREATE INDEX IF NOT EXISTS idx_memories_person ON memories(personId);
  `);
  return _db;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function createPerson(p: Omit<Person, 'id' | 'createdAt'>): Promise<Person> {
  const person: Person = { ...p, id: uid(), createdAt: Date.now() };
  const d = await db();
  await d.runAsync(
    'INSERT INTO persons (id,name,relationshipType,notes,createdAt) VALUES (?,?,?,?,?)',
    person.id, person.name, person.relationshipType, person.notes ?? null, person.createdAt
  );
  return person;
}

export async function listPersons(): Promise<Person[]> {
  const d = await db();
  return d.getAllAsync<Person>('SELECT * FROM persons ORDER BY createdAt DESC');
}

export async function getPerson(id: string): Promise<Person | null> {
  const d = await db();
  return d.getFirstAsync<Person>('SELECT * FROM persons WHERE id = ?', id);
}

/** Save a parsed import + its raw messages, locally. */
export async function saveImport(
  personId: string,
  source: string,
  fileName: string | null,
  messages: Message[]
): Promise<string> {
  const d = await db();
  const importId = uid();
  await d.runAsync(
    'INSERT INTO imports (id,personId,source,fileName,messageCount,createdAt) VALUES (?,?,?,?,?,?)',
    importId, personId, source, fileName, messages.length, Date.now()
  );
  await d.withTransactionAsync(async () => {
    for (const m of messages) {
      await d.runAsync(
        'INSERT INTO messages (id,importId,personId,sender,senderRole,text,timestamp,source,mediaOmitted) VALUES (?,?,?,?,?,?,?,?,?)',
        uid(), importId, personId, m.sender, m.senderRole, m.text, m.timestamp, m.source, m.mediaOmitted ? 1 : 0
      );
    }
  });
  return importId;
}

/** Recent window of messages for a person, oldest→newest. */
export async function recentMessages(personId: string, limit = 60): Promise<Message[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM messages WHERE personId = ? ORDER BY (timestamp IS NULL), timestamp DESC LIMIT ?',
    personId, limit
  );
  return rows
    .reverse()
    .map((r) => ({
      id: r.id, importId: r.importId, personId: r.personId, sender: r.sender,
      senderRole: r.senderRole, text: r.text, timestamp: r.timestamp,
      source: r.source, mediaOmitted: !!r.mediaOmitted,
    }));
}

export async function saveMemories(personId: string, memories: PersonMemory[]): Promise<void> {
  const d = await db();
  await d.withTransactionAsync(async () => {
    for (const m of memories) {
      await d.runAsync(
        'INSERT INTO memories (id,personId,kind,content,confidence,evidence,model,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        uid(), personId, m.kind, m.content, m.confidence, JSON.stringify(m.evidence ?? []), m.model ?? null, Date.now()
      );
    }
  });
}

export async function listMemories(personId: string): Promise<PersonMemory[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>('SELECT * FROM memories WHERE personId = ? ORDER BY createdAt DESC', personId);
  return rows.map((r) => ({
    id: r.id, personId: r.personId, kind: r.kind, content: r.content,
    confidence: r.confidence, evidence: JSON.parse(r.evidence ?? '[]'), model: r.model,
  }));
}

/** Conversation-level deletion: drops one import and its messages. */
export async function deleteImport(importId: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM messages WHERE importId = ?', importId);
  await d.runAsync('DELETE FROM imports WHERE id = ?', importId);
}

/** Person-level deletion: drops the person and everything derived from them. */
export async function deletePerson(personId: string): Promise<void> {
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.runAsync('DELETE FROM messages WHERE personId = ?', personId);
    await d.runAsync('DELETE FROM imports WHERE personId = ?', personId);
    await d.runAsync('DELETE FROM memories WHERE personId = ?', personId);
    await d.runAsync('DELETE FROM persons WHERE id = ?', personId);
  });
}
