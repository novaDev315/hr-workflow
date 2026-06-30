import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrgReferenceModule } from './org-reference/org-reference.module';
import { EmployeeModule } from './employee/employee.module';
import { LocationModule } from './location/location.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PayrollModule } from './payroll/payroll.module';
import { PolicyModule } from './policy/policy.module';
import { ReportsModule } from './reports/reports.module';
import { RecruitmentModule } from './recruitment/recruitment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? ['.env.test', '../../.env.test', '.env', '../../.env']
          : ['.env', '../../.env'],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      buildSchemaOptions: {
        dateScalarMode: 'isoDate',
      },
      context: ({ req, res }) => ({ req, res }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    OrgReferenceModule,
    EmployeeModule,
    LocationModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    PolicyModule,
    ReportsModule,
    RecruitmentModule,
  ],
})
export class AppModule {}
