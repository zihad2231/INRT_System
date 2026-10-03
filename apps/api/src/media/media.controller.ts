import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { OrganizationLogoService } from './organization-logo.service.js';
import { ImageBbService } from './imagebb.service.js';
import type { UploadedImageFile } from './imagebb.service.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Controller('media')
@UseGuards(SessionAuthGuard)
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly imageBb: ImageBbService,
    private readonly organizationLogo: OrganizationLogoService,
  ) {}

  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  async uploadImage(@UploadedFile() file?: UploadedImageFile) {
    this.logger.log(`POST /media/images received file: ${file?.originalname ?? 'NONE'}`);
    console.log(`[MediaController] POST /media/images received file: ${file?.originalname ?? 'NONE'}`);

    if (!file) {
      throw new BadRequestException({
        code: 'IMAGE_REQUIRED',
        message: 'Send one image in the multipart field named "image".',
      });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException({
        code: 'IMAGE_TOO_LARGE',
        message: 'Image must be 10 MB or smaller.',
      });
    }

    const result = await this.imageBb.upload(file);
    return { success: true, data: result };
  }

  @Post('organization-logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  async uploadOrganizationLogo(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    this.logger.log(
      `POST /media/organization-logo received file: ${file?.originalname ?? 'NONE'} from user: ${request.user?.id}`,
    );
    console.log(
      `[MediaController] POST /media/organization-logo received file: ${file?.originalname ?? 'NONE'} from user: ${request.user?.id}`,
    );

    if (!file) {
      throw new BadRequestException({
        code: 'IMAGE_REQUIRED',
        message: 'Send one image in the multipart field named "image".',
      });
    }
    const organization = await this.organizationLogo.upload(request.user, file);
    return { success: true, data: { organization } };
  }
}
