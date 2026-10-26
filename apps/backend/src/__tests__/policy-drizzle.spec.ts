import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { access, rm } from 'fs/promises';
import path from 'path';
import request from 'supertest';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { policyDocuments as policyDocumentsTable } from '../database/drizzle/schema';
import { PolicyFilesController } from '../policy/policy-files.controller';
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
          envFilePath: ['.env', '../../.env'],
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

describe('Policy file upload and serving', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let policies: PolicyService;
  let previousStorageDir: string | undefined;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const storageDir = path.join('/tmp', `rakss-policy-files-${suffix}`);
  const adminUser: AuthenticatedUser = {
    userId: `policy-files-admin-${suffix}`,
    email: `policy.files.${suffix}@example.test`,
    roles: ['ADMIN'],
  };
  const policyIds: string[] = [];

  const newPolicy = async (label: string) => {
    const created = await policies.createPolicyDocument(adminUser, {
      title: `File Policy ${label} ${suffix}`,
      category: 'HR',
      version: '1.0',
      effectiveDate: '2026-08-01',
      description: 'Policy file serving proof',
    });
    policyIds.push(created.id);
    return created.id;
  };

  const upload = (
    policyDocumentId: string,
    fileName: string,
    mimeType: string,
    body: Buffer | string = Buffer.from('proof'),
  ) =>
    policies.uploadPolicyDocumentFile(adminUser, {
      policyDocumentId,
      fileName,
      mimeType,
      contentBase64: typeof body === 'string' ? body : body.toString('base64'),
    });

  const storedName = (documentUrl?: string | null) => documentUrl!.split('/').pop()!;

  beforeAll(async () => {
    previousStorageDir = process.env.POLICY_STORAGE_DIR;
    process.env.POLICY_STORAGE_DIR = storageDir;

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
        DatabaseModule,
      ],
      controllers: [PolicyFilesController],
      providers: [PolicyService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    database = moduleFixture.get(DatabaseService);
    policies = moduleFixture.get(PolicyService);
  });

  afterAll(async () => {
    if (database && policyIds.length) {
      await database.drizzle
        .delete(policyDocumentsTable)
        .where(inArray(policyDocumentsTable.id, policyIds));
    }

    await app?.close();
    await rm(storageDir, { recursive: true, force: true });

    if (previousStorageDir === undefined) {
      delete process.env.POLICY_STORAGE_DIR;
    } else {
      process.env.POLICY_STORAGE_DIR = previousStorageDir;
    }
  });

  it('serves a file only while its policy is PUBLISHED', async () => {
    const policyId = await newPolicy('visibility');
    const uploaded = await upload(policyId, 'handbook.pdf', 'application/pdf');
    const url = `/policy-files/${storedName(uploaded.documentUrl)}`;

    await request(app.getHttpServer()).get(url).expect(404);

    await policies.publishPolicyDocument(adminUser, { policyDocumentId: policyId });
    const response = await request(app.getHttpServer()).get(url).expect(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-disposition']).toBe("inline; filename*=UTF-8''handbook.pdf");

    await policies.archivePolicyDocument(adminUser, { policyDocumentId: policyId });
    await request(app.getHttpServer()).get(url).expect(404);
  });

  it('serves non-previewable types as attachments with the canonical content type', async () => {
    const policyId = await newPolicy('attachment');
    await policies.publishPolicyDocument(adminUser, { policyDocumentId: policyId });
    const uploaded = await upload(policyId, 'we"ird name.txt', 'text/plain');

    const response = await request(app.getHttpServer())
      .get(`/policy-files/${storedName(uploaded.documentUrl)}`)
      .expect(200);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      "attachment; filename*=UTF-8''we%22ird%20name.txt",
    );
  });

  it('rejects stored names that do not match the expected shape', async () => {
    await request(app.getHttpServer()).get('/policy-files/not-a-real-file.pdf').expect(404);
    await request(app.getHttpServer()).get('/policy-files/..%2F..%2Fetc%2Fpasswd').expect(404);
    await request(app.getHttpServer())
      .get('/policy-files/123e4567-e89b-12d3-a456-426614174000.PDF')
      .expect(404);
  });

  it('rejects disallowed extensions and mismatched or spoofed mime types', async () => {
    const policyId = await newPolicy('allowlist');

    await expect(upload(policyId, 'page.html', 'text/html')).rejects.toThrow(/must be PDF, DOC/);
    await expect(upload(policyId, 'page.svg', 'image/svg+xml')).rejects.toThrow(/must be PDF, DOC/);
    await expect(upload(policyId, 'noext', 'application/pdf')).rejects.toThrow(/must be PDF, DOC/);
    await expect(upload(policyId, 'evil.pdf', 'text/html')).rejects.toThrow(/does not match/);
    await expect(upload(policyId, 'evil.png', 'application/octet-stream')).rejects.toThrow(
      /does not match/,
    );
  });

  it('stores the canonical mime type and normalized extension, not the client values', async () => {
    const policyId = await newPolicy('canonical');
    const uploaded = await upload(policyId, 'Photo.JPEG', 'IMAGE/JPEG; charset=binary');

    expect(uploaded.documentMimeType).toBe('image/jpeg');
    expect(storedName(uploaded.documentUrl)).toMatch(/^[0-9a-f-]{36}\.jpeg$/);
  });

  it('rejects oversized base64 before decoding and invalid base64', async () => {
    const policyId = await newPolicy('size');
    const tooLarge = 'A'.repeat(13981016 + 4);

    await expect(upload(policyId, 'big.pdf', 'application/pdf', tooLarge)).rejects.toThrow(
      '10 MB or smaller',
    );
    await expect(upload(policyId, 'bad.pdf', 'application/pdf', 'not base64!!')).rejects.toThrow(
      'valid base64',
    );
  });

  it('deletes the previously stored file when it is replaced', async () => {
    const policyId = await newPolicy('replace');
    const first = await upload(policyId, 'v1.pdf', 'application/pdf', Buffer.from('one'));
    const firstPath = path.join(storageDir, storedName(first.documentUrl));
    await access(firstPath);

    const second = await upload(policyId, 'v2.png', 'image/png', Buffer.from('two'));
    await access(path.join(storageDir, storedName(second.documentUrl)));
    await expect(access(firstPath)).rejects.toThrow();
  });

  it('refuses non-http documentUrl values and allows clearing the link', async () => {
    const policyId = await newPolicy('url');

    await expect(
      policies.updatePolicyDocument(adminUser, { id: policyId, documentUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow(/http or https/);

    const set = await policies.updatePolicyDocument(adminUser, {
      id: policyId,
      documentUrl: 'https://example.test/p.pdf',
    });
    expect(set.documentUrl).toBe('https://example.test/p.pdf');

    const cleared = await policies.updatePolicyDocument(adminUser, { id: policyId, documentUrl: '' });
    expect(cleared.documentUrl).toBeNull();
  });
});
