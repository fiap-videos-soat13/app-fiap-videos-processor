#!/bin/sh
set -e

mkdir -p /app/storage/videos /app/storage/zips
chown -R fiap:fiap /app/storage

exec su-exec fiap "$@"
