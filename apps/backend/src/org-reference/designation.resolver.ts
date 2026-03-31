import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateDesignationInput, DesignationType } from '../auth/auth.types';
import { DesignationService } from './designation.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';

@UseGuards(GqlAuthGuard)
@Resolver(() => DesignationType)
export class DesignationResolver {
  constructor(private readonly designationService: DesignationService) {}

  @Query(() => [DesignationType], { name: 'designations' })
  async designations(
    @Args('departmentId', { nullable: true }) departmentId?: string,
    @Args('includeInactive', { type: () => Boolean, nullable: true })
    includeInactive?: boolean,
  ) {
    return this.designationService.findAll({
      departmentId,
      includeInactive: includeInactive ?? false,
    });
  }

  @Mutation(() => DesignationType, { name: 'createDesignation' })
  async createDesignation(@Args('input') input: CreateDesignationInput) {
    return this.designationService.create(input);
  }
}
