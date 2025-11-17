import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose } from '@apollo/gateway';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      server: {
        cors: true,
        playground: process.env.NODE_ENV === 'development',
        introspection: true,
      },
      gateway: {
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            {
              name: 'employee',
              url: process.env.EMPLOYEE_SERVICE_URL || 'http://employee-service:3001/graphql',
            },
            {
              name: 'attendance',
              url: process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3002/graphql',
            },
            {
              name: 'leave',
              url: process.env.LEAVE_SERVICE_URL || 'http://leave-service:3003/graphql',
            },
            {
              name: 'location',
              url: process.env.LOCATION_SERVICE_URL || 'http://location-service:3004/graphql',
            },
            {
              name: 'payroll',
              url: process.env.PAYROLL_SERVICE_URL || 'http://payroll-service:3005/graphql',
            },
          ],
        }),
      },
    }),

    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
