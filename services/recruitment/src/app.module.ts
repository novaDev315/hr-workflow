import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { RequisitionModule } from './requisition/requisition.module';
import { ApplicationModule } from './application/application.module';
import { InterviewModule } from './interview/interview.module';
import { OfferModule } from './offer/offer.module';
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
    EventEmitterModule.forRoot(),
    PrismaModule,
    RequisitionModule,
    ApplicationModule,
    InterviewModule,
    OfferModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
