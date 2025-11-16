# HRFlow Pro - Deployment Guide
## Docker Compose On-Premise Deployment

**Version:** 2.0
**Last Updated:** November 2024
**Deployment Type:** On-Premise using Docker Compose

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Services](#services)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## Overview

HRFlow Pro is deployed as a containerized microservices application using Docker Compose. This deployment method provides:

- **Simple Deployment**: Single-command startup of all services
- **Resource Efficiency**: Optimized for on-premise infrastructure
- **Easy Maintenance**: Container-based updates and rollbacks
- **Scalability**: Can be migrated to Kubernetes when needed
- **Data Sovereignty**: Complete control over data location

---

## Prerequisites

### System Requirements

**Minimum Hardware:**
- CPU: 8 cores (16 threads recommended)
- RAM: 16 GB (32 GB recommended)
- Storage: 500 GB SSD (1 TB recommended)
- Network: 1 Gbps NIC

**Operating System:**
- Ubuntu 22.04 LTS (recommended)
- RHEL 8/9
- CentOS Stream 8/9
- Debian 11/12

**Software Requirements:**
```bash
# Docker Engine
docker --version  # >= 24.0.0

# Docker Compose
docker compose version  # >= 2.20.0

# Git
git --version  # >= 2.30.0
```

### Network Requirements

**Required Ports:**
- `4000`: GraphQL API Gateway (external)
- `3000`: Grafana Dashboard (external)
- `5432`: PostgreSQL (internal)
- `6379`: Redis (internal)
- `5672`: RabbitMQ (internal)
- `9000`: MinIO (internal)
- `9200`: Elasticsearch (internal)
- `9090`: Prometheus (internal)

---

## Architecture

### Docker Compose Network

```
┌─────────────────────────────────────────────────────────┐
│                Docker Compose Network                    │
│                    (hrflow-network)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         API Gateway (api-gateway)                 │  │
│  │            Port: 4000 (external)                  │  │
│  └───────────────────┬──────────────────────────────┘  │
│                      │                                  │
│      ┌───────────────┼───────────────┬─────────────┐   │
│      │               │               │             │   │
│  ┌───▼─────┐  ┌─────▼───┐  ┌───────▼──┐  ┌───────▼┐  │
│  │attendance│  │  leave  │  │ location │  │ payroll│  │
│  │ -service │  │-service │  │ -service │  │-service│  │
│  └────┬─────┘  └────┬────┘  └────┬─────┘  └────┬───┘  │
│       │             │            │             │       │
│       └─────────────┼────────────┼─────────────┘       │
│                     │            │                     │
│           ┌─────────▼────────────▼──────┐             │
│           │      rabbitmq                │             │
│           └─────────────────────────────┘             │
│                                                         │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────┐    │
│  │   postgres   │  │  redis   │  │    minio     │    │
│  └──────────────┘  └──────────┘  └──────────────┘    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │elasticsearch │  │  prometheus  │  │   grafana   │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Service Dependencies

```
api-gateway → depends on:
  - postgres
  - redis
  - rabbitmq

*-service (microservices) → depends on:
  - postgres
  - redis
  - rabbitmq

prometheus → scrapes:
  - api-gateway
  - all microservices
  - postgres
  - redis

grafana → depends on:
  - prometheus

elasticsearch → receives logs from:
  - all services
```

---

## Installation

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/hrflow-pro.git
cd hrflow-pro

# Checkout production branch
git checkout production
```

### Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

```bash
# Application
NODE_ENV=production
APP_NAME=HRFlow Pro
APP_VERSION=2.0.0

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=hrflow_production
POSTGRES_USER=hrflow_admin
POSTGRES_PASSWORD=<SECURE_PASSWORD>
POSTGRES_MAX_CONNECTIONS=200

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<SECURE_PASSWORD>

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=hrflow
RABBITMQ_PASSWORD=<SECURE_PASSWORD>

# MinIO (S3-compatible storage)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=<ACCESS_KEY>
MINIO_SECRET_KEY=<SECRET_KEY>
MINIO_BUCKET=hrflow-files

# JWT Authentication
JWT_SECRET=<RANDOM_256_BIT_SECRET>
JWT_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800

# GPS Geofencing
GEOFENCE_DEFAULT_RADIUS=100  # meters

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=hrflow@example.com
SMTP_PASSWORD=<SMTP_PASSWORD>

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=<GRAFANA_PASSWORD>
```

### Step 3: Create Required Directories

```bash
# Create data directories
mkdir -p data/{postgres,redis,minio,elasticsearch,prometheus,grafana}

# Set permissions
chmod -R 755 data/
```

### Step 4: Initialize Database

```bash
# Start only PostgreSQL
docker compose up -d postgres

# Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready

# Run database migrations
docker compose run --rm api-gateway npm run migrate:up
```

### Step 5: Start All Services

```bash
# Start all services
docker compose up -d

# Verify all services are running
docker compose ps

# Check logs
docker compose logs -f
```

---

## Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  # API Gateway
  api-gateway:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    container_name: hrflow-api-gateway
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - hrflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Attendance Service
  attendance-service:
    build:
      context: ./services/attendance
      dockerfile: Dockerfile
    container_name: hrflow-attendance-service
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - hrflow-network
    restart: unless-stopped

  # Leave Service
  leave-service:
    build:
      context: ./services/leave
      dockerfile: Dockerfile
    container_name: hrflow-leave-service
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - hrflow-network
    restart: unless-stopped

  # Location Service
  location-service:
    build:
      context: ./services/location
      dockerfile: Dockerfile
    container_name: hrflow-location-service
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - hrflow-network
    restart: unless-stopped

  # Payroll Service
  payroll-service:
    build:
      context: ./services/payroll
      dockerfile: Dockerfile
    container_name: hrflow-payroll-service
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
      - RABBITMQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - hrflow-network
    restart: unless-stopped

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: hrflow-postgres
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - hrflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: hrflow-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data
    networks:
      - hrflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # RabbitMQ Message Queue
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: hrflow-rabbitmq
    environment:
      - RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}
      - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}
    volumes:
      - ./data/rabbitmq:/var/lib/rabbitmq
    networks:
      - hrflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MinIO Object Storage
  minio:
    image: minio/minio:latest
    container_name: hrflow-minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - ./data/minio:/data
    networks:
      - hrflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Elasticsearch
  elasticsearch:
    image: elasticsearch:8.10.0
    container_name: hrflow-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - ./data/elasticsearch:/usr/share/elasticsearch/data
    networks:
      - hrflow-network
    restart: unless-stopped

  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: hrflow-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./data/prometheus:/prometheus
    networks:
      - hrflow-network
    restart: unless-stopped

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: hrflow-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - ./data/grafana:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards
    depends_on:
      - prometheus
    networks:
      - hrflow-network
    restart: unless-stopped

