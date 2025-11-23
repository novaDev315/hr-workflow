import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ShiftModule } from './shift/shift.module';
import { join } from 'path';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: [join(__dirname, '**/*.graphql')],
      context: ({ req }) => ({ req }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ShiftModule,
  ],
})
export class AppModule {}
