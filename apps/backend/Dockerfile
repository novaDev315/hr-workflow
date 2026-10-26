FROM oven/bun:1.3.9 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web-admin/package.json ./apps/web-admin/package.json
RUN bun install --frozen-lockfile --production --filter @hrflow/backend

FROM base AS builder
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web-admin/package.json ./apps/web-admin/package.json
RUN bun install --frozen-lockfile --filter @hrflow/backend
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
# Versioned SQL migrations; dist/src/scripts/migrate.js resolves them as ../../../drizzle.
COPY --from=builder /app/apps/backend/drizzle ./apps/backend/drizzle
# Arabic PDF fonts; simple-pdf.ts resolves them as ../../../assets/fonts from dist/src/common.
COPY --from=builder /app/apps/backend/assets ./apps/backend/assets
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
WORKDIR /app/apps/backend

EXPOSE 4001
CMD ["bun", "run", "start:prod"]
