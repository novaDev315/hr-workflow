import type { AppDrizzleDatabase } from './database.service';
import { leaveTypes, policyDocuments } from './drizzle/schema';

export async function seedDatabase(database: AppDrizzleDatabase) {
  await database
    .insert(leaveTypes)
    .values([
      {
        id: 'seed-leave-casual',
        code: 'CASUAL',
        name: 'Casual Leave',
        defaultDays: 12,
        description: 'General personal leave allowance',
        isActive: true,
      },
      {
        id: 'seed-leave-sick',
        code: 'SICK',
        name: 'Sick Leave',
        defaultDays: 12,
        description: 'Leave allowance for illness and recovery',
        isActive: true,
      },
      {
        id: 'seed-leave-earned',
        code: 'EARNED',
        name: 'Earned Leave',
        defaultDays: 18,
        description: 'Accrued annual leave allowance',
        isActive: true,
      },
    ])
    .onConflictDoNothing({ target: leaveTypes.code });

  await database
    .insert(policyDocuments)
    .values([
      {
        id: 'seed-policy-handbook',
        title: 'Employee Handbook',
        category: 'Handbook',
        version: '2.0',
        effectiveDate: '2024-01-01',
        description: 'Complete guide for employees and company expectations',
        status: 'PUBLISHED',
        documentUrl: null,
        content:
          'Welcome to the company. This handbook covers conduct, attendance, leave, payroll, and workplace expectations.',
        publishedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 'seed-policy-leave',
        title: 'Leave Policy',
        category: 'Leave Policy',
        version: '1.5',
        effectiveDate: '2024-01-01',
        description:
          'Leave types, balances, approval workflow, and employee responsibilities',
        status: 'PUBLISHED',
        documentUrl: null,
        content:
          'Employees must request leave through the HR system. Managers and HR approve leave based on policy and staffing needs.',
        publishedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 'seed-policy-security',
        title: 'IT Security Policy',
        category: 'IT Policy',
        version: '2.1',
        effectiveDate: '2024-03-01',
        description: 'Security, password hygiene, and acceptable use requirements',
        status: 'PUBLISHED',
        documentUrl: null,
        content:
          'Employees must safeguard credentials, use approved devices, and report security incidents immediately.',
        publishedAt: new Date('2024-03-01T00:00:00.000Z'),
      },
    ])
    .onConflictDoNothing({
      target: [policyDocuments.title, policyDocuments.version],
    });
}
