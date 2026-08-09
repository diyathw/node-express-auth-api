# Node Express Auth API

A production-oriented REST authentication and authorization API built with TypeScript, Express, PostgreSQL, Prisma, JWT, Zod, OpenAPI, Scalar, and ReDoc.

## Features

- Local account registration and login with bcrypt and signed JWTs
- Auth0 RS256 access-token validation through remote JWKS
- Database-backed RBAC with direct roles, groups, and effective permissions
- Protected system roles, final-administrator safeguards, and transactional audit logs
- Cursor-paginated administration endpoints with Zod request validation
- English, French, and Spanish `application/problem+json` errors
- Global and authentication-specific rate limiting
- Liveness/readiness probes and graceful shutdown
- Generated OpenAPI documentation with Scalar and ReDoc interfaces
- Docker Compose workflows for database-only, development, and production-like use

The code follows a layered OOP design with constructor injection. Controllers handle HTTP, `AuthService` owns the use cases, and Prisma stays behind the `UserRepository` interface.

Authorization uses a normalized, NIST-style RBAC model. Permissions are stable code-managed capabilities, roles bundle permissions, groups receive roles, and users receive roles directly or through group membership. New accounts receive the `USER` role automatically. Protected operations check effective permissions from current database assignments, so access removal takes effect immediately rather than waiting for a JWT to expire.

The built-in `ADMIN` role receives the full permission catalog. Its permissions are immutable through the API, the final effective admin assignment cannot be removed, and every access-control mutation is written atomically to `access_audit_logs`. Changing effective administrator access—directly, through groups, or by delegating `admins:manage`—requires `admins:manage`. The API does not create arbitrary permission names at runtime: new capabilities must ship with the application code and a reviewed database migration, preventing typo-driven or unenforced policies.

Rate limiting protects the whole API with a configurable request budget and applies a stricter failed-attempt budget to login and registration. Successful authentication attempts do not consume the stricter budget, and health checks are excluded.

## Auth0 social authentication

Auth0 Universal Login provides Google, Facebook, Apple, GitHub, Microsoft, passwordless, enterprise, and other identity connections without receiving provider passwords in this API.

1. Create an Auth0 Application for your frontend and register its callback/logout URLs.
2. Create an Auth0 API and use its Identifier as `AUTH0_AUDIENCE`; keep RS256 signing enabled.
3. Enable Google, Facebook, and any other connection for the frontend Application under **Authentication → Social**.
4. Set `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` in `.env`.
5. Have the frontend use Universal Login and request an access token for the configured audience. Send that access token—not an ID token—as `Authorization: Bearer TOKEN`.

`GET /api/v1/auth0/me` accepts any valid Auth0 access token for this API. The existing local JWT endpoints remain available separately.

## Languages and locales

API error messages support English (`en`), French (`fr`), and Spanish (`es`). Select a language with the standard `Accept-Language` request header or a `?lang=fr` query parameter; the query parameter takes precedence. Responses include `Content-Language`, and `GET /api/v1/locales` reports the supported and selected locales.

For Auth0 Universal Login, the frontend should pass an OIDC `ui_locales` value such as `ui_locales=fr`. This changes the hosted login interface independently of API response localization.

## Requirements

- Node.js 24 LTS recommended (`.nvmrc` and `.node-version` are included); Auth0's SDK also supports compatible Node 20 and 22 releases
- Docker (recommended) or PostgreSQL 14+

## Run locally

```bash
nvm install
nvm use
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:deploy
npm run dev
```

Before starting the API, replace the example `JWT_SECRET` and review the database, CORS, Auth0, and seed values in `.env`. The server defaults to <http://localhost:3000>.

Create the first local administrator with the repeatable database seed. Set `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL`, and a unique `ADMIN_SEED_PASSWORD` of 12–72 characters in `.env`, then run:

```bash
npm run db:deploy
npm run db:seed
```

The seed creates or updates the account, hashes its password with bcrypt, ensures both `USER` and `ADMIN` roles are assigned, restores the complete `ADMIN` permission set, and records an audit event. It is safe to run repeatedly. The password is never logged or committed. If the account already exists and only needs promotion, the existing `npm run admin:bootstrap -- user@example.com` command remains available without changing its password.

After that, use the authenticated resource endpoints under `/api/v1` to create least-privilege roles, assign permissions to those roles, create groups, and manage user membership. Authorization comes from permissions, not an `/admin` URL prefix. Do not share the `ADMIN` role for routine work; create narrower roles such as `SUPPORT`, `AUDITOR`, or `USER_MANAGER`.

## Docker and Compose options

Use the modern `docker compose` command. Copy `.env.example` to `.env` and replace `JWT_SECRET`, `AUTH0_DOMAIN`, and `AUTH0_AUDIENCE` before starting an application profile.

Database only, with the API running on your host:

```bash
docker compose up -d postgres
npm run db:migrate -- --name your_change
npm run dev
```

Development stack with source bind mounting and Node watch mode:

