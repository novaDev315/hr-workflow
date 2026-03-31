import { UseGuards } from '@nestjs/common';
import { Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  AuthBootstrapStatusType,
  AccountProfileType,
  AccountSessionType,
  BootstrapAdminInput,
  CreateEmployeeAccountInput,
  LoginInput,
  ProvisionStaffAccessInput,
} from './auth.types';
import { AuthService } from './auth.service';
import { Args } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Query(() => AuthBootstrapStatusType, { name: 'authBootstrapStatus' })
  async authBootstrapStatus() {
    return this.authService.getBootstrapStatus();
  }

  @Mutation(() => AccountSessionType, { name: 'bootstrapAdmin' })
  async bootstrapAdmin(@Args('input') input: BootstrapAdminInput) {
    return this.authService.bootstrapAdmin(input);
  }

  @Mutation(() => AccountSessionType, { name: 'login' })
  async login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'logout' })
  async logout() {
    return this.authService.logout();
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => AccountSessionType, { name: 'createEmployeeAccount' })
  async createEmployeeAccount(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateEmployeeAccountInput,
  ) {
    return this.authService.createEmployeeAccount(currentUser, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => AccountProfileType, { name: 'provisionStaffAccess' })
  async provisionStaffAccess(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ProvisionStaffAccessInput,
  ) {
    return this.authService.provisionStaffAccess(currentUser, input);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => AccountProfileType, { name: 'me' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}
