import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
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
import {
  getPolicyFileType,
  POLICY_FILE_MAX_BASE64_LENGTH,
  POLICY_FILE_MAX_BYTES,
  STORED_POLICY_FILE_NAME_PATTERN,
} from './policy-file-types';

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

    const documentUrl = this.normalizeDocumentUrl(input.documentUrl);
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
        documentUrl,
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
    const documentUrl =
      input.documentUrl !== undefined
        ? this.normalizeDocumentUrl(input.documentUrl)
        : existing.documentUrl;

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
        documentUrl,
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
      .select({
        id: policyDocumentsTable.id,
        storedFileName: policyDocumentsTable.storedFileName,
      })
      .from(policyDocumentsTable)
      .where(eq(policyDocumentsTable.id, input.policyDocumentId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Policy document not found');
    }

    // Reject oversized payloads before allocating the decoded buffer.
    if (input.contentBase64.length > POLICY_FILE_MAX_BASE64_LENGTH) {
      throw new BadRequestException('Uploaded policy file must be 10 MB or smaller');
    }

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64)) {
      throw new BadRequestException('Uploaded policy file content must be valid base64');
    }

    const safeOriginalName = path.basename(input.fileName.trim());
    if (!safeOriginalName) {
      throw new BadRequestException('Uploaded policy file must include a valid file name');
    }

    const extension = path.extname(safeOriginalName).slice(1).toLowerCase();
    const fileType = getPolicyFileType(extension);
    if (!fileType) {
      throw new BadRequestException(
        'Policy files must be PDF, DOC, DOCX, TXT, PNG, or JPG',
      );
    }

    const declaredMime = input.mimeType.split(';')[0].trim().toLowerCase();
    if (declaredMime !== fileType.mimeType) {
      throw new BadRequestException(
        `File type ${declaredMime || 'unknown'} does not match the .${extension} extension`,
      );
    }

    const fileBuffer = Buffer.from(input.contentBase64, 'base64');
    if (fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded policy file cannot be empty');
    }

    if (fileBuffer.length > POLICY_FILE_MAX_BYTES) {
      throw new BadRequestException('Uploaded policy file must be 10 MB or smaller');
    }

    const storedFileName = `${randomUUID()}.${extension}`;
    const storageDir = this.getPolicyStorageDir();
    const absolutePath = path.join(storageDir, storedFileName);

    await mkdir(storageDir, { recursive: true });
    await writeFile(absolutePath, fileBuffer);

    try {
      await this.database.drizzle
        .update(policyDocumentsTable)
        .set({
          documentUrl: `${this.getBackendPublicUrl()}/policy-files/${storedFileName}`,
          documentOriginalName: safeOriginalName,
          documentMimeType: fileType.mimeType,
          storedFileName,
          updatedAt: sql`NOW()`,
        })
        .where(eq(policyDocumentsTable.id, input.policyDocumentId));
    } catch (error) {
      await this.removeStoredFile(storedFileName);
      throw error;
    }

    if (existing.storedFileName && existing.storedFileName !== storedFileName) {
      await this.removeStoredFile(existing.storedFileName);
    }

    return this.findPolicyDocument(input.policyDocumentId);
  }

  /**
   * Resolves a stored file for public download. Only files that belong to a
   * PUBLISHED policy are served; everything else is reported as missing.
   */
  async getStoredPolicyFile(storedFileName: string) {
    if (!STORED_POLICY_FILE_NAME_PATTERN.test(storedFileName)) {
      return null;
    }

    const fileType = getPolicyFileType(path.extname(storedFileName));
    if (!fileType) {
      return null;
    }

    const [file] = await this.database.drizzle
      .select({
        documentOriginalName: policyDocumentsTable.documentOriginalName,
        storedFileName: policyDocumentsTable.storedFileName,
      })
      .from(policyDocumentsTable)
      .where(
        and(
          eq(policyDocumentsTable.storedFileName, storedFileName),
          eq(policyDocumentsTable.status, 'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!file?.storedFileName) {
      return null;
    }

    return {
      originalName: file.documentOriginalName ?? file.storedFileName,
      mimeType: fileType.mimeType,
      fileType,
      absolutePath: path.join(this.getPolicyStorageDir(), file.storedFileName),
    };
  }

  private async removeStoredFile(storedFileName: string) {
    if (!STORED_POLICY_FILE_NAME_PATTERN.test(storedFileName)) {
      return;
    }

    try {
      await unlink(path.join(this.getPolicyStorageDir(), storedFileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Could not remove policy file ${storedFileName}`);
      }
    }
  }

  /** Empty clears the link; anything else must be an http(s) URL. */
  private normalizeDocumentUrl(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('documentUrl must be a valid http or https URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('documentUrl must be a valid http or https URL');
    }

    return trimmed;
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
