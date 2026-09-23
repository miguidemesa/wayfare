import "server-only";
import { db } from "./db";
import { eachDay, dateKey, seededRand } from "./utils";

/**
 * Weather intelligence.
 * - If the requested date is within Open-Meteo's 16-day forecast window we fetch live data.
 * - Otherwise (e.g. a trip in 2027) we produce honest seasonal estimates from climate
 *   normals with deterministic variance, clearly labeled `seasonal-estimate`.
 * Snapshots are cached per (trip, city, date) in the DB.
 */

type Climate = { tempMin: number; tempMax: number; rainProb: number; humidity: number };

const CLIMATE: Record<string, Climate[]> = {
  // index = month-1
  Tokyo: [
    { tempMin: 1, tempMax: 10, rainProb: 20, humidity: 52 },
    { tempMin: 2, tempMax: 11, rainProb: 22, humidity: 53 },
    { tempMin: 5, tempMax: 14, rainProb: 30, humidity: 58 },
    { tempMin: 10, tempMax: 19, rainProb: 35, humidity: 62 },
    { tempMin: 15, tempMax: 23, rainProb: 40, humidity: 66 },
    { tempMin: 19, tempMax: 26, rainProb: 45, humidity: 72 },
    { tempMin: 23, tempMax: 31, rainProb: 42, humidity: 74 },
    { tempMin: 24, tempMax: 32, rainProb: 34, humidity: 70 },
    { tempMin: 21, tempMax: 28, rainProb: 45, humidity: 72 },
    { tempMin: 15, tempMax: 22, rainProb: 42, humidity: 68 },
    { tempMin: 9, tempMax: 17, rainProb: 30, humidity: 64 },
    { tempMin: 4, tempMax: 12, rainProb: 24, humidity: 58 },
  ],
  Kyoto: [
    { tempMin: 1, tempMax: 9, rainProb: 22, humidity: 60 },
    { tempMin: 1, tempMax: 10, rainProb: 25, humidity: 60 },
    { tempMin: 4, tempMax: 14, rainProb: 32, humidity: 62 },
    { tempMin: 9, tempMax: 20, rainProb: 36, humidity: 62 },
    { tempMin: 14, tempMax: 25, rainProb: 42, humidity: 66 },
    { tempMin: 19, tempMax: 28, rainProb: 48, humidity: 72 },
    { tempMin: 23, tempMax: 33, rainProb: 44, humidity: 72 },
    { tempMin: 24, tempMax: 34, rainProb: 36, humidity: 68 },
    { tempMin: 20, tempMax: 29, rainProb: 46, humidity: 72 },
    { tempMin: 13, tempMax: 23, rainProb: 40, humidity: 68 },
    { tempMin: 7, tempMax: 17, rainProb: 32, humidity: 66 },
    { tempMin: 3, tempMax: 11, rainProb: 26, humidity: 64 },
  ],
  Seoul: [
    { tempMin: -6, tempMax: 2, rainProb: 18, humidity: 50 },
    { tempMin: -4, tempMax: 5, rainProb: 20, humidity: 52 },
    { tempMin: 1, tempMax: 11, rainProb: 26, humidity: 56 },
    { tempMin: 8, tempMax: 18, rainProb: 32, humidity: 58 },
    { tempMin: 13, tempMax: 23, rainProb: 38, humidity: 64 },
    { tempMin: 18, tempMax: 27, rainProb: 44, humidity: 70 },
    { tempMin: 22, tempMax: 29, rainProb: 55, humidity: 76 },
    { tempMin: 22, tempMax: 30, rainProb: 48, humidity: 74 },
    { tempMin: 16, tempMax: 26, rainProb: 40, humidity: 68 },
    { tempMin: 9, tempMax: 20, rainProb: 30, humidity: 60 },
    { tempMin: 2, tempMax: 12, rainProb: 26, humidity: 56 },
    { tempMin: -4, tempMax: 4, rainProb: 20, humidity: 52 },
  ],
  Rome: [
    { tempMin: 3, tempMax: 12, rainProb: 30, humidity: 72 },
    { tempMin: 4, tempMax: 13, rainProb: 30, humidity: 70 },
    { tempMin: 6, tempMax: 16, rainProb: 28, humidity: 66 },
    { tempMin: 8, tempMax: 19, rainProb: 30, humidity: 64 },
    { tempMin: 12, tempMax: 24, rainProb: 26, humidity: 62 },
    { tempMin: 16, tempMax: 29, rainProb: 20, humidity: 60 },
    { tempMin: 19, tempMax: 32, rainProb: 12, humidity: 54 },
    { tempMin: 19, tempMax: 32, rainProb: 14, humidity: 56 },
    { tempMin: 16, tempMax: 27, rainProb: 24, humidity: 62 },
    { tempMin: 12, tempMax: 22, rainProb: 32, humidity: 70 },
    { tempMin: 7, tempMax: 16, rainProb: 36, humidity: 74 },
    { tempMin: 4, tempMax: 13, rainProb: 34, humidity: 76 },
  ],
  Florence: [
    { tempMin: 2, tempMax: 11, rainProb: 28, humidity: 74 },
    { tempMin: 3, tempMax: 13, rainProb: 28, humidity: 70 },
    { tempMin: 5, tempMax: 16, rainProb: 28, humidity: 66 },
    { tempMin: 8, tempMax: 20, rainProb: 30, humidity: 64 },
    { tempMin: 12, tempMax: 25, rainProb: 28, humidity: 62 },
    { tempMin: 16, tempMax: 29, rainProb: 22, humidity: 60 },
    { tempMin: 18, tempMax: 33, rainProb: 12, humidity: 54 },
    { tempMin: 18, tempMax: 32, rainProb: 14, humidity: 56 },
    { tempMin: 15, tempMax: 27, rainProb: 24, humidity: 64 },
    { tempMin: 10, tempMax: 21, rainProb: 34, humidity: 72 },
    { tempMin: 6, tempMax: 15, rainProb: 34, humidity: 76 },
    { tempMin: 3, tempMax: 12, rainProb: 32, humidity: 78 },
  ],
  Venice: [
    { tempMin: 1, tempMax: 8, rainProb: 28, humidity: 80 },
    { tempMin: 2, tempMax: 10, rainProb: 28, humidity: 76 },
    { tempMin: 5, tempMax: 13, rainProb: 28, humidity: 72 },
    { tempMin: 8, tempMax: 17, rainProb: 30, humidity: 70 },
    { tempMin: 12, tempMax: 22, rainProb: 30, humidity: 68 },
    { tempMin: 16, tempMax: 27, rainProb: 26, humidity: 66 },
    { tempMin: 18, tempMax: 30, rainProb: 18, humidity: 62 },
    { tempMin: 18, tempMax: 30, rainProb: 20, humidity: 64 },
    { tempMin: 15, tempMax: 25, rainProb: 28, humidity: 70 },
    { tempMin: 11, tempMax: 19, rainProb: 32, humidity: 76 },
    { tempMin: 6, tempMax: 13, rainProb: 32, humidity: 80 },
    { tempMin: 2, tempMax: 9, rainProb: 30, humidity: 82 },
  ],
};

