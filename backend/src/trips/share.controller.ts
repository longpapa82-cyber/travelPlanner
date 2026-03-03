import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TripsService } from './trips.service';

/**
 * Public Share Controller
 * Handles public access to shared trips (no authentication required)
 */
@Controller('share')
export class ShareController {
  constructor(private readonly tripsService: TripsService) {}

  @Get(':shareToken')
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  getSharedTrip(@Param('shareToken') shareToken: string) {
    if (!shareToken || !/^[a-f0-9]{32}$/.test(shareToken)) {
      throw new BadRequestException('Invalid share token format');
    }
    return this.tripsService.getSharedTrip(shareToken);
  }
}
