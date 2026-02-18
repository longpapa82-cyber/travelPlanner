import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SocialService } from './social.service';

@Controller('social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ─── Follow / Unfollow ───────────────────────

  @Post('follow/:userId')
  @Throttle({ short: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async follow(
    @CurrentUser('userId') currentUserId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.socialService.follow(currentUserId, userId);
  }

  @Delete('follow/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @CurrentUser('userId') currentUserId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.socialService.unfollow(currentUserId, userId);
  }

  @Get('followers/:userId')
  async getFollowers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.socialService.getFollowers(userId, p, l);
  }

  @Get('following/:userId')
  async getFollowing(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.socialService.getFollowing(userId, p, l);
  }

  // ─── Like / Unlike ───────────────────────────

  @Post('trips/:tripId/like')
  @Throttle({ short: { ttl: 60000, limit: 60 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async likeTrip(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
  ) {
    await this.socialService.likeTrip(userId, tripId);
  }

  @Delete('trips/:tripId/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlikeTrip(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
  ) {
    await this.socialService.unlikeTrip(userId, tripId);
  }

  // ─── Feed ────────────────────────────────────

  @Get('feed')
  async getFeed(
    @CurrentUser('userId') userId: string,
    @Query('tab') tab?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const feedTab =
      tab === 'following' || tab === 'trending' ? tab : 'trending';
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.socialService.getDiscoverFeed(userId, p, l, feedTab);
  }

  // ─── User Profile ────────────────────────────

  @Get('users/:userId/profile')
  async getUserProfile(
    @CurrentUser('userId') viewerId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.socialService.getUserProfile(viewerId, userId);
  }
}
