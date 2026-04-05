import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Headers,
  Res,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateTravelPreferencesDto } from './dto/update-travel-preferences.dto';
import { UpdateConsentsDto } from './dto/consent.dto';
import { t, parseLang } from '../common/i18n';
import { AuditService } from '../admin/audit.service';
import { AuditAction } from '../admin/entities/audit-log.entity';
import { ImageService } from '../common/image.service';
import { validateImageMagicBytes } from '../common/utils/file-validation';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly imageService: ImageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findProfileById(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const updateData: Record<string, string> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.profileImage !== undefined)
      updateData.profileImage = dto.profileImage;

    return this.usersService.update(userId, updateData);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/photo')
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'profiles');
          if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
          cb(null, `profile-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for profile photos
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadProfilePhoto(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    if (!validateImageMagicBytes(file.path)) {
      throw new BadRequestException(
        'Invalid image file: file signature does not match an allowed image format',
      );
    }
    const result = await this.imageService.processUpload(file.path, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 85,
      generateThumbnail: false,
    });
    // Update user profile with the new image URL
    await this.usersService.update(userId, {
      profileImage: result.url,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @Post('me/password')
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = parseLang(acceptLanguage);
    const result = await this.usersService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      lang,
    );
    this.auditService
      .log({ userId, action: AuditAction.PASSWORD_CHANGE })
      .catch(() => {});
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/travel-preferences')
  async updateTravelPreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateTravelPreferencesDto,
  ) {
    return this.usersService.updateTravelPreferences(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @Post('me/export')
  async exportData(
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    const data = await this.usersService.exportUserData(userId);
    this.auditService
      .log({ userId, action: AuditAction.DATA_EXPORT })
      .catch(() => {});
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="travelplanner-data-${new Date().toISOString().split('T')[0]}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 2 } })
  @Post('me/delete')
  async deleteAccount(
    @CurrentUser('userId') userId: string,
    @Body() dto: DeleteAccountDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    this.auditService
      .log({ userId, action: AuditAction.ACCOUNT_DELETE })
      .catch(() => {});
    await this.usersService.remove(userId, dto.password);
    return { message: t('account.deleted', parseLang(acceptLanguage)) };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findPublicProfile(id);
  }
}
