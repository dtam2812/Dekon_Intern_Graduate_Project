import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { unlink } from 'fs/promises';

@Catch(BadRequestException)
export class CleanupUploadedFilesFilter implements ExceptionFilter {
  async catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const files = (request.files as Express.Multer.File[]) ?? [];
    if (files.length) {
      await Promise.all(
        files.map((file) => unlink(file.path).catch(() => undefined)),
      );
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    response.status(status).json(body);
  }
}
