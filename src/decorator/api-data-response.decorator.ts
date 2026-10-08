import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/dto/paginated-response.dto';

const envelopeOf = (inner: Record<string, unknown>) => ({
  type: 'object',
  required: ['data'],
  properties: { data: inner },
});

const envelope = <T extends Type<unknown>>(model: T, isArray: boolean) =>
  envelopeOf(
    isArray
      ? { type: 'array', items: { $ref: getSchemaPath(model) } }
      : { $ref: getSchemaPath(model) },
  );

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
      schema: envelopeOf({
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      }),
    }),
  );

export const ApiOkOneOfData = (models: Type<unknown>[], description?: string) =>
  applyDecorators(
    ApiExtraModels(...models),
    ApiOkResponse({
      description,
      schema: envelopeOf({
        oneOf: models.map((m) => ({ $ref: getSchemaPath(m) })),
      }),
    }),
  );
