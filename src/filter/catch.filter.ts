import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  // Logger khai báo như một property của class, KHÔNG đặt trong constructor
  private readonly logger = new Logger(CatchEverythingFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const isHttpException = exception instanceof HttpException;
    const httpStatus = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Lỗi không phải HttpException (TypeError, lỗi DB, ...) mới cần log stack
    if (!isHttpException) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Với HttpException (400, 404, 409, ...) trả message ra để client biết sai gì.
    // Với lỗi 500 thì không lộ chi tiết nội bộ.
    let message: unknown = 'Internal server error';
    if (isHttpException) {
      const res = exception.getResponse();
      message =
        typeof res === 'string' ? res : (res as { message?: unknown }).message;
    }

    const responseBody = {
      statusCode: httpStatus,
      message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
