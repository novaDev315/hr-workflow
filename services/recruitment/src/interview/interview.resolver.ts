import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { InterviewService } from './interview.service';

@Resolver('Interview')
export class InterviewResolver {
  constructor(private readonly interviewService: InterviewService) {}

  @Mutation()
  async scheduleInterview(@Args('input') input: any) {
    return this.interviewService.schedule(input);
  }

  @Query()
  async interviews(@Args('filters', { nullable: true }) filters?: any) {
    return this.interviewService.findAll(filters);
  }

  @Query()
  async interview(@Args('id', { type: () => ID }) id: string) {
    return this.interviewService.findOne(id);
  }

  @Mutation()
  async submitInterviewFeedback(
    @Args('id', { type: () => ID }) id: string,
    @Args('feedback') feedback: any,
  ) {
    return this.interviewService.submitFeedback(id, feedback);
  }
}
