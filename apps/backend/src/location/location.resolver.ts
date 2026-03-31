import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { LocationService } from './location.service';
import {
  AssignEmployeeLocationInput,
  CreateLocationInput,
  EmployeeLocationAssignmentType,
  LocationType,
} from './location.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => LocationType)
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => [LocationType], { name: 'locations' })
  async locations(
    @Args('activeOnly', { type: () => Boolean, nullable: true })
    activeOnly?: boolean,
  ) {
    return this.locationService.findAll(activeOnly ?? true);
  }

  @Query(() => LocationType, { name: 'location' })
  async location(@Args('id', { type: () => ID }) id: string) {
    return this.locationService.findOne(id);
  }

  @Mutation(() => LocationType, { name: 'createLocation' })
  async createLocation(@Args('input') input: CreateLocationInput) {
    return this.locationService.create(input);
  }

  @Mutation(() => EmployeeLocationAssignmentType, {
    name: 'assignEmployeeLocation',
  })
  async assignEmployeeLocation(
    @Args('input') input: AssignEmployeeLocationInput,
  ) {
    return this.locationService.assignEmployee(input);
  }

  @Query(() => [EmployeeLocationAssignmentType], { name: 'employeeLocations' })
  async employeeLocations(
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.locationService.getEmployeeLocations(employeeId);
  }
}
