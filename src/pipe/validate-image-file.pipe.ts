import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { extname } from 'path';

const ALLOWED_IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

@Injectable()
export class ValidateImageFilesPipe implements PipeTransform<
  Express.Multer.File[] | undefined,
  Promise<Express.Multer.File[] | undefined>
> {
  async transform(
    files: Express.Multer.File[] | undefined,
  ): Promise<Express.Multer.File[] | undefined> {
    if (!files?.length) return files;

    const { fileTypeFromFile } = await import('file-type');

    for (const file of files) {
      const detected = await fileTypeFromFile(file.path);
      const allowedExts = detected
        ? ALLOWED_IMAGE_TYPES[detected.mime]
        : undefined;

      if (!allowedExts?.includes(extname(file.filename).toLowerCase())) {
        throw new BadRequestException(
          `File "${file.originalname}" is not a valid .jpg, .jpeg or .png image`,
        );
      }
    }

    return files;
  }
}
