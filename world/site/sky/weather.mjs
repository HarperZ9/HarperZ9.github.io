// weather.mjs: one weather state that the sea, the clouds, the lens and the sound all read.
//   { wind (m/s at 10 m), windFrom (degrees, where it blows from), cloud (0..1 cover), rain (mm/h), thunder (bool),
//     source: "estimated" | "open-meteo" | "planted" }
// Estimated weather is a stand-in, never a reading: wind from latitude, season and hour; cloud and rain from a
// seeded value per place and three-hour block, so it holds still while you look. Real weather comes from Open-Meteo
// only after the visitor's own opt-in (sky.js), with the position rounded to 0.1 degree.
// The sea's numbers: significant wave height and peak period from the JONSWAP spectrum the field draws
// (field/ocean.js, Hasselmann et al. 1973), so the sound's surf beats at the same period the waves arrive at.
import { jonswap, G } from "../field/ocean.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function estimatedWeather(date, lat, lon) {
  const day = (date - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000;
  const winter = Math.cos(((day - (lat >= 0 ? 15 : 197)) / 365.25) * 2 * Math.PI);
  const solarHour = (date.getUTCHours() + date.getUTCMinutes() / 60 + lon / 15 + 24) % 24;
  const breeze = Math.exp(-(((solarHour - 15) / 3) ** 2));
  const wind = clamp(3 + 5 * Math.abs(Math.sin((lat * Math.PI) / 180)) + (2 * winter * Math.abs(lat)) / 90 + 1.5 * breeze, 1.5, 12);
  const block = Math.floor(date.getTime() / 10800000) + Math.round(lat * 10) * 7 + Math.round(lon * 10) * 13;
  const cloud = clamp(0.15 + 0.6 * hash(block) + 0.15 * winter * Math.sign(lat || 1), 0, 1);
  const rain = cloud > 0.78 ? Math.round((cloud - 0.78) * 30 * 10) / 10 : 0;
  // westerlies poleward of 30 degrees, trade winds from the east nearer the equator
  const windFrom = Math.abs(lat) > 30 ? 260 + 40 * (hash(block + 1) - 0.5) : (lat >= 0 ? 60 : 120) + 30 * (hash(block + 2) - 0.5);
  return { wind, windFrom, cloud, rain, thunder: false, source: "estimated" };
}

// planted weather for renders and checks (?wx=...): the named cases the author asked to see
export const PLANTED = {
  calm: { wind: 2, windFrom: 270, cloud: 0.1, rain: 0, thunder: false },
  gale: { wind: 20, windFrom: 250, cloud: 0.7, rain: 0, thunder: false },
  storm: { wind: 24, windFrom: 230, cloud: 0.98, rain: 12, thunder: true },
  rainbow: { wind: 8, windFrom: 260, cloud: 0.55, rain: 2, thunder: false },
  clear: { wind: 5, windFrom: 270, cloud: 0, rain: 0, thunder: false },
  fog: { wind: 3, windFrom: 200, cloud: 0.9, rain: 0, thunder: false, fog: true },
};

// WMO weather interpretation codes (Open-Meteo's weather_code): 95, 96 and 99 are thunderstorms
export function fromOpenMeteo(current) {
  const wind = Number(current?.wind_speed_10m), from = Number(current?.wind_direction_10m);
  if (!Number.isFinite(wind)) throw new Error("no wind in the reply");
  return {
    wind: clamp(wind, 0.5, 32), windFrom: Number.isFinite(from) ? from : 270,
    cloud: clamp((Number(current?.cloud_cover) || 0) / 100, 0, 1), rain: Math.max(0, Number(current?.precipitation) || 0),
    thunder: [95, 96, 99].includes(Number(current?.weather_code)), fog: [45, 48].includes(Number(current?.weather_code)), source: "open-meteo",
  };
}
export const OPEN_METEO_FIELDS = "wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,weather_code";

// a sea stops growing once it is fully developed. The spectrum here keeps JONSWAP's peak enhancement all the way, so
// growth is stopped where its height reaches the Pierson-Moskowitz fully developed height, Hs = 0.21 U19.5^2 / g
// (Pierson and Moskowitz 1964, with U19.5 about 1.075 U10). In g F / U^2 that is one number for every wind, solved
// here once by bisection (about 1.27e4); more fetch than that adds nothing.
const heightAt = (U, F) => { let m0 = 0; for (let w = 0.03; w < 6; w += 0.0015) m0 += jonswap(w, { U10: U, fetch: F }) * 0.0015; return 4 * Math.sqrt(m0); };
export const SATURATION = (() => {
  let lo = 1000, hi = 50000;
  for (let i = 0; i < 40; i++) { const x = (lo + hi) / 2; if ((heightAt(10, (x * 100) / G) * G) / 100 > 0.21 * 1.075 ** 2) hi = x; else lo = x; }
  return (lo + hi) / 2;
})();
export const effectiveFetch = (wind, fetch = 500000) => Math.min(fetch, (SATURATION * wind * wind) / G);
// fog as a material: extinction beta (per km) from meteorological visibility V by Koschmieder's law, beta = 3.912 / V
// (contrast threshold 2 percent). Visibility in fog is under 1 km (WMO); in rain it falls with rate, about
// V = 11.6 R^-0.29 km for rain rate R in mm/h (a fit used in rain-attenuation work; treat the coefficients as
// approximate). Clear air keeps the field's own aerosol extinction.
export function hazeExtinction(w) {
  if (w.fog) return 3.912 / 0.6;
  if (w.rain > 0) return 3.912 / Math.max(0.8, 11.6 * Math.pow(w.rain, -0.29));
  return 0;
}
// fit beta from a scene's measured contrast against distance: C(d) = C0 exp(-beta d), a log-linear least squares fit
export function fitExtinction(samples) {
  const xs = samples.map((s) => s.d), ys = samples.map((s) => Math.log(Math.max(1e-6, s.C))), n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return -sxy / sxx;
}

// the sea a wind raises, from the spectrum itself: significant wave height Hs = 4 sqrt(m0) and the peak period
export function seaState(wind, fetch = 500000) {
  fetch = effectiveFetch(wind, fetch);
  let m0 = 0, peak = 0, wPeak = 0;
  for (let w = 0.05; w < 6; w += 0.0025) { const s = jonswap(w, { U10: wind, fetch }); m0 += s * 0.0025; if (s > peak) { peak = s; wPeak = w; } }
  return { Hs: 4 * Math.sqrt(m0), Tp: (2 * Math.PI) / wPeak };
}
// Beaufort force from wind speed (WMO: v = 0.836 B^1.5 m/s)
export const beaufort = (wind) => clamp(Math.round(Math.pow(wind / 0.836, 2 / 3)), 0, 12);
export { G };
