import pino from 'pino';

/**
 * Redacting logger. We log METADATA only — never raw message content or full prompts.
 * The orchestrator passes counts/latencies/categories; if a sensitive field ever slips
 * into a log object under these keys, pino redacts it.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'question',
      'text',
      'content',
      'messages',
      'recentMessages',
      'context',
      'prompt',
      'user',
      'body.question',
      'body.context',
      '*.text',
      '*.content',
    ],
    censor: '[redacted]',
  },
});
