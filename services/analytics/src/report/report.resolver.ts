import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ReportService } from './report.service';

@Resolver('Report')
export class ReportResolver {
  constructor(private readonly reportService: ReportService) {}

  @Query()
  async reports() {
    return this.reportService.findAll();
  }

  @Query()
  async report(@Args('id', { type: () => ID }) id: string) {
    return this.reportService.findOne(id);
  }

  @Mutation()
  async createReport(@Args('input') input: any) {
    return this.reportService.create(input);
  }
}
