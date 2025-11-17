import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { RequisitionService } from './requisition.service';

@Resolver('JobRequisition')
export class RequisitionResolver {
  constructor(private readonly requisitionService: RequisitionService) {}

  @Mutation()
  async createRequisition(@Args('input') input: any) {
    return this.requisitionService.create(input);
  }

  @Query()
  async jobRequisitions(@Args('filters', { nullable: true }) filters?: any) {
    return this.requisitionService.findAll(filters);
  }

  @Query()
  async activeJobOpenings() {
    return this.requisitionService.getActiveOpenings();
  }

  @Query()
  async jobRequisition(@Args('id', { type: () => ID }) id: string) {
    return this.requisitionService.findOne(id);
  }

  @Mutation()
  async approveRequisition(
    @Args('id', { type: () => ID }) id: string,
    @Args('approvedBy', { type: () => ID }) approvedBy: string,
  ) {
    return this.requisitionService.approve(id, approvedBy);
  }

  @Mutation()
  async activateRequisition(@Args('id', { type: () => ID }) id: string) {
    return this.requisitionService.activate(id);
  }

  @Query()
  async requisitionStatistics() {
    return this.requisitionService.getStatistics();
  }
}
