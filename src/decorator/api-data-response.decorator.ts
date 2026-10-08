import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/dto/paginated-response.dto';

const envelope = <T extends Type<unknown>>(model: T, isArray: boolean) => ({
  type: 'object',
  required: ['data'],
  properties: {
    data: isArray
      ? { type: 'array', items: { $ref: getSchemaPath(model) } }
      : { $ref: getSchemaPath(model) },
  },
});

export const ApiOkData = <T extends Type<unknown>>(
  model: T,
  description?: string,
  isArray = false,
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({ description, schema: envelope(model, isArray) }),
  );

export const ApiCreatedData = <T extends Type<unknown>>(
  model: T,
  description?: string,
  isArray = false,
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({ description, schema: envelope(model, isArray) }),
  );

export const ApiPaginatedData = <T extends Type<unknown>>(
  model: T,
  description?: string,
) =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            allOf: [
              { $ref: getSchemaPath(PaginatedResponseDto) },
              {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                },
              },
            ],
          },
        },
      },
    }),
  );
