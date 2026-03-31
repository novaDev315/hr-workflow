import { UseGuards } from '@nestjs/common';
import { Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  AuthBootstrapStatusType,
  AuthPayloadType,
  AuthUserType,
  BootstrapAdminInput,
  CreateEmployeeUserInput,
  LoginInput,
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

  @Mutation(() => AuthPayloadType, { name: 'bootstrapAdmin' })
  async bootstrapAdmin(@Args('input') input: BootstrapAdminInput) {
    return this.authService.bootstrapAdmin(input);
  }

  @Mutation(() => AuthPayloadType, { name: 'login' })
  async login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'logout' })
  async logout() {
    return this.authService.logout();
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => AuthPayloadType, { name: 'createEmployeeUser' })
  async createEmployeeUser(@Args('input') input: CreateEmployeeUserInput) {
    return this.authService.createEmployeeUser(input);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => AuthUserType, { name: 'me' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}
