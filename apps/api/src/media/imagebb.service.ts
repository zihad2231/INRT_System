import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(ImageBbService.name);

  constructor(private readonly config: ConfigService) {}

  async upload(file: UploadedImageFile): Promise<{ url: string }> {
    this.logger.log(`[Backend Upload Step 1/4] Processing image file: "${file?.originalname}", size=${file?.size} bytes`);
    console.log(`[Backend Upload Step 1/4] Processing image file: "${file?.originalname}", size=${file?.size} bytes`);

    if (!file?.buffer?.length) {
      this.logger.error('[Backend Upload Error] No image buffer provided');
      console.error('[Backend Upload Error] No image buffer provided');
      throw new BadRequestException({
        code: 'IMAGE_REQUIRED',
        message: 'Select an image to upload.',
      });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      this.logger.error(`[Backend Upload Error] File size ${file.size} exceeds maximum ${MAX_IMAGE_BYTES} bytes`);
      console.error(`[Backend Upload Error] File size ${file.size} exceeds maximum ${MAX_IMAGE_BYTES} bytes`);
      throw new PayloadTooLargeException({
        code: 'IMAGE_TOO_LARGE',
        message: 'Image must be 10 MB or smaller.',
      });
    }

    const detectedType = this.detectImageType(file.buffer);
    this.logger.log(`[Backend Upload Step 2/4] Detected MIME type: ${detectedType || 'UNKNOWN'}`);
    console.log(`[Backend Upload Step 2/4] Detected MIME type: ${detectedType || 'UNKNOWN'}`);

    if (!detectedType) {
      this.logger.error('[Backend Upload Error] File signature does not match JPEG, PNG, GIF, or WebP');
      console.error('[Backend Upload Error] File signature does not match JPEG, PNG, GIF, or WebP');
      throw new BadRequestException({
        code: 'INVALID_IMAGE',
        message: 'Only valid JPEG, PNG, GIF, or WebP image files are accepted.',
      });
    }

    const apiKey = this.config.get<string>('IMAGEBB_API_KEY');
    this.logger.log(`[Backend Upload Step 3/4] Checking IMAGEBB_API_KEY: ${apiKey ? 'KEY_FOUND' : 'NOT_CONFIGURED'}`);
    console.log(`[Backend Upload Step 3/4] Checking IMAGEBB_API_KEY: ${apiKey ? 'KEY_FOUND' : 'NOT_CONFIGURED'}`);

    if (!apiKey) {
      this.logger.error(
        '[Backend Upload Error] IMAGEBB_API_KEY environment variable is not configured on server! Image upload to ImgBB cannot proceed.',
      );
      console.error(
        '[Backend Upload Error] IMAGEBB_API_KEY environment variable is not configured on server! Image upload to ImgBB cannot proceed.',
      );
      throw new ServiceUnavailableException({
        code: 'IMAGE_STORAGE_NOT_CONFIGURED',
        message: 'Image uploads are not configured on the server. Please add IMAGEBB_API_KEY environment variable in Render/host settings.',
      });
    }

    const form = new FormData();
    form.append('image', file.buffer.toString('base64'));

    this.logger.log(`[Backend Upload Step 4/4] Uploading to ImgBB API (${IMAGEBB_UPLOAD_URL})...`);
    console.log(`[Backend Upload Step 4/4] Uploading to ImgBB API (${IMAGEBB_UPLOAD_URL})...`);

    let response: Response | undefined;
    try {
      response = await fetch(`${IMAGEBB_UPLOAD_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (networkErr) {
      this.logger.warn(`[Backend Upload Warning] Fetch to ImgBB failed: ${networkErr}. Falling back to Base64 Data URL.`);
      console.warn(`[Backend Upload Warning] Fetch to ImgBB failed: ${networkErr}. Falling back to Base64 Data URL.`);
      const dataUrl = `data:${detectedType};base64,${file.buffer.toString('base64')}`;
      return { url: dataUrl };
    }

    let body: ImageBbResponse | null = null;
    try {
      body = (await response.json()) as ImageBbResponse;
    } catch (parseErr) {
      this.logger.warn(`[Backend Upload Warning] Could not parse ImgBB response JSON: ${parseErr}. Falling back to Base64 Data URL.`);
      console.warn(`[Backend Upload Warning] Could not parse ImgBB response JSON: ${parseErr}. Falling back to Base64 Data URL.`);
      const dataUrl = `data:${detectedType};base64,${file.buffer.toString('base64')}`;
      return { url: dataUrl };
    }

    const url = body?.data?.url ?? body?.data?.display_url;
    if (!response.ok || !body?.success || !url) {
      this.logger.warn(`[Backend Upload Warning] ImgBB returned unsuccessful response: status=${response.status}, error=${body?.error?.message}. Falling back to Base64 Data URL.`);
      console.warn(`[Backend Upload Warning] ImgBB returned unsuccessful response: status=${response.status}, error=${body?.error?.message}. Falling back to Base64 Data URL.`);
      const dataUrl = `data:${detectedType};base64,${file.buffer.toString('base64')}`;
      return { url: dataUrl };
    }

    this.logger.log(`[Backend Upload Success] Image uploaded successfully to ImgBB: ${url}`);
    console.log(`[Backend Upload Success] Image uploaded successfully to ImgBB: ${url}`);
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
