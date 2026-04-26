import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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

  // V178 (Issue 2): the previous `@Res()` + `res.send(JSON.stringify(...))`
  // shape made axios deserialize the body as a raw string instead of a
  // parsed object, so the client then JSON.stringify'd it again and
  // produced a doubly-quoted file. Worse, the client's expo-file-system
  // dynamic import was failing in production because the module was not a
  // direct dependency. Returning a plain object lets NestJS's
  // ClassSerializerInterceptor handle serialization and lets axios parse
  // the response into the same shape the web/native code paths consume.
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @Post('me/export')
  async exportData(@CurrentUser('userId') userId: string) {
    const data = await this.usersService.exportUserData(userId);
    this.auditService
      .log({ userId, action: AuditAction.DATA_EXPORT })
      .catch(() => {});
    return data;
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

  /**
   * Consent Management Endpoints - Phase 0b
   * NOTE: Must be declared BEFORE @Get(':id') to prevent route shadowing
   */

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @Get('me/consents')
  async getConsents(@CurrentUser('userId') userId: string) {
    return this.usersService.getConsentsStatus(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Post('me/consents')
  async updateConsents(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateConsentsDto,
    @Headers('x-forwarded-for') xForwardedFor?: string,
    @Headers('x-real-ip') xRealIp?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress = xForwardedFor?.split(',')[0]?.trim() || xRealIp;
    await this.usersService.updateConsents(userId, dto, ipAddress, userAgent);
    return { message: 'Consents updated successfully' };
  }

  // GDPR Art.7(3): dedicated withdrawal endpoint so revocation is as easy as granting.
  // Revokes all optional (non-required) consents in a single call.
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Delete('me/consents/optional')
  async revokeOptionalConsents(
    @CurrentUser('userId') userId: string,
    @Headers('x-forwarded-for') xForwardedFor?: string,
    @Headers('x-real-ip') xRealIp?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress = xForwardedFor?.split(',')[0]?.trim() || xRealIp;
    await this.usersService.revokeOptionalConsents(userId, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findPublicProfile(id);
  }
}
