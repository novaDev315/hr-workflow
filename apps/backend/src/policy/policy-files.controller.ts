import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PolicyService } from './policy.service';

@Controller('policy-files')
export class PolicyFilesController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(':storedFileName')
  async getPolicyFile(
    @Param('storedFileName') storedFileName: string,
    @Res() response: Response,
  ) {
    const file = await this.policyService.getStoredPolicyFile(storedFileName);

    if (!file) {
      throw new NotFoundException('Policy file not found');
    }

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${file.originalName}"`,
    );

    return response.sendFile(file.absolutePath);
  }
}
