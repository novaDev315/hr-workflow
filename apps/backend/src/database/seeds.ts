import * as bcrypt from 'bcryptjs';
import { createFirstAdminAccount } from '../auth/bootstrap-admin';
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
      {
        id: 'seed-leave-unpaid',
        code: 'UNPAID',
        name: 'Unpaid Leave',
        defaultDays: 30,
        description: 'Approved time off without pay; deducted from payroll',
        isPaid: false,
        isActive: true,
      },
    ])
    .onConflictDoNothing();

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
    .onConflictDoNothing();

  await seedEnvAdmin(database);
}

/**
 * Creates the first ADMIN from HR_WORKFLOW_ADMIN_EMAIL / HR_WORKFLOW_ADMIN_PASSWORD when
 * the users table is empty. Serialized by an advisory lock, so concurrent
 * instances create exactly one account. Never touches an existing database.
 */
export async function seedEnvAdmin(
  database: AppDrizzleDatabase,
  env: Record<string, string | undefined> = process.env,
) {
  const email = env.HR_WORKFLOW_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.HR_WORKFLOW_ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  if (!email.includes('@') || password.length < 8) {
    console.warn(
      'HR_WORKFLOW_ADMIN_EMAIL/HR_WORKFLOW_ADMIN_PASSWORD ignored: a valid email and a password of at least 8 characters are required.',
    );
    return null;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await createFirstAdminAccount(database, {
    email,
    passwordHash,
    firstName: env.HR_WORKFLOW_ADMIN_FIRST_NAME?.trim() || 'System',
    lastName: env.HR_WORKFLOW_ADMIN_LAST_NAME?.trim() || 'Administrator',
  });

  if (userId) {
    console.log(`Created initial ADMIN account for ${email} from environment.`);
  }

  return userId;
}
