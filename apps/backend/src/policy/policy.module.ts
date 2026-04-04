import { Module } from '@nestjs/common';
import { PolicyFilesController } from './policy-files.controller';
import { PolicyResolver } from './policy.resolver';
import { PolicyService } from './policy.service';

@Module({
  controllers: [PolicyFilesController],
  providers: [PolicyResolver, PolicyService],
})
export class PolicyModule {}
