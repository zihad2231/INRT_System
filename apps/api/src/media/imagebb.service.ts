import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGEBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

interface ImageBbResponse {
  success?: boolean;
  data?: { url?: string; display_url?: string };
  error?: { message?: string };
}

export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
  originalname: string;
}

@Injectable()
export class ImageBbService {
  constructor(private readonly config: ConfigService) {}

  async upload(file: UploadedImageFile): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'IMAGE_REQUIRED',
        message: 'Select an image to upload.',
      });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException({
        code: 'IMAGE_TOO_LARGE',
        message: 'Image must be 10 MB or smaller.',
      });
    }

    const detectedType = this.detectImageType(file.buffer);
    if (!detectedType) {
      throw new BadRequestException({
        code: 'INVALID_IMAGE',
        message: 'Only valid JPEG, PNG, GIF, or WebP image files are accepted.',
      });
    }

    const apiKey = this.config.get<string>('IMAGEBB_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_NOT_CONFIGURED',
        message: 'Image uploads are not configured.',
      });
    }

    const form = new FormData();
    form.append('image', file.buffer.toString('base64'));

    let response: Response;
    try {
      response = await fetch(`${IMAGEBB_UPLOAD_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException({
        code: 'IMAGE_STORAGE_UNAVAILABLE',
        message: 'The image storage provider could not be reached.',
      });
    }

    let body: ImageBbResponse;
    try {
      body = (await response.json()) as ImageBbResponse;
    } catch {
      throw new BadGatewayException({
        code: 'IMAGE_STORAGE_INVALID_RESPONSE',
        message: 'The image storage provider returned an invalid response.',
      });
    }

    const url = body.data?.url ?? body.data?.display_url;
    if (!response.ok || !body.success || !url) {
      // Never forward provider errors: the request URL contains the API key.
      throw new BadGatewayException({
        code: 'IMAGE_UPLOAD_FAILED',
        message: 'The image storage provider could not upload this image.',
      });
    }

    return { url };
  }

  private detectImageType(buffer: Buffer): string | undefined {
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer.toString('ascii', 1, 4) === 'PNG' &&
      buffer.toString('ascii', 4, 8) === '\r\n\x1a\n'
    ) {
      return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) {
      return 'image/gif';
    }
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }
    return undefined;
  }
}
