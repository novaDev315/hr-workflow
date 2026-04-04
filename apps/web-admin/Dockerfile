FROM oven/bun:1.3.9 AS builder

WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
