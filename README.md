# Matrix × CandexAI

Voice-agent + CRM platform: ElevenLabs Conversational AI agents call your Zoho CRM leads, and after each call the collected answers fill the lead's **empty** fields and are written back to Zoho.

```
matrix/
├── backend/    Express + TypeScript + Mongoose (MongoDB Atlas)   → http://localhost:5001
└── frontend/   Next.js 16 + React 19 + Tailwind v4                → http://localhost:3000
```

## Pages

| Route            | What it does |
|------------------|--------------|
| `/conversations` | Inbox of voice calls: transcript, audio, summary, collected data, Zoho sync status. Channel pills (Website/WhatsApp/…) are placeholders for later phases. |
| `/leads`         | **My Leads** — lead tables: every Zoho custom view of the Leads module becomes a table (plus *All leads* and manual lists). Open a table to see its rows, attach a voice agent per table (or a workspace default), call one lead or multi-select and batch-call. |
| `/agents`        | **Voice Agents** — create/edit ElevenLabs agents with the full configuration surface: LLM, language(s), voice + TTS model, ASR, turn-taking, tools, human transfer, data collection, evaluation, privacy, limits, post-call webhook. Import existing agents from ElevenLabs. |
| `/test`          | **AI Test** — telephonic test: pick an agent and a number from Phone Numbers, enter a mobile number, and the agent rings it; the call's transcript, summary and collected data appear when it ends. A browser-only web call is available via **Preview** on each agent card. |
| `/analytics`     | **Calls** tab: calls, minutes, outcomes, agent performance, lead funnel, activity heatmap. **Insights** tab: every completed call is read by an LLM and classified into a living taxonomy of at most 12 tags (outcome, sentiment, objection, intent, topic); tags merge as patterns converge and counts are recomputed from the calls, plus sentiment, loss risk, objections and next best actions. |
| `/phone-numbers` | Import Twilio numbers or SIP-trunk numbers into ElevenLabs, assign them to agents, remove them. These numbers are used for outbound calls from My Leads and AI Test. |
| `/integrations`  | Zoho CRM (real OAuth), ElevenLabs status, and upcoming channel/CRM cards. |

## Quick start

```bash
npm run install:all            # installs backend + frontend deps
cp backend/.env.example backend/.env   # then fill in the values below
npm run dev                    # runs both servers (or npm run dev:backend / dev:frontend)
```

### backend/.env

