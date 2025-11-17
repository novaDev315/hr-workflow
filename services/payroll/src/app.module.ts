import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { PayrollModule } from './payroll/payroll.module';
import { SalaryModule } from './salary/salary.module';
import { TaxModule } from './tax/tax.module';
import { PayslipModule } from './payslip/payslip.module';
import { LoanModule } from './loan/loan.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'src/schema.gql'),
        federation: 2,
      },
      sortSchema: true,
      playground: true,
    }),
    HttpModule,
    PrismaModule,
    PayrollModule,
    SalaryModule,
    TaxModule,
    PayslipModule,
    LoanModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
