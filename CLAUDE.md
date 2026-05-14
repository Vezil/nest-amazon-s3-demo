# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start:dev` — run API in watch mode (Swagger UI at `/docs`, port from `PORT`, default `3000`)
- `npm run build` / `npm run start:prod` — compile to `dist/` and run compiled output
- `npm run lint` — ESLint with `--fix` over `src`, `apps`, `libs`, `test`
- `npm run format` — Prettier over `src` and `test`
- `npm test` — unit specs (`*.spec.ts`, rooted in `src`; none currently exist)
- `npm run test:e2e` — e2e suite under `test/` using `test/jest-e2e.json`
- Single e2e test: `npm run test:e2e -- -t "should filter by title"`
- `docker compose up -d` — start Postgres (`:5432`) and MinIO (`:9000`, console `:9001`)

The MinIO `images` bucket is **not created automatically** and is private by default. After first `docker compose up`, create the bucket via the console (`http://localhost:9001`, `minio` / `minio123`) and grant anonymous download (`mc anonymous set download local/images`) — otherwise stored image URLs return AccessDenied. See README for exact `mc` commands.

## Architecture

Two NestJS feature modules wired into `AppModule`, deliberately split along the **binary vs. metadata** boundary:

- **`ImagesModule`** (`src/images/`) — HTTP surface (`/images` POST, GET, GET `:id`) and orchestration. `ImagesService.upload` runs the full pipeline: Sharp resize+WebP encode in memory → `StorageService.uploadFile` → persist `ImageEntity` row. List queries use a TypeORM `QueryBuilder` with `ILIKE` for title-contains filtering and offset pagination.
- **`StorageModule`** (`src/storage/`) — thin wrapper over `@aws-sdk/client-s3`. `StorageService` is the **only** place that talks to S3/MinIO; it generates the storage key (`<uuid>.webp`) and synthesizes the public URL as `${S3_ENDPOINT}/${bucket}/${key}`. Swap MinIO for real S3 by changing env vars only — no code changes.

Uploads go through `multer` with `memoryStorage()` (no temp files) and a 5 MB size limit enforced at the `FileInterceptor`. The controller also rejects non-`image/*` MIME types before calling the service.

### Cross-cutting conventions

- **Validation** is global: `main.ts` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. DTOs use `class-validator` + `@Type(() => Number)` for multipart fields (which arrive as strings). The e2e bootstrap re-applies the same pipe — keep them in sync if you change one.
- **TypeORM** runs with `synchronize: true` and `autoLoadEntities: true` — schema follows entity classes; there are no migrations. Treat entity changes as schema changes.
- **Config** comes from `.env` via `@nestjs/config` (global). `main.ts` also calls `import 'dotenv/config'` so `process.env.PORT` is populated before Nest bootstraps.
- **API responses** for read endpoints intentionally project a subset of fields (`id, url, title, width, height`) — `storageKey`, `mimeType`, and timestamps are not exposed. Preserve this shape unless the task says otherwise.

### Testing model

E2E tests (`test/images.e2e-spec.ts`) boot the **real** `AppModule` against the **real** Postgres from docker-compose, but override `StorageService` with a Jest mock. Implication: running e2e requires Postgres up; MinIO is not required. `imageRepository.clear()` runs before each test, so the `images` table is wiped between cases — don't point the suite at a database you care about.
