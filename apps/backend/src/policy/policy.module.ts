import { Module } from '@nestjs/common';
import { PolicyResolver } from './policy.resolver';
import { PolicyService } from './policy.service';

@Module({
  providers: [PolicyResolver, PolicyService],
})
export class PolicyModule {}
