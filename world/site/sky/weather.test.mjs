// Known answers for the sea a wind raises and for the sound models' physics.
import test from "node:test";
import assert from "node:assert/strict";
import { seaState, beaufort, estimatedWeather, fromOpenMeteo, PLANTED, hazeExtinction, fitExtinction } from "./weather.mjs";
import { minnaert, aeolian, thunderDelay } from "./sound.mjs";

const near = (a, b, rel, what) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${what}: ${a} against ${b} (within ${rel * 100}%)`);
const G = 9.81;

test("a fully developed sea: height meets Pierson-Moskowitz by construction; its peak period, an independent check, is within 15% of PM's Tp = 2 pi U19.5 / (0.877 g)", () => {
  // found 2026-11-06: the period comes out about 13% short of PM's (6.8 s against 7.85 s at 10 m/s), since the
  // spectrum keeps JONSWAP's narrow peak where a fully developed sea's is broader; kept visible, not tuned away
  for (const U of [5, 10, 20]) {
    const s = seaState(U, 1e7), u = 1.075 * U;
    near(s.Hs, (0.21 * u * u) / G, 0.02, `Hs at ${U} m/s`);
    near(s.Tp, (2 * Math.PI * u) / (0.877 * G), 0.15, `Tp at ${U} m/s`);
  }
});

test("fetch-limited JONSWAP: the peak period is the spectrum's own, omega_p = 22 (g^2 / (U F))^(1/3); the height sits within 25% of the growth curve g Hs / U^2 = 1.6e-3 (g F / U^2)^0.5", () => {
  // the spectrum as parameterised (alpha from fetch, gamma 3.3) gives about 24% more height than Hasselmann's fitted
  // growth curve at 20 m/s over 120 km; kept visible here, not tuned away
  const U = 20, F = 120000, s = seaState(U, F);
  near(s.Hs, (1.6e-3 * Math.sqrt((G * F) / (U * U)) * U * U) / G, 0.25, "significant wave height m");
  near(s.Tp, (2 * Math.PI) / (22 * Math.cbrt((G * G) / (U * F))), 0.03, "peak period s");
});

test("a gale raises a sea several metres high; a calm raises ripples", () => {
  assert.ok(seaState(20).Hs > 4, `gale Hs ${seaState(20).Hs}`);
  assert.ok(seaState(2).Hs < 0.2);
});

test("Beaufort force from wind speed (WMO v = 0.836 B^1.5): 20 m/s is force 8, a gale; 2 m/s is force 2", () => {
  assert.equal(beaufort(20), 8);
  assert.equal(beaufort(2), 2);
});

test("Minnaert: a 1 mm air bubble in water at one atmosphere rings near 3.3 kHz", () => near(minnaert(0.001), 3290, 0.02, "Hz"));
test("Strouhal: a 5 mm wire in a 10 m/s wind sings at St U / d = 400 Hz", () => near(aeolian(10, 0.005), 400, 1e-9, "Hz"));
test("thunder from a strike 3.43 km away arrives 10 s after the flash", () => near(thunderDelay(3430), 10, 1e-9, "s"));

test("estimated weather says it is estimated, and Open-Meteo's thunderstorm codes read as thunder", () => {
  assert.equal(estimatedWeather(new Date(Date.UTC(2026, 10, 6, 12)), 47.6, -122.3).source, "estimated");
  const w = fromOpenMeteo({ wind_speed_10m: 14, wind_direction_10m: 200, precipitation: 6, cloud_cover: 95, weather_code: 95 });
  assert.deepEqual([w.thunder, w.cloud, w.source], [true, 0.95, "open-meteo"]);
  assert.equal(fromOpenMeteo({ wind_speed_10m: 3, weather_code: 3 }).thunder, false);
  assert.throws(() => fromOpenMeteo({}));
  assert.ok(PLANTED.storm.thunder && PLANTED.rainbow.rain > 0);
});

test("fog as a material: extinction fitted from a planted foggy scene's contrast against distance is within 15% of the truth", () => {
  // planted scene: dark objects on a bright fog at 40 to 900 m, true beta 6.5 per km, 4 percent measurement noise
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const truth = 6.5, samples = [];
  for (let d = 0.04; d <= 0.9; d += 0.04) samples.push({ d, C: 0.85 * Math.exp(-truth * d) * (1 + (rnd() - 0.5) * 0.08) });
  near(fitExtinction(samples), truth, 0.15, "beta per km");
  // and Koschmieder's law: fog at 0.6 km visibility is beta = 3.912 / 0.6
  near(hazeExtinction({ fog: true, rain: 0 }), 6.52, 0.01, "fog beta");
  assert.equal(hazeExtinction({ fog: false, rain: 0 }), 0);
});
