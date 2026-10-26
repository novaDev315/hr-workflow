import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { buildContentDisposition } from './policy-file-types';
import { PolicyService } from './policy.service';

@Controller('policy-files')
export class PolicyFilesController {
  constructor(private readonly policyService: PolicyService) {}

  /** Public download of files that belong to PUBLISHED policies only. */
  @Get(':storedFileName')
  async getPolicyFile(
    @Param('storedFileName') storedFileName: string,
    @Res() response: Response,
  ) {
    const file = await this.policyService.getStoredPolicyFile(storedFileName);

    if (!file) {
      throw new NotFoundException('Policy file not found');
    }

    response.setHeader('Content-Type', file.fileType.contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      buildContentDisposition(file.fileType, file.originalName),
    );

    return response.sendFile(file.absolutePath, { dotfiles: 'deny' }, (error) => {
      if (error && !response.headersSent) {
        response.removeHeader('Content-Disposition');
        response.status(404).json({
          statusCode: 404,
          message: 'Policy file not found',
          error: 'Not Found',
        });
      }
    });
  }
}
