import { Injectable } from '@nestjs/common';

@Injectable()
export class GeofenceService {
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const earthRadiusInMeters = 6371e3;
    const firstLatitude = (lat1 * Math.PI) / 180;
    const secondLatitude = (lat2 * Math.PI) / 180;
    const deltaLatitude = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLongitude = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
      Math.cos(firstLatitude) *
        Math.cos(secondLatitude) *
        Math.sin(deltaLongitude / 2) *
        Math.sin(deltaLongitude / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusInMeters * c);
  }

  getGeofenceStatus(
    userLatitude: number,
    userLongitude: number,
    locationLatitude: number,
    locationLongitude: number,
    radius: number,
  ) {
    const distance = this.calculateDistance(
      userLatitude,
      userLongitude,
      locationLatitude,
      locationLongitude,
    );

    return {
      distance,
      radius,
      isWithinGeofence: distance <= radius,
      distanceFromBoundary: Math.abs(distance - radius),
    };
  }
}
