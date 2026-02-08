import { Controller, Get, Param } from '@nestjs/common';
import { TripsService } from './trips.service';

/**
 * Public Share Controller
 * Handles public access to shared trips (no authentication required)
 */
@Controller('share')
export class ShareController {
  constructor(private readonly tripsService: TripsService) {}

  @Get(':shareToken')
  getSharedTrip(@Param('shareToken') shareToken: string) {
    return this.tripsService.getSharedTrip(shareToken);
  }
}
