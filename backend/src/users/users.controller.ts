import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { t, parseLang } from '../common/i18n';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @Request() req,
    @Body() body: { name?: string; profileImage?: string },
  ) {
    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.profileImage !== undefined)
      updateData.profileImage = body.profileImage;

    return this.usersService.update(req.user.userId, updateData);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/password')
  async changePassword(
    @Request() req,
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
    return this.usersService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
      lang,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteAccount(
    @Request() req,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    await this.usersService.remove(req.user.userId);
    return { message: t('account.deleted', parseLang(acceptLanguage)) };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
