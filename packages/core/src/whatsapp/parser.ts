import { Message, ParseResult } from '../types';

/**
 * Robust WhatsApp export parser.
 *
 * Handles the common export shapes:
 *   iOS:      [dd/mm/yyyy, hh:mm:ss] Name: message      (also [dd.mm.yy, h:mm:ss AM])
 *   Android:  dd/mm/yyyy, hh:mm - Name: message         (also m/d/yy, h:mm AM/PM)
 * plus: multi-line messages, system messages (no "Name:"), and omitted media markers.
 *
 * Design goals:
 *  - Never throw on a weird line — collect it in `unparsedLines` instead.
 *  - Be locale-tolerant about separators ( / . - ), 2/4-digit years, 12/24h clocks.
 *  - We default day-first (dd/mm) because that's WhatsApp's most common export, but
 *    swap to month-first when the first number can only be a month/day disambiguates.
 */

// Matches the timestamp + optional sender prefix at the start of a NEW message line.
// Group structure:
//   1 date, 2 time, 3 ampm, 4 sender (undefined for system lines), 5 body
const IOS_BRACKET = new RegExp(
  '^\\u200e?\\[' + // optional LRM, opening bracket
    '([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4})' + // 1: date
    ',?\\s+' +
    '([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)' + // 2: time
    '(?:\\s?\\u202f?\\s?([AaPp]\\.?[Mm]\\.?))?' + // 3: am/pm (optional, narrow nbsp tolerated)
    '\\]\\s' +
    '(?:([^:]{1,80}):\\s)?' + // 4: sender (optional → system message)
    '([\\s\\S]*)$' // 5: body
);

const ANDROID_DASH = new RegExp(
  '^\\u200e?' +
    '([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4})' + // 1: date
    ',?\\s+' +
    '([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)' + // 2: time
    '(?:\\s?\\u202f?\\s?([AaPp]\\.?[Mm]\\.?))?' + // 3: am/pm
    '\\s[-\\u2013]\\s' + // " - " (hyphen or en dash)
    '(?:([^:]{1,80}):\\s)?' + // 4: sender (optional → system message)
    '([\\s\\S]*)$' // 5: body
);

const MEDIA_MARKERS = [
  /<media omitted>/i,
  /image omitted/i,
  /video omitted/i,
  /audio omitted/i,
  /sticker omitted/i,
  /gif omitted/i,
  /document omitted/i,
  /<attached:.*>/i,
];

// WhatsApp "events" carry a sender name but are not authored messages: security
// notices, calls, deletions, group changes. We mark these as senderRole 'system' so
// they don't pollute me/them analysis, while keeping who they relate to in `sender`.
const EVENT_MARKERS = [
  /messages and calls are end-to-end encrypted/i,
  /^(voice|video) call(,|\b)/i,
  /^missed (voice|video) call/i,
  /this message was deleted/i,
  /you deleted this message/i,
  /changed the subject to/i,
  /changed this group'?s icon/i,
  /\bwas added\b/i,
  /\bleft\b\s*$/i,
  /changed their phone number/i,
  /your security code with .* changed/i,
];

// Invisible directional-formatting marks WhatsApp injects (LRM/RLM/embeddings).
const DIRECTIONAL_MARKS = /[‎‏‪-‮⁦-⁩]/g;

function stripMarks(text: string): string {
  return text.replace(DIRECTIONAL_MARKS, '');
}

function isEvent(text: string): boolean {
  return EVENT_MARKERS.some((re) => re.test(text));
}

interface RawLineMatch {
  date: string;
  time: string;
  ampm?: string;
  sender?: string;
  body: string;
}

function matchHeader(line: string): RawLineMatch | null {
  const m = IOS_BRACKET.exec(line) ?? ANDROID_DASH.exec(line);
  if (!m) return null;
  return {
    date: m[1],
    time: m[2],
    ampm: m[3],
    sender: m[4],
    body: m[5] ?? '',
  };
}

/** Parse a WhatsApp date+time into an ISO string, or null if not confidently parseable. */
export function parseTimestamp(date: string, time: string, ampm?: string): string | null {
  const dateParts = date.split(/[./-]/).map((p) => parseInt(p, 10));
  if (dateParts.length !== 3 || dateParts.some((n) => Number.isNaN(n))) return null;

  let [a, b, year] = dateParts;
  // Year handling: if first chunk is a 4-digit year (yyyy/mm/dd), reorder.
  let day: number, month: number;
  if (a > 31) {
    // yyyy-mm-dd
    year = a;
    month = b;
    day = dateParts[2];
  } else {
    day = a;
    month = b;
    // Day-first is the default. If "day" can't be a day but could be a month, flip.
    if (day > 12 && month <= 12) {
      // already correct (day-first)
    } else if (month > 12 && day <= 12) {
      // source was month-first (m/d) → swap
      [day, month] = [month, day];
    }
  }
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const timeParts = time.split(':').map((p) => parseInt(p, 10));
  let hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  const second = timeParts[2] ?? 0;

  if (ampm) {
    const isPm = /p/i.test(ampm);
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59 || second > 59) return null;

  // Construct as UTC to keep deterministic across environments (tests/devices).
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function detectMediaOmitted(text: string): boolean {
  return MEDIA_MARKERS.some((re) => re.test(text));
}

export interface ParseOptions {
  /** Display name that should be marked as senderRole 'me'. */
  myName?: string;
}

/** Parse a full WhatsApp .txt export into structured messages. */
export function parseWhatsApp(raw: string, opts: ParseOptions = {}): ParseResult {
  // Normalize line endings; strip a leading BOM.
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const messages: Message[] = [];
  const unparsedLines: string[] = [];
  const participants = new Set<string>();
  let current: Message | null = null;

  const pushCurrent = () => {
    if (current) {
      current.text = current.text.replace(/\s+$/g, '');
      messages.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    if (line.trim() === '') {
      // Blank line inside a multi-line message is preserved.
      if (current) current.text += '\n';
      continue;
    }

    const header = matchHeader(line);
    if (!header) {
      // Continuation of the previous message (multi-line).
      if (current) {
        current.text += '\n' + line;
      } else {
        unparsedLines.push(line);
      }
      continue;
    }

    pushCurrent();

    const timestamp = parseTimestamp(header.date, header.time, header.ampm);
    const sender = header.sender?.trim();
    const isSystem = !sender;
    if (sender) participants.add(sender);

    const senderRole = isSystem
      ? 'system'
      : opts.myName && sender === opts.myName
        ? 'me'
        : 'them';

    current = {
      sender: sender ?? 'system',
      senderRole,
      text: header.body,
      timestamp,
      source: 'whatsapp',
      mediaOmitted: detectMediaOmitted(header.body),
    };
  }
  pushCurrent();

  // Final pass: strip invisible marks, recompute mediaOmitted after multi-line
  // assembly, and reclassify call/security/group "events" as system.
  for (const m of messages) {
    m.text = stripMarks(m.text).replace(/\s+$/g, '');
    m.mediaOmitted = detectMediaOmitted(m.text);
    if (m.senderRole !== 'system' && isEvent(m.text)) m.senderRole = 'system';
  }

  const timestamps = messages
    .map((m) => m.timestamp)
    .filter((t): t is string => !!t)
    .sort();

  return {
    messages,
    participants: [...participants],
    unparsedLines,
    rangeStart: timestamps[0] ?? null,
    rangeEnd: timestamps[timestamps.length - 1] ?? null,
  };
}
