import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TaxService } from './tax.service';

@Resolver('Tax')
export class TaxResolver {
  constructor(private readonly taxService: TaxService) {}

  @Query()
  async calculateTakeHome(
    @Args('grossSalary', { type: () => Number }) grossSalary: number,
    @Args('basicSalary', { type: () => Number }) basicSalary: number,
  ) {
    return this.taxService.calculateTakeHome(grossSalary, basicSalary);
  }

  @Query()
  async calculateTDS(
    @Args('annualIncome', { type: () => Number }) annualIncome: number,
    @Args('financialYear') financialYear: string,
  ) {
    return this.taxService.calculateTDS(annualIncome, financialYear);
  }

  @Mutation()
  async createTaxSlab(@Args('input') input: any) {
    return this.taxService.createTaxSlab(input);
  }

  @Query()
  async taxSlabs(@Args('financialYear') financialYear: string) {
    return this.taxService.getTaxSlabs(financialYear);
  }

  @Query()
  async calculateGratuity(
    @Args('lastDrawnSalary', { type: () => Number }) lastDrawnSalary: number,
    @Args('yearsOfService', { type: () => Number }) yearsOfService: number,
  ) {
    return this.taxService.calculateGratuity(lastDrawnSalary, yearsOfService);
  }
}
