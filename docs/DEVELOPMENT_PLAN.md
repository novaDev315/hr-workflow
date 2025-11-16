# HRFlow Pro - Development Plan

**Version**: 1.1
**Last Updated**: 2025-11-16 (Updated Expo SDK to 53)
**Project Duration**: 24 weeks (6 months)
**Target Deployment**: Q2 2026

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Development Phases](#development-phases)
5. [Service Implementation Details](#service-implementation-details)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Strategy](#deployment-strategy)
8. [Risk Management](#risk-management)
9. [Success Metrics](#success-metrics)

---

## Executive Summary

HRFlow Pro is a comprehensive HR Management System designed for on-premise deployment using microservices architecture. The system will be built in 5 phases over 24 weeks, focusing on:

- **Employee Management** (Source of Truth)
- **Attendance Tracking** with GPS Geofencing
- **Leave Management** with Multi-tier Approval
- **Location & Client Management**
- **Payroll Processing** with HR Override

### Key Objectives

1. **Scalability**: Microservices architecture supporting 1000+ concurrent users
2. **Accuracy**: GPS-based attendance with 100m radius validation
3. **Flexibility**: Multi-location assignments and dynamic workflows
4. **Security**: JWT authentication, role-based access control, comprehensive audit trails
5. **Performance**: <2s response time for 95% of operations

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├───────────────────────────┬─────────────────────────────────────┤
│   Web Control Panel       │      Mobile Application             │
│   (React 19 + shadcn/ui)  │      (React Native + Expo)          │
└───────────────────────────┴─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                          │
│                   (Apollo Server 4 + GraphQL)                   │
│                    Schema Stitching / Federation                │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Employee Service│  │Attendance Service│  │  Leave Service  │
│  (NestJS)       │  │    (NestJS)      │  │    (NestJS)     │
│                 │  │                  │  │                 │
│ Source of Truth │  │ GPS Validation   │  │ Approval Flow   │
│ Employee CRUD   │  │ 3-Tier Approval  │  │ Balance Mgmt    │
│ Dept/Designation│  │ Overtime Calc    │  │ Team Calendar   │
│ Documents       │  │ Lock/Unlock      │  │                 │
│ Salary Structure│  │                  │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│Location Service │  │ Payroll Service  │  │  Event Bus      │
│   (NestJS)      │  │    (NestJS)      │  │  (RabbitMQ)     │
│                 │  │                  │  │                 │
│ Client Mgmt     │  │ Salary Calc      │  │ Async Events    │
│ Location CRUD   │  │ Payslip Gen      │  │ Cross-Service   │
│ Multi-Assignment│  │ HR Override      │  │ Communication   │
│ Contract Mgmt   │  │ Audit Trail      │  │                 │
│ Geofence Config │  │ Tax Calculation  │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  PostgreSQL 15  │    Redis 7      │      MinIO (S3)             │
│  (Primary DB)   │  (Cache/Session)│   (Object Storage)          │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Prometheus     │   Grafana       │      ELK Stack              │
│  (Metrics)      │  (Dashboards)   │   (Logging/Search)          │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Service Dependencies

```
Employee Service (Core - No Dependencies)
    │
    ├── Attendance Service
    │   └── Depends on: Employee Service, Location Service
    │
    ├── Leave Service
    │   └── Depends on: Employee Service
    │
    ├── Location Service
    │   └── Depends on: Employee Service
    │
    └── Payroll Service
        └── Depends on: Employee Service, Attendance Service, Leave Service
```

### Microservices Breakdown

#### 1. Employee Service (Source of Truth)
- **Purpose**: Central repository for all employee data
- **Responsibilities**:
  - Employee CRUD operations
  - Department and designation management
  - Document management (ID, contracts, certifications)
  - Salary structure management
  - Employee hierarchy (supervisor/subordinate)
  - Bulk import/export operations
- **Database**: Dedicated PostgreSQL schema
- **Events Published**:
  - `employee.created`
  - `employee.updated`
  - `employee.deleted`
  - `employee.status.changed`

#### 2. Attendance Service
- **Purpose**: Track employee attendance with GPS validation
- **Responsibilities**:
  - Clock-in/out with GPS coordinates
  - Geofence validation (100m radius)
  - 3-tier approval workflow
  - Overtime calculation
  - Attendance locking for payroll
  - HR override with audit trail
- **Database**: Dedicated PostgreSQL schema
- **Events Consumed**:
  - `employee.created` (setup attendance profile)
  - `employee.deleted` (archive attendance data)
  - `location.updated` (update geofence)
- **Events Published**:
  - `attendance.clocked.in`
  - `attendance.clocked.out`
  - `attendance.approved`
  - `attendance.locked`

#### 3. Leave Service
- **Purpose**: Manage leave requests and approvals
- **Responsibilities**:
  - Leave request creation
  - Multi-tier approval workflow
  - Leave balance tracking
  - Leave type configuration
  - Team calendar generation
  - Leave encashment calculation
- **Database**: Dedicated PostgreSQL schema
- **Events Consumed**:
  - `employee.created` (initialize leave balance)
  - `employee.updated` (update leave eligibility)
- **Events Published**:
  - `leave.requested`
  - `leave.approved`
  - `leave.rejected`
  - `leave.balance.updated`

#### 4. Location Service
- **Purpose**: Manage clients, locations, and assignments
- **Responsibilities**:
  - Client CRUD operations
  - Client contract management
  - Location management with GPS coordinates
  - Multi-location employee assignments
  - Geofence configuration per location
  - Contract validation (personnel, gender, period)
- **Database**: Dedicated PostgreSQL schema
- **Events Consumed**:
  - `employee.created` (enable for assignment)
  - `employee.status.changed` (update assignments)
- **Events Published**:
  - `location.created`
  - `location.updated`
  - `assignment.created`
  - `assignment.updated`

#### 5. Payroll Service
- **Purpose**: Calculate and process payroll
- **Responsibilities**:
  - Salary calculation based on attendance
  - Payslip generation
  - Tax and deduction calculation
  - HR override for corrections
  - Payroll audit trail
  - Bulk payroll processing
- **Database**: Dedicated PostgreSQL schema
- **Events Consumed**:
  - `attendance.locked` (ready for payroll)
  - `leave.approved` (deduct salary if unpaid)
  - `employee.updated` (salary structure changed)
- **Events Published**:
  - `payroll.calculated`
  - `payroll.processed`
  - `payslip.generated`

---

## Technology Stack

### Frontend Technologies

#### Web Control Panel
```json
{
  "name": "hrflow-web-cp",
  "version": "1.0.0",
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",

    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",

    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0",

    "@apollo/client": "^3.8.0",
    "graphql": "^16.8.1",

    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.0",

    "@tanstack/react-table": "^8.10.0",
    "@tanstack/react-query": "^5.12.0",

    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.294.0",

    "zustand": "^4.4.7",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

**Key Features**:
- React 19 with React Compiler for automatic optimization
- shadcn/ui components built on Radix UI
- Tailwind CSS for utility-first styling
- Apollo Client for GraphQL data fetching
- React Hook Form + Zod for form validation
- TanStack Table for advanced data tables
- Recharts for analytics dashboards
- Zustand for lightweight state management

#### Mobile Application
```json
{
  "name": "hrflow-mobile",
  "version": "1.0.0",
  "dependencies": {
    "expo": "~53.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",

    "expo-router": "~4.0.0",
    "expo-location": "~18.0.0",
    "expo-local-authentication": "~15.0.0",
    "expo-camera": "~16.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-notifications": "~0.29.0",
    "expo-secure-store": "~14.0.0",

    "react-native-maps": "1.18.0",
    "@react-native-async-storage/async-storage": "2.0.0",

    "@apollo/client": "^3.8.0",
    "graphql": "^16.8.1",

    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",

    "zustand": "^4.4.7",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.3.0",
    "typescript": "^5.3.0"
  }
}
```

**Key Features**:
- Expo SDK 53 (latest) for rapid development
- Expo Router for file-based routing
- Expo Location for GPS tracking
- Expo Local Authentication for biometric auth
- React Native Maps for location visualization
- Apollo Client for GraphQL integration
- Secure token storage with Expo Secure Store

### Backend Technologies

#### API Gateway
```json
{
  "name": "hrflow-api-gateway",
  "version": "1.0.0",
  "dependencies": {
    "@nestjs/core": "^10.2.0",
    "@nestjs/common": "^10.2.0",
    "@nestjs/platform-express": "^10.2.0",

    "@nestjs/apollo": "^12.0.0",
    "@nestjs/graphql": "^12.0.0",
    "@apollo/server": "^4.9.0",
    "@apollo/gateway": "^2.5.0",
    "graphql": "^16.8.1",

    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",

    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",

    "express-rate-limit": "^7.1.0",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  }
}
```

**Key Features**:
- Apollo Server 4 for GraphQL API
- Schema stitching for microservices federation
- JWT authentication with refresh tokens
- Rate limiting and security headers
- Request compression
- GraphQL playground for development

#### Microservices (NestJS)
```json
{
  "name": "hrflow-service-template",
  "version": "1.0.0",
  "dependencies": {
    "@nestjs/core": "^10.2.0",
    "@nestjs/common": "^10.2.0",
    "@nestjs/microservices": "^10.2.0",

    "@nestjs/graphql": "^12.0.0",
    "@apollo/subgraph": "^2.5.0",

    "@nestjs/typeorm": "^10.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",

    "@prisma/client": "^5.7.0",

    "@nestjs/config": "^3.1.0",
    "joi": "^17.11.0",

    "amqplib": "^0.10.3",
    "@nestjs/bull": "^10.0.0",
    "bull": "^4.12.0",

    "ioredis": "^5.3.2",

    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",

    "bcrypt": "^5.1.1",
    "uuid": "^9.0.1",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "prisma": "^5.7.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**Key Features**:
- NestJS for enterprise-grade architecture
- Prisma ORM for type-safe database queries
- RabbitMQ for event-driven communication
- Bull for job queues
- Redis for caching and session management
- GraphQL subgraph support
- Environment-based configuration with validation

### Infrastructure

#### Docker Compose Services
```yaml
version: '3.8'

services:
  # API Gateway
  api-gateway:
    image: hrflow-api-gateway:latest
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
    depends_on:
      - redis
      - rabbitmq

  # Microservices
  employee-service:
    image: hrflow-employee-service:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/employee_db
    depends_on:
      - postgres
      - redis
      - rabbitmq

  attendance-service:
    image: hrflow-attendance-service:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/attendance_db
    depends_on:
      - postgres
      - redis
      - rabbitmq

  leave-service:
    image: hrflow-leave-service:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/leave_db
    depends_on:
      - postgres
      - redis
      - rabbitmq

  location-service:
    image: hrflow-location-service:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/location_db
    depends_on:
      - postgres
      - redis
      - rabbitmq

  payroll-service:
    image: hrflow-payroll-service:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/payroll_db
    depends_on:
      - postgres
      - redis
      - rabbitmq

  # Data Layer
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=hrflow
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=hrflow
      - RABBITMQ_DEFAULT_PASS=secure_password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=hrflow
      - MINIO_ROOT_PASSWORD=secure_password
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

  # Logging
  elasticsearch:
    image: elasticsearch:8.11.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: logstash:8.11.0
    ports:
      - "5000:5000"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:
  prometheus_data:
  grafana_data:
  elasticsearch_data:
```

---

## Development Phases

### Phase 1: Foundation (Weeks 1-4)

#### Week 1-2: Infrastructure Setup
**Objectives**:
- Set up development environment
- Initialize project repositories
- Configure Docker Compose
- Set up CI/CD pipelines

**Deliverables**:
```bash
hrflow-pro/
├── apps/
│   ├── web-cp/                 # React 19 Web Control Panel
│   ├── mobile/                 # React Native Mobile App
│   └── api-gateway/            # Apollo Server Gateway
├── services/
│   ├── employee/               # Employee Service
│   ├── attendance/             # Attendance Service
│   ├── leave/                  # Leave Service
│   ├── location/               # Location Service
│   └── payroll/                # Payroll Service
├── packages/
│   ├── shared-types/           # Shared TypeScript types
│   ├── graphql-schema/         # GraphQL schema definitions
│   └── utils/                  # Shared utilities
├── infrastructure/
│   ├── docker/                 # Docker configurations
│   ├── k8s/                    # Kubernetes manifests (future)
│   └── monitoring/             # Prometheus/Grafana configs
├── docs/                       # Documentation
├── .github/
│   └── workflows/              # CI/CD workflows
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

**Tasks**:
- [ ] Create monorepo structure with Turborepo/Nx
- [ ] Initialize all service repositories
- [ ] Set up PostgreSQL with separate databases per service
- [ ] Configure Redis for caching
- [ ] Set up RabbitMQ for event bus
- [ ] Configure MinIO for object storage
- [ ] Set up Prometheus and Grafana
- [ ] Configure ELK stack for logging
- [ ] Create Docker Compose files for local development
- [ ] Set up GitHub Actions for CI/CD

#### Week 3-4: Employee Service (Core)
**Objectives**:
- Implement Employee Service as source of truth
- Create database schema
- Implement GraphQL API
- Set up event publishing

**Database Schema**:
```sql
-- Employee Service Database Schema

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    department_id UUID REFERENCES departments(id),
    level INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(50) NOT NULL UNIQUE,

    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    marital_status VARCHAR(20),
    nationality VARCHAR(50),

    -- Employment Information
    department_id UUID REFERENCES departments(id),
    designation_id UUID REFERENCES designations(id),
    supervisor_id UUID REFERENCES employees(id),
    employment_type VARCHAR(50) NOT NULL,
    join_date DATE NOT NULL,
    confirmation_date DATE,
    exit_date DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE',

    -- Contact Information
    permanent_address TEXT,
    current_address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),

    -- Banking Information
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    CONSTRAINT valid_employment_dates CHECK (
        (exit_date IS NULL) OR (exit_date >= join_date)
    ),
    CONSTRAINT valid_confirmation_date CHECK (
        (confirmation_date IS NULL) OR (confirmation_date >= join_date)
    )
);

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_url VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID,
    expires_at DATE,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    verified_by UUID
);

CREATE TABLE salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,

    -- Salary Components
    basic_salary DECIMAL(15,2) NOT NULL,
    hra DECIMAL(15,2) DEFAULT 0,
    conveyance_allowance DECIMAL(15,2) DEFAULT 0,
    medical_allowance DECIMAL(15,2) DEFAULT 0,
    special_allowance DECIMAL(15,2) DEFAULT 0,
    other_allowances DECIMAL(15,2) DEFAULT 0,

    -- Deductions
    pf_contribution DECIMAL(15,2) DEFAULT 0,
    esi_contribution DECIMAL(15,2) DEFAULT 0,
    professional_tax DECIMAL(15,2) DEFAULT 0,

    -- Calculated Fields
    gross_salary DECIMAL(15,2) GENERATED ALWAYS AS (
        basic_salary + COALESCE(hra, 0) + COALESCE(conveyance_allowance, 0) +
        COALESCE(medical_allowance, 0) + COALESCE(special_allowance, 0) +
        COALESCE(other_allowances, 0)
    ) STORED,

    net_salary DECIMAL(15,2) GENERATED ALWAYS AS (
        basic_salary + COALESCE(hra, 0) + COALESCE(conveyance_allowance, 0) +
        COALESCE(medical_allowance, 0) + COALESCE(special_allowance, 0) +
        COALESCE(other_allowances, 0) - COALESCE(pf_contribution, 0) -
        COALESCE(esi_contribution, 0) - COALESCE(professional_tax, 0)
    ) STORED,

    effective_from DATE NOT NULL,
    effective_to DATE,
    is_current BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    CONSTRAINT valid_effective_dates CHECK (
        (effective_to IS NULL) OR (effective_to > effective_from)
    ),
    CONSTRAINT only_one_current_salary CHECK (
        NOT is_current OR
        NOT EXISTS (
            SELECT 1 FROM salary_structures ss2
            WHERE ss2.employee_id = salary_structures.employee_id
            AND ss2.is_current = true
            AND ss2.id != salary_structures.id
        )
    )
);

CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_designation ON employees(designation_id);
CREATE INDEX idx_employees_supervisor ON employees(supervisor_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX idx_salary_structures_employee ON salary_structures(employee_id);
CREATE INDEX idx_salary_structures_current ON salary_structures(is_current) WHERE is_current = true;
```

**GraphQL Schema**:
```graphql
# Employee Service Schema

type Department {
  id: ID!
  name: String!
  code: String!
  description: String
  isActive: Boolean!
  employees: [Employee!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Designation {
  id: ID!
  title: String!
  code: String!
  department: Department!
  level: Int!
  description: String
  isActive: Boolean!
  employees: [Employee!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Employee {
  id: ID!
  employeeNumber: String!

  # Personal Information
  firstName: String!
  lastName: String!
  fullName: String!
  email: String!
  phone: String
  dateOfBirth: Date
  gender: Gender
  maritalStatus: MaritalStatus
  nationality: String

  # Employment Information
  department: Department!
  designation: Designation!
  supervisor: Employee
  subordinates: [Employee!]!
  employmentType: EmploymentType!
  joinDate: Date!
  confirmationDate: Date
  exitDate: Date
  status: EmployeeStatus!

  # Relationships
  documents: [EmployeeDocument!]!
  salaryStructures: [SalaryStructure!]!
  currentSalary: SalaryStructure

  # Metadata
  createdAt: DateTime!
  updatedAt: DateTime!
}

type EmployeeDocument {
  id: ID!
  employee: Employee!
  documentType: DocumentType!
  documentName: String!
  documentUrl: String!
  fileSize: Int
  mimeType: String
  uploadedAt: DateTime!
  uploadedBy: User!
  expiresAt: Date
  isVerified: Boolean!
  verifiedAt: DateTime
  verifiedBy: User
}

type SalaryStructure {
  id: ID!
  employee: Employee!

  # Salary Components
  basicSalary: Decimal!
  hra: Decimal!
  conveyanceAllowance: Decimal!
  medicalAllowance: Decimal!
  specialAllowance: Decimal!
  otherAllowances: Decimal!

  # Deductions
  pfContribution: Decimal!
  esiContribution: Decimal!
  professionalTax: Decimal!

  # Calculated
  grossSalary: Decimal!
  netSalary: Decimal!

  effectiveFrom: Date!
  effectiveTo: Date
  isCurrent: Boolean!

  createdAt: DateTime!
  createdBy: User!
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum MaritalStatus {
  SINGLE
  MARRIED
  DIVORCED
  WIDOWED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERNSHIP
  CONSULTANT
}

enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  SUSPENDED
  TERMINATED
  RESIGNED
  RETIRED
}

enum DocumentType {
  AADHAAR_CARD
  PAN_CARD
  PASSPORT
  DRIVING_LICENSE
  VOTER_ID
  BANK_STATEMENT
  EDUCATIONAL_CERTIFICATE
  EXPERIENCE_LETTER
  OFFER_LETTER
  EMPLOYMENT_CONTRACT
  RELIEVING_LETTER
  MEDICAL_CERTIFICATE
  OTHER
}

type Query {
  # Employee Queries
  employee(id: ID!): Employee
  employees(
    filter: EmployeeFilter
    pagination: PaginationInput
    sorting: SortingInput
  ): EmployeesConnection!

  # Department Queries
  department(id: ID!): Department
  departments(filter: DepartmentFilter): [Department!]!

  # Designation Queries
  designation(id: ID!): Designation
  designations(filter: DesignationFilter): [Designation!]!
}

input EmployeeFilter {
  search: String
  departmentIds: [ID!]
  designationIds: [ID!]
  status: [EmployeeStatus!]
  employmentType: [EmploymentType!]
  joinDateFrom: Date
  joinDateTo: Date
}

type Mutation {
  # Employee Mutations
  createEmployee(input: CreateEmployeeInput!): Employee!
  updateEmployee(id: ID!, input: UpdateEmployeeInput!): Employee!
  deleteEmployee(id: ID!): Boolean!
  changeEmployeeStatus(id: ID!, status: EmployeeStatus!, reason: String): Employee!

  # Department Mutations
  createDepartment(input: CreateDepartmentInput!): Department!
  updateDepartment(id: ID!, input: UpdateDepartmentInput!): Department!

  # Designation Mutations
  createDesignation(input: CreateDesignationInput!): Designation!
  updateDesignation(id: ID!, input: UpdateDesignationInput!): Designation!

  # Document Mutations
  uploadEmployeeDocument(input: UploadDocumentInput!): EmployeeDocument!
  deleteEmployeeDocument(id: ID!): Boolean!
  verifyEmployeeDocument(id: ID!): EmployeeDocument!

  # Salary Structure Mutations
  createSalaryStructure(input: CreateSalaryStructureInput!): SalaryStructure!
  updateSalaryStructure(id: ID!, input: UpdateSalaryStructureInput!): SalaryStructure!
}

type Subscription {
  employeeCreated: Employee!
  employeeUpdated(id: ID): Employee!
  employeeStatusChanged: Employee!
}
```

**Service Implementation**:
```typescript
// services/employee/src/modules/employee/employee.service.ts

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { EmployeeStatus } from '@prisma/client';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    // Check for duplicate email
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { email: createEmployeeDto.email },
    });

    if (existingEmployee) {
      throw new ConflictException('Employee with this email already exists');
    }

    // Generate employee number
    const employeeNumber = await this.generateEmployeeNumber();

    // Create employee
    const employee = await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        employeeNumber,
      },
      include: {
        department: true,
        designation: true,
        supervisor: true,
      },
    });

    // Publish event
    this.eventEmitter.emit('employee.created', {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      joinDate: employee.joinDate,
      status: employee.status,
    });

    return employee;
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        designation: true,
        supervisor: true,
        subordinates: true,
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        salaryStructures: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  async findAll(filter?: any, pagination?: any) {
    const where: any = {};

    if (filter?.search) {
      where.OR = [
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { employeeNumber: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter?.departmentIds?.length) {
      where.departmentId = { in: filter.departmentIds };
    }

    if (filter?.status?.length) {
      where.status = { in: filter.status };
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          supervisor: true,
        },
        skip: pagination?.offset || 0,
        take: pagination?.limit || 50,
        orderBy: pagination?.orderBy || { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees,
      total,
      hasMore: (pagination?.offset || 0) + employees.length < total,
    };
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateEmployeeDto,
      include: {
        department: true,
        designation: true,
        supervisor: true,
      },
    });

    // Publish event if status or key fields changed
    if (
      employee.status !== updated.status ||
      employee.departmentId !== updated.departmentId
    ) {
      this.eventEmitter.emit('employee.updated', {
        employeeId: updated.id,
        previousStatus: employee.status,
        newStatus: updated.status,
        previousDepartmentId: employee.departmentId,
        newDepartmentId: updated.departmentId,
      });
    }

    return updated;
  }

  async changeStatus(id: string, status: EmployeeStatus, reason?: string) {
    const employee = await this.findOne(id);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        status,
        exitDate: status === EmployeeStatus.TERMINATED ||
                 status === EmployeeStatus.RESIGNED
                   ? new Date()
                   : employee.exitDate,
      },
      include: {
        department: true,
        designation: true,
      },
    });

    // Log status change
    await this.prisma.employeeStatusLog.create({
      data: {
        employeeId: id,
        previousStatus: employee.status,
        newStatus: status,
        reason,
        changedAt: new Date(),
      },
    });

    // Publish event
    this.eventEmitter.emit('employee.status.changed', {
      employeeId: id,
      previousStatus: employee.status,
      newStatus: status,
      reason,
    });

    return updated;
  }

  async delete(id: string) {
    await this.findOne(id);

    await this.prisma.employee.delete({
      where: { id },
    });

    // Publish event
    this.eventEmitter.emit('employee.deleted', {
      employeeId: id,
    });

    return true;
  }

  private async generateEmployeeNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'EMP';

    // Get the last employee number for this year
    const lastEmployee = await this.prisma.employee.findFirst({
      where: {
        employeeNumber: {
          startsWith: `${prefix}${year}`,
        },
      },
      orderBy: {
        employeeNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastEmployee) {
      const lastSequence = parseInt(
        lastEmployee.employeeNumber.slice(-4),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${sequence.toString().padStart(4, '0')}`;
  }

  async getCurrentSalary(employeeId: string) {
    return this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isCurrent: true,
      },
    });
  }

  async createSalaryStructure(input: any) {
    // Deactivate current salary structure
    await this.prisma.salaryStructure.updateMany({
      where: {
        employeeId: input.employeeId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        effectiveTo: new Date(),
      },
    });

    // Create new salary structure
    const salaryStructure = await this.prisma.salaryStructure.create({
      data: {
        ...input,
        isCurrent: true,
      },
    });

    return salaryStructure;
  }
}
```

**Tasks**:
- [ ] Implement Employee Service with all CRUD operations
- [ ] Create GraphQL resolvers for Employee schema
- [ ] Set up Prisma with PostgreSQL
- [ ] Implement event publishing to RabbitMQ
- [ ] Add data validation with class-validator
- [ ] Create unit tests (80%+ coverage)
- [ ] Create integration tests for GraphQL API
- [ ] Document API with examples

### Phase 2: Location & Attendance (Weeks 5-10)

#### Week 5-6: Location Service
**Objectives**:
- Implement Location Service
- Client and contract management
- Multi-location assignments
- GPS geofencing configuration

**Database Schema**:
```sql
-- Location Service Database Schema

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    industry VARCHAR(100),
    contact_person VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Calculated field
    contract_period_months INT GENERATED ALWAYS AS (
        EXTRACT(YEAR FROM AGE(end_date, start_date)) * 12 +
        EXTRACT(MONTH FROM AGE(end_date, start_date))
    ) STORED,

    contract_value DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Personnel Requirements
    required_personnel INT NOT NULL,
    gender_requirement VARCHAR(50) DEFAULT 'NO_PREFERENCE',
    male_count INT,
    female_count INT,

    -- Location Information
    number_of_locations INT NOT NULL DEFAULT 1,

    -- Contract Terms
    payment_terms TEXT,
    sla_terms TEXT,
    auto_renew BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'DRAFT',

    signed_document_url VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_gender_counts CHECK (
        CASE
            WHEN gender_requirement = 'MALE_ONLY' THEN
                male_count = required_personnel AND female_count = 0
            WHEN gender_requirement = 'FEMALE_ONLY' THEN
                female_count = required_personnel AND male_count = 0
            WHEN gender_requirement = 'MIXED' THEN
                (COALESCE(male_count, 0) + COALESCE(female_count, 0)) = required_personnel
            ELSE TRUE
        END
    ),
    CONSTRAINT valid_contract_dates CHECK (end_date > start_date),
    CONSTRAINT valid_personnel_count CHECK (required_personnel > 0),
    CONSTRAINT valid_location_count CHECK (number_of_locations > 0)
);

CREATE TABLE client_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    contract_id UUID REFERENCES client_contracts(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,

    -- GPS Coordinates
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geofence_radius INT DEFAULT 100, -- in meters

    -- Address
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    landmark VARCHAR(255),

    -- Location Details
    location_type VARCHAR(50),
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),

    -- Working Hours
    default_shift_start TIME DEFAULT '09:00:00',
    default_shift_end TIME DEFAULT '18:00:00',

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_geofence_radius CHECK (
        geofence_radius >= 50 AND geofence_radius <= 500
    ),
    CONSTRAINT valid_coordinates CHECK (
        latitude BETWEEN -90 AND 90 AND
        longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT unique_location_code_per_client UNIQUE (client_id, code)
);

CREATE TABLE employee_location_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL, -- From Employee Service
    location_id UUID REFERENCES client_locations(id),

    is_primary BOOLEAN DEFAULT false,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    release_date DATE,

    status VARCHAR(50) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_assignment_dates CHECK (
        (release_date IS NULL) OR (release_date >= assigned_date)
    ),
    CONSTRAINT max_five_locations CHECK (
        (SELECT COUNT(*)
         FROM employee_location_assignments ela2
         WHERE ela2.employee_id = employee_location_assignments.employee_id
         AND ela2.status = 'ACTIVE') <= 5
    )
);

CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_client_contracts_client ON client_contracts(client_id);
CREATE INDEX idx_client_contracts_status ON client_contracts(status);
CREATE INDEX idx_client_locations_client ON client_locations(client_id);
CREATE INDEX idx_client_locations_contract ON client_locations(contract_id);
CREATE INDEX idx_client_locations_coords ON client_locations(latitude, longitude);
CREATE INDEX idx_employee_assignments_employee ON employee_location_assignments(employee_id);
CREATE INDEX idx_employee_assignments_location ON employee_location_assignments(location_id);
CREATE INDEX idx_employee_assignments_status ON employee_location_assignments(status);
```

**GPS Distance Calculation**:
```typescript
// services/location/src/utils/geofence.util.ts

export class GeofenceUtil {
  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * @param lat1 Latitude of point 1
   * @param lon1 Longitude of point 1
   * @param lat2 Latitude of point 2
   * @param lon2 Longitude of point 2
   * @returns Distance in meters
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if coordinates are within geofence
   * @param userLat User's latitude
   * @param userLon User's longitude
   * @param locationLat Location's latitude
   * @param locationLon Location's longitude
   * @param radius Geofence radius in meters
   * @returns true if within geofence
   */
  static isWithinGeofence(
    userLat: number,
    userLon: number,
    locationLat: number,
    locationLon: number,
    radius: number = 100,
  ): boolean {
    const distance = this.calculateDistance(
      userLat,
      userLon,
      locationLat,
      locationLon,
    );
    return distance <= radius;
  }

  /**
   * Get geofence status with detailed information
   */
  static getGeofenceStatus(
    userLat: number,
    userLon: number,
    locationLat: number,
    locationLon: number,
    radius: number = 100,
  ) {
    const distance = this.calculateDistance(
      userLat,
      userLon,
      locationLat,
      locationLon,
    );

    return {
      isWithinGeofence: distance <= radius,
      distance: Math.round(distance),
      radius,
      distanceFromBoundary: Math.round(Math.abs(distance - radius)),
      accuracyPercentage: Math.round((1 - distance / radius) * 100),
    };
  }
}
```

**Tasks**:
- [ ] Implement Location Service with client/location CRUD
- [ ] Implement contract management with validations
- [ ] Create multi-location assignment logic
- [ ] Implement GPS geofencing utilities
- [ ] Create GraphQL schema and resolvers
- [ ] Set up event listeners for Employee Service events
- [ ] Add unit and integration tests
- [ ] Document geofencing algorithms

#### Week 7-10: Attendance Service
**Objectives**:
- Implement Attendance Service
- GPS-based clock-in/out
- 3-tier approval workflow
- Overtime calculation
- HR override mechanism

**Database Schema**:
```sql
-- Attendance Service Database Schema

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL, -- From Employee Service
    location_id UUID NOT NULL, -- From Location Service
    attendance_date DATE NOT NULL,

    -- Clock In
    clock_in_time TIMESTAMP,
    clock_in_latitude DECIMAL(10, 8),
    clock_in_longitude DECIMAL(11, 8),
    clock_in_distance_from_location INT, -- in meters
    clock_in_address TEXT,
    clock_in_device_info JSONB,

    -- Clock Out
    clock_out_time TIMESTAMP,
    clock_out_latitude DECIMAL(10, 8),
    clock_out_longitude DECIMAL(11, 8),
    clock_out_distance_from_location INT,
    clock_out_address TEXT,
    clock_out_device_info JSONB,

    -- Calculated Fields
    total_hours DECIMAL(5, 2),
    regular_hours DECIMAL(5, 2),
    overtime_hours DECIMAL(5, 2),
    break_hours DECIMAL(5, 2) DEFAULT 0,

    -- Status and Workflow
    status VARCHAR(50) DEFAULT 'PENDING',
    is_late BOOLEAN DEFAULT false,
    late_by_minutes INT,
    is_early_departure BOOLEAN DEFAULT false,
    early_departure_by_minutes INT,

    -- Approval Workflow (3-tier)
    tier1_approver_id UUID,
    tier1_approved_at TIMESTAMP,
    tier1_status VARCHAR(50),
    tier1_comments TEXT,

    tier2_approver_id UUID,
    tier2_approved_at TIMESTAMP,
    tier2_status VARCHAR(50),
    tier2_comments TEXT,

    tier3_approver_id UUID,
    tier3_approved_at TIMESTAMP,
    tier3_status VARCHAR(50),
    tier3_comments TEXT,

    final_approval_status VARCHAR(50),
    final_approved_at TIMESTAMP,

    -- Payroll Lock
    is_locked_for_payroll BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    locked_by UUID,

    -- HR Override
    is_overridden BOOLEAN DEFAULT false,
    override_reason TEXT,
    override_by UUID,
    override_at TIMESTAMP,
    override_previous_data JSONB,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_clock_times CHECK (
        (clock_out_time IS NULL) OR (clock_out_time > clock_in_time)
    ),
    CONSTRAINT unique_employee_date UNIQUE (employee_id, attendance_date)
);

CREATE TABLE attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES attendance_records(id),
    requested_by UUID NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    correction_type VARCHAR(50) NOT NULL,
    current_value JSONB,
    requested_value JSONB,
    reason TEXT NOT NULL,

    status VARCHAR(50) DEFAULT 'PENDING',
    approved_by UUID,
    approved_at TIMESTAMP,
    rejection_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID,
    department_id UUID,

    tier1_role VARCHAR(50),
    tier2_role VARCHAR(50),
    tier3_role VARCHAR(50),

    auto_approve_if_no_issues BOOLEAN DEFAULT false,
    require_all_tiers BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX idx_attendance_location ON attendance_records(location_id);
CREATE INDEX idx_attendance_date ON attendance_records(attendance_date);
CREATE INDEX idx_attendance_status ON attendance_records(status);
CREATE INDEX idx_attendance_payroll_lock ON attendance_records(is_locked_for_payroll);
CREATE INDEX idx_attendance_corrections_attendance ON attendance_corrections(attendance_id);
```

**Clock-In Implementation**:
```typescript
// services/attendance/src/modules/attendance/attendance.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private httpService: HttpService,
  ) {}

  async clockIn(employeeId: string, locationId: string, lat: number, lon: number) {
    // Get location details from Location Service
    const location = await this.getLocationDetails(locationId);

    if (!location || !location.isActive) {
      throw new BadRequestException('Invalid or inactive location');
    }

    // Calculate distance from location
    const distance = this.calculateDistance(
      lat,
      lon,
      location.latitude,
      location.longitude,
    );

    // Validate geofence
    if (distance > location.geofenceRadius) {
      throw new BadRequestException(
        `You are ${Math.round(distance)}m away from the location. ` +
        `You must be within ${location.geofenceRadius}m to clock in.`
      );
    }

    // Check for existing attendance today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: today,
        },
      },
    });

    if (existingAttendance && existingAttendance.clockInTime) {
      throw new BadRequestException('You have already clocked in today');
    }

    // Get reverse geocoded address
    const address = await this.getReverseGeocodedAddress(lat, lon);

    // Check if late
    const clockInTime = new Date();
    const expectedStartTime = new Date(today);
    expectedStartTime.setHours(
      parseInt(location.defaultShiftStart.split(':')[0]),
      parseInt(location.defaultShiftStart.split(':')[1]),
      0,
      0,
    );

    const isLate = clockInTime > expectedStartTime;
    const lateByMinutes = isLate
      ? Math.floor((clockInTime.getTime() - expectedStartTime.getTime()) / (1000 * 60))
      : 0;

    // Create attendance record
    const attendance = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        locationId,
        attendanceDate: today,
        clockInTime,
        clockInLatitude: lat,
        clockInLongitude: lon,
        clockInDistanceFromLocation: Math.round(distance),
        clockInAddress: address,
        isLate,
        lateByMinutes,
        status: 'CLOCKED_IN',
      },
    });

    // Publish event
    this.eventEmitter.emit('attendance.clocked.in', {
      attendanceId: attendance.id,
      employeeId,
      locationId,
      clockInTime,
      isLate,
      lateByMinutes,
    });

    return attendance;
  }

  async clockOut(attendanceId: string, lat: number, lon: number) {
    const attendance = await this.prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      throw new BadRequestException('Attendance record not found');
    }

    if (attendance.clockOutTime) {
      throw new BadRequestException('You have already clocked out');
    }

    // Get location details
    const location = await this.getLocationDetails(attendance.locationId);

    // Calculate distance
    const distance = this.calculateDistance(
      lat,
      lon,
      location.latitude,
      location.longitude,
    );

    // Validate geofence (allow slightly larger radius for clock-out)
    if (distance > location.geofenceRadius * 1.5) {
      throw new BadRequestException(
        `You are too far from the location to clock out.`
      );
    }

    const clockOutTime = new Date();
    const address = await this.getReverseGeocodedAddress(lat, lon);

    // Calculate hours
    const totalMinutes = Math.floor(
      (clockOutTime.getTime() - attendance.clockInTime.getTime()) / (1000 * 60)
    );
    const totalHours = totalMinutes / 60;

    const expectedEndTime = new Date(attendance.attendanceDate);
    expectedEndTime.setHours(
      parseInt(location.defaultShiftEnd.split(':')[0]),
      parseInt(location.defaultShiftEnd.split(':')[1]),
      0,
      0,
    );

    const expectedHours = 9; // Standard 9-hour shift
    const regularHours = Math.min(totalHours, expectedHours);
    const overtimeHours = Math.max(0, totalHours - expectedHours);

    const isEarlyDeparture = clockOutTime < expectedEndTime;
    const earlyDepartureByMinutes = isEarlyDeparture
      ? Math.floor((expectedEndTime.getTime() - clockOutTime.getTime()) / (1000 * 60))
      : 0;

    // Update attendance record
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        clockOutTime,
        clockOutLatitude: lat,
        clockOutLongitude: lon,
        clockOutDistanceFromLocation: Math.round(distance),
        clockOutAddress: address,
        totalHours: parseFloat(totalHours.toFixed(2)),
        regularHours: parseFloat(regularHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        isEarlyDeparture,
        earlyDepartureByMinutes,
        status: 'PENDING_APPROVAL',
      },
    });

    // Trigger approval workflow
    await this.initiateApprovalWorkflow(attendanceId);

    // Publish event
    this.eventEmitter.emit('attendance.clocked.out', {
      attendanceId,
      employeeId: attendance.employeeId,
      totalHours,
      overtimeHours,
    });

    return updated;
  }

  async initiateApprovalWorkflow(attendanceId: string) {
    const attendance = await this.prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    });

    // Get employee details from Employee Service
    const employee = await this.getEmployeeDetails(attendance.employeeId);

    // Get approval rules
    const rules = await this.prisma.attendanceApprovalRules.findFirst({
      where: {
        OR: [
          { locationId: attendance.locationId },
          { departmentId: employee.departmentId },
        ],
      },
    });

    if (!rules) {
      // Default: require supervisor approval
      await this.prisma.attendanceRecord.update({
        where: { id: attendanceId },
        data: {
          tier1ApproverId: employee.supervisorId,
          tier1Status: 'PENDING',
        },
      });
      return;
    }

    // Auto-approve if no issues and rule allows
    if (
      rules.autoApproveIfNoIssues &&
      !attendance.isLate &&
      !attendance.isEarlyDeparture
    ) {
      await this.autoApprove(attendanceId);
      return;
    }

    // Set approvers based on rules
    const approvers = await this.getApproversForRoles(
      employee.departmentId,
      [rules.tier1Role, rules.tier2Role, rules.tier3Role],
    );

    await this.prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        tier1ApproverId: approvers[0],
        tier1Status: 'PENDING',
        tier2ApproverId: approvers[1],
        tier3ApproverId: approvers[2],
      },
    });
  }

  async approveTier(
    attendanceId: string,
    tier: 1 | 2 | 3,
    approverId: string,
    status: 'APPROVED' | 'REJECTED',
    comments?: string,
  ) {
    const attendance = await this.prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    });

    const updateData: any = {
      [`tier${tier}Status`]: status,
      [`tier${tier}ApprovedAt`]: new Date(),
      [`tier${tier}Comments`]: comments,
    };

    // If rejected, set final status
    if (status === 'REJECTED') {
      updateData.finalApprovalStatus = 'REJECTED';
      updateData.finalApprovedAt = new Date();
    }

    // If approved and last tier, set final status
    if (
      status === 'APPROVED' &&
      tier === 3 ||
      (tier === 2 && !attendance.tier3ApproverId) ||
      (tier === 1 && !attendance.tier2ApproverId && !attendance.tier3ApproverId)
    ) {
      updateData.finalApprovalStatus = 'APPROVED';
      updateData.finalApprovedAt = new Date();
    }

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: updateData,
    });

    // Publish event
    this.eventEmitter.emit('attendance.approved', {
      attendanceId,
      tier,
      status,
      finalStatus: updateData.finalApprovalStatus,
    });

    return updated;
  }

  async lockForPayroll(attendanceIds: string[], lockedBy: string) {
    const updated = await this.prisma.attendanceRecord.updateMany({
      where: {
        id: { in: attendanceIds },
        finalApprovalStatus: 'APPROVED',
        isLockedForPayroll: false,
      },
      data: {
        isLockedForPayroll: true,
        lockedAt: new Date(),
        lockedBy,
      },
    });

    // Publish events
    attendanceIds.forEach((id) => {
      this.eventEmitter.emit('attendance.locked', {
        attendanceId: id,
        lockedBy,
      });
    });

    return updated;
  }

  async hrOverride(
    attendanceId: string,
    overrideData: any,
    reason: string,
    overrideBy: string,
  ) {
    const attendance = await this.prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance.isLockedForPayroll) {
      throw new BadRequestException(
        'Only locked attendance records can be overridden'
      );
    }

    // Store previous data
    const previousData = {
      clockInTime: attendance.clockInTime,
      clockOutTime: attendance.clockOutTime,
      totalHours: attendance.totalHours,
      regularHours: attendance.regularHours,
      overtimeHours: attendance.overtimeHours,
    };

    // Unlock for modification
    await this.prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        isLockedForPayroll: false,
      },
    });

    // Apply override
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        ...overrideData,
        isOverridden: true,
        overrideReason: reason,
        overrideBy,
        overrideAt: new Date(),
        overridePreviousData: previousData,
        // Reset approval workflow
        tier1Status: 'PENDING',
        tier2Status: null,
        tier3Status: null,
        finalApprovalStatus: null,
      },
    });

    // Restart approval workflow
    await this.initiateApprovalWorkflow(attendanceId);

    return updated;
  }

  // Helper methods
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private async getLocationDetails(locationId: string) {
    // Call Location Service via HTTP or event bus
    const response = await firstValueFrom(
      this.httpService.get(`http://location-service:3000/locations/${locationId}`)
    );
    return response.data;
  }

  private async getEmployeeDetails(employeeId: string) {
    // Call Employee Service
    const response = await firstValueFrom(
      this.httpService.get(`http://employee-service:3000/employees/${employeeId}`)
    );
    return response.data;
  }

  private async getReverseGeocodedAddress(lat: number, lon: number): Promise<string> {
    // Use OpenStreetMap Nominatim or Google Maps API
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        )
      );
      return response.data.display_name;
    } catch (error) {
      return `${lat}, ${lon}`;
    }
  }

  private async autoApprove(attendanceId: string) {
    await this.prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        tier1Status: 'AUTO_APPROVED',
        tier2Status: 'AUTO_APPROVED',
        tier3Status: 'AUTO_APPROVED',
        finalApprovalStatus: 'APPROVED',
        finalApprovedAt: new Date(),
      },
    });
  }

  private async getApproversForRoles(departmentId: string, roles: string[]) {
    // Get employees with specified roles from Employee Service
    // Return array of approver IDs
    return [];
  }
}
```

**Mobile Clock-In Screen**:
```typescript
// apps/mobile/app/(tabs)/attendance.tsx

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useMutation, useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { CLOCK_IN, CLOCK_OUT } from '../graphql/mutations/attendance';
import { GET_TODAY_ATTENDANCE } from '../graphql/queries/attendance';
import { GET_ACTIVE_LOCATIONS } from '../graphql/queries/location';

