FROM oven/bun:1.3.9 AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN bun install --production

FROM base AS builder
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 4001
CMD ["bun", "run", "start:prod"]
