import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { ACCOUNT_MANAGER_ROLE_KEYS } from '../common/system-roles';
import {
  CreatePolicyDocumentInput,
  PublishPolicyDocumentInput,
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
  content: string | null;
  createdAt: string;
  publishedAt: string | null;
}

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async policyDocuments() {
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
          content,
          created_at::text AS "createdAt",
          published_at::text AS "publishedAt"
        FROM policy_documents
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

    return this.mapPolicyDocument(row);
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
      content: row.content,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    };
  }
}
