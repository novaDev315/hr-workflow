import { ConfigModule } from '@nestjs/config';
import { TestingModule, Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { rm } from 'fs/promises';
import path from 'path';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { policyDocuments as policyDocumentsTable } from '../database/drizzle/schema';
import { PolicyService } from '../policy/policy.service';

jest.setTimeout(30000);

describe('Policy Drizzle migration', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let policies: PolicyService;
  let previousStorageDir: string | undefined;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const storageDir = path.join('/tmp', `rakss-policy-drizzle-${suffix}`);
  const adminUser: AuthenticatedUser = {
    userId: `policy-admin-${suffix}`,
    email: `policy.admin.${suffix}@example.test`,
    roles: ['ADMIN'],
  };
  const employeeUser: AuthenticatedUser = {
    userId: `policy-employee-${suffix}`,
    email: `policy.employee.${suffix}@example.test`,
    roles: ['EMPLOYEE'],
  };

  let policyId = '';

  beforeAll(async () => {
    previousStorageDir = process.env.POLICY_STORAGE_DIR;
    process.env.POLICY_STORAGE_DIR = storageDir;

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath:
            process.env.NODE_ENV === 'test'
              ? ['.env.test', '../../.env.test', '.env', '../../.env']
              : ['.env', '../../.env'],
        }),
        DatabaseModule,
      ],
      providers: [PolicyService],
    }).compile();

    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    policies = moduleFixture.get(PolicyService);
  });

  afterAll(async () => {
    if (database && policyId) {
      await database.drizzle
        .delete(policyDocumentsTable)
        .where(eq(policyDocumentsTable.id, policyId));
    }

    await moduleFixture?.close();
    await rm(storageDir, { recursive: true, force: true });

    if (previousStorageDir === undefined) {
      delete process.env.POLICY_STORAGE_DIR;
    } else {
      process.env.POLICY_STORAGE_DIR = previousStorageDir;
    }
  });

  it('creates, publishes, uploads, filters, and archives policies', async () => {
    const created = await policies.createPolicyDocument(adminUser, {
      title: `Drizzle Policy ${suffix}`,
      category: 'HR',
      version: '1.0',
      effectiveDate: '2026-08-01',
      description: 'Created by policy Drizzle proof',
      content: 'Initial policy content',
      status: 'DRAFT',
    });

    policyId = created.id;
    expect(created.status).toBe('DRAFT');
    expect(created.publishedAt).toBeNull();

    await expect(
      policies.createPolicyDocument(adminUser, {
        title: `drizzle policy ${suffix}`,
        category: 'HR',
        version: '1.0',
        effectiveDate: '2026-08-01',
        description: 'Duplicate policy content',
      }),
    ).rejects.toThrow('This policy title and version already exist');

    const updated = await policies.updatePolicyDocument(adminUser, {
      id: policyId,
      description: 'Updated by policy Drizzle proof',
      documentUrl: 'https://example.test/policy.pdf',
    });

    expect(updated.description).toBe('Updated by policy Drizzle proof');
    expect(updated.documentUrl).toBe('https://example.test/policy.pdf');

    const published = await policies.publishPolicyDocument(adminUser, {
      policyDocumentId: policyId,
    });

    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeTruthy();

    const employeeVisible = await policies.policyDocuments(employeeUser);
    expect(employeeVisible.map((policy) => policy.id)).toContain(policyId);

    const uploaded = await policies.uploadPolicyDocumentFile(adminUser, {
      policyDocumentId: policyId,
      fileName: 'employee-handbook.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('policy file proof').toString('base64'),
    });

    expect(uploaded.documentOriginalName).toBe('employee-handbook.pdf');
    expect(uploaded.documentMimeType).toBe('application/pdf');
    expect(uploaded.documentUrl).toContain('/policy-files/');

    const storedFileName = uploaded.documentUrl?.split('/').pop();
    expect(storedFileName).toBeTruthy();

    const storedFile = await policies.getStoredPolicyFile(storedFileName!);
    expect(storedFile?.originalName).toBe('employee-handbook.pdf');
    expect(storedFile?.mimeType).toBe('application/pdf');

    const archived = await policies.archivePolicyDocument(adminUser, {
      policyDocumentId: policyId,
    });

    expect(archived.status).toBe('ARCHIVED');
    expect(archived.publishedAt).toBeNull();

    const employeeHidden = await policies.policyDocuments(employeeUser);
    expect(employeeHidden.map((policy) => policy.id)).not.toContain(policyId);
  });
});
