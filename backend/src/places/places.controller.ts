import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlacesService } from './places.service';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('autocomplete')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async autocomplete(
    @Query('input') input: string,
    @Query('sessionToken') sessionToken?: string,
    @Query('language') language?: string,
  ) {
    return this.placesService.autocomplete(
      input,
      sessionToken,
      language || 'en',
    );
  }
}
