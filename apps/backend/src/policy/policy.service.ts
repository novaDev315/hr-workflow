import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { policyDocuments as policyDocumentsTable } from '../database/drizzle/schema';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { ACCOUNT_MANAGER_ROLE_KEYS } from '../common/system-roles';
import { hasAdminPanelAccess } from '../common/access-control';
import {
  ArchivePolicyDocumentInput,
  CreatePolicyDocumentInput,
  PublishPolicyDocumentInput,
  UpdatePolicyDocumentInput,
  UploadPolicyDocumentFileInput,
} from './policy.types';

interface PolicyDocumentRow {
  id: string;
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  description: string;
  status: string;
  documentUrl: string | null;
  documentOriginalName: string | null;
  documentMimeType: string | null;
  storedFileName: string | null;
  content: string | null;
  createdAt: string;
  publishedAt: string | null;
}

@Injectable()
export class PolicyService {
  constructor(private readonly database: DatabaseService) {}

  async policyDocuments(currentUser: AuthenticatedUser) {
    const rows = await this.database.drizzle
      .select(this.policyDocumentSelectFields())
      .from(policyDocumentsTable)
      .where(
        hasAdminPanelAccess(currentUser.roles)
          ? undefined
          : eq(policyDocumentsTable.status, 'PUBLISHED'),
      )
      .orderBy(
        desc(policyDocumentsTable.effectiveDate),
        desc(policyDocumentsTable.createdAt),
      );

    return rows.map((row) => this.mapPolicyDocument(row));
  }

  async createPolicyDocument(
    currentUser: AuthenticatedUser,
    input: CreatePolicyDocumentInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);

    const status = input.status?.trim().toUpperCase() || 'DRAFT';
    if (!['DRAFT', 'PUBLISHED'].includes(status)) {
      throw new BadRequestException('Policy status must be DRAFT or PUBLISHED');
    }

    const title = input.title.trim();
    const version = input.version.trim();
    const [existing] = await this.database.drizzle
      .select({ id: policyDocumentsTable.id })
      .from(policyDocumentsTable)
      .where(
        and(
          sql`LOWER(${policyDocumentsTable.title}) = LOWER(${title})`,
          sql`LOWER(${policyDocumentsTable.version}) = LOWER(${version})`,
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('This policy title and version already exist');
    }

    const [created] = await this.database.drizzle
      .insert(policyDocumentsTable)
      .values({
        id: randomUUID(),
        title,
        category: input.category.trim(),
        version,
        effectiveDate: input.effectiveDate.trim(),
        description: input.description.trim(),
        status,
        documentUrl: input.documentUrl?.trim() ?? null,
        content: input.content?.trim() ?? null,
        publishedAt: status === 'PUBLISHED' ? sql`NOW()` : null,
      })
      .returning({ id: policyDocumentsTable.id });

    return this.findPolicyDocument(created.id);
  }

