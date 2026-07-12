# app-fiap-videos-processor

Async worker service: consumes `VideoProcessingRequested`, extracts video frames with ffmpeg, builds a zip, and publishes result events.

## Responsibilities

- Consume `VideoProcessingRequested` from RabbitMQ
- Extract one frame per second with ffmpeg, pack into zip
- Publish `VideoProcessingStarted`, `VideoProcessingCompleted`, or `VideoProcessingFailed`
- Idempotent processing (skips already-completed jobs)

## Run locally

### Full stack

```bash
cd ../app-fiap-videos-infra/docker
docker compose up --build
```

### This service only

```bash
docker compose up --build
```

Starts processor + Postgres (`:5434`) + RabbitMQ (`:5674`).  
**Note:** isolated mode does not receive uploads unless events are published to this broker and videos exist in storage.

### Development server (`yarn start:dev`)

**1. Start infrastructure** (shared Postgres + **single RabbitMQ**):

```bash
cd ../app-fiap-videos-infra/docker
docker compose up postgres rabbitmq -d
```

Or processor-only Postgres + shared RabbitMQ:

```bash
cd ../app-fiap-videos-infra/docker && docker compose up rabbitmq -d
cd ../app-fiap-videos-processor && docker compose up postgres -d
```

**2. Configure & run:**

```bash
cp .env.example .env
yarn install
yarn db:migrate
yarn start:dev
```

When developing with the API on the same machine, share video files:

```env
STORAGE_PATH=../app-fiap-videos-api/storage
```

Processor listens on http://localhost:3001 (health/metrics only).

Ensure `.env` uses `localhost` ports (`5434` for service-owned Postgres, or `5433` with shared infra) and `5673` for RabbitMQ.

`yarn start:dev` runs `prestart:dev`, which starts this service's Postgres container (`fiap_videos_processor` is created automatically on first boot).

## HTTP (operations)

| Route | Purpose |
|-------|---------|
| `/health/live`, `/health/ready` | Probes |
| `/metrics` | Prometheus |
| `/api/docs` | Ops Swagger |

## Messaging

| Direction | Events |
|-----------|--------|
| Consumes | `VideoProcessingRequested` |
| Publishes | `VideoProcessingStarted`, `VideoProcessingCompleted`, `VideoProcessingFailed` |

Uses transactional **outbox** for publishes and **inbox** for idempotent consumption.

## Environment

See [`.env.example`](./.env.example). Key vars: `DATABASE_URL`, `RABBITMQ_URL`, `STORAGE_PATH`, `FFMPEG_PATH`, `CONSUMER_PREFETCH`.

## Tests & CI

```bash
yarn lint:ci
yarn typecheck
yarn test:unit
yarn build
```

## Architecture

Hexagonal layout under `src/` — use cases in `core/application`, ffmpeg/storage adapters in `adapter/infra`.  
Wiring in `src/adapter/infra/http/composition-root.ts`.

## Docker

Image includes **ffmpeg**. Shared `video_storage` volume must match the API service for end-to-end processing.