networks:
  hrflow-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  rabbitmq-data:
  minio-data:
  elasticsearch-data:
  prometheus-data:
  grafana-data:
```

---

## Services

### Service Health Checks

```bash
# Check all services
docker compose ps

# Check specific service
docker compose logs api-gateway

# View real-time logs
docker compose logs -f api-gateway

# Check service health
docker compose exec api-gateway wget -O- http://localhost:4000/health
```

### Service Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart api-gateway

# Scale a service
docker compose up -d --scale attendance-service=3

# Rebuild and restart
docker compose up -d --build api-gateway
```

---

## Monitoring & Logging

### Prometheus Metrics

Access Prometheus at: `http://localhost:9090`

**Key Metrics:**
- API response times
- Request rates
- Error rates
- Database connections
- Cache hit rates
- Queue lengths

### Grafana Dashboards

Access Grafana at: `http://localhost:3000`

**Default Login:**
- Username: `admin`
- Password: `${GRAFANA_ADMIN_PASSWORD}`

**Pre-configured Dashboards:**
1. System Overview
2. API Performance
3. Database Metrics
4. Cache Performance
5. Queue Status

### Log Management

```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs api-gateway

# Follow logs in real-time
docker compose logs -f

# View last N lines
docker compose logs --tail=100 api-gateway

# Export logs
docker compose logs > hrflow-logs-$(date +%Y%m%d).log
```

---

## Backup & Recovery

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -F c \
  -f /tmp/backup.dump

# Copy backup from container
docker compose cp postgres:/tmp/backup.dump ./backups/

# Automated daily backup script
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

docker compose exec -T postgres pg_dump \
  -U hrflow_admin \
  -d hrflow_production \
  -F c > "${BACKUP_DIR}/hrflow_${DATE}.dump"

# Keep only last 7 days
find "${BACKUP_DIR}" -name "hrflow_*.dump" -mtime +7 -delete
```

### Database Restore

```bash
# Stop services
docker compose down

# Start only PostgreSQL
docker compose up -d postgres

# Restore backup
docker compose exec -T postgres pg_restore \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -c < ./backups/hrflow_backup.dump

# Restart all services
docker compose up -d
```

### MinIO Backup

```bash
# Install MinIO Client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

# Configure MinIO client
./mc alias set hrflow http://localhost:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY}

# Mirror bucket to backup location
./mc mirror hrflow/hrflow-files ./backups/minio/
```

---

## Troubleshooting

### Common Issues

**Issue: API Gateway not responding**
```bash
# Check logs
docker compose logs api-gateway

# Check if service is running
docker compose ps api-gateway

# Restart service
docker compose restart api-gateway

# Check network connectivity
docker compose exec api-gateway ping postgres
```

**Issue: Database connection errors**
```bash
# Check PostgreSQL status
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Verify credentials
docker compose exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT 1"

# Check connection from service
docker compose exec api-gateway nc -zv postgres 5432
```

**Issue: Out of memory**
```bash
# Check resource usage
docker stats

# Adjust memory limits in docker-compose.yml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 2G
```

**Issue: Disk space full**
```bash
# Check disk usage
df -h

# Clean up old images
docker system prune -a

# Remove unused volumes
docker volume prune
```

---

## Maintenance

### Updates

```bash
# Pull latest changes
git pull origin production

# Rebuild images
docker compose build

# Rolling update (no downtime)
docker compose up -d --no-deps --build api-gateway
docker compose up -d --no-deps --build attendance-service
# ... update other services

# Verify updates
docker compose ps
docker compose logs -f
```

### Database Migrations

```bash
# Run pending migrations
docker compose run --rm api-gateway npm run migrate:up

# Rollback last migration
docker compose run --rm api-gateway npm run migrate:down

# Check migration status
docker compose run --rm api-gateway npm run migrate:status
```

### Security Updates

```bash
# Update base images
docker compose pull

# Rebuild with security patches
docker compose build --no-cache

# Restart with updated images
docker compose up -d
```

---

## Next Steps

After deployment, proceed to:

1. **Configure Mobile App**: Update API endpoint in mobile app configuration
2. **Setup Web Admin**: Configure web admin portal with API Gateway URL
3. **Import Initial Data**: Import employees, clients, and locations
4. **Configure Alerts**: Setup Grafana alerts for critical metrics
5. **SSL/TLS Setup**: Configure reverse proxy with SSL certificates
6. **Firewall Rules**: Configure firewall to allow only necessary ports

---

**For support, contact:** devops@hrflow.com
**Documentation:** https://docs.hrflow.com
