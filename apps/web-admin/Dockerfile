# Build from the repository root: docker build -f apps/web-admin/Dockerfile .
FROM oven/bun:1.3.9 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web-admin/package.json ./apps/web-admin/package.json
RUN bun install --frozen-lockfile --filter @hrflow/web-admin

COPY apps/web-admin ./apps/web-admin
WORKDIR /app/apps/web-admin
RUN bun run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
USER root
# CA bundle used by nginx to verify the API upstream (proxy_ssl_verify on).
RUN apk add --no-cache ca-certificates
USER 101

ENV API_UPSTREAM_HOST=api.hrflow.lab.novadev.tech
COPY apps/web-admin/nginx/ /etc/nginx/templates/
COPY --from=builder /app/apps/web-admin/dist /usr/share/nginx/html

EXPOSE 8080
