# Reflectly-style AI Companion — MVP Plan

> Working codename: **Echo** — "Stop overthinking your messages. Talk it through with an AI that actually knows the context."

This document is the source of truth for the MVP. It covers product, privacy/safety, architecture, data model, AI pipeline, UX, task list, risks, and the development order. Implementation begins after this plan (see `/packages/core`, `/apps/server`, `/apps/mobile`).

---

## 1. Product definition

**What it is:** A private AI *reflection companion* for conversations. Users import chats they already own (WhatsApp export, Instagram export, screenshots, copy-paste), organize them by *person*, and ask reflective questions: "Am I overthinking?", "What does this mean?", "How should I reply?". The AI answers in a balanced, evidence-grounded, non-judgmental way, and can draft calm replies.

**Who it's for:** People who over-analyze messages and currently screenshot chats to ask friends. The app is the always-available, context-aware, private version of that friend.

**What makes it different:**
- **Context-aware:** It remembers the person and the history, so answers aren't generic.
- **Privacy-first:** Raw data stays on device by default; only selected chunks go to the cloud, and only if the user enables cloud analysis.
- **Calibrated, not certain:** It separates evidence from interpretation and never claims to know what another person "really" thinks.

**Explicitly NOT:** therapy, medical care, diagnosis, a surveillance tool, a manipulation/"how to win" coach, or a way to secretly read someone else's apps.

---

## 2. MVP scope (v0.1)

