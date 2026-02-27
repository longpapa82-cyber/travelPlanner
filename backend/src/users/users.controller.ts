import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  Res,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { t, parseLang } from '../common/i18n';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
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
  @Post('me/password')
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() body: { currentPassword: string; newPassword: string },
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = parseLang(acceptLanguage);
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException(t('password.enterBoth', lang));
    }
    if (body.newPassword.length < 8) {
      throw new BadRequestException(t('password.minLength', lang));
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(body.newPassword)) {
      throw new BadRequestException('Password must contain at least one letter and one number');
    }
    return this.usersService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
      lang,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/travel-preferences')
  async updateTravelPreferences(
    @CurrentUser('userId') userId: string,
    @Body() body: { budget?: string; travelStyle?: string; interests?: string[] },
  ) {
    return this.usersService.updateTravelPreferences(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/export')
  async exportData(
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    const data = await this.usersService.exportUserData(userId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="travelplanner-data-${new Date().toISOString().split('T')[0]}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/delete')
  async deleteAccount(
    @CurrentUser('userId') userId: string,
    @Body() dto: DeleteAccountDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    await this.usersService.remove(userId, dto.password);
    return { message: t('account.deleted', parseLang(acceptLanguage)) };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }
}
