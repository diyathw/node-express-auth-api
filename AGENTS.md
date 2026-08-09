# Codex Project Guide

## Project overview

This repository is a TypeScript Express authentication and authorization API backed by PostgreSQL and Prisma. It supports local JWT authentication, Auth0 bearer tokens, localized errors, rate limiting, OpenAPI documentation, and database-backed RBAC.

Use Node.js 24. The supported engine range is defined in `package.json`, `.nvmrc`, and `.node-version`.

## Toolchain and dependency installation

Select the repository runtime before running npm commands:

```bash
nvm install
nvm use
node --version
```

The reported version must be `v24.x`. Do not suppress `EBADENGINE` warnings or widen the project engine range to Node.js 26 until every runtime dependency, including `express-oauth2-jwt-bearer`, officially supports it. Docker images must use the same Node.js major version.

Use `npm ci` for reproducible clean installs and CI. Use `npm install` only when intentionally changing dependencies, and commit the resulting `package-lock.json` changes. Keep dependency versions and security overrides deliberate and minimal.

npm install-script approvals are stored as exact package versions in `package.json#allowScripts`. Before approving a new script, identify why the package is present, inspect the script, and approve only the required package and version. Do not replace the allowlist with a blanket approval. Verify it with:

```bash
npm approve-scripts --allow-scripts-pending
```

## Architecture

Keep the existing layered design:

- Controllers translate HTTP requests and responses.
- Services implement business rules and authorization invariants.
- Repository interfaces isolate persistence operations.
- Prisma repository implementations are the only application layer that should query Prisma directly.
- Routers compose validation, authentication, authorization, and controllers.
- Zod schemas validate all untrusted input before it reaches a controller.
- Domain types must not depend on Express or Prisma-generated types.

Use constructor injection for service, repository, and controller dependencies. Keep ESM imports compatible with `NodeNext` and include `.js` extensions in TypeScript source imports.

## Authentication and RBAC rules

Local JWT authentication and Auth0 authentication are separate trust domains. Do not treat an Auth0 scope as a local role or silently translate between them.

Local authorization follows a deny-by-default, NIST-style RBAC model:

1. Permissions represent stable application capabilities.
2. Roles bundle permissions.
3. Users receive roles directly or through groups.
4. Routes authorize effective permissions, not role names.
5. Effective access must be loaded from current database assignments so revocation is immediate.

Preserve these security invariants:

- New local accounts receive the built-in `USER` role.
- The built-in `ADMIN` role contains the complete permission catalog.
- `USER` and `ADMIN` are reserved system role names.
- Do not remove permissions from the built-in `ADMIN` role through the API.
- Do not remove the built-in `USER` role from an account.
- Never allow removal of the final effective administrator.
- Access-control mutations and their audit entries must commit in the same transaction.
- Use serializable transactions for mutations that enforce the final-admin invariant.
- Permission identifiers are code-managed. Add new permissions through reviewed code and migrations, not arbitrary runtime CRUD.
- Never put roles or permissions into a JWT as the authorization source of truth.

Current local permissions are:

- `users:read`
- `users:roles:manage`
- `roles:read`
- `roles:manage`
- `groups:read`
- `groups:manage`
- `audit:read`

Apply least privilege. Prefer narrowly scoped roles such as `SUPPORT` or `AUDITOR` over assigning `ADMIN` for routine work.

## Database changes

Edit `prisma/schema.prisma`, create a new migration under `prisma/migrations`, and regenerate the Prisma client. Never edit files under `src/generated/prisma` manually.

Development migration workflow:

```bash
npm run db:migrate -- --name descriptive_migration_name
npm run db:generate
```

Deployment workflow:

```bash
npm run db:deploy
```

Migrations must preserve existing data and include any required system-role or permission-catalog updates. Avoid destructive schema changes unless the migration includes an explicit, reviewed data transition.

## Admin seed

The admin seed is configured through Prisma and reads credentials from environment variables:

- `ADMIN_SEED_NAME`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

