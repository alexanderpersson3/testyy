import axios from 'axios';
import logger from '../utils/logger.js';

interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  coordinates?: [number, number];
}

export async function getLocationFromIP(ip: string): Promise<GeoLocation> {
  try {
    // Using ipapi.co as an example. In production, use a paid service with better reliability
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const data = response.data;

    return {
      country: data.country_name,
      region: data.region,
      city: data.city,
      coordinates: [data.latitude, data.longitude],
    };
  } catch (error) {
    logger.error('Failed to get location from IP:', error);
    return {};
  }
}

export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;

  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isLocationAllowed(
  location: GeoLocation,
  allowedCountries?: string[],
  blockedCountries?: string[]
): boolean {
  if (!location.country) return true;

  if (blockedCountries?.includes(location.country)) {
    return false;
  }

  if (allowedCountries?.length && !allowedCountries.includes(location.country)) {
    return false;
  }

  return true;
}
