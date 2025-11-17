import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { LeaveModule } from './leave/leave.module';
import { BalanceModule } from './balance/balance.module';
import { ApprovalModule } from './approval/approval.module';
import { CalendarModule } from './calendar/calendar.module';
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
    PrismaModule,
    LeaveModule,
    BalanceModule,
    ApprovalModule,
    CalendarModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
