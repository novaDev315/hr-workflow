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
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async policyDocuments(currentUser: AuthenticatedUser) {
    const rows = await this.prisma.many<PolicyDocumentRow>(
      `
        SELECT
          id,
          title,
          category,
          version,
          effective_date::text AS "effectiveDate",
          description,
          status,
          document_url AS "documentUrl",
          document_original_name AS "documentOriginalName",
          document_mime_type AS "documentMimeType",
          stored_file_name AS "storedFileName",
          content,
          created_at::text AS "createdAt",
          published_at::text AS "publishedAt"
        FROM policy_documents
        ${hasAdminPanelAccess(currentUser.roles) ? '' : `WHERE status = 'PUBLISHED'`}
        ORDER BY effective_date DESC, created_at DESC
      `,
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
    const existing = await this.prisma.one<{ id: string }>(
      `
        SELECT id
        FROM policy_documents
        WHERE LOWER(title) = LOWER($1) AND LOWER(version) = LOWER($2)
      `,
      [title, version],
    );

    if (existing) {
      throw new ConflictException('This policy title and version already exist');
    }

    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO policy_documents (
          id,
          title,
          category,
          version,
          effective_date,
          description,
          status,
          document_url,
          content,
          published_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        randomUUID(),
        title,
        input.category.trim(),
        version,
        input.effectiveDate.trim(),
        input.description.trim(),
        status,
        input.documentUrl?.trim() ?? null,
        input.content?.trim() ?? null,
        status === 'PUBLISHED' ? new Date().toISOString() : null,
      ],
    );

    return this.findPolicyDocument(created!.id);
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

    const duplicate = await this.prisma.one<{ id: string }>(
      `
        SELECT id
        FROM policy_documents
        WHERE LOWER(title) = LOWER($1) AND LOWER(version) = LOWER($2) AND id <> $3
      `,
      [title, version, input.id],
    );

    if (duplicate) {
      throw new ConflictException('This policy title and version already exist');
    }

    await this.prisma.query(
      `
        UPDATE policy_documents
        SET
          title = $2,
          category = $3,
          version = $4,
          effective_date = $5,
          description = $6,
          status = $7,
          document_url = $8,
          content = $9,
          published_at = CASE
            WHEN $7 = 'PUBLISHED' AND published_at IS NULL THEN NOW()
            WHEN $7 <> 'PUBLISHED' THEN NULL
            ELSE published_at
          END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        title,
        input.category?.trim() ?? existing.category,
        version,
        input.effectiveDate?.trim() ?? existing.effectiveDate,
        input.description !== undefined
          ? input.description?.trim() || existing.description
          : existing.description,
        status,
        input.documentUrl !== undefined
          ? input.documentUrl?.trim() || null
          : existing.documentUrl,
        input.content !== undefined ? input.content?.trim() || null : existing.content,
      ],
    );

    return this.findPolicyDocument(input.id);
  }

  async publishPolicyDocument(
    currentUser: AuthenticatedUser,
    input: PublishPolicyDocumentInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);

    const existing = await this.prisma.one<{ id: string; status: string }>(
      `SELECT id, status FROM policy_documents WHERE id = $1`,
      [input.policyDocumentId],
    );

    if (!existing) {
      throw new NotFoundException('Policy document not found');
    }

    if (existing.status === 'PUBLISHED') {
      throw new BadRequestException('Policy document is already published');
    }

    await this.prisma.query(
      `
        UPDATE policy_documents
        SET
          status = 'PUBLISHED',
          published_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [input.policyDocumentId],
    );

    return this.findPolicyDocument(input.policyDocumentId);
  }

  async archivePolicyDocument(
    currentUser: AuthenticatedUser,
    input: ArchivePolicyDocumentInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);
    await this.getRawPolicyDocument(input.policyDocumentId);

    await this.prisma.query(
      `
        UPDATE policy_documents
        SET
          status = 'ARCHIVED',
          published_at = NULL,
          updated_at = NOW()
        WHERE id = $1
      `,
      [input.policyDocumentId],
    );

    return this.findPolicyDocument(input.policyDocumentId);
  }

  async uploadPolicyDocumentFile(
    currentUser: AuthenticatedUser,
    input: UploadPolicyDocumentFileInput,
  ) {
    this.assertCanManagePolicies(currentUser.roles);

    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM policy_documents WHERE id = $1`,
      [input.policyDocumentId],
    );

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

    await this.prisma.query(
      `
        UPDATE policy_documents
        SET
          document_url = $2,
          document_original_name = $3,
          document_mime_type = $4,
          stored_file_name = $5,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.policyDocumentId,
        `${this.getBackendPublicUrl()}/policy-files/${storedFileName}`,
        safeOriginalName,
        input.mimeType.trim(),
        storedFileName,
      ],
    );

    return this.findPolicyDocument(input.policyDocumentId);
  }

  async getStoredPolicyFile(storedFileName: string) {
    const file = await this.prisma.one<{
      documentOriginalName: string | null;
      documentMimeType: string | null;
      storedFileName: string | null;
    }>(
      `
        SELECT
          document_original_name AS "documentOriginalName",
          document_mime_type AS "documentMimeType",
          stored_file_name AS "storedFileName"
        FROM policy_documents
        WHERE stored_file_name = $1
      `,
      [storedFileName],
    );

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
    const row = await this.prisma.one<PolicyDocumentRow>(
      `
        SELECT
          id,
          title,
          category,
          version,
          effective_date::text AS "effectiveDate",
          description,
          status,
          document_url AS "documentUrl",
          document_original_name AS "documentOriginalName",
          document_mime_type AS "documentMimeType",
          stored_file_name AS "storedFileName",
          content,
          created_at::text AS "createdAt",
          published_at::text AS "publishedAt"
        FROM policy_documents
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Policy document not found');
    }

    return row;
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
