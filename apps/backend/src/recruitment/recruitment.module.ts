import { Module } from '@nestjs/common';
import { RecruitmentResolver } from './recruitment.resolver';
import { RecruitmentService } from './recruitment.service';

@Module({
  providers: [RecruitmentResolver, RecruitmentService],
})
export class RecruitmentModule {}
