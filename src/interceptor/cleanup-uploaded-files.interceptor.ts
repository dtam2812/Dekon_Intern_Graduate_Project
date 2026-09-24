import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { unlink } from 'fs/promises';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class CleanupUploadedFilesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      catchError(async (error: unknown) => {
        await this.removeUploadedFiles(request);
        throw error;
      }),
    );
  }

  private async removeUploadedFiles(request: Request): Promise<void> {
    const uploaded: Express.Multer.File[] = [];

    if (request.file) uploaded.push(request.file);
    if (Array.isArray(request.files)) {
      uploaded.push(...request.files);
    } else if (request.files) {
      uploaded.push(...Object.values(request.files).flat());
    }

    await Promise.all(
      uploaded
        .filter((file) => file.path)
        .map((file) => unlink(file.path).catch(() => undefined)),
    );
  }
}
