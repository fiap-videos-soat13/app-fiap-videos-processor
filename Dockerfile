FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache ffmpeg wget

FROM base AS deps
COPY package.json yarn.lock* package-lock.json* ./
RUN corepack enable && (yarn install --frozen-lockfile || npm ci)

FROM deps AS builder
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache su-exec && addgroup -S fiap && adduser -S fiap -G fiap
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3001/health/live || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/adapter/infra/http/Main.js"]

FROM runner AS migrator
COPY scripts/docker-migrate.js ./scripts/docker-migrate.js
USER fiap
ENTRYPOINT []
CMD ["node", "scripts/docker-migrate.js"]
