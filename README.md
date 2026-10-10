# Echo — privacy-first AI reflection companion (MVP)

> "Stop overthinking your messages. Talk it through with an AI that actually knows the context."

A private companion for thinking through your own conversations. Import chats you already
own (WhatsApp export / paste), organize them by person, and ask reflective questions. Echo
answers in a balanced, evidence-grounded way, drafts calm replies, and routes risky inputs
to safe responses. **It is not therapy, medical care, or a diagnosis tool.**

Full design rationale is in [`PLAN.md`](./PLAN.md).

## Monorepo layout

```
packages/core     Shared TS: types, WhatsApp parser (+tests), safety classifier (+tests),
                  prompt templates + safety system prompt, model provider abstraction.
apps/server       Express API. Safety-gated orchestration. Prisma/Postgres for memory &
                  summaries only (NEVER raw chat). Runs with a MockProvider if no API key.
apps/mobile       Expo (React Native) app. Local SQLite store keeps raw messages on-device;
                  cloud calls are gated behind a Cloud Analysis toggle.
```

## Privacy model in one line

Raw messages live **on the device**. The server stores only derived **memories/summaries**.
Cloud LLM calls happen only when **Cloud Analysis = ON** and **Privacy Mode = OFF**, and send
only the minimal selected context — never the whole transcript. No training on user data.

## Prerequisites

- Node 20+
- (Optional) Postgres 14+ for server persistence routes
- (Optional) `ANTHROPIC_API_KEY` — without it the server uses a deterministic mock so the
  whole stack still runs.
- For mobile: Expo Go on a device, or an iOS/Android simulator.

## 1. Install

```bash
npm install                       # installs all workspaces from the repo root
npm run build -w @echo/core       # build core (server + mobile import from its dist)
```

## 2. Run the core tests (parser + safety)

```bash
npm test                          # or: npm test -w @echo/core
```

The parser suite includes an integration test that runs against a real export at
`exports/_extracted/_chat.txt` when present (and skips otherwise). Set `ECHO_MY_NAME` to your
own display name in that export so "me" and "them" resolve correctly. The `exports/` folder
is gitignored — personal chats never enter version control.

## 3. Start the database (Docker)

```bash
docker compose up -d              # Postgres 16 on host port 5433 (5432 left free)
```

This matches the `DATABASE_URL` in `apps/server/.env.example`
(`postgresql://echo:echo@localhost:5433/echo`). Data persists in the `echo_pgdata` volume.

## 4. Run the server

```bash
cp apps/server/.env.example apps/server/.env     # optionally add ANTHROPIC_API_KEY
npm run prisma:generate -w @echo/server
npm run prisma:migrate  -w @echo/server          # creates tables (migration: init)
npm run dev:server                                # http://localhost:4000
```

Without a database the AI routes still work and the persistence routes return 503.
Without `ANTHROPIC_API_KEY` the server uses a deterministic mock provider.

Smoke test:

```bash
curl localhost:4000/health
curl -s localhost:4000/v1/safety/classify -H 'content-type: application/json' \
  -d '{"question":"am I overthinking?"}'
```

## 5. Run the mobile app

```bash
# point the app at your machine's IP if testing on a physical device:
# edit apps/mobile/app.json -> expo.extra.apiBaseUrl
cd apps/mobile
npx expo start
```

Then: accept onboarding/consent → add a person → import a WhatsApp `.txt` (or paste) →
pick which name is you → save (stays local) → optionally turn on Cloud Analysis in Settings
→ Reflect / Reality check / Replies.

## API surface (server)

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/health` | liveness |
| POST | `/v1/safety/classify` | classify a question (no content stored) |
| POST | `/v1/reflect` | reflective answer (mode: reflect/reality_check/reply_drafts) |
| POST | `/v1/reality-check` | 6-part structured reality check |
| POST | `/v1/reply-drafts` | 3 reply styles (calm/warm/short) |
| POST | `/v1/memory/summarize` | derive PersonMemory objects from messages |
| CRUD | `/v1/persons*` | persons + memories + delete/export (needs DATABASE_URL) |

## What's implemented vs. stretch

Implemented: WhatsApp parser (+tests), safety classifier (+tests), safety system prompt &
mode templates, model abstraction (Anthropic + Mock), full server API, local SQLite store,
all core mobile screens (onboarding/consent, home, add person, import, person detail, chat,
reality check, reply drafts, settings, delete/export).

Stretch / future (designed for, not built): Instagram JSON parser, screenshot OCR, auth &
rate limiting, embeddings/retrieval, voice interface, consent-gated "talk to myself" mode.
