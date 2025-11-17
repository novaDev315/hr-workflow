# HRFlow Pro - Quick Start Guide

Get the HRFlow Pro system running in under 10 minutes.

## Prerequisites

```bash
# Required
- Node.js 18+
- Docker & Docker Compose
- Git

# Verify installations
node --version   # Should be 18.x or higher
docker --version
docker compose version
```

## Quick Start (Development)

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/your-org/hrflow-pro.git
cd hrflow-pro

# Checkout the implementation branch
git checkout claude/implement-system-01HeGHJxwgz56FUxf6nAnzEr

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (or use defaults for development)
# The defaults work out of the box for local development
```

### 3. Start Infrastructure

```bash
# Start database and supporting services
docker compose up -d postgres redis rabbitmq minio

# Wait for services to be healthy (about 30 seconds)
docker compose ps

# Check logs if needed
docker compose logs -f postgres
```

### 4. Initialize Database

```bash
# Database will auto-initialize with the init script
# Verify connection
docker compose exec postgres psql -U hrflow_admin -d hrflow_dev -c "SELECT 1"

# Run Prisma migrations for each service
cd services/employee && npx prisma generate && npx prisma migrate dev
cd ../location && npx prisma generate && npx prisma migrate dev
cd ../attendance && npx prisma generate && npx prisma migrate dev
cd ../..
```

### 5. Start Services

```bash
# Option A: Start all services with Docker
docker compose up -d

# Option B: Start services in development mode (hot reload)
npm run dev

# Option C: Start individual services
npm run dev --workspace=apps/api-gateway
npm run dev --workspace=services/employee
npm run dev --workspace=services/location
npm run dev --workspace=services/attendance
```

### 6. Verify Services

```bash
# Check health endpoints
curl http://localhost:4000/health  # API Gateway
curl http://localhost:3001/health  # Employee Service
curl http://localhost:3004/health  # Location Service
curl http://localhost:3002/health  # Attendance Service

# All should return: {"status":"ok","service":"...","timestamp":"..."}
```

### 7. Access GraphQL Playground

```bash
# Open in browser
http://localhost:4000/graphql  # Federated Gateway

# Individual services
http://localhost:3001/graphql  # Employee Service
http://localhost:3002/graphql  # Attendance Service
http://localhost:3004/graphql  # Location Service
```

## Test the System

### Create an Employee

```graphql
mutation CreateEmployee {
  createEmployee(input: {
    firstName: "John"
    lastName: "Doe"
    email: "john.doe@example.com"
    phone: "+1234567890"
    departmentId: "dept-uuid"
    designationId: "desig-uuid"
    employmentType: FULL_TIME
    joinDate: "2024-11-16"
  }) {
    id
    employeeNumber
    firstName
    lastName
    email
    status
  }
}
```

### GPS Clock In

```graphql
mutation ClockIn {
  clockIn(input: {
    employeeId: "emp-uuid"
    locationId: "loc-uuid"
    latitude: 40.7128
    longitude: -74.0060
    distance: 45
  }) {
    id
    clockInTime
    clockInDistance
    status
  }
}
```

### Validate Geofence

```graphql
query ValidateGeofence {
  validateGeofence(
    locationId: "loc-uuid"
    latitude: 40.7128
    longitude: -74.0060
  ) {
    isWithinGeofence
    distance
    radius
    accuracyPercentage
  }
}
```

## Monitoring & Tools

```bash
# Grafana Dashboard
http://localhost:3000
# Login: admin / admin (or GRAFANA_ADMIN_PASSWORD from .env)

# Prometheus Metrics
http://localhost:9090

# RabbitMQ Management
http://localhost:15672
# Login: hrflow / change_me_in_production

# MinIO Console
http://localhost:9001
# Login: hrflow_access_key / change_me_in_production

# PostgreSQL
docker compose exec postgres psql -U hrflow_admin -d hrflow_dev
```

## Common Commands

```bash
# View logs
docker compose logs -f                    # All services
docker compose logs -f api-gateway        # Specific service

# Restart a service
docker compose restart api-gateway

# Stop all services
docker compose down

# Clean up (including volumes)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Run tests
npm run test

# Lint code
npm run lint

# Build for production
npm run build
```

## Troubleshooting

### Service won't start

```bash
# Check logs
docker compose logs [service-name]

# Verify dependencies
docker compose ps

# Restart service
docker compose restart [service-name]
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Verify credentials in .env
cat .env | grep POSTGRES

# Test connection
docker compose exec postgres psql -U hrflow_admin -d hrflow_dev -c "SELECT NOW()"
```

### GraphQL errors

```bash
# Check service health
curl http://localhost:4000/health

# Verify all subgraphs are running
docker compose ps

# Check API Gateway logs
docker compose logs api-gateway
```

### Port conflicts

```bash
# Find what's using a port
lsof -i :4000  # On macOS/Linux
netstat -ano | findstr :4000  # On Windows

# Kill the process or change port in docker-compose.yml
```

## Next Steps

1. **Read the documentation:**
   - [README.md](./README.md) - Project overview
   - [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) - Current status
   - [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Production deployment
   - [PRD.md](./PRD.md) - Full requirements

2. **Explore the API:**
   - Open GraphQL Playground at http://localhost:4000/graphql
   - Try the example queries above
   - Review the schema documentation

3. **Development:**
   - Check [docs/DEVELOPMENT_PLAN.md](./docs/DEVELOPMENT_PLAN.md)
   - Review service structure in respective folders
   - Run tests with `npm run test`

## Architecture Quick Reference

```
Port Map:
- 4000: API Gateway (GraphQL)
- 3001: Employee Service
- 3002: Attendance Service
- 3003: Leave Service
- 3004: Location Service
- 3005: Payroll Service
- 5432: PostgreSQL
- 6379: Redis
- 5672: RabbitMQ (AMQP)
- 15672: RabbitMQ Management UI
- 9000: MinIO API
- 9001: MinIO Console
- 9090: Prometheus
- 3000: Grafana
```

## Getting Help

- Check logs: `docker compose logs -f`
- Review health checks: `curl http://localhost:4000/health`
- Read error messages carefully
- Verify environment variables in `.env`
- Ensure all required services are running: `docker compose ps`

## Development Workflow

```bash
# 1. Pull latest changes
git pull origin claude/implement-system-01HeGHJxwgz56FUxf6nAnzEr

# 2. Install dependencies
npm install

# 3. Start infrastructure
docker compose up -d postgres redis rabbitmq

# 4. Start services in dev mode
npm run dev

# 5. Make changes to code (hot reload enabled)

# 6. Test changes
npm run test

# 7. Commit changes
git add .
git commit -m "feat: your changes"
git push
```

---

**Ready to code!** 🚀

The system is now running. Access the GraphQL Playground at http://localhost:4000/graphql to start building.
