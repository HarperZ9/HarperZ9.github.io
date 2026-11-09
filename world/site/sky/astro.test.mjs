// Known answers for astro.mjs. Published worked examples first, then positions from an independent implementation
// (astropy, reference-positions.json, made by a script kept outside the site), then a planted wrong case that the
// checks must catch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gmst, julianDay, moonEcliptic, moonPosition, sunPosition, placeFromTimeZone, coarse } from "./astro.mjs";

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b} (tolerance ${tol})`);
const angle = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

test("Meeus example 12.a: sidereal time at Greenwich, 1987 April 10, 0h UT, is 13h 10m 46.3668s", () => {
  near(gmst(julianDay(new Date(Date.UTC(1987, 3, 10)))), (13 + 10 / 60 + 46.3668 / 3600) * 15, 1e-4, "GMST degrees");
});

test("Reda and Andreas (NREL SPA, 2004) example: Denver, 2003-10-17 12:30:30 MST; zenith 50.11162, azimuth 194.34024", () => {
  // the SPA value is refracted at 820 mbar and 11 C; NOAA's correction assumes sea level, about 0.003 degree more
  const s = sunPosition(new Date(Date.UTC(2003, 9, 17, 19, 30, 30)), 39.742476, -105.1786);
  near(90 - s.alt, 50.11162, 0.03, "zenith");
  near(s.az, 194.34024, 0.03, "azimuth");
});

test("Meeus example 47.a: the Moon on 1992 April 12, 0h TD: longitude 133.162655, latitude -3.229126, distance 368409.7 km", () => {
  const m = moonEcliptic(2448724.5);
  near(m.lambda, 133.162655, 0.02, "longitude");
  near(m.beta, -3.229126, 0.02, "latitude");
  near(m.distance, 368409.7, 40, "distance km");
});

test("Meeus example 48.a: the Moon's phase angle on 1992 April 12, 0h TD, is 69.0756 degrees, 0.6786 illuminated", () => {
  // TD is about 59 s ahead of UT in 1992
  const m = moonPosition(new Date(Date.UTC(1992, 3, 11, 23, 59, 1)), 0, 0);
  near(m.phaseAngle, 69.0756, 0.3, "phase angle");
  near(m.illuminated, 0.6786, 0.004, "illuminated fraction");
});

const REF = JSON.parse(readFileSync(new URL("./reference-positions.json", import.meta.url), "utf8"));
for (const c of REF.cases) {
  test(`against astropy: ${c.name}`, () => {
    const t = new Date(c.time);
    const s = sunPosition(t, c.lat, c.lon), m = moonPosition(t, c.lat, c.lon);
    near(s.altGeometric, c.sun.alt, 0.03, "Sun altitude");
    assert.ok(angle(s.az, c.sun.az) <= 0.03 / Math.max(0.05, Math.cos((c.sun.alt * Math.PI) / 180)), `Sun azimuth ${s.az} against ${c.sun.az}`);
    near(m.altGeometric, c.moon.alt, 0.15, "Moon altitude");
    assert.ok(angle(m.az, c.moon.az) <= 0.15 / Math.max(0.05, Math.cos((c.moon.alt * Math.PI) / 180)), `Moon azimuth ${m.az} against ${c.moon.az}`);
  });
}

test("planted wrong case: west longitude entered as east puts the Sun on the wrong side of the sky, and the check sees it", () => {
  const c = REF.cases[0], t = new Date(c.time);
  const wrong = sunPosition(t, c.lat, -c.lon);
  assert.ok(Math.abs(wrong.altGeometric - c.sun.alt) > 10 || angle(wrong.az, c.sun.az) > 10, "a sign error must be far from the reference");
  assert.throws(() => near(wrong.altGeometric, c.sun.alt, 0.03, "Sun altitude"));
});

test("a shared location is kept to 0.1 degree, and a time zone guess is labelled as one", () => {
  assert.equal(coarse(47.61234), 47.6);
  assert.equal(coarse(-122.3456), -122.3);
  const p = placeFromTimeZone(new Date(Date.UTC(2026, 10, 5)), "Europe/Berlin");
  assert.equal(p.guessed, true);
  assert.ok(Math.abs(p.lat - 52.5) < 0.01);
});
