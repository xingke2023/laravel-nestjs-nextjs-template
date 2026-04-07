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

Two separate API clients in `lib/api/client.ts`:
- `laravelClient` → `NEXT_PUBLIC_LARAVEL_API_URL` (auth endpoints)
- `nestjsClient` → `NEXT_PUBLIC_NESTJS_API_URL` (posts endpoints)

Both clients auto-inject `accessToken` from localStorage. On 401, both trigger token refresh via **Laravel's** `/token/refresh` endpoint (single shared refresh flow). Auth API (`lib/api/auth.ts`) uses `laravelClient`; Posts API (`lib/api/posts.ts`) uses `nestjsClient`.

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
```

**`frontend1/.env`**
```
VITE_API_BASE_URL=https://api-161-1.xingke888.com/api
```

## NestJS Route Protection

Global `JwtGuard` protects all routes by default. Use `@Public()` decorator to allow unauthenticated access. Currently public: `GET /posts`, `GET /posts/:id`, `POST /auth/login`, `POST /auth/register`, `POST /token/refresh`.

## Fastify Route Protection

Global `preHandler` hook in `src/plugins/jwt.js` protects all routes by default. Public routes are explicitly listed in the `PUBLIC_ROUTES` set — add `'METHOD:/path'` to whitelist a route. Verified JWT payload is available at `request.jwtPayload` (`.sub` = SSO user ID). Currently public: `GET /`, `GET /health`, `GET|POST /iching/predict`, `GET /iching/trigrams`, `GET /iching/hexagrams/*`.