export default function AttendanceScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const { data: attendanceData, refetch: refetchAttendance } = useQuery(GET_TODAY_ATTENDANCE);
  const { data: locationsData } = useQuery(GET_ACTIVE_LOCATIONS);

  const [clockIn, { loading: clockingIn }] = useMutation(CLOCK_IN, {
    onCompleted: () => {
      refetchAttendance();
    },
  });

  const [clockOut, { loading: clockingOut }] = useMutation(CLOCK_OUT, {
    onCompleted: () => {
      refetchAttendance();
    },
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(location);

      // Auto-select closest location
      if (locationsData?.activeLocations) {
        const closest = findClosestLocation(
          location.coords.latitude,
          location.coords.longitude,
          locationsData.activeLocations
        );
        setSelectedLocation(closest.id);
        setDistance(closest.distance);
      }
    })();
  }, [locationsData]);

  const handleClockIn = async () => {
    if (!location || !selectedLocation) return;

    try {
      await clockIn({
        variables: {
          locationId: selectedLocation,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });
      alert('Successfully clocked in!');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleClockOut = async () => {
    if (!location || !attendanceData?.todayAttendance?.id) return;

    try {
      await clockOut({
        variables: {
          attendanceId: attendanceData.todayAttendance.id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });
      alert('Successfully clocked out!');
    } catch (error) {
      alert(error.message);
    }
  };

  const isWithinGeofence = distance !== null && distance <= 100;
  const attendance = attendanceData?.todayAttendance;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendance</Text>
      <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>

      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.label}>Your Location</Text>
          <Text style={styles.coords}>
            {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
          </Text>

          {distance !== null && (
            <View style={styles.distanceContainer}>
              <Text style={[
                styles.distance,
                isWithinGeofence ? styles.distanceOk : styles.distanceFar
              ]}>
                {Math.round(distance)}m from location
              </Text>
              {!isWithinGeofence && (
                <Text style={styles.warning}>
                  You must be within 100m to clock in
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {attendance ? (
        <View style={styles.attendanceStatus}>
          <Text style={styles.statusLabel}>Today's Attendance</Text>

          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>Clock In</Text>
            <Text style={styles.time}>
              {format(new Date(attendance.clockInTime), 'hh:mm a')}
            </Text>
            {attendance.isLate && (
              <Text style={styles.late}>Late by {attendance.lateByMinutes} min</Text>
            )}
          </View>

          {attendance.clockOutTime ? (
            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>Clock Out</Text>
              <Text style={styles.time}>
                {format(new Date(attendance.clockOutTime), 'hh:mm a')}
              </Text>
              <Text style={styles.hours}>
                Total: {attendance.totalHours.toFixed(2)} hours
              </Text>
              {attendance.overtimeHours > 0 && (
                <Text style={styles.overtime}>
                  Overtime: {attendance.overtimeHours.toFixed(2)} hours
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.button,
                styles.clockOutButton,
                (!isWithinGeofence || clockingOut) && styles.buttonDisabled,
              ]}
              onPress={handleClockOut}
              disabled={!isWithinGeofence || clockingOut}
            >
              {clockingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Clock Out</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.button,
            styles.clockInButton,
            (!isWithinGeofence || clockingIn) && styles.buttonDisabled,
          ]}
          onPress={handleClockIn}
          disabled={!isWithinGeofence || clockingIn}
        >
          {clockingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Clock In</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function findClosestLocation(lat: number, lon: number, locations: any[]) {
  let closest = locations[0];
  let minDistance = calculateDistance(lat, lon, locations[0].latitude, locations[0].longitude);

  for (const location of locations.slice(1)) {
    const distance = calculateDistance(lat, lon, location.latitude, location.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      closest = location;
    }
  }

  return { ...closest, distance: minDistance };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  date: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  locationInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  coords: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  distanceContainer: {
    marginTop: 8,
  },
  distance: {
    fontSize: 16,
    fontWeight: '600',
  },
  distanceOk: {
    color: '#10b981',
  },
  distanceFar: {
    color: '#ef4444',
  },
  warning: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  attendanceStatus: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  timeCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  time: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  late: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  hours: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  overtime: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 2,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  clockInButton: {
    backgroundColor: '#10b981',
  },
  clockOutButton: {
    backgroundColor: '#3b82f6',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

**Tasks**:
- [ ] Implement Attendance Service with clock-in/out logic
- [ ] Implement GPS validation and geofencing
- [ ] Create 3-tier approval workflow
- [ ] Implement overtime calculation
- [ ] Create HR override mechanism with audit trail
- [ ] Implement payroll locking functionality
- [ ] Create mobile clock-in/out screens
- [ ] Add real-time location tracking
- [ ] Implement reverse geocoding for addresses
- [ ] Add unit and integration tests
- [ ] Load testing for concurrent clock-ins

### Phase 3: Leave & Payroll (Weeks 11-16)

#### Week 11-13: Leave Service
**Objectives**:
- Implement Leave Service
- Leave request and approval workflow
- Leave balance tracking
- Team calendar integration

**Tasks**:
- [ ] Implement Leave Service with all leave types
- [ ] Create multi-tier approval workflow
- [ ] Implement leave balance calculation
- [ ] Create team calendar functionality
- [ ] Implement leave encashment logic
- [ ] Add GraphQL API and resolvers
- [ ] Create Web CP leave management UI
- [ ] Create Mobile app leave request screens
- [ ] Add comprehensive tests

#### Week 14-16: Payroll Service
**Objectives**:
- Implement Payroll Service
- Salary calculation from attendance
- Payslip generation
- Tax calculation
- HR override with audit

**Tasks**:
- [ ] Implement Payroll Service
- [ ] Create salary calculation engine
- [ ] Implement tax and deduction calculations
- [ ] Create payslip generation (PDF)
- [ ] Implement HR override workflow
- [ ] Create comprehensive audit trails
- [ ] Add bulk payroll processing
- [ ] Create Web CP payroll UI
- [ ] Add integration tests with Attendance Service
- [ ] Performance testing for bulk operations

### Phase 4: Web & Mobile Applications (Weeks 17-20)

#### Week 17-18: Web Control Panel
**Objectives**:
- Complete Web CP implementation
- Dashboard and analytics
- All CRUD interfaces
- Reporting modules

**Tasks**:
- [ ] Create dashboard with analytics
- [ ] Implement employee management UI
- [ ] Create attendance approval workflows UI
- [ ] Implement leave management UI
- [ ] Create payroll management UI
- [ ] Implement location and client management UI
- [ ] Add comprehensive reporting
- [ ] Create role-based access control UI
- [ ] Add data export functionality (Excel, PDF)
- [ ] Implement real-time notifications

#### Week 19-20: Mobile Application
**Objectives**:
- Complete mobile app development
- Offline support
- Push notifications
- Biometric authentication (Phase 2)

**Tasks**:
- [ ] Complete clock-in/out screens
- [ ] Implement leave request screens
- [ ] Create attendance history view
- [ ] Implement payslip viewer
- [ ] Add location map view
- [ ] Implement offline mode with sync
- [ ] Add push notifications
- [ ] Create profile management
- [ ] Implement biometric authentication
- [ ] Add comprehensive error handling

### Phase 5: Testing & Deployment (Weeks 21-24)

#### Week 21-22: Testing
**Objectives**:
- Comprehensive testing
- Performance optimization
- Security audit
- Bug fixes

**Tasks**:
- [ ] Complete unit test coverage (>80%)
- [ ] Integration testing for all services
- [ ] End-to-end testing for critical flows
- [ ] Performance testing and optimization
- [ ] Security penetration testing
- [ ] Load testing (1000+ concurrent users)
- [ ] Mobile app testing on multiple devices
- [ ] User acceptance testing (UAT)
- [ ] Bug triaging and fixes

#### Week 23: Pre-Production Setup
**Objectives**:
- Production environment setup
- Data migration
- Training materials

**Tasks**:
- [ ] Set up production Docker Compose environment
- [ ] Configure production database with backups
- [ ] Set up monitoring and alerting
- [ ] Create deployment runbooks
- [ ] Prepare data migration scripts
- [ ] Create user training materials
- [ ] Set up production logging (ELK Stack)
- [ ] Configure production SSL certificates
- [ ] Create disaster recovery procedures

#### Week 24: Production Deployment
**Objectives**:
- Production deployment
- Post-deployment monitoring
- User training
- Handover

**Tasks**:
- [ ] Execute production deployment
- [ ] Verify all services are running
- [ ] Run smoke tests on production
- [ ] Monitor system performance
- [ ] Conduct user training sessions
- [ ] Create support documentation
- [ ] Set up help desk procedures
- [ ] Project handover to operations team
- [ ] Post-deployment review
- [ ] Create future enhancement roadmap

---

## Testing Strategy

### Unit Testing
- **Target Coverage**: >80% code coverage
- **Tools**: Jest, Testing Library
- **Focus Areas**:
  - Business logic validation
  - Data transformation functions
  - Utility functions
  - Service methods

### Integration Testing
- **Tools**: Jest, Supertest
- **Focus Areas**:
  - GraphQL API endpoints
  - Service-to-service communication
  - Event publishing and consumption
  - Database operations

### End-to-End Testing
- **Tools**: Playwright, Detox (mobile)
- **Critical Flows**:
  - Employee onboarding
  - Clock-in/out with GPS validation
  - Leave request and approval
  - Payroll processing
  - Multi-location assignment

### Performance Testing
- **Tools**: K6, Artillery
- **Scenarios**:
  - 1000 concurrent clock-ins
  - Bulk payroll processing (500+ employees)
  - Report generation with large datasets
  - GraphQL query optimization

### Security Testing
- **Tools**: OWASP ZAP, Burp Suite
- **Focus Areas**:
  - SQL injection prevention
  - XSS protection
  - Authentication bypass attempts
  - Authorization checks
  - Data encryption validation

---

## Deployment Strategy

### Development Environment
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # All services with hot-reload enabled
  # Exposed ports for debugging
  # Development-specific configurations
```

### Staging Environment
- Mirror of production
- Used for UAT
- Automated deployment from `develop` branch

### Production Environment
- Docker Compose deployment
- Automated backups
- Monitoring and alerting
- Zero-downtime deployments with Docker Compose rolling updates

### CI/CD Pipeline
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm install
      - name: Run linter
        run: npm run lint
      - name: Run unit tests
        run: npm run test:unit
      - name: Run integration tests
        run: npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker images
        run: docker-compose build
      - name: Push to registry
        run: docker-compose push

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          ssh staging-server "cd /app && docker-compose pull && docker-compose up -d"

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh production-server "cd /app && docker-compose pull && docker-compose up -d"
```

---

## Risk Management

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GPS accuracy issues in dense urban areas | High | Medium | Implement adjustable geofence radius per location, allow manual verification |
| Database performance with large datasets | High | Medium | Implement database indexing, query optimization, read replicas |
| Microservice communication failures | High | Low | Implement circuit breakers, retry logic, fallback mechanisms |
| Real-time sync issues for mobile app | Medium | Medium | Implement offline-first architecture with conflict resolution |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Changing requirements mid-development | High | High | Agile methodology, regular stakeholder reviews, modular architecture |
| User adoption resistance | Medium | Medium | Comprehensive training, gradual rollout, user feedback integration |
| Data migration from legacy system | High | Low | Thorough migration testing, rollback procedures, parallel run period |

### Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Server downtime | High | Low | Docker Compose with restart policies, regular backups, disaster recovery plan |
| Data loss | Critical | Very Low | Automated daily backups, transaction logs, point-in-time recovery |
| Security breach | Critical | Low | Regular security audits, penetration testing, encryption at rest and in transit |

---

## Success Metrics

### Technical Metrics
- **Uptime**: >99.5%
- **Response Time**: <2s for 95% of requests
- **Error Rate**: <0.1%
- **Test Coverage**: >80%
- **Build Success Rate**: >95%

### Business Metrics
- **User Adoption**: >90% active users within 3 months
- **Attendance Accuracy**: >95% GPS validation success rate
- **Approval Efficiency**: <24 hours average approval time
- **Payroll Accuracy**: 100% accurate calculations
- **Time Savings**: 50% reduction in manual HR processes

### User Satisfaction Metrics
- **Net Promoter Score (NPS)**: >50
- **User Satisfaction**: >4.0/5.0
- **Support Ticket Volume**: <10 tickets per 100 users per month
- **Training Completion**: >95%

---

## Next Steps

1. **Immediate** (Week 1):
   - Set up development environment
   - Create GitHub repositories
   - Initialize all services with boilerplate
   - Set up Docker Compose for local development

2. **Short-term** (Weeks 2-4):
   - Implement Employee Service (source of truth)
   - Set up API Gateway
   - Configure event bus (RabbitMQ)
   - Begin Web CP skeleton

3. **Medium-term** (Weeks 5-16):
   - Implement remaining services
   - Complete Web CP and Mobile app
   - Comprehensive testing

4. **Long-term** (Weeks 17-24):
   - UAT and stakeholder feedback
   - Production deployment
   - User training and handover

---

## Appendix

### Technology Decision Records

**ADR-001: Microservices Architecture**
- **Decision**: Use microservices instead of monolith
- **Rationale**: Better scalability, independent deployment, technology flexibility
- **Consequences**: Increased complexity, need for service mesh

**ADR-002: GraphQL over REST**
- **Decision**: Use GraphQL as API layer
- **Rationale**: Flexible querying, reduced over-fetching, better mobile performance
- **Consequences**: Learning curve, need for GraphQL expertise

**ADR-003: Docker Compose for Deployment**
- **Decision**: Use Docker Compose instead of Kubernetes
- **Rationale**: On-premise deployment requirement, simpler operations
- **Consequences**: Limited auto-scaling, manual orchestration

**ADR-004: Prisma as ORM**
- **Decision**: Use Prisma instead of TypeORM
- **Rationale**: Better TypeScript support, type safety, migration tooling
- **Consequences**: Learning curve for team

**ADR-005: React 19 for Web CP**
- **Decision**: Use React 19 with new compiler
- **Rationale**: Automatic optimizations, better performance
- **Consequences**: Bleeding edge, potential instability

**ADR-006: Expo SDK 53 for Mobile Development**
- **Decision**: Use Expo SDK 53 (latest) instead of bare React Native
- **Rationale**: Faster development, built-in libraries, OTA updates, improved performance with React Native 0.76.5
- **Consequences**: Limited native module access, requires staying current with SDK updates

### Glossary

- **GP**: Control Panel
- **GPS**: Global Positioning System
- **Geofence**: Virtual perimeter for a real-world geographic area
- **Haversine Formula**: Method to calculate distances between GPS coordinates
- **OTA**: Over-The-Air (updates)
- **JWT**: JSON Web Token
- **HR**: Human Resources
- **CRUD**: Create, Read, Update, Delete
- **UAT**: User Acceptance Testing
- **SLA**: Service Level Agreement

---

**Document Status**: Final
**Approver**: [Project Sponsor]
**Date**: 2025-11-16
