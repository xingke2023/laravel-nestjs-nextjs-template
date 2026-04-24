# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monorepo with five sub-projects:

| Directory | Stack | Port | Role |
|-----------|-------|------|------|
| `backend/` | Laravel (PHP) | 8000 | Main app: Web pages, Filament admin, business logic |
| `nestjs-backend/` | NestJS (TypeScript) | 8068 | High-concurrency services, posts API |
| `fastify-backend/` | Fastify (Node.js) | 3200 | High-performance HTTP services |
| `frontend/` | Next.js (TypeScript) | 3111 | Primary frontend |
| `frontend1/` | Vue 3 + Vite | — | Reference frontend |

## Commands

### Laravel (`backend/`)
```bash
php artisan serve                # Start dev server
php artisan migrate              # Run migrations
php artisan migrate:rollback     # Rollback last migration
php artisan make:migration name  # Create migration
php artisan make:controller name # Create controller
php artisan test                 # Run tests
composer install                 # Install dependencies
```

### NestJS (`nestjs-backend/`)
```bash
npm run start:dev   # Start with hot reload
npm run start:prod  # Start production (node dist/main)
npm run build       # Compile TypeScript
npm run test        # Run unit tests
npm run lint        # Lint and fix
```

### Fastify (`fastify-backend/`)
```bash
npm start        # Start production server
npm run dev      # Start with hot reload (node --watch)
```

### Next.js frontend (`frontend/`)
```bash
npm run dev    # Start dev server on 0.0.0.0:3111
npm run build  # Build for production
npm run lint   # ESLint
```

### Vue frontend (`frontend1/`)
```bash
npm run dev    # Start dev server
npm run build  # Build
```

## Architecture

### Authentication Flow

All auth is delegated to an **external Auth Center** (SSO). Neither Laravel nor NestJS handles passwords directly.

```
frontend → Laravel /api/auth/login → Auth Center (https://mo.xingke888.com/api)
frontend → NestJS  /api/auth/login → Auth Center
```

- Auth Center issues `accessToken` + `refreshToken` (JWT, dual-token)
- Laravel config: `AUTH_CENTER_URL` in `.env`, `config/services.auth_center.url`
- NestJS config: `AUTH_CENTER_URL` in `.env`, implemented in `src/auth/auth-center.service.ts`
- Both projects use **the same `JWT_SECRET`** to verify tokens
- Login field is `identifier` (username or email), not `email`

### JWT Verification

- **Laravel**: `JwtAuthMiddleware` using `firebase/php-jwt`, verifies with `config('jwt.secret')`
- **NestJS**: `JwtGuard` using `@nestjs/jwt`, verifies then looks up `sso_users` table to get local `user_id`
- **Fastify**: `preHandler` hook using `@fastify/jwt`, whitelist-based — protected by default, public routes explicitly listed in `src/plugins/jwt.js`

### User Sync (SSO Mapping)

Both backends maintain a local `users` table linked to the Auth Center via `sso_users`:

```
sso_users.sso_user_id  →  Auth Center user ID (from JWT payload.sub)
sso_users.local_user_id →  local users.id
```

On first login, a local `User` record is created and mapped in `sso_users`. Both Laravel (`SsoUser` model) and NestJS (`SsoUser` entity) use the same tables.

### Database

Both backends share **one MySQL database** (`backend`). Schema is managed by **Laravel migrations only** — NestJS has `synchronize: false`.

Shared tables: `users`, `sso_users`, `posts`
Laravel-only tables: `cache`, `jobs`, `sessions`, `personal_access_tokens`, etc.

### Frontend API Clients (`frontend/`)

Three API clients in `lib/api/client.ts`:
- `laravelClient` → `NEXT_PUBLIC_LARAVEL_API_URL` (auth endpoints)
- `nestjsClient` → `NEXT_PUBLIC_NESTJS_API_URL` (posts endpoints)
- `fastifyClient` → `NEXT_PUBLIC_FASTIFY_API_URL` (iching, image, scenic, video endpoints)

All clients auto-inject `accessToken` from localStorage. On 401, all trigger token refresh via **Laravel's** `/token/refresh` endpoint (single shared refresh flow).

### OAuth / WeChat Login

WeChat OAuth redirects to `/oauth/callback` with `accessToken` and `refreshToken` as query params. The callback page (`app/oauth/callback/page.tsx`) stores tokens and fetches user info.

## Key Environment Variables

**`backend/.env`**
```
AUTH_CENTER_URL=https://mo.xingke888.com/api
JWT_SECRET=...
JWT_ALGO=HS256
DB_CONNECTION=mysql / DB_DATABASE=backend
```

**`nestjs-backend/.env`**
```
AUTH_CENTER_URL=...   # Must match Laravel's auth center
JWT_SECRET=...        # Must match Laravel's JWT_SECRET
DB_HOST/DB_PORT/DB_DATABASE/DB_USERNAME/DB_PASSWORD
PORT=8068
```

**`frontend/.env.local`**
```
NEXT_PUBLIC_LARAVEL_API_URL=http://localhost:8000/api
NEXT_PUBLIC_NESTJS_API_URL=http://localhost:8068/api
NEXT_PUBLIC_FASTIFY_API_URL=http://localhost:3200
```

