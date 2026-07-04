# Modular Monolith Architecture

The application is a domain-oriented modular monolith. It keeps one deployable backend and one MySQL database while giving each product domain an explicit ownership boundary.

## Backend Module

```text
backend/src/modules/{module}/
  domain/          Business types and invariants
  application/     Use cases and transaction orchestration
  infrastructure/  MySQL repositories and external adapters
  http/            Express routes, controllers, and validation schemas
  migrations/      New module-owned timestamp migrations
  module.ts         Routes, OpenAPI, and optional System capability
  index.ts          Public exports used by other modules
```

Modules must not import another module's internal files. Shared authentication, tenancy, system access, errors, logging, and module contracts belong in `backend/src/platform` or established shared middleware.

The explicit composition root is `backend/src/modules/catalog.ts`. Adding one module entry there is the only expected shared backend edit.

## Frontend Feature

```text
frontend/src/features/{feature}/
  api/             Feature API adapters
  components/      Feature-only components
  page.tsx         Route screens
  manifest.tsx     URL routes and role/system-aware navigation
```

Generic HeroUI components, HTTP behavior, generated contracts, themes, and app-shell utilities belong under `frontend/src/shared` or `frontend/src/app`.

Feature manifests are discovered with Vite `import.meta.glob`, so a new feature does not require an `App.tsx` navigation edit. React Router provides stable, deep-linkable URLs.

Docker uses a multi-stage frontend build. Node and Vite compile the application, then the gateway runs only Nginx and serves the generated `dist/` files. Vite remains available through `npm run dev` for optional development outside Docker.

The local Docker gateway defaults to `http://localhost:8080` and requires no hosts-file changes. The root `.env` file is the single runtime configuration source. Change only `APP_URL` when deploying behind a different public domain. `APP_HTTP_PORT` controls the local Docker binding, while `CORS_EXTRA_ORIGINS` is optional and only needed when the same backend must accept additional browser origins.

## Adding A System

1. Create the backend module and `module.ts` descriptor.
2. Implement a `SystemCapability` with settings, dashboard metrics, and enable hooks as needed.
3. Add the capability to `system-catalog.ts` and the module to `catalog.ts`.
4. Add a UTC timestamp migration without changing previous migrations.
5. Add module-owned OpenAPI operations and regenerate frontend contracts.
6. Add a frontend feature and manifest with role and system visibility.
7. Add tenant-isolation, role, disabled-system, and workflow tests.
8. Run architecture, lint, test, contract, and build checks.

## Commands

```powershell
node scripts/check-architecture.mjs

cd backend
npm run openapi
npm run lint
npm test
npm run build

cd ../frontend
npm run contracts
npm run lint
npm test
npm run build
```

Database-backed tests run when `RUN_DB_TESTS=true` and use the normal `DB_*` environment variables.

## Migration Rules

- Existing migrations are immutable and retain their current filenames.
- New migrations use `YYYYMMDD_HHMMSS_description.sql` in UTC.
- Module migrations are stored in the module's `migrations/` directory.
- Timestamp collisions fail before migrations run.
- Migrations must work from a fresh database and an already-migrated database.
