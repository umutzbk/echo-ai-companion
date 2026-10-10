import { Message } from './types';

/**
 * Lightweight, on-device-friendly analysis of how the USER themselves writes, so reply
 * drafts can be generated in their own voice (length, casing, emoji, punctuation,
 * language) instead of a generic assistant tone.
 */

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
const TURKISH = /[şğıçöüŞĞİÇÖÜ]|(\b(bir|ve|için|çok|ben|sen|nasıl|teşekkür|tamam)\b)/i;

export interface StyleProfile {
  profile: string;
  samples: string[];
}

export function summarizeUserStyle(messages: Message[]): StyleProfile {
  const mine = messages.filter(
    (m) => m.senderRole === 'me' && !m.mediaOmitted && m.text.trim().length > 0
  );
  if (mine.length === 0) {
    return { profile: 'No samples of the user’s own messages are available.', samples: [] };
  }

  const wordCounts = mine.map((m) => m.text.trim().split(/\s+/).length);
  const avgWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / mine.length);

  const ratio = (pred: (m: Message) => boolean) => mine.filter(pred).length / mine.length;
  const emojiRate = ratio((m) => EMOJI.test(m.text));
  const lowercaseStart = ratio((m) => /^[a-zçğıöşü]/.test(m.text.trim()));
  const exclaim = ratio((m) => m.text.includes('!'));
  const questions = ratio((m) => m.text.includes('?'));
  const turkish = ratio((m) => TURKISH.test(m.text));

  const traits: string[] = [];
  traits.push(avgWords <= 6 ? 'very short messages' : avgWords <= 14 ? 'fairly short messages' : 'longer, fuller messages');
  traits.push(`~${avgWords} words on average`);
  if (lowercaseStart > 0.5) traits.push('often starts sentences in lowercase');
  else traits.push('usually capitalizes normally');
  traits.push(emojiRate > 0.25 ? 'uses emoji regularly' : emojiRate > 0.05 ? 'uses emoji occasionally' : 'rarely uses emoji');
  if (exclaim > 0.3) traits.push('fairly expressive (uses “!”)');
  if (questions > 0.3) traits.push('asks a lot of questions');
  traits.push(turkish > 0.4 ? 'writes mainly in Turkish' : 'writes mainly in English');

  // Up to 6 representative samples (skip near-duplicates / very long ones).
  const samples = mine
    .map((m) => m.text.trim().replace(/\s+/g, ' '))
    .filter((t) => t.length <= 200)
    .slice(-12)
    .slice(0, 6);

  return { profile: traits.join(', ') + '.', samples };
}