**`fastify-backend/.env`**
```
PORT=3200
HOST=0.0.0.0
JWT_SECRET=...        # Must match Laravel/NestJS JWT_SECRET
AUTH_CENTER_URL=https://mo.xingke888.com/api
GEMINI_API_KEY=...    # Google Gemini image generation
GEMINI_BASE_URL=...   # Optional proxy base URL
ARK_API_KEY=...       # Volcengine Ark API (Seedance video generation)
WEBHOOK_BASE_URL=...  # Public base URL of this server for Ark callbacks (e.g. https://example.com)
```

**`frontend1/.env`**
```
VITE_API_BASE_URL=https://api-161-1.xingke888.com/api
```

## NestJS Route Protection

Global `JwtGuard` protects all routes by default. Use `@Public()` decorator to allow unauthenticated access. Currently public: `GET /posts`, `GET /posts/:id`, `POST /auth/login`, `POST /auth/register`, `POST /token/refresh`.

## Fastify Route Protection

Global `preHandler` hook in `src/plugins/jwt.js` protects all routes by default. Public routes are explicitly listed in the `PUBLIC_ROUTES` set — add `'METHOD:/path'` to whitelist a route. Supports `*` suffix for prefix matching. Verified JWT payload is available at `request.jwtPayload` (`.sub` = SSO user ID).

Currently public: `GET /`, `GET /health`, `GET|POST /iching/predict`, `GET /iching/trigrams`, `GET /iching/hexagrams/*`, `POST /image/generate`, `GET /scenic/spots`, `GET /scenic/sub-spots`, `POST /video/generate`, `GET /video/task/*`, `POST /video/webhook`, `GET /video/webhook/status`.

## Fastify Video Generation (`src/routes/video.js`, `src/video/`)

Integrates Volcengine Ark **Seedance 2.0** for async video generation.

**Endpoints:**
- `POST /video/generate` — submit task; accepts `prompt`, `images[]`, `videos[]`, `audios[]` (each `{url}` or `{data, mimeType}`), plus `model`, `resolution` (`480p`/`720p`), `ratio`, `duration` (4–15s), `generateAudio`, `watermark`, `webSearch`. Auto-injects `callback_url` from `WEBHOOK_BASE_URL`.
- `GET /video/task/:taskId` — poll status; returns cached terminal states from in-memory store, always calls Ark API for non-terminal states.
- `POST /video/webhook` — receives Ark push callbacks; stores result in `src/video/store.js` (in-memory Map, TTL 48h).
- `GET /video/webhook/status` — debug: shows store size and configured callback URL.

**Ark REST API base:** `https://ark.cn-beijing.volces.com/api/v3`
- Create: `POST /contents/generations/tasks`
- Poll: `GET /contents/generations/tasks/{id}`
- Response video URL: `result.content.video_url` (string)

**Virtual avatar assets:** Reference images can use `asset://asset-xxxx` URLs instead of HTTP URLs. In prompts, still reference by position (「图片1」not the asset ID).

## Fastify Service Structure

Adding a new Fastify service requires three steps:

1. **Create** `src/<name>/service.js` — business logic
2. **Create** `src/routes/<name>.js` — export `async function <name>Routes(fastify)` with route handlers
3. **Register** in `src/app.js`: `app.register(<name>Routes, { prefix: '/<name>' })`
4. **Whitelist** any public routes in `src/plugins/jwt.js` `PUBLIC_ROUTES` set

Response convention: `{ success: true, data: ... }` on success, `reply.code(4xx/5xx).send({ success: false, error: msg })` on error. Body size limit is 30 MB (set in `buildApp`).

## Process Management (PM2)

All services run under PM2. After code changes:

```bash
# Frontend: must build first, then restart
cd /home/ubuntu/app/frontend && npm run build
pm2 restart nextjs-frontend

# Fastify: restart picks up new JS files immediately
pm2 restart fastify-backend

# Reload env vars (after .env changes)
pm2 restart <name> --update-env
```

PM2 process names: `nextjs-frontend` (id 4), `fastify-backend` (id 8), `nestjs-backend` (id 5), `laravel-backend` (id 6).

## Frontend Video Page (`frontend/app/video/`)

- Virtual avatar library images are stored in `frontend/public/avatars/` (filename format: `{assetId}_{label}.png`). Served as static assets at `/avatars/`.
- Task state persisted in `localStorage` key `video_task` for page-refresh recovery. Polling restarts on mount if status is non-terminal.
- `visibilitychange` listener immediately polls when tab becomes active (avoids browser throttling of background `setInterval`).
- `@` in the prompt textarea triggers a mention dropdown for referencing uploaded media by position (图片1, 视频1, 音频1…). Uses mirror-div technique to position dropdown at the `@` caret.
- Media items (images/audio) are passed as `{ url, data, mimeType }` — `url` takes priority in `buildMediaUrl`; base64 falls back to `data:` URI. `asset://` URLs pass through unchanged to Ark API.
- Prompt must reference media by position type+index (「图片1」「视频2」), not by asset ID or filename.

## Adding a New Frontend Page

1. Create `frontend/app/<name>/page.tsx` with `'use client'` directive
2. Use `fastifyClient`, `laravelClient`, or `nestjsClient` from `@/lib/api/client`
3. Add a link in `frontend/app/page.tsx` under the appropriate section (免费工具 or 会员功能)
4. Run `npm run build` in `frontend/` then `pm2 restart nextjs-frontend`
