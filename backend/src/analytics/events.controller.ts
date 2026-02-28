import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { TrackEventsDto } from './dto/track-events.dto';
import { Request } from 'express';

@Controller('analytics')
export class EventsController {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OptionalJwtAuthGuard)
  async trackEvents(
    @Body() dto: TrackEventsDto,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    const userId = req.user?.userId;
    const events = dto.events.slice(0, 100);

    if (events.length === 0) return;

    const entities = events.map((e) =>
      this.eventRepo.create({
        name: e.name,
        platform: e.properties?.platform as string,
        properties: e.properties,
        userId,
        clientTimestamp: e.timestamp,
      }),
    );

    await this.eventRepo.save(entities).catch(() => {
      // Best-effort — don't fail the request
    });
  }
}
