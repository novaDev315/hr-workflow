import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CompanySettingsType, UpsertCompanySettingsInput } from '../auth/auth.types';
import { CompanySettingsService } from './company-settings.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  assertAccountManagerAccess,
  assertAdminPanelAccess,
} from '../common/access-control';

@UseGuards(GqlAuthGuard)
@Resolver(() => CompanySettingsType)
export class CompanySettingsResolver {
  constructor(private readonly companySettingsService: CompanySettingsService) {}

  @Query(() => CompanySettingsType, {
    name: 'companySettings',
    nullable: true,
  })
  async companySettings(@CurrentUser() currentUser: AuthenticatedUser) {
    assertAdminPanelAccess(currentUser.roles);
    return this.companySettingsService.getSettings();
  }

  @Mutation(() => CompanySettingsType, { name: 'upsertCompanySettings' })
  async upsertCompanySettings(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpsertCompanySettingsInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.companySettingsService.upsertSettings(input);
  }
}
