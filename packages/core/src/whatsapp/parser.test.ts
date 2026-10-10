import { parseWhatsApp, parseTimestamp } from './parser';

describe('parseTimestamp', () => {
  it('parses day-first 24h', () => {
    expect(parseTimestamp('07/03/2024', '14:05:09')).toBe('2024-03-07T14:05:09.000Z');
  });

  it('parses 2-digit year', () => {
    expect(parseTimestamp('07/03/24', '09:30')).toBe('2024-03-07T09:30:00.000Z');
  });

  it('handles AM/PM', () => {
    expect(parseTimestamp('1/2/24', '12:00', 'AM')).toBe('2024-02-01T00:00:00.000Z');
    expect(parseTimestamp('1/2/24', '12:00', 'PM')).toBe('2024-02-01T12:00:00.000Z');
    expect(parseTimestamp('1/2/24', '1:05', 'PM')).toBe('2024-02-01T13:05:00.000Z');
  });

  it('flips to month-first when day-first is impossible', () => {
    // 13 cannot be a day in dd/mm? Actually it can. Use case where first>12.
    expect(parseTimestamp('13/06/2024', '00:00')).toBe('2024-06-13T00:00:00.000Z');
    // month-first source: 06/13 → day 13, month 6
    expect(parseTimestamp('06/13/2024', '00:00')).toBe('2024-06-13T00:00:00.000Z');
  });

  it('supports dotted and yyyy-first dates', () => {
    expect(parseTimestamp('07.03.2024', '08:00')).toBe('2024-03-07T08:00:00.000Z');
    expect(parseTimestamp('2024-03-07', '08:00')).toBe('2024-03-07T08:00:00.000Z');
  });

  it('returns null for garbage', () => {
    expect(parseTimestamp('not/a/date', '08:00')).toBeNull();
    expect(parseTimestamp('40/40/2024', '08:00')).toBeNull();
  });
});

describe('parseWhatsApp — iOS bracket format', () => {
  const sample = [
    '[07/03/2024, 14:05:09] Alice: Hey, are you free later?',
    '[07/03/2024, 14:06:00] Bob: Yeah what’s up',
    '[07/03/2024, 14:06:30] Alice: ‎image omitted',
  ].join('\n');

  it('parses messages, senders and timestamps', () => {
    const r = parseWhatsApp(sample, { myName: 'Bob' });
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0]).toMatchObject({
      sender: 'Alice',
      senderRole: 'them',
      text: 'Hey, are you free later?',
      timestamp: '2024-03-07T14:05:09.000Z',
      source: 'whatsapp',
    });
    expect(r.messages[1].senderRole).toBe('me'); // Bob is "me"
  });

  it('detects omitted media', () => {
    const r = parseWhatsApp(sample);
    expect(r.messages[2].mediaOmitted).toBe(true);
  });

  it('collects participants and date range', () => {
    const r = parseWhatsApp(sample);
    expect(r.participants.sort()).toEqual(['Alice', 'Bob']);
    expect(r.rangeStart).toBe('2024-03-07T14:05:09.000Z');
    expect(r.rangeEnd).toBe('2024-03-07T14:06:30.000Z');
  });
});

describe('parseWhatsApp — Android dash format', () => {
  const sample = [
    '07/03/2024, 14:05 - Alice: First line',
    'second line of same message',
    '07/03/2024, 14:07 - Bob: <Media omitted>',
  ].join('\n');

  it('handles multi-line continuation', () => {
    const r = parseWhatsApp(sample);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0].text).toBe('First line\nsecond line of same message');
    expect(r.messages[1].mediaOmitted).toBe(true);
  });
});

describe('parseWhatsApp — system messages', () => {
  it('marks lines without a sender as system', () => {
    const sample =
      '07/03/2024, 14:00 - Messages and calls are end-to-end encrypted.\n' +
      '07/03/2024, 14:05 - Alice: hi';
    const r = parseWhatsApp(sample);
    expect(r.messages[0].senderRole).toBe('system');
    expect(r.messages[0].sender).toBe('system');
    expect(r.messages[1].senderRole).toBe('them');
    // system "sender" should not pollute participants
    expect(r.participants).toEqual(['Alice']);
  });
});

describe('parseWhatsApp — WhatsApp events & invisible marks', () => {
  it('treats sender-attributed security notice and calls as system', () => {
    const sample = [
      '[08/04/2026, 14:13:37] Bob: ‎Messages and calls are end-to-end encrypted.',
      '[08/04/2026, 14:13:37] Sam: ‎Voice call, ‎1 min',
      '[09/04/2026, 13:21:49] Sam: Hello',
    ].join('\n');
    const r = parseWhatsApp(sample, { myName: 'Sam' });
    expect(r.messages[0].senderRole).toBe('system'); // encryption notice
    expect(r.messages[1].senderRole).toBe('system'); // voice call event
    expect(r.messages[2].senderRole).toBe('me'); // real authored message
  });

  it('strips invisible directional marks from text', () => {
    const r = parseWhatsApp('[08/04/2026, 14:13:37] Sam: ‎Voice call, ‎1 min');
    expect(r.messages[0].text).toBe('Voice call, 1 min');
  });
});

describe('parseWhatsApp — robustness', () => {
  it('puts unrecognized leading lines into unparsedLines', () => {
    const r = parseWhatsApp('garbage with no header\nmore garbage');
    expect(r.messages).toHaveLength(0);
    expect(r.unparsedLines).toHaveLength(2);
  });

  it('strips BOM and handles CRLF', () => {
    const r = parseWhatsApp('﻿[07/03/2024, 14:05:09] Alice: hi\r\n');
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toBe('hi');
  });

  it('preserves blank lines inside a multi-line message', () => {
    const sample = '07/03/2024, 14:05 - Alice: line1\n\nline3';
    const r = parseWhatsApp(sample);
    expect(r.messages[0].text).toBe('line1\n\nline3');
  });
});