In scope:
- **Onboarding + consent** (what it does / doesn't do / privacy).
- **Person profiles** (name, relationship type, notes).
- **Import:** WhatsApp `.txt` export and manual copy-paste **first**; Instagram JSON and screenshot (OCR) as stretch within MVP.
- **Robust WhatsApp parser** with tests (multiple formats, multiline, system messages, omitted media).
- **Person memory:** structured summaries (tone, recurring patterns, unresolved conflicts, positive signals, stress points) with confidence + evidence references.
- **AI chat with context** (question + person memory + relevant recent messages + summaries + safety rules).
- **Reply drafting:** 3 styles (calm/direct, warm/empathetic, short/casual).
- **Reality Check mode** (6-part structured output).
- **Safety layer:** pre-classification of every query; safe handling of crisis/abuse/stalking/manipulation/medical.
- **Settings:** delete person, delete conversation, export data, cloud-analysis toggle, privacy mode.
- **Model abstraction layer** (Claude for deep reasoning, cheaper model for light chat; swappable).

Out of scope for v0.1 (see Non-goals + Future).

---

## 3. Non-goals

- No direct/automated reading of WhatsApp/Instagram/iMessage/Gmail. **Only user-initiated imports.**
- No voice cloning of friends or public figures. No impersonation of anyone without explicit consent.
- No therapy/medical/diagnosis claims.
- No "manipulation/seduction/winning" coaching, revenge advice, or obsessive-checking workflows.
- No certainty about a third party's inner state.
- No training/fine-tuning on user data.
- No background sync, no contact scraping, no notifications that nudge obsessive checking.

---

## 4. Privacy & safety principles

**Privacy (data-handling):**
1. **Consent before every import** — explicit screen, per import, restating where data goes.
2. **Local-by-default** — raw imported messages stored on device (encrypted). Cloud receives only *selected relevant chunks* needed for a given question, and only when **Cloud analysis = ON**.
3. **Store summaries, not raw chat, server-side** — person memory objects + per-import summaries, never the full raw transcript by default.
4. **Deletion controls** — person-level and conversation-level delete; "export my data"; account/data wipe.
5. **No training on user data**; provider calls configured with no-retention where available.
6. **No sensitive content in logs** — never log raw messages or full prompts. Log metadata (counts, latencies, model, redacted hashes) only.
7. **Encryption** — at rest on device (SQLCipher / Expo SecureStore for keys); TLS in transit; encrypted columns for any sensitive server-stored text.
8. **Secrets via env vars**; keys never in the client.

**Safety (model behavior):** the assistant must NOT state another person's thoughts as fact, encourage stalking/manipulation/coercion/harassment/revenge/obsessive checking, diagnose, or give absolutes ("they definitely hate you"). It MUST be balanced, flag missing context, separate evidence from interpretation, encourage healthy communication, offer calm replies, ask grounding questions, gently name possible overthinking, carefully note possible red flags without overclaiming, and escalate to professional/emergency help for crisis/self-harm/abuse.

---

## 5. System architecture

```
┌──────────────────────────────────────────────────────────────┐
│  MOBILE (Expo / React Native / TS)                            │
│                                                                │
│  • Onboarding/consent      • Person list/detail               │
│  • Import (file pick, paste, OCR)                              │
│  • Local store: SQLite (encrypted) — raw messages + memory    │
│  • On-device WhatsApp parser (packages/core)                   │
│  • Chat UI / Reality Check / Reply drafts                      │
│  • Settings (delete, export, cloud toggle, privacy mode)      │
│                                                                │
│   raw chat stays here ──────────────┐                          │
└─────────────────────────────────────┼──────────────────────────┘
            selected chunks + memory   │  (only if Cloud Analysis ON)
            over HTTPS                  ▼
┌──────────────────────────────────────────────────────────────┐
│  SERVER (Node/Express/TS)                                      │
│                                                                │
│  POST /v1/safety/classify   → SafetyClassifier                 │
│  POST /v1/reflect           → safety → context build → LLM     │
│  POST /v1/reply-drafts      → 3 styles                         │
│  POST /v1/reality-check     → 6-part structured                │
│  POST /v1/memory/summarize  → person memory objects           │
│                                                                │
│  ModelProvider abstraction (Claude deep / Haiku light)        │
│  Prompt templates + safety system prompt (packages/core)      │
│  Postgres + Prisma: users, persons, memories, summaries,      │
│     imports(meta), audit(non-sensitive)  — NO raw chat default │
│  Redacting logger (no raw content)                             │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼  (provider call, no-retention)
                 Anthropic Claude API
```

Two deployment modes, user-controlled:
- **Privacy mode / Cloud OFF:** everything local; AI features that need the cloud are disabled or (future) use an on-device model. App is still useful for organizing/parsing.
- **Cloud ON:** server orchestrates LLM calls using only the minimal context the client sends.

`packages/core` is shared TypeScript used by **both** client (parser, safety heuristics, prompt building, types) and server (same + provider calls), so parsing/safety logic is identical everywhere and testable in isolation.

---

## 6. Recommended tech stack

**Frontend:** Expo (React Native) + TypeScript; Expo Router; NativeWind (Tailwind) for styling; `expo-document-picker`/`expo-file-system` for imports; `expo-sqlite` (+ SQLCipher where available) for local encrypted store; `expo-secure-store` for keys; `expo-image-manipulator` + an OCR option (cloud Vision or on-device ML Kit) for screenshots later.

**Backend:** Node.js + Express + TypeScript; Zod for validation; Prisma ORM + PostgreSQL; Pino logger with redaction; Helmet/CORS; rate limiting (later).

**AI:** Anthropic Claude via `@anthropic-ai/sdk`. `ModelProvider` interface so providers/models are swappable. Deep reasoning → Claude Opus/Sonnet; light chat/classification → Claude Haiku. Embeddings deferred but the memory/retrieval layer is designed to accept a vector index later.

**Shared:** `packages/core` (parser, safety, prompts, model abstraction, types, schemas). Jest for tests. pnpm/npm workspaces monorepo.

---

## 7. Data model

Local (device, SQLite) and server (Postgres) share shapes via `packages/core` types. Raw `Message` rows live **on device**; server keeps memory/summaries only.

```
User            id, createdAt, settings(JSON: cloudAnalysis, privacyMode, modelTier)
Person          id, userId, name, relationshipType, notes, createdAt
Import          id, personId, source(whatsapp|instagram|screenshot|paste),
                fileName?, messageCount, rangeStart, rangeEnd, createdAt
Message(local)  id, importId, personId, sender, senderRole(me|them|system),
                text, timestamp, source, mediaOmitted(bool)
PersonMemory    id, personId, kind(tone|pattern|unresolved|positive|stress|summary),
                content(text), confidence(0..1), evidence(JSON: messageIds/quotes),
                model, createdAt, updatedAt
ConversationSummary id, importId, personId, summary, highlights(JSON), createdAt
SafetyEvent     id, userId, category, severity, action, createdAt   // NO raw text
AuditLog        id, userId, event, metadata(JSON, redacted), createdAt
```

`senderRole` is resolved at import time by asking the user "which name is you?" so "me vs them" is reliable.

---

## 8. AI pipeline

Every reflective request runs the same spine:

1. **Client builds minimal context** — person memory + the *relevant* recent messages (windowed, e.g. last N or user-selected range) + import summaries. Raw history is NOT shipped wholesale.
2. **Safety classify** (`SafetyClassifier`, can run client-side heuristic first, then server model classify): categories = `self_harm | abuse_coercive_control | stalking_harassment | manipulation_request | crisis | medical_request | normal`. Returns `{category, severity, action}`.
3. **Route on safety:**
   - `crisis`/`self_harm`/`abuse` (high) → **safe-response template** (validate, encourage immediate/professional support, regional resources), do **not** do analysis that could escalate.
   - `manipulation_request`/`stalking` → decline the harmful framing, offer a healthy-communication reframe.
   - `medical_request` → no diagnosis; suggest professional.
   - `normal` → proceed.
4. **Build prompt** from templates: `SYSTEM_SAFETY` + mode template (`reflect` / `reality_check` / `reply_drafts`) + structured context.
5. **Model call** via `ModelProvider` (tiered: deep vs light).
6. **Post-process / validate** — for Reality Check, enforce the 6-section structure; strip any absolute-certainty phrasing; attach "evidence vs interpretation" labeling.
7. **Return** answer + (optional) updated memory deltas. **Log metadata only.**

Memory generation (`/memory/summarize`) consumes a window of parsed messages and emits `PersonMemory` objects with `confidence` and `evidence` references — never raw overclaiming.

---

## 9. UX flow

Screens:
1. **Welcome / Onboarding** (3 cards: what it does / what it doesn't / privacy) → **Consent**.
2. **Home / Person list** (+ add person).
3. **Add Person** (name, relationship type, notes).
4. **Person detail** (memory cards: tone, patterns, unresolved, positives, stress; tabs: Chat, Imports, Memory).
5. **Import** (choose source → consent restate → pick file/paste → "which name is you?" → parse preview → confirm).
6. **Chat** (ask questions; quick chips: "Am I overthinking?", "Was I wrong?", "What should I reply?", "Reality check").
7. **Reality Check result** (6-part layout).
8. **Reply drafts** (3 styles, copy button, "make calmer/shorter").
9. **Settings** (cloud analysis toggle, privacy mode, delete person/conversation, export data).
10. **Crisis/safety interstitial** (shown when safety layer triggers).

Core loop: add person → import chat → review auto memory → ask a question → get balanced answer / reality check / reply drafts.

---

## 10. Implementation task list

**Phase 0 — Repo & shared core**
- [ ] Monorepo (npm workspaces): `packages/core`, `apps/server`, `apps/mobile`.
- [ ] `core`: types + Zod schemas.
- [ ] `core`: WhatsApp parser + Jest tests.
- [ ] `core`: SafetyClassifier (heuristics) + tests.
- [ ] `core`: prompt templates + safety system prompt.
- [ ] `core`: `ModelProvider` interface + Anthropic + mock providers.

**Phase 1 — Server**
- [ ] Express app, Zod validation, redacting logger, Helmet/CORS.
- [ ] Prisma schema + migrations.
- [ ] Routes: `/safety/classify`, `/reflect`, `/reply-drafts`, `/reality-check`, `/memory/summarize`, persons CRUD, delete/export.
- [ ] `.env.example`.

**Phase 2 — Mobile**
- [ ] Expo app + router + theming.
- [ ] Local SQLite store + secure key.
- [ ] Onboarding/consent, Home, Add Person, Import (WhatsApp + paste), Person detail, Chat, Reality Check, Reply drafts, Settings.
- [ ] API client + cloud-analysis gating.

**Phase 3 — Polish/stretch**
- [ ] Instagram JSON parser; screenshot OCR.
- [ ] Rate limiting, auth, abuse throttling.
- [ ] Embeddings/retrieval; voice (future); "talk to myself" (future, consent-gated).

---

## 11. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Model overclaims another person's intent | Safety system prompt + post-processing to strip certainty; evidence-vs-interpretation labeling. |
| User in crisis | Safety classifier + crisis interstitial + resources; avoid escalatory analysis. |
| Misuse for manipulation/stalking | Classifier declines + reframes toward healthy communication; non-goals enforced in prompt. |
| Privacy leak via logs | Redacting logger; never log raw content/full prompts; metadata only. |
| Sensitive data in cloud | Local-by-default; send minimal chunks; cloud toggle; no-retention provider config; no training. |
| WhatsApp format drift | Parser handles multiple formats + tests; graceful fallback to "unparsed" lines. |
| Wrong "me vs them" attribution | Ask user to pick their name at import; allow re-map. |
| Provider lock-in/cost | `ModelProvider` abstraction; tiered models; mock provider for dev/tests. |

---

## 12. Development order

1. **`packages/core`** — types, parser (+tests), safety (+tests), prompts, model abstraction. *(Most concrete, fully testable now.)*
2. **`apps/server`** — Express routes wired to core, Prisma schema, env example.
3. **`apps/mobile`** — Expo skeleton, local store, import + chat screens.
4. **Stretch** — Instagram/OCR, auth/rate limits, embeddings, voice.

> Default assumptions taken (no blocking on confirmation): npm workspaces monorepo; Express (not Next API routes) for a clean mobile-facing API; NativeWind for styling; Anthropic SDK with a mock provider so the repo runs without keys; raw messages local, summaries/memory server-side. These match the recommended stack and can be swapped behind the abstractions.