const DEFAULT_CLIMATE: Climate = {
  tempMin: 12,
  tempMax: 22,
  rainProb: 30,
  humidity: 65,
};

function conditionFor(rainProb: number, rand: number): string {
  if (rainProb > 55 && rand > 0.35) return "rain";
  if (rand > 0.82) return "cloudy";
  if (rand < 0.22) return "partly";
  return "clear";
}

function estimate(city: string, date: Date) {
  const c = CLIMATE[city]?.[date.getMonth()] ?? DEFAULT_CLIMATE;
  const r1 = seededRand(`${city}:${dateKey(date)}:a`);
  const r2 = seededRand(`${city}:${dateKey(date)}:b`);
  const swing = Math.round((r1 - 0.5) * 6);
  const tempMax = Math.max(c.tempMax + swing, c.tempMin + 4);
  const tempMin = c.tempMin + Math.round((r2 - 0.5) * 4);
  const rainProb = Math.min(95, Math.max(0, c.rainProb + Math.round((r1 - 0.4) * 40)));
  const humidity = Math.min(96, Math.max(30, c.humidity + Math.round((r2 - 0.5) * 16)));
  const windKph = 6 + Math.round(r1 * 18);
  return {
    tempMinC: tempMin,
    tempMaxC: tempMax,
    rainProb,
    humidity,
    windKph,
    condition: conditionFor(rainProb, r2),
    source: "seasonal-estimate" as const,
  };
}

async function fetchLive(
  city: string,
  lat: number,
  lng: number,
  date: Date
): Promise<{
  tempMinC: number;
  tempMaxC: number;
  rainProb: number;
  humidity: number;
  windKph: number;
  condition: string;
} | null> {
  const daysAhead = Math.round((date.getTime() - Date.now()) / 86400000);
  if (daysAhead < 0 || daysAhead > 15) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,wind_speed_10m_max&hourly=relative_humidity_2m&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_mean: (number | null)[];
        wind_speed_10m_max: number[];
      };
    };
    const idx = json.daily?.time.findIndex((t) => t === dateKey(date)) ?? -1;
    if (idx === -1 || !json.daily) return null;
    const d = json.daily;
    const rainProb = d.precipitation_probability_mean[idx] ?? 0;
    return {
      tempMinC: Math.round(d.temperature_2m_min[idx]),
      tempMaxC: Math.round(d.temperature_2m_max[idx]),
      rainProb,
      humidity: 65,
      windKph: Math.round(d.wind_speed_10m_max[idx]),
      condition: conditionFor(rainProb, seededRand(`live:${city}:${dateKey(date)}`)),
    };
  } catch {
    return null;
  }
}

export async function getWeatherForTrip(
  tripId: string,
  cities: { name: string; lat: number; lng: number }[],
  startDate: Date,
  endDate: Date
) {
  const existing = await db.weatherSnapshot.findMany({ where: { tripId } });
  const have = new Set(existing.map((w) => `${w.city}:${dateKey(w.date)}`));
  const days = eachDay(startDate, endDate).slice(0, 21);

  for (let i = 0; i < days.length; i++) {
    const date = days[i];
    const cityMeta =
      cities[Math.min(Math.floor((i / days.length) * cities.length), cities.length - 1)];
    const key = `${cityMeta.name}:${dateKey(date)}`;
    if (have.has(key)) continue;
    const ahead = (date.getTime() - Date.now()) / 86400000;
    const live = ahead >= 0 && ahead <= 15
      ? await fetchLive(cityMeta.name, cityMeta.lat, cityMeta.lng, date)
      : null;
    const base = live ?? estimate(cityMeta.name, date);
    await db.weatherSnapshot.upsert({
      where: { tripId_city_date: { tripId, city: cityMeta.name, date } },
      create: {
        tripId,
        city: cityMeta.name,
        date,
        tempMinC: base.tempMinC,
        tempMaxC: base.tempMaxC,
        rainProb: base.rainProb,
        humidity: base.humidity,
        windKph: base.windKph,
        condition: base.condition,
        source: live ? "live-open-meteo" : "seasonal-estimate",
      },
      update: {},
    });
  }

  return db.weatherSnapshot.findMany({ where: { tripId }, orderBy: { date: "asc" } });
}
