import { UseGuards } from '@nestjs/common';
import { Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  AuthBootstrapStatusType,
  AccountProfileType,
  AccountSessionType,
  BootstrapAdminInput,
  ChangePasswordInput,
  CreateEmployeeAccountInput,
  LoginInput,
  ProvisionStaffAccessInput,
  RevokeStaffAccessInput,
} from './auth.types';
import { AuthService } from './auth.service';
import { Args } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';
import { getClientIp } from './login-rate-limiter';

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
  async login(
    @Args('input') input: LoginInput,
    @Context() context: { req?: Parameters<typeof getClientIp>[0] },
  ) {
    return this.authService.login(input, getClientIp(context?.req));
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'logout' })
  async logout(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.logout(currentUser);
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
  @Mutation(() => AccountProfileType, { name: 'revokeStaffAccess' })
  async revokeStaffAccess(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: RevokeStaffAccessInput,
  ) {
    return this.authService.revokeStaffAccess(currentUser, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => AccountSessionType, { name: 'changePassword' })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ChangePasswordInput,
  ) {
    return this.authService.changePassword(currentUser, input);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => AccountProfileType, { name: 'me' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}
