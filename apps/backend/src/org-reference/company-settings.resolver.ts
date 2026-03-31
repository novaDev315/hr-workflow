import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CompanySettingsType, UpsertCompanySettingsInput } from '../auth/auth.types';
import { CompanySettingsService } from './company-settings.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';

@UseGuards(GqlAuthGuard)
@Resolver(() => CompanySettingsType)
export class CompanySettingsResolver {
  constructor(private readonly companySettingsService: CompanySettingsService) {}

  @Query(() => CompanySettingsType, {
    name: 'companySettings',
    nullable: true,
  })
  async companySettings() {
    return this.companySettingsService.getSettings();
  }

  @Mutation(() => CompanySettingsType, { name: 'upsertCompanySettings' })
  async upsertCompanySettings(
    @Args('input') input: UpsertCompanySettingsInput,
  ) {
    return this.companySettingsService.upsertSettings(input);
  }
}
