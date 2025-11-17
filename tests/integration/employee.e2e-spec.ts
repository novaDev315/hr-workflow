import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../services/employee/src/app.module';
import { PrismaService } from '../../services/employee/src/prisma/prisma.service';

describe('Employee Service (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Clean up test data
    await prismaService.employee.deleteMany({
      where: { email: { contains: '@test.com' } },
    });
  });

  describe('/graphql (POST) - Employee Queries', () => {
    it('should create a new employee', () => {
      const createEmployeeMutation = `
        mutation {
          createEmployee(input: {
            firstName: "John"
            lastName: "Doe"
            email: "john.doe@test.com"
            phone: "+1234567890"
            departmentId: "dept-123"
            designationId: "desig-123"
            employmentType: FULL_TIME
            joinDate: "2024-01-01"
          }) {
            id
            employeeNumber
            firstName
            lastName
            email
            status
          }
        }
      `;

      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: createEmployeeMutation })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.createEmployee).toHaveProperty('id');
          expect(res.body.data.createEmployee.employeeNumber).toMatch(/EMP\d{8}/);
          expect(res.body.data.createEmployee.firstName).toBe('John');
          expect(res.body.data.createEmployee.status).toBe('ACTIVE');
        });
    });

    it('should query employees with pagination', async () => {
      // Create test employees first
      await prismaService.employee.createMany({
        data: [
          {
            employeeNumber: 'EMP20240001',
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@test.com',
            departmentId: 'dept-123',
            designationId: 'desig-123',
            employmentType: 'FULL_TIME',
            joinDate: new Date('2024-01-01'),
          },
          {
            employeeNumber: 'EMP20240002',
            firstName: 'Bob',
            lastName: 'Johnson',
            email: 'bob@test.com',
            departmentId: 'dept-123',
            designationId: 'desig-123',
            employmentType: 'FULL_TIME',
            joinDate: new Date('2024-01-02'),
          },
        ],
      });

      const employeesQuery = `
        query {
          employees(pagination: { limit: 10, offset: 0 }) {
            data {
              id
              employeeNumber
              firstName
              lastName
            }
            total
            hasMore
          }
        }
      `;

      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: employeesQuery })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.employees.data.length).toBeGreaterThanOrEqual(2);
          expect(res.body.data.employees.total).toBeGreaterThanOrEqual(2);
        });
    });

    it('should search employees by name', async () => {
      await prismaService.employee.create({
        data: {
          employeeNumber: 'EMP20240003',
          firstName: 'Charlie',
          lastName: 'Brown',
          email: 'charlie@test.com',
          departmentId: 'dept-123',
          designationId: 'desig-123',
          employmentType: 'FULL_TIME',
          joinDate: new Date('2024-01-03'),
        },
      });

      const searchQuery = `
        query {
          employees(filter: { search: "Charlie" }) {
            data {
              firstName
              lastName
            }
          }
        }
      `;

      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: searchQuery })
        .expect(200)
        .expect((res) => {
          const employees = res.body.data.employees.data;
          expect(employees.some((e) => e.firstName === 'Charlie')).toBe(true);
        });
    });

    it('should update an employee', async () => {
      const employee = await prismaService.employee.create({
        data: {
          employeeNumber: 'EMP20240004',
          firstName: 'Diana',
          lastName: 'Prince',
          email: 'diana@test.com',
          departmentId: 'dept-123',
          designationId: 'desig-123',
          employmentType: 'FULL_TIME',
          joinDate: new Date('2024-01-04'),
        },
      });

      const updateMutation = `
        mutation {
          updateEmployee(
            id: "${employee.id}"
            input: { firstName: "Diana Updated" }
          ) {
            id
            firstName
          }
        }
      `;

      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: updateMutation })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.updateEmployee.firstName).toBe('Diana Updated');
        });
    });

    it('should handle duplicate email error', () => {
      const createMutation = `
        mutation {
          createEmployee(input: {
            firstName: "Duplicate"
            lastName: "User"
            email: "duplicate@test.com"
            departmentId: "dept-123"
            designationId: "desig-123"
            employmentType: FULL_TIME
            joinDate: "2024-01-01"
          }) {
            id
          }
        }
      `;

      // Create first employee
      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: createMutation })
        .then(() => {
          // Try to create duplicate
          return request(app.getHttpServer())
            .post('/graphql')
            .send({ query: createMutation })
            .expect(200)
            .expect((res) => {
              expect(res.body.errors).toBeDefined();
              expect(res.body.errors[0].message).toContain('already exists');
            });
        });
    });
  });

  describe('Health Check', () => {
    it('/health (GET) should return OK', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });
  });
});
