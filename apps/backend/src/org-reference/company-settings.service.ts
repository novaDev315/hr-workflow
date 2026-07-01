import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { companySettings } from '../database/drizzle/schema';
import { UpsertCompanySettingsInput } from '../auth/auth.types';
import { randomUUID } from 'crypto';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly database: DatabaseService) {}

  async getSettings() {
    const [settings] = await this.database.drizzle
      .select(this.settingsProjection())
      .from(companySettings)
      .where(eq(companySettings.singletonKey, 'default'))
      .limit(1);

    return settings ?? null;
  }

  async upsertSettings(input: UpsertCompanySettingsInput) {
    const settings = {
      companyName: input.companyName.trim(),
      legalName: input.legalName?.trim() ?? null,
      timezone: input.timezone?.trim() ?? 'Asia/Dubai',
      currencyCode: input.currencyCode?.trim().toUpperCase() ?? 'AED',
      countryCode: input.countryCode?.trim().toUpperCase() ?? 'AE',
      supportEmail: input.supportEmail?.trim().toLowerCase() ?? null,
      supportPhone: input.supportPhone?.trim() ?? null,
    };

    const [updated] = await this.database.drizzle
      .insert(companySettings)
      .values({
        id: randomUUID(),
        singletonKey: 'default',
        ...settings,
      })
      .onConflictDoUpdate({
        target: companySettings.singletonKey,
        set: {
          ...settings,
          updatedAt: sql`NOW()`,
        },
      })
      .returning(this.settingsProjection());

    return updated;
  }

  private settingsProjection() {
    return {
      id: companySettings.id,
      companyName: companySettings.companyName,
      legalName: companySettings.legalName,
      timezone: companySettings.timezone,
      currencyCode: companySettings.currencyCode,
      countryCode: companySettings.countryCode,
      supportEmail: companySettings.supportEmail,
      supportPhone: companySettings.supportPhone,
    };
  }
}
