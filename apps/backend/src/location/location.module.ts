import { Module } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';

@Module({
  providers: [GeofenceService, LocationResolver, LocationService],
  exports: [GeofenceService, LocationService],
})
export class LocationModule {}
