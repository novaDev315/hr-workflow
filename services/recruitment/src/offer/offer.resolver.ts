import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { OfferService } from './offer.service';

@Resolver('JobOffer')
export class OfferResolver {
  constructor(private readonly offerService: OfferService) {}

  @Mutation()
  async createJobOffer(@Args('input') input: any) {
    return this.offerService.create(input);
  }

  @Mutation()
  async sendOffer(
    @Args('id', { type: () => ID }) id: string,
    @Args('offerLetterUrl') offerLetterUrl: string,
  ) {
    return this.offerService.send(id, offerLetterUrl);
  }

  @Mutation()
  async acceptOffer(@Args('id', { type: () => ID }) id: string) {
    return this.offerService.accept(id);
  }

  @Mutation()
  async declineOffer(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason') reason: string,
  ) {
    return this.offerService.decline(id, reason);
  }

  @Query()
  async jobOffers(@Args('filters', { nullable: true }) filters?: any) {
    return this.offerService.findAll(filters);
  }

  @Query()
  async jobOffer(@Args('id', { type: () => ID }) id: string) {
    return this.offerService.findOne(id);
  }
}
