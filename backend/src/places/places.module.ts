import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlacesService } from './places.service';
import { PlacesController } from './places.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
