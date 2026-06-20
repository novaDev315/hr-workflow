import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { LocationService } from './location.service';
import {
  AssignEmployeeLocationInput,
  CreateLocationInput,
  DeactivateLocationInput,
  EmployeeLocationAssignmentType,
  LocationType,
  UpdateLocationInput,
} from './location.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => LocationType)
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => [LocationType], { name: 'locations' })
  async locations(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('activeOnly', { type: () => Boolean, nullable: true })
    activeOnly?: boolean,
  ) {
    return this.locationService.findAll(currentUser, activeOnly ?? true);
  }

  @Query(() => LocationType, { name: 'location' })
  async location(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.locationService.findOne(currentUser, id);
  }

  @Mutation(() => LocationType, { name: 'createLocation' })
  async createLocation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateLocationInput,
  ) {
    return this.locationService.create(currentUser, input);
  }

  @Mutation(() => LocationType, { name: 'updateLocation' })
  async updateLocation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateLocationInput,
  ) {
    return this.locationService.update(currentUser, input);
  }

  @Mutation(() => LocationType, { name: 'deactivateLocation' })
  async deactivateLocation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: DeactivateLocationInput,
  ) {
    return this.locationService.deactivate(currentUser, input);
  }

  @Mutation(() => EmployeeLocationAssignmentType, {
    name: 'assignEmployeeLocation',
  })
  async assignEmployeeLocation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: AssignEmployeeLocationInput,
  ) {
    return this.locationService.assignEmployee(currentUser, input);
  }

  @Query(() => [EmployeeLocationAssignmentType], { name: 'employeeLocations' })
  async employeeLocations(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.locationService.getEmployeeLocations(currentUser, employeeId);
  }
}
