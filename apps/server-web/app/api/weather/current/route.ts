import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type GeocodingResult = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type ForecastResponse = {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wet_bulb_temperature_2m?: number;
  };
};

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;

  const location = request.nextUrl.searchParams.get('location')?.trim();
  if (!location || location.length < 2) {
    return NextResponse.json({ error: 'Enter a city, town, or postal code.' }, { status: 400 });
  }

  try {
    const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocodingUrl.search = new URLSearchParams({
      name: location.slice(0, 100),
      count: '1',
      language: 'en',
      format: 'json',
    }).toString();

    const geocodingResponse = await fetch(geocodingUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!geocodingResponse.ok) throw new Error('Location lookup failed');

    const geocodingData = await geocodingResponse.json() as { results?: GeocodingResult[] };
    const match = geocodingData.results?.[0];
    if (!match) {
      return NextResponse.json({ error: 'No matching location was found.' }, { status: 404 });
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.search = new URLSearchParams({
      latitude: String(match.latitude),
      longitude: String(match.longitude),
      current: 'temperature_2m,weather_code,wet_bulb_temperature_2m',
      temperature_unit: 'fahrenheit',
      timezone: match.timezone || 'auto',
    }).toString();

    const forecastResponse = await fetch(forecastUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!forecastResponse.ok) throw new Error('Weather lookup failed');

    const forecast = await forecastResponse.json() as ForecastResponse;
    const current = forecast.current;
    if (
      !current ||
      typeof current.temperature_2m !== 'number' ||
      typeof current.wet_bulb_temperature_2m !== 'number' ||
      typeof current.weather_code !== 'number'
    ) {
      throw new Error('Weather provider returned incomplete conditions');
    }

    const locationLabel = [match.name, match.admin1 || match.country]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(', ');

    return NextResponse.json({
      weather: {
        locationLabel,
        timezone: forecast.timezone || match.timezone || 'UTC',
        temperatureF: Math.round(current.temperature_2m),
        wetBulbF: Math.round(current.wet_bulb_temperature_2m),
        description: describeWeatherCode(current.weather_code),
        weatherCode: current.weather_code,
        observedAt: new Date().toISOString(),
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Practice board weather lookup failed:', error);
    return NextResponse.json(
      { error: 'Weather is temporarily unavailable. Try again in a moment.' },
      { status: 502 }
    );
  }
}

function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorms';
  return 'Current conditions';
}
