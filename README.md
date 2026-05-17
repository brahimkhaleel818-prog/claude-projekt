# Static Ads Generator

A single Node + Express monolith for planning and generating static ad
creative. Backend, frontend, and API all run from one process. The frontend
is plain HTML + vanilla JS with Tailwind via CDN — no bundler.

## Features

- Multi-tenant **client switcher** — every record lives under a `client_id` and a
  default workspace is auto-created on first boot
- **Brand kit** per client: name, tagline, description, primary/secondary/accent
  colors, typography, light + dark logo variants
- **Asset library** — multi-file upload, post-upload categorization modal
  (product, packaging, lifestyle, logo, other), search, filter
- **Template library** — uploads, favorites, save-as-template from any
  succeeded generation
- **Brand intelligence** profiles (persona, pain point, angle, visual
  direction, emotion, copy hook) — manual entry or AI-generated via Gemini
- **Prompt composition** — compose `/api/prompt/compose`, reverse-engineer
  winners `/api/prompt/reverse`, concept directions `/api/prompt/concepts`
- **Single generation** `/api/generate` with FAL Flux defaults, brand-kit
  toggle, reference + product image inputs
- **Re-prompt variations** `/api/generate/edit` keeps parent linkage
- **Campaign builder** — profile-first plan + batch generate with per-item
  status; succeeded / partial / failed rollup
- **History board** — every generation rendered as a card; pending and
  failed states surface inline
- **Production hardening** — hardened static `/uploads/` serving, JSON-only
  error handler, env warnings at boot, orphan-file cleanup

## Quick start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 2. Install + configure
```bash
npm install
cp .env.example .env
# edit .env: at minimum DATABASE_URL; add GEMINI_API_KEY / FAL_KEY when ready
```

### 3. Boot
```bash
npm start
# or for hot reload:
npm run dev
```

Open http://localhost:3000.

The server runs `database/init.js` automatically — creates all tables,
applies `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations, and seeds a
default client if none exist. Re-running is always safe.

### Required env

| Variable      | Required | Purpose |
|---------------|:--------:|---------|
| `DATABASE_URL` | yes | Postgres connection string |
| `DATABASE_SSL` | no | Set `true` for managed Postgres |
| `PORT` | no | Defaults to `3000` |
| `GEMINI_API_KEY` | no | Enables AI prompt composition, reverse, concepts, intel generation |
| `GEMINI_MODEL` | no | Default `gemini-2.0-flash` |
| `FAL_KEY` | no | Enables actual image generation |
| `FAL_MODEL` | no | Default `fal-ai/flux/dev` |
| `FAL_TIMEOUT_MS` | no | Default `90000` |

Missing optional keys do **not** crash boot. Instead `/api/admin/status`
reports what's available, and the relevant endpoints return `503` with a
clear `error` code (`gemini_unavailable`, `fal_unavailable`) plus a
persisted `failed` row so history never silently loses work.

## Architecture map

```
server.js                 boot, middleware, route mounting
database/init.js          schema + idempotent migrations + default seed
middleware/
  resolveClient.js        X-Client-Id → req.client / req.clientId
  upload.js               multer disk storage, image MIME filter, size caps
routes/
  clients.js              GET/POST/PATCH/DELETE /api/clients + last-client guard
  brandKits.js            GET/PATCH + logo upload/delete per variant
  assets.js               list, multi-upload, bulk re-categorize, delete
  templates.js            upload + favorite + edit + delete
  generate.js             POST /api/generate, POST /api/generate/edit
  generations.js          history list + save-as-template
  brandIntelligence.js    CRUD + Gemini-driven /generate
  prompt.js               /compose (+ deterministic fallback), /reverse, /concepts
  campaigns.js            /plan + /:id/generate; CRUD; per-item status
  admin.js                /status, /cleanup-uploads
utils/
  gemini.js               wrapper around @google/generative-ai
  fal.js                  wrapper around @fal-ai/client with timeout + normalization
  downloadImage.js        safe local copy / remote fetch into uploads/
  cleanupUploads.js       deletes orphan files not referenced in DB
  startupChecks.js        env warnings at boot
public/js/app.js          sidebar nav + section loaders + client switcher
public/css/styles.css     small overrides on top of Tailwind CDN
views/index.html          single-page UI shell
```

## Operations

### Inspect runtime config
```bash
curl http://localhost:3000/api/admin/status
```

### Clean up orphan uploaded files
Files referenced by `brand_kits.logo_*`, `assets.url`, `templates.image_url`,
or `generations.images[*].url` are kept. Everything else is removed.
```bash
npm run cleanup:dry   # report only
npm run cleanup       # actually delete
# or:
curl -X POST http://localhost:3000/api/admin/cleanup-uploads
```

### Multi-client routing
All `/api/*` routes look at the `X-Client-Id` request header. The UI
persists the active client id in `localStorage` and sends it
automatically. If the header is absent or points at a non-existent client,
the lowest-id client is used (default fallback).

## Deploying

The app is a single process. On Replit / Render / Railway / a plain VPS:
1. Provision a Postgres database; copy its connection string to
   `DATABASE_URL`
2. Run `npm install`
3. Run `npm start`
4. Reverse-proxy or expose the configured `PORT`

`uploads/` is a local directory. For multi-instance or stateless
deployments, mount a persistent volume there or move to object storage
(future work).

## Status codes

The `/api` error envelope is always JSON:
```json
{ "error": "code", "message": "human-friendly explanation" }
```

| Code | Meaning |
|------|---------|
| `400` | Validation failure (`invalid_name`, `no_file`, `upload_failed`, ...) |
| `404` | `not_found` |
| `409` | `last_client` (can't delete the only remaining client) |
| `502` | Upstream provider failed (`generation_failed`, `reverse_failed`, ...) |
| `503` | Optional integration not configured (`gemini_unavailable`, `fal_unavailable`) |
| `500` | Unhandled — check server logs |

## License

Internal.