Run it only after migrations:

```bash
npm run db:deploy
npm run db:seed
```

The seed must remain idempotent, bcrypt-hash the password, assign both `USER` and `ADMIN`, restore the ADMIN permission catalog, and write an audit record. Never hard-code, print, commit, or return the seed password.

## API and documentation

Business API endpoints use the `/api/v1` prefix. Infrastructure probes are intentionally unversioned at `/health/live` and `/health/ready`. When adding or changing an endpoint:

- Add Zod validation for body, path, and query inputs.
- Apply authentication first, validate input second, and perform database-backed permission checks third.
- Enforce the narrowest applicable permission.
- Return errors as traceable `application/problem+json` documents through the shared problem helper and error middleware.
- Cursor-paginate collection endpoints with a bounded `limit`; do not introduce unbounded list operations.
- Update `src/config/openapi.ts` and `README.md`.
- Add or update tests for success, denial, validation, and security invariants.

Scalar documentation is served at `/docs`, and the raw OpenAPI document is served at `/openapi.json`, when `DOCS_ENABLED=true`. Documentation is disabled by default in the production Compose profile.

## Secrets and environment configuration

Keep `.env` untracked. Document variable names and safe examples in `.env.example` without placing real secrets there.

Never expose:

- JWT secrets
- Database passwords or connection strings
- Admin seed passwords
- Auth0 client secrets or private keys
- Access or refresh tokens

Do not weaken environment validation to make startup pass. Fix missing configuration at its source.

## Verification

Before completing a code change, run the checks relevant to the change. For normal application changes, run all of them:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For schema changes, also run:

```bash
npx prisma validate
```

Do not report a migration as applied unless it was successfully executed against the configured database. If PostgreSQL is unavailable, clearly state that the migration is ready but unapplied.

## Test-driven development

For behavior changes, follow red-green-refactor: add a focused failing Jest test, implement the smallest passing change, and refactor while the suite remains green. Unit-test service rules through repository fakes or mocks rather than a real database. Add integration coverage when behavior depends on Express middleware, Prisma transactions, migrations, or PostgreSQL constraints.

Tests for authorization mutations must cover denial paths and invariants as well as successful changes, particularly final-admin protection, reserved roles, effective group permissions, and audit writes. Do not weaken coverage thresholds or skip tests to make a change pass.

## HTTP security and operations

- Keep Helmet enabled globally and configure exceptions narrowly when Scalar or another explicit route requires them.
- Keep global and authentication-specific rate limits in place. New authentication or recovery endpoints require an abuse-control review.
- Keep CORS origin validation allowlist-based; never use reflected arbitrary origins with credentials.
- Do not reveal whether an account exists through authentication, password-recovery, or invitation responses.
- Preserve graceful shutdown of the HTTP server and Prisma connection when changing application startup.

Use `docker compose` rather than the legacy `docker-compose` command. The database-only workflow is `npm run docker:db`; development and production-like profiles are `npm run docker:dev` and `npm run docker:app`. Do not run `docker compose down --volumes` unless deletion of local PostgreSQL data was explicitly requested.

## Version control

Keep commits focused and use conventional prefixes such as `feat:`, `fix:`, `test:`, `docs:`, and `chore:`. Commit Prisma migrations, `package-lock.json`, and safe `.env.example` changes; never commit `.env`, generated Prisma output, build output, coverage, logs, or secrets.

Husky's pre-commit checks are part of the project quality gate. Do not bypass them with `--no-verify`; fix the failing check or clearly report why it cannot run. Preserve unrelated worktree changes and never rewrite shared history unless explicitly requested.

## Working conventions

- Preserve strict TypeScript settings and avoid `any`.
- Prefer small, cohesive classes and explicit domain types.
- Use async error propagation through Express `next`.
- Keep API responses free of password hashes and other secrets.
- Make relationship mutations idempotent where practical.
- Map expected database conflicts and missing records to typed application errors.
- Update tests alongside behavior changes.
- Preserve unrelated user changes in the worktree.
