import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlacesService } from './places.service';
import { PlacesController } from './places.controller';
import { MapboxService } from './mapbox.service';

@Module({
  imports: [ConfigModule],
  controllers: [PlacesController],
  providers: [PlacesService, MapboxService],
  exports: [PlacesService],
})
export class PlacesModule {}
