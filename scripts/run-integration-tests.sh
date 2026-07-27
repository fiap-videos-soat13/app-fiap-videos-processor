#!/usr/bin/env bash
set -euo pipefail

# Run integration tests for app-fiap-videos-processor.
# If DATABASE_URL is not set, starts a temporary Postgres container.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="fiap-videos-processor-integration-pg"
DB_URL="${DATABASE_URL:-postgresql://fiap:fiap@localhost:5433/fiap_videos_processor_test}"

start_postgres() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Starting temporary Postgres container..."
    docker run -d --rm \
      --name "$CONTAINER_NAME" \
      -e POSTGRES_USER=fiap \
      -e POSTGRES_PASSWORD=fiap \
      -e POSTGRES_DB=fiap_videos_processor_test \
      -p 5433:5432 \
      postgres:16-alpine \
      >/dev/null

    echo "Waiting for Postgres to be ready..."
    for _ in {1..30}; do
      if docker exec "$CONTAINER_NAME" pg_isready -U fiap -d fiap_videos_processor_test >/dev/null 2>&1; then
        echo "Postgres is ready."
        return 0
      fi
      sleep 1
    done

    echo "Postgres failed to become ready."
    return 1
  else
    echo "Using existing Postgres container: $CONTAINER_NAME"
  fi
}

stop_postgres() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping temporary Postgres container..."
    docker stop "$CONTAINER_NAME" >/dev/null
  fi
}

cleanup() {
  if [ "${STARTED_CONTAINER:-false}" = true ]; then
    stop_postgres
  fi
}
trap cleanup EXIT

if [ -z "${DATABASE_URL:-}" ]; then
  start_postgres
  STARTED_CONTAINER=true
  export DATABASE_URL="$DB_URL"
fi

cd "$PROJECT_DIR"
echo "Running migrations..."
yarn db:migrate

echo "Running integration tests..."
yarn test:integration:ci
