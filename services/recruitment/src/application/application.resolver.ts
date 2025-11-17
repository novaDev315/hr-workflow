import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ApplicationService } from './application.service';

@Resolver('Application')
export class ApplicationResolver {
  constructor(private readonly applicationService: ApplicationService) {}

  @Mutation()
  async submitApplication(@Args('input') input: any) {
    return this.applicationService.create(input);
  }

  @Query()
  async applications(@Args('filters', { nullable: true }) filters?: any) {
    return this.applicationService.findAll(filters);
  }

  @Query()
  async application(@Args('id', { type: () => ID }) id: string) {
    return this.applicationService.findOne(id);
  }

  @Mutation()
  async screenApplication(
    @Args('id', { type: () => ID }) id: string,
    @Args('screenedBy', { type: () => ID }) screenedBy: string,
    @Args('decision') decision: 'SHORTLISTED' | 'REJECTED',
    @Args('notes', { nullable: true }) notes?: string,
    @Args('score', { nullable: true, type: () => Number }) score?: number,
  ) {
    return this.applicationService.screen(id, screenedBy, decision, notes, score);
  }

  @Query()
  async applicationStatistics(
    @Args('requisitionId', { nullable: true, type: () => ID }) requisitionId?: string,
  ) {
    return this.applicationService.getStatistics(requisitionId);
  }

  @Query()
  async searchApplications(@Args('query') query: string) {
    return this.applicationService.search(query);
  }
}