```bash
docker compose --profile dev up --build
```

Production-like stack using the non-root, read-only, multi-stage image:

```bash
docker compose --profile app up --build -d
```

The `migrate` one-shot service waits for PostgreSQL to become healthy and runs `prisma migrate deploy` before either API service starts. Useful operational commands:

```bash
docker compose logs -f api
docker compose ps
docker compose down
```

Set `PORT`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` in `.env` to override defaults. Set `TRUST_PROXY` to the exact number of trusted reverse proxies in front of Express. API documentation is disabled by default in the production Compose profile; explicitly set `DOCS_ENABLED=true` only when public documentation is intended. PostgreSQL data uses the named `postgres_data` volume and survives `docker compose down`; adding `--volumes` permanently deletes that local database volume.

Check the complete project with:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
```

ESLint uses type-aware TypeScript rules; use `npm run lint:fix` for safe automatic fixes.

Husky runs ESLint, the TypeScript checker, and Jest before each commit. A failed check blocks the commit until the issue is fixed.

## Test-driven development

Write the failing behavior first, run `npm run test:watch`, implement the smallest passing change, and then refactor while the suite remains green. Use `npm run test:coverage` to enforce the service coverage thresholds.

## Version control

The repository uses the `main` branch, normalized LF line endings, and a Husky pre-commit quality gate. Keep `.env` and generated/build output untracked; commit `.env.example`, Prisma schemas and migrations, and `package-lock.json`.

Create focused branches and commits:

```bash
git switch -c feature/short-description
git add .
git commit -m "feat: describe the change"
```

## Project structure

```text
src/
  config/          Environment, Prisma, OpenAPI, Scalar, and ReDoc setup
  controllers/     HTTP request/response adapters
  domain/          Framework-independent domain types
  integrations/    Auth0 middleware and routes
  middleware/      Authentication, validation, rate limiting, and errors
  repositories/    Persistence interfaces and Prisma implementations
  routes/          Express route composition
  schemas/         Zod request schemas
  services/        Authentication and authorization use cases
prisma/
  migrations/      Reviewed database migrations
  schema.prisma    PostgreSQL data model
tests/             Unit and integration tests
```

Open the interactive Scalar API reference at <http://localhost:3000/docs> or the self-hosted ReDoc reference at <http://localhost:3000/redoc>. The raw OpenAPI document remains available at <http://localhost:3000/openapi.json>.

## API endpoints

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health/live` | No | Process liveness probe |
| `GET` | `/health/ready` | No | PostgreSQL readiness probe |
| `GET` | `/api/v1/locales` | No | List supported languages |
| `POST` | `/api/v1/auth/register` | No | Create an account |
| `POST` | `/api/v1/auth/login` | No | Log in and receive a JWT |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Read the current account |
| `GET` | `/api/v1/users` | `users:read` | List users and assignments |
| `PUT/DELETE` | `/api/v1/users/:userId/roles/:roleId` | `users:roles:manage` | Manage direct user roles; ADMIN changes also require `admins:manage` |
| `GET` | `/api/v1/permissions` | `roles:read` | List the permission catalog |
| `GET/POST` | `/api/v1/roles` | `roles:read` / `roles:manage` | List or create roles |
| `GET` | `/api/v1/roles/:roleId` | `roles:read` | Read one role |
| `PUT/DELETE` | `/api/v1/roles/:roleId/permissions/:permissionId` | `roles:manage` | Manage role permissions; delegating `admins:manage` also requires it |
| `GET/POST` | `/api/v1/groups` | `groups:read` / `groups:manage` | List or create groups |
| `GET` | `/api/v1/groups/:groupId` | `groups:read` | Read one group |
| `PUT/DELETE` | `/api/v1/groups/:groupId/roles/:roleId` | `groups:manage` | Manage group roles; ADMIN changes also require `admins:manage` |
| `PUT/DELETE` | `/api/v1/groups/:groupId/users/:userId` | `groups:manage` | Manage membership; ADMIN-bearing groups also require `admins:manage` |
| `GET` | `/api/v1/audit-logs` | `audit:read` | Review access-control changes |
| `GET` | `/api/v1/auth0/me` | Auth0 access token | Read validated Auth0 identity |

Collection endpoints use cursor pagination with `?limit=25&cursor=UUID` and return `{ data, pagination }`. The maximum page size is 100. Audit records additionally support `actorUserId`, `action`, `targetType`, `targetId`, `from`, and `to` filters; timestamps use ISO 8601 with an offset.

All error responses use `application/problem+json` and include a stable application code plus the `X-Request-ID` value as `traceId`. Authentication responses send `Cache-Control: no-store` and `Pragma: no-cache`.

## Example

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"correct-horse-42"}'
```

Copy `accessToken` from the response and use Scalar's authentication controls, or call:

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

## Production notes

- Replace `JWT_SECRET` with a securely generated secret.
- Set `CORS_ORIGIN` to a comma-separated allowlist of your frontend origins.
- Run migrations as part of deployment before starting the API.
