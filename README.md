# Image API

REST API for uploading, processing, storing, and serving images.

The application allows users to upload images, resize and optimize them, store the processed files in S3-compatible object storage, and persist image metadata in a relational database.

---

## 🚀 Tech Stack

* **Node.js (LTS)**
* **NestJS**
* **PostgreSQL**
* **MinIO (S3-compatible storage)**
* **TypeORM**
* **Sharp**
* **Swagger (OpenAPI v3)**
* **Docker Compose**
* **Jest + Supertest**

---

## 📌 Design Overview

The system separates **binary file storage** from **structured metadata storage**:

* **MinIO (S3-compatible)**
  Stores actual image files.

* **PostgreSQL**
  Stores metadata and enables efficient querying (filtering, pagination, lookup).

This separation mirrors real-world production architectures and ensures scalability and maintainability.

---

## ⚙️ Why This Stack?

### NestJS

Chosen for:

* modular architecture (clean separation of concerns)
* strong TypeScript support
* built-in DI system
* first-class support for validation, testing, and Swagger

Alternative (Express) would require manual structuring and more boilerplate for the same result.

---

### PostgreSQL

Used because:

* supports relational querying (filtering, pagination)
* reliable and production-proven
* integrates cleanly with TypeORM

Why not store everything in S3?

* S3 is not designed for querying by fields like `title`
* pagination and filtering would be inefficient or impractical

---

### MinIO (S3-compatible storage)

Used instead of real AWS S3 because:

* runs locally via Docker
* uses the same API as AWS S3
* avoids external dependencies and cloud costs
* enables deterministic development and testing

Design benefit:

* code written against S3 API can be used in production with AWS without changes

---

### Sharp

Used for:

* resizing images
* optimizing output
* converting to WebP

Why WebP?

* smaller file size
* good quality-to-size ratio
* widely supported

---

### Docker Compose

Provides:

* reproducible local environment
* isolated services (Postgres, MinIO)
* easy setup for reviewers

---

### Jest + Supertest

Used for:

* end-to-end testing of HTTP endpoints
* validation of full request pipeline (controller → service → DB)

Storage layer is mocked to:

* avoid dependency on external services in tests
* keep tests fast and deterministic

---

## 📦 Features

### POST /images

* upload image (`multipart/form-data`)
* set image title
* resize image to provided width and height
* optimize and convert to WebP
* store file in S3-compatible storage
* store metadata in PostgreSQL

---

### GET /images

* return paginated list of images
* filter by title (`title contains {text}`)

Query params:

* `page` (default: 1)
* `limit` (default: 10, max: 100)
* `title` (optional filter)

---

### GET /images/:id

* return single image by ID
* returns 404 if not found

---

## 🧱 Data Model

### Image

| Field      | Description        |
| ---------- | ------------------ |
| id         | UUID               |
| title      | image title        |
| url        | public URL to file |
| storageKey | key in S3 bucket   |
| width      | processed width    |
| height     | processed height   |
| mimeType   | stored file format |
| createdAt  | timestamp          |
| updatedAt  | timestamp          |

---

## 🛠️ Setup

### 1. Install dependencies

```bash
npm install
```

---

### 2. Configure environment

Create `.env` file based on `.env.example`:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=image_api

S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_BUCKET=images
S3_FORCE_PATH_STYLE=true
```

---

### 3. Start infrastructure

```bash
docker compose up -d
```

Services:

* PostgreSQL → `localhost:5432`
* MinIO → `localhost:9000`
* MinIO Console → `http://localhost:9001`

---

### 4. Create bucket

Open:

```
http://localhost:9001
```

Credentials:

* login: `minio`
* password: `minio123`

Create bucket:

```
images
```

---

### 5. Run application

```bash
npm run start:dev
```

---

## 📖 API Documentation

Swagger UI:

```
http://localhost:3000/docs
```

---

## 🧪 Running Tests

```bash
npm run test:e2e
```

Tests cover:

* image upload
* validation
* pagination
* filtering
* fetching single resource
* error cases (404)

---

## 📌 Architectural Decisions

### Separation of concerns

* file storage → S3 (MinIO)
* metadata → PostgreSQL

This avoids:

* storing large blobs in DB
* inefficient querying

---

### Memory-based upload (multer)

Files are processed in-memory:

* no temporary disk writes
* faster pipeline
* simpler cleanup

---

### Validation

* `class-validator` + `ValidationPipe`
* strict request validation
* automatic type transformation

---

### Pagination strategy

* offset-based (`skip/take`)
* simple and sufficient for this use case

---

## 🔧 Possible Improvements

* automatic bucket creation on startup
* file type validation using file signature (not only MIME)
* database migrations instead of `synchronize: true`
* presigned URLs instead of public URLs
* rate limiting
* authentication layer
* integration tests with real MinIO instance

---

## 📎 Notes

* MinIO is used only for local development
  → can be replaced with AWS S3 without code changes

* `synchronize: true` is enabled for simplicity in this recruitment task
  → should be replaced with migrations in production

---

## ✅ Summary

The application demonstrates:

* clean architecture with separation of storage and metadata
* proper use of NestJS ecosystem
* realistic backend patterns (S3 + DB split)
* complete API with validation, documentation, and tests

---
