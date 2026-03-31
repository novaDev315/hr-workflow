import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCompanySettingsInput } from '../auth/auth.types';
import { randomUUID } from 'crypto';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    return this.prisma.one(
      `
        SELECT
          id,
          company_name AS "companyName",
          legal_name AS "legalName",
          timezone,
          currency_code AS "currencyCode",
          country_code AS "countryCode",
          support_email AS "supportEmail",
          support_phone AS "supportPhone"
        FROM company_settings
        WHERE singleton_key = 'default'
      `,
    );
  }

  async upsertSettings(input: UpsertCompanySettingsInput) {
    return this.prisma.one(
      `
        INSERT INTO company_settings (
          id,
          singleton_key,
          company_name,
          legal_name,
          timezone,
          currency_code,
          country_code,
          support_email,
          support_phone
        )
        VALUES ($1, 'default', $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (singleton_key)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          legal_name = EXCLUDED.legal_name,
          timezone = EXCLUDED.timezone,
          currency_code = EXCLUDED.currency_code,
          country_code = EXCLUDED.country_code,
          support_email = EXCLUDED.support_email,
          support_phone = EXCLUDED.support_phone,
          updated_at = NOW()
        RETURNING
          id,
          company_name AS "companyName",
          legal_name AS "legalName",
          timezone,
          currency_code AS "currencyCode",
          country_code AS "countryCode",
          support_email AS "supportEmail",
          support_phone AS "supportPhone"
      `,
      [
        randomUUID(),
        input.companyName.trim(),
        input.legalName?.trim() ?? null,
        input.timezone?.trim() ?? 'Asia/Dubai',
        input.currencyCode?.trim().toUpperCase() ?? 'AED',
        input.countryCode?.trim().toUpperCase() ?? 'AE',
        input.supportEmail?.trim().toLowerCase() ?? null,
        input.supportPhone?.trim() ?? null,
      ],
    );
  }
}
