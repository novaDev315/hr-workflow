import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';

import { PrismaModule } from './prisma/prisma.module';
import { LocationModule } from './location/location.module';
import { ClientModule } from './client/client.module';
import { GeofenceModule } from './geofence/geofence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      sortSchema: true,
    }),

    PrismaModule,
    LocationModule,
    ClientModule,
    GeofenceModule,
  ],
})
export class AppModule {}
