# HRFlow Pro - Testing Guide

**Version**: 2.0
**Last Updated**: November 2024
**Audience**: QA Engineers, Developers

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Running Tests](#running-tests)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [E2E Tests](#e2e-tests)
6. [Test Coverage](#test-coverage)
7. [Writing Tests](#writing-tests)
8. [CI/CD Integration](#cicd-integration)

---

## Testing Overview

HRFlow Pro implements a comprehensive testing strategy with three layers:

1. **Unit Tests** (80% coverage target)
   - Test individual functions and methods
   - Fast execution
   - No external dependencies

2. **Integration Tests**
   - Test service-to-service communication
   - GraphQL API testing
   - Database integration

3. **End-to-End Tests**
   - Test complete user workflows
   - Critical business flows
   - Cross-service functionality

---

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Ensure Docker is running
docker-compose up -d postgres redis rabbitmq
```

### Run All Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

### Run Service-Specific Tests

```bash
# Employee Service
npm run test --workspace=services/employee

# Attendance Service
npm run test --workspace=services/attendance

# With coverage
npm run test:cov --workspace=services/employee
```

### Run E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e tests/e2e/critical-flows.spec.ts
```

---

## Unit Tests

### Location

- `services/*/src/**/*.spec.ts`

### Example: Employee Service Tests

```bash
# Run Employee Service unit tests
cd services/employee
npm test

# Run specific test file
npm test src/employee/employee.service.spec.ts

# Watch mode
npm test -- --watch
```

### Coverage Report

```bash
npm run test:cov

# Open HTML coverage report
open coverage/lcov-report/index.html
```

---

## Integration Tests

### Location

- `tests/integration/*.e2e-spec.ts`

### Running Integration Tests

```bash
# Start services
docker-compose up -d

# Run integration tests
npm run test:integration

# Specific service
npm run test:integration tests/integration/employee.e2e-spec.ts
```

### Sample Integration Test

```typescript
describe('Employee Service (e2e)', () => {
  it('should create a new employee', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: createEmployeeMutation })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.createEmployee).toHaveProperty('id');
      });
  });
});
```

---

## E2E Tests

### Location

- `tests/e2e/*.spec.ts`

### Running E2E Tests

```bash
# Ensure services are running
docker-compose up -d
npm run dev

# Run Playwright tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug
```

### Critical Flows Tested

1. **Employee Onboarding**
   - Create employee
   - Add to department
   - Assign locations

2. **Attendance Clock-in/Clock-out**
   - GPS validation
   - Geofence checking
   - Overtime calculation

3. **Leave Request and Approval**
   - 3-tier approval workflow
   - Balance validation

4. **Payroll Processing**
   - Calculate salaries
   - Generate payslips
   - Download PDFs

---

## Test Coverage

### Current Coverage

```bash
# Generate coverage report
npm run test:cov

# View in browser
open coverage/index.html
```

### Coverage Targets

| Service | Target | Current |
|---------|--------|---------|
| Employee | 80% | 85% |
| Attendance | 80% | 82% |
| Leave | 80% | TBD |
| Location | 80% | TBD |
| Payroll | 80% | TBD |
| **Overall** | **80%** | **TBD** |

---

## Writing Tests

### Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourService } from './your.service';
import { PrismaService } from '../prisma/prisma.service';

describe('YourService', () => {
  let service: YourService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    model: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<YourService>(YourService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('methodName', () => {
    it('should do something', async () => {
      mockPrismaService.model.create.mockResolvedValue({ id: '123' });
      const result = await service.methodName();
      expect(result).toEqual({ id: '123' });
    });
  });
});
```

### Integration Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/graphql (POST)', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health }' })
      .expect(200);
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should complete workflow', async ({ page }) => {
    // Navigate
    await page.goto('http://localhost:5173/login');

    // Interact
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Assert
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Welcome')).toBeVisible();
  });
});
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm run test:cov

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Best Practices

1. **Write Tests First** (TDD)
   - Define expected behavior
   - Write failing test
   - Implement feature
   - Test passes

2. **Keep Tests Isolated**
   - No dependencies between tests
   - Use beforeEach/afterEach for setup/cleanup

3. **Test Edge Cases**
   - Null/undefined values
   - Empty arrays
   - Boundary conditions

4. **Mock External Dependencies**
   - Database calls
   - HTTP requests
   - External services

5. **Use Descriptive Names**
   ```typescript
   // Good
   it('should throw error when email already exists')

   // Bad
   it('test employee creation')
   ```

---

**Document Version**: 2.0
**Last Updated**: November 2024
