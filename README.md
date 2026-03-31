# HRFlow Pro

Comprehensive HR Management System with GPS-based attendance tracking, multi-level approval workflows, and payroll processing.

## Features

- **Mobile App** - React Native with Expo SDK 53 for employee self-service
- **Web Admin Portal** - React 19 with shadcn/ui for HR management
- **GraphQL API** - Apollo Server with microservices architecture
- **GPS Attendance** - 100m geofence validation for clock-in/out
- **Multi-Level Approvals** - 3-tier approval workflow for attendance and leave
- **Payroll Processing** - Automated salary calculation with HR override capabilities
- **Multi-Location** - Support for employees across multiple client locations

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Client Layer                        │
├──────────────┬───────────────────────────────────────┤
│ Web Admin    │         Mobile App                    │
│ (React 19)   │    (React Native + Expo)              │
└──────────────┴───────────────────────────────────────┘
                        │
                  GraphQL Gateway
                  (Apollo Server)
                        │
┌──────────────────────────────────────────────────────┐
│                 Microservices                        │
├─────────┬──────────┬─────────┬─────────┬───────────┤
│Employee │Attendance│  Leave  │Location │  Payroll  │
│Service  │ Service  │ Service │Service  │  Service  │
└─────────┴──────────┴─────────┴─────────┴───────────┘
                        │
┌──────────────────────────────────────────────────────┐
│         PostgreSQL │ Redis │ RabbitMQ │ MinIO      │
└──────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Web**: React 19, shadcn/ui, Tailwind CSS, Apollo Client
- **Mobile**: React Native, Expo SDK 53, Expo Router, Apollo Client

### Backend
- **API Gateway**: Apollo Server 4, NestJS, GraphQL
- **Services**: NestJS, Prisma ORM, GraphQL Federation
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Queue**: RabbitMQ
- **Storage**: MinIO (S3-compatible)

### Infrastructure
- **Deployment**: Docker Compose (On-Premise)
- **Monitoring**: Prometheus + Grafana
- **Logging**: Elasticsearch + Kibana

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/hrflow-pro.git
cd hrflow-pro

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure
docker compose up -d postgres redis rabbitmq minio

# Run migrations
npm run migrate:up

# Start services
npm run dev
```

### Docker Deployment

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Project Structure

```
hrflow-pro/
├── apps/
│   ├── web-cp/              # React 19 Web Control Panel
│   ├── mobile/              # React Native Mobile App
│   └── api-gateway/         # Apollo GraphQL Gateway
├── services/
│   ├── employee/            # Employee Service (Source of Truth)
│   ├── attendance/          # Attendance & GPS Service
│   ├── leave/               # Leave Management Service
│   ├── location/            # Client & Location Service
│   └── payroll/             # Payroll Processing Service
├── packages/
│   ├── shared-types/        # Shared TypeScript types
│   ├── graphql-schema/      # GraphQL schema definitions
│   └── utils/               # Shared utilities
├── infrastructure/
│   ├── docker/              # Docker configurations
│   └── monitoring/          # Monitoring configs
├── config/                  # Configuration files
├── scripts/                 # Utility scripts
└── docs/                    # Documentation
```

## Development

### Running Locally

```bash
# Start database and infrastructure
docker compose up -d postgres redis rabbitmq

# Run all services in dev mode
npm run dev

# Run specific service
npm run dev --workspace=services/employee

# Run tests
npm run test

# Lint code
npm run lint
```

### Database Migrations

```bash
# Create migration
npm run migrate:create --workspace=services/employee

# Run migrations
npm run migrate:up

# Rollback migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

## Documentation

- [Product Requirements](./PRD.md)
- [Development Plan](./docs/DEVELOPMENT_PLAN.md)
- [Implementation Decisions](./docs/IMPLEMENTATION_DECISIONS.md)
- [Modular Monolith Rebuild Plan](./docs/MODULAR_MONOLITH_REBUILD_PLAN.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## Key Features

### GPS-Based Attendance
- 100m geofence radius validation
- Real-time location tracking
- Haversine distance calculation
- Indoor/outdoor compatibility

### Multi-Level Approval Workflow
1. **Level 1**: Supervisor Review
2. **Level 2**: Operations Manager Approval
3. **Level 3**: Manager Verification
- Automated escalation after 24 hours
- Bulk approval capabilities
- Audit trail for all actions

### Multi-Location Support
- Employees can work at multiple client locations
- Primary and secondary location assignments
- Daily location tracking via GPS
- Location-specific reporting

### Payroll Processing
- Automated salary calculation from attendance
- Tax and deduction computation
- HR override with audit trail
- Payslip generation (PDF)
- Bulk payroll processing

## Monitoring

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **RabbitMQ Management**: http://localhost:15672
- **MinIO Console**: http://localhost:9001

## Testing

```bash
# Run all tests
npm run test

# Run tests for specific service
npm run test --workspace=services/attendance

# Run e2e tests
npm run test:e2e

# Run integration tests
npm run test:integration
```

## Security

- JWT Authentication with refresh tokens
- Role-based access control (RBAC)
- Field-level permissions
- Encrypted data at rest (AES-256)
- TLS 1.3 for data in transit
- Comprehensive audit logging

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

Proprietary - All Rights Reserved

## Support

For support, contact: support@hrflow.com
Documentation: https://docs.hrflow.com
