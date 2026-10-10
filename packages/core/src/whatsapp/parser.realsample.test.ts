import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseWhatsApp } from './parser';

/**
 * Integration test against a REAL WhatsApp export, if one is present locally at
 * exports/_extracted/_chat.txt. We deliberately do NOT commit the personal sample into
 * the repo (privacy-first), so this test is skipped when the file is absent — keeping CI
 * green for other developers while still validating real-world parsing on this machine.
 */
const SAMPLE = join(__dirname, '../../../../exports/_extracted/_chat.txt');
const hasSample = existsSync(SAMPLE);
// Your own display name in the export, so "me" vs "them" can be resolved.
const MY_NAME = process.env.ECHO_MY_NAME ?? 'Me';
const maybe = hasSample ? describe : describe.skip;

maybe('parseWhatsApp — real export integration', () => {
  const raw = hasSample ? readFileSync(SAMPLE, 'utf8') : '';

  it('parses every line (no unparsed) and assembles multi-line messages', () => {
    const r = parseWhatsApp(raw, { myName: MY_NAME });
    expect(r.messages.length).toBeGreaterThan(0);
    expect(r.unparsedLines).toHaveLength(0);
    // multi-line message should join continuation lines with newlines.
    expect(r.messages.some((m) => m.text.includes('\n'))).toBe(true);
  });

  it('classifies call/security events as system, not authored messages', () => {
    const r = parseWhatsApp(raw, { myName: MY_NAME });
    const system = r.messages.filter((m) => m.senderRole === 'system');
    expect(system.length).toBeGreaterThan(0);
    expect(system.every((m) => !m.text.includes('‎'))).toBe(true); // marks stripped
  });

  it('resolves "me" vs "them" from the chosen name', () => {
    const r = parseWhatsApp(raw, { myName: MY_NAME });
    expect(r.messages.some((m) => m.senderRole === 'me')).toBe(true);
    expect(r.messages.some((m) => m.senderRole === 'them')).toBe(true);
  });
});
