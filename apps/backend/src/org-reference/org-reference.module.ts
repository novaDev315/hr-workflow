import { Module } from '@nestjs/common';
import { CompanySettingsResolver } from './company-settings.resolver';
import { CompanySettingsService } from './company-settings.service';
import { DepartmentResolver } from './department.resolver';
import { DepartmentService } from './department.service';
import { DesignationResolver } from './designation.resolver';
import { DesignationService } from './designation.service';

@Module({
  providers: [
    CompanySettingsResolver,
    CompanySettingsService,
    DepartmentResolver,
    DepartmentService,
    DesignationResolver,
    DesignationService,
  ],
})
export class OrgReferenceModule {}