| Variable | Notes |
|----------|-------|
| `MONGODB_URI`, `DB_NAME` | Atlas connection. Add this machine's public IP to **Atlas → Network Access**. In development the backend falls back to an in-memory MongoDB when Atlas is unreachable (data is not persisted). |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_BASE_URL` | Direct ElevenLabs API. Use `https://api.eu.residency.elevenlabs.io` for EU-residency keys. |
| `ELEVENLABS_SERVICE_URL` | Optional. Your Python FastAPI ElevenLabs wrapper (`Desktop/elvenlabs_agent`, `venv/bin/python run_api.py`, port 8000). When reachable, agent create/update go through it; otherwise the backend talks to ElevenLabs directly. |
| `PUBLIC_BACKEND_URL` | Public **https** URL of the backend. Optional: if it is not https, the backend auto-detects a running `ngrok http 5001` tunnel (via ngrok's local API on port 4040), registers the post-call webhook and attaches it to every agent within a minute. |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_ACCOUNTS_URL` | Create a *Server-based application* at https://api-console.zoho.com with redirect URI `${PUBLIC_BACKEND_URL}/api/v1/integrations/zoho/callback`. Use the accounts host of your data centre (`accounts.zoho.in`, `accounts.zoho.com`, `accounts.zoho.eu`…). |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Post-call transcript extraction (fills empty lead fields). Optional; without it only ElevenLabs data-collection results are used. |
| `ENCRYPTION_KEY` | 32+ chars; encrypts OAuth tokens and webhook secrets at rest. |

## Conversation Insights (dynamic analytics)

After each completed call with a transcript, `services/insights.service.ts` sends the transcript plus the current taxonomy (labels, descriptions, counts, cap) to OpenAI. The model must reuse an overlapping tag, may add a tag only while there is room, and when the taxonomy is full it must merge two semantically identical tags (e.g. *Not Happy* + *Aggressive Caller* → *Frustrated Caller*). Merges rewrite the tagged conversations and counts are recomputed from conversations, so merged counts always sum correctly. Each conversation stores `insights` (tags with evidence quotes, sentiment score, caller mood, intent, objections, loss risk, next best action, key quote). Endpoints: `GET /analytics/insights?days=30`, `GET|PATCH|DELETE /analytics/insights/tags[/:key]`, `POST /analytics/insights/tags/:key/merge`, `POST /analytics/insights/reanalyze`, `POST /conversations/:id/analyze`. Cap: `INSIGHT_TAG_CAP` (default 12).

## Generate an agent with AI (per lead table)

`POST /lead-lists/:id/generate-agent` takes your instructions, an optional website URL (the page is fetched and summarised into the prompt), language/tone, and the table's collectable columns (empty-capable Zoho fields, with how filled each one is). The LLM drafts the agent name, first message, a structured system prompt (identity, available data as dynamic variables, numbered conversation flow with one question per empty column, objection handling, close, style rules) and the data-collection fields with "ask as" phrasing. `dryRun: true` returns the editable draft; posting the edited `draft` creates the agent on ElevenLabs and attaches it to the table with the field mapping.

## Zoho OAuth when the redirect URI points at production

If the Zoho app's registered redirect URI is the production backend (e.g. `https://synervo-api.candexai.co.in/...`) and you cannot add a localhost URI in the Zoho API console, run the local bridge:

```bash
npm run zoho:bridge
```

It starts a local HTTPS server on port 8443 that impersonates the production hostname and opens a dedicated Chrome window where that hostname resolves to 127.0.0.1 (via `--host-resolver-rules`; your normal browser is untouched). Click **Connect Zoho CRM** in that window; after you approve, Zoho's redirect lands on the bridge, which forwards `code` + `state` to `http://localhost:5001`, the token is exchanged and stored in MongoDB, and you are sent back to `http://localhost:3000/integrations`. Keep `ZOHO_REDIRECT_URI` set to the registered production URL.

## How the Zoho ↔ voice loop works

1. **Connect Zoho** on `/integrations` → OAuth tokens are stored (encrypted) in MongoDB (`zohointegrations`).
2. **Sync now** pulls Leads (all editable fields) into `leads`; each lead keeps every Zoho field in `fields` keyed by API name.
3. **Attach a voice agent** on `/leads`: pick the agent, the outbound number and the Zoho fields to collect. The backend writes a matching `platform_settings.data_collection` schema to the ElevenLabs agent and points it at the post-call webhook.
4. **Call** a lead (or a batch). The lead's details are passed as dynamic variables (`name`, `company`, `zoho_<field>`, `lead_id`…).
5. **Post-call webhook** (`POST /api/v1/webhooks/elevenlabs/post-call`, HMAC-verified) stores the conversation and matches the lead (by `lead_id`, then by phone number). Then two extraction passes fill fields that are **empty** on the lead:
   - ElevenLabs *data collection* results (the fields configured on the agent / list binding);
   - **OpenAI** (`OPENAI_API_KEY`, model `OPENAI_MODEL`, default `gpt-4.1-mini`): every remaining empty, writable Zoho field is sent with the transcript; only values the caller clearly stated are returned, coerced to the Zoho data type (picklists matched, lakh/crore converted, Roman script). Workflow fields such as `Lead_Status` are never auto-filled (the binding's "set status after call" handles that).
   The merged values are written to the lead and pushed to Zoho (`PUT /crm/v6/Leads/{id}`); the conversation records `zohoSync` and `extraction` details. If the webhook can't reach you (no public URL), use **Sync from ElevenLabs** on `/conversations` — it runs the same pipeline.

## API (backend, all under `/api/v1`)

- `GET /catalog`, `GET /voices`, `GET /usage`
- `GET /phone-numbers`, `GET /phone-numbers/:id`, `POST /phone-numbers/twilio`, `POST /phone-numbers/sip-trunk`, `PATCH /phone-numbers/:id` (assign agent / label / trunk config), `DELETE /phone-numbers/:id`
- `GET|POST /agents`, `GET|PATCH|DELETE /agents/:id`, `POST /agents/:id/sync`, `POST /agents/webhooks/ensure` (attach the current public post-call webhook to every agent), `GET /agents/:id/signed-url`, `POST /agents/:id/test-call` (ring a real phone with the agent), `GET /agents/remote`, `POST /agents/import`, `GET /agents/providers`
- `GET /lead-lists`, `POST /lead-lists`, `GET|PATCH|DELETE /lead-lists/:id`, `POST|DELETE /lead-lists/:id/leads`, `GET|PUT|DELETE /lead-lists/:id/agent-binding`
- `GET|POST /leads` (`?listId=`), `GET|PATCH|DELETE /leads/:id`, `GET /leads/:id/conversations`, `POST /leads/:id/call`, `POST /leads/batch-call`, `GET|PUT|DELETE /leads/agent-binding` (workspace default; `?listId=` for a list)
- `GET /conversations`, `POST /conversations/sync`, `GET /conversations/:id`, `POST /conversations/:id/refresh`, `GET /conversations/:id/audio`, `DELETE /conversations/:id`
- `GET /integrations`, `POST /integrations/zoho/connect`, `GET /integrations/zoho/callback`, `GET /integrations/zoho/status`, `POST /integrations/zoho/sync`, `GET /integrations/zoho/fields`, `DELETE /integrations/zoho/disconnect`
- `POST /webhooks/elevenlabs/post-call`
- `GET /analytics/dashboard?days=30` (+ `/summary`, `/trends`, `/agents`, `/outcomes`, `/leads`, `/heatmap`)

## Deployment (production)

Live at **https://edu.candexai.co.in** on `root@37.60.249.35` (Ubuntu 24.04): nginx (TLS via certbot, HTTP basic auth) → Next.js on 127.0.0.1:3000 and Express on 127.0.0.1:5001, both managed by pm2 from `/opt/matrix`. One-time provisioning: `deploy/setup-server.sh`; updates: `bash /opt/matrix/deploy/deploy.sh`. The full operations runbook (status, logs, restart, TLS, troubleshooting) is in [deploy/README.md](deploy/README.md).

## Developer helpers

- `POST /api/v1/dev/seed?reset=1` (development only) — seeds 12 demo leads (tagged `demo`) and 8 demo voice conversations onto your first agent so every page can be exercised. `DELETE /api/v1/dev/seed` removes the demo data again without touching real records.
- `npm --prefix backend run test:pipeline` — offline test of the config builder, HMAC verification and the post-call → lead-fill → Zoho-sync pipeline against an in-memory MongoDB.
- Set `WEBHOOK_ALLOW_UNVERIFIED=true` (development only) to accept unsigned post-call webhooks while testing with tools like curl.

Multi-tenancy is prepared (every document has `workspaceId`, header `x-workspace-id`), but there is no login yet — single default workspace.
