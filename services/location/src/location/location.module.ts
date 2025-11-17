import { Module } from '@nestjs/common';
import { LocationService } from './location.service';
import { GeofenceModule } from '../geofence/geofence.module';

@Module({
  imports: [GeofenceModule],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