  async updatePolicyDocument(
    currentUser: AuthenticatedUser,
    input: UpdatePolicyDocumentInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);
    const existing = await this.getRawPolicyDocument(input.id);
    const title = input.title?.trim() ?? existing.title;
    const version = input.version?.trim() ?? existing.version;
    const status = input.status?.trim().toUpperCase() ?? existing.status;

    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      throw new BadRequestException('Policy status must be DRAFT, PUBLISHED, or ARCHIVED');
    }

    const [duplicate] = await this.database.drizzle
      .select({ id: policyDocumentsTable.id })
      .from(policyDocumentsTable)
      .where(
        and(
          sql`LOWER(${policyDocumentsTable.title}) = LOWER(${title})`,
          sql`LOWER(${policyDocumentsTable.version}) = LOWER(${version})`,
          ne(policyDocumentsTable.id, input.id),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictException('This policy title and version already exist');
    }

    await this.database.drizzle
      .update(policyDocumentsTable)
      .set({
        title,
        category: input.category?.trim() ?? existing.category,
        version,
        effectiveDate: input.effectiveDate?.trim() ?? existing.effectiveDate,
        description:
          input.description !== undefined
            ? input.description?.trim() || existing.description
            : existing.description,
        status,
        documentUrl:
          input.documentUrl !== undefined
            ? input.documentUrl?.trim() || null
            : existing.documentUrl,
        content:
          input.content !== undefined
            ? input.content?.trim() || null
            : existing.content,
        publishedAt:
          status === 'PUBLISHED'
            ? existing.publishedAt
              ? sql`${policyDocumentsTable.publishedAt}`
              : sql`NOW()`
            : null,
        updatedAt: sql`NOW()`,
      })
      .where(eq(policyDocumentsTable.id, input.id));

    return this.findPolicyDocument(input.id);
  }

  async publishPolicyDocument(
    currentUser: AuthenticatedUser,
    input: PublishPolicyDocumentInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);

    const [existing] = await this.database.drizzle
      .select({ id: policyDocumentsTable.id, status: policyDocumentsTable.status })
      .from(policyDocumentsTable)
      .where(eq(policyDocumentsTable.id, input.policyDocumentId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Policy document not found');
    }

    if (existing.status === 'PUBLISHED') {
      throw new BadRequestException('Policy document is already published');
    }

    await this.database.drizzle
      .update(policyDocumentsTable)
      .set({
        status: 'PUBLISHED',
        publishedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(policyDocumentsTable.id, input.policyDocumentId));

    return this.findPolicyDocument(input.policyDocumentId);
  }

  async archivePolicyDocument(
    currentUser: AuthenticatedUser,
    input: ArchivePolicyDocumentInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);
    await this.getRawPolicyDocument(input.policyDocumentId);

    await this.database.drizzle
      .update(policyDocumentsTable)
      .set({
        status: 'ARCHIVED',
        publishedAt: null,
        updatedAt: sql`NOW()`,
      })
      .where(eq(policyDocumentsTable.id, input.policyDocumentId));

    return this.findPolicyDocument(input.policyDocumentId);
  }

  async uploadPolicyDocumentFile(
    currentUser: AuthenticatedUser,
    input: UploadPolicyDocumentFileInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);

    const [existing] = await this.database.drizzle
      .select({ id: policyDocumentsTable.id })
      .from(policyDocumentsTable)
      .where(eq(policyDocumentsTable.id, input.policyDocumentId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Policy document not found');
    }

    const fileBuffer = Buffer.from(input.contentBase64, 'base64');
    if (fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded policy file cannot be empty');
    }

    if (fileBuffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Uploaded policy file must be 10 MB or smaller');
    }

    const safeOriginalName = path.basename(input.fileName.trim());
    if (!safeOriginalName) {
      throw new BadRequestException('Uploaded policy file must include a valid file name');
    }

    const extension = path.extname(safeOriginalName) || '.bin';
    const storedFileName = `${randomUUID()}${extension}`;
    const storageDir = this.getPolicyStorageDir();
    const absolutePath = path.join(storageDir, storedFileName);

    await mkdir(storageDir, { recursive: true });
    await writeFile(absolutePath, fileBuffer);

    await this.database.drizzle
      .update(policyDocumentsTable)
      .set({
        documentUrl: `${this.getBackendPublicUrl()}/policy-files/${storedFileName}`,
        documentOriginalName: safeOriginalName,
        documentMimeType: input.mimeType.trim(),
        storedFileName,
        updatedAt: sql`NOW()`,
      })
      .where(eq(policyDocumentsTable.id, input.policyDocumentId));

    return this.findPolicyDocument(input.policyDocumentId);
  }

  async getStoredPolicyFile(storedFileName: string) {
    const [file] = await this.database.drizzle
      .select({
        documentOriginalName: policyDocumentsTable.documentOriginalName,
        documentMimeType: policyDocumentsTable.documentMimeType,
        storedFileName: policyDocumentsTable.storedFileName,
      })
      .from(policyDocumentsTable)
      .where(eq(policyDocumentsTable.storedFileName, storedFileName))
      .limit(1);

    if (!file?.storedFileName) {
      return null;
    }

    return {
      originalName: file.documentOriginalName ?? file.storedFileName,
      mimeType: file.documentMimeType ?? 'application/octet-stream',
      absolutePath: path.join(this.getPolicyStorageDir(), file.storedFileName),
    };
  }

  private assertCanManagePolicies(roles: string[]) {
    const hasAccess = roles.some((role) =>
      ACCOUNT_MANAGER_ROLE_KEYS.includes(
        role as (typeof ACCOUNT_MANAGER_ROLE_KEYS)[number],
      ),
    );

    if (!hasAccess) {
      throw new ForbiddenException('Only ADMIN and HR_ADMIN accounts can manage policies');
    }
  }

  private async findPolicyDocument(id: string) {
    const row = await this.getRawPolicyDocument(id);

    return this.mapPolicyDocument(row);
  }

  private async getRawPolicyDocument(id: string) {
    const [row] = await this.database.drizzle
      .select(this.policyDocumentSelectFields())
      .from(policyDocumentsTable)
      .where(eq(policyDocumentsTable.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Policy document not found');
    }

    return row;
  }

  private policyDocumentSelectFields() {
    return {
      id: policyDocumentsTable.id,
      title: policyDocumentsTable.title,
      category: policyDocumentsTable.category,
      version: policyDocumentsTable.version,
      effectiveDate: sql<string>`${policyDocumentsTable.effectiveDate}::text`,
      description: policyDocumentsTable.description,
      status: policyDocumentsTable.status,
      documentUrl: policyDocumentsTable.documentUrl,
      documentOriginalName: policyDocumentsTable.documentOriginalName,
      documentMimeType: policyDocumentsTable.documentMimeType,
      storedFileName: policyDocumentsTable.storedFileName,
      content: policyDocumentsTable.content,
      createdAt: sql<string>`${policyDocumentsTable.createdAt}::text`,
      publishedAt: sql<string | null>`${policyDocumentsTable.publishedAt}::text`,
    };
  }

  private mapPolicyDocument(row: PolicyDocumentRow) {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      version: row.version,
      effectiveDate: row.effectiveDate,
      description: row.description,
      status: row.status,
      documentUrl: row.documentUrl,
      documentOriginalName: row.documentOriginalName,
      documentMimeType: row.documentMimeType,
      content: row.content,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    };
  }

  private getPolicyStorageDir() {
    return process.env.POLICY_STORAGE_DIR?.trim() || path.resolve(process.cwd(), 'storage/policies');
  }

  private getBackendPublicUrl() {
    const configured = process.env.BACKEND_PUBLIC_URL?.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    const port = Number(process.env.BACKEND_PORT ?? 4001);
    return `http://localhost:${port}`;
  }
}
