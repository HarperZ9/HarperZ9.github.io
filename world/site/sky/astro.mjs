// astro.mjs: where the Sun and the Moon stand in a visitor's sky, from latitude, longitude and time, in the browser.
//
// Sun: the NOAA solar position algorithm, as published in NOAA's Solar Calculator and its spreadsheet (NOAA Global
// Monitoring Laboratory, gml.noaa.gov/grad/solcalc), which follows Jean Meeus, "Astronomical Algorithms", 2nd ed.
// (Willmann-Bell, 1998), chapters 25 and 28. Stated accuracy about 0.01 degree for dates between 1800 and 2100,
// with NOAA's refraction correction.
// Moon: Meeus chapter 47 with the 32 largest longitude and distance terms and the 15 largest latitude terms of
// tables 47.A and 47.B, plus the A1 to A3 corrections; about 0.05 degree. Parallax (chapter 40, the horizontal
// parallax approximation) and the same refraction. Phase angle and illuminated fraction: Meeus chapter 48.
// Sidereal time: Meeus formula 12.4.
// Everything here is pure arithmetic. Nothing is fetched and nothing is stored.

const D = Math.PI / 180;
const sin = (d) => Math.sin(d * D), cos = (d) => Math.cos(d * D), tan = (d) => Math.tan(d * D);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / D, atan2 = (y, x) => Math.atan2(y, x) / D;
const norm = (d) => ((d % 360) + 360) % 360;

export const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;
const centuries = (jd) => (jd - 2451545) / 36525;

// Greenwich mean sidereal time in degrees (Meeus 12.4)
export function gmst(jd) {
  const T = centuries(jd);
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

// NOAA's atmospheric refraction correction, in degrees, for an apparent elevation in degrees
export function refraction(e) {
  if (e > 85) return 0;
  const t = tan(e);
  let s;
  if (e > 5) s = 58.1 / t - 0.07 / (t * t * t) + 0.000086 / Math.pow(t, 5);
  else if (e > -0.575) s = 1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)));
  else s = -20.774 / t;
  return s / 3600;
}

function horizon(ha, dec, lat) {
  // altitude and azimuth (degrees from north, toward east) for hour angle and declination
  const alt = asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha));
  const az = norm(atan2(sin(ha), cos(ha) * sin(lat) - tan(dec) * cos(lat)) + 180);
  return { alt, az };
}

// the Sun's ecliptic quantities shared by the solar position and the Moon's phase
function sunEcliptic(T) {
  const L0 = norm(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * sin(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(M + C)); // astronomical units
  return { L0, M, e, lambda, eps, R, omega };
}

// the Sun for a place and an instant. lat, lon in degrees (east positive). Returns altitude (refracted), azimuth
// (degrees clockwise from true north), declination, equation of time (minutes) and distance (AU).
export function sunPosition(date, lat, lon) {
  const jd = julianDay(date), T = centuries(jd);
  const { L0, M, e, lambda, eps, R } = sunEcliptic(T);
  const dec = asin(sin(eps) * sin(lambda));
  const y = tan(eps / 2) ** 2;
  const eqTime = 4 * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0) - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M)) / D;
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
  let tst = (minutes + eqTime + 4 * lon) % 1440; if (tst < 0) tst += 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const h = horizon(ha, dec, lat);
  return { alt: h.alt + refraction(h.alt), altGeometric: h.alt, az: h.az, dec, eqTime, distanceAU: R, lambda };
}

// Meeus table 47.A: D, M, M', F, longitude (1e-6 degree), distance (1e-3 km)
const LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
// Meeus table 47.B: D, M, M', F, latitude (1e-6 degree)
const B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
];

// the Moon's geocentric apparent ecliptic longitude and latitude (degrees) and distance (km) for a Julian day
export function moonEcliptic(jd) {
  const T = centuries(jd), T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = norm(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000);
  const Dm = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
  const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
  const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);
  const F = norm(93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000);
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const ecc = (m) => (Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1);
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of LR) { const a = d * Dm + m * M + mp * Mp + f * F; sl += l * ecc(m) * sin(a); sr += r * ecc(m) * cos(a); }
  for (const [d, m, mp, f, b] of B) sb += b * ecc(m) * sin(d * Dm + m * M + mp * Mp + f * F);
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
  // nutation in longitude, the two largest terms (Meeus chapter 22)
  const omega = 125.04452 - 1934.136261 * T, Lsun = 280.4665 + 36000.7698 * T;
  const dpsi = (-17.2 * sin(omega) - 1.32 * sin(2 * Lsun) - 0.23 * sin(2 * Lp) + 0.21 * sin(2 * omega)) / 3600;
  return { lambda: norm(Lp + sl / 1e6 + dpsi), beta: sb / 1e6, distance: 385000.56 + sr / 1000 };
}

// the Moon for a place and an instant: topocentric altitude (refracted) and azimuth, phase angle i (0 is full,
// 180 new), illuminated fraction, and whether it is waxing
export function moonPosition(date, lat, lon) {
  const jd = julianDay(date), T = centuries(jd);
  const { lambda, beta, distance } = moonEcliptic(jd);
  const sun = sunEcliptic(T);
  const eps = sun.eps;
  const ra = norm(atan2(sin(lambda) * cos(eps) - tan(beta) * sin(eps), cos(lambda)));
  const dec = asin(sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lambda));
  const lst = norm(gmst(jd) + lon), ha = norm(lst - ra);
  const h = horizon(ha, dec, lat);
  const parallax = asin(6378.14 / distance);
  const altTopo = h.alt - parallax * cos(h.alt);
  // phase angle (Meeus 48.2 and 48.3), with the Sun's distance in km
  const Rkm = sun.R * 149597870.7;
  const psi = Math.acos(Math.max(-1, Math.min(1, cos(beta) * cos(lambda - sun.lambda)))) / D;
  const i = atan2(Rkm * sin(psi), distance - Rkm * cos(psi));
  return {
    alt: altTopo + refraction(altTopo), altGeometric: altTopo, az: h.az, ra, dec, distance, phaseAngle: i,
    illuminated: (1 + cos(i)) / 2, waxing: norm(lambda - sun.lambda) < 180,
  };
}

// local sidereal time in degrees, for turning the stars
export const localSidereal = (date, lon) => norm(gmst(julianDay(date)) + lon);

// a coordinate rounded to 0.1 degree (about 11 km of latitude): the only precision the sky needs
export const coarse = (x) => Math.round(x * 10) / 10;

// a place guessed from the browser's time zone, when the visitor has not shared a location: longitude from the zone's
// standard offset (15 degrees an hour), latitude from the zone's region. Labelled as a guess wherever it is shown.
const ZONE_LAT = {
  "America/New_York": 40.7, "America/Chicago": 41.9, "America/Denver": 39.7, "America/Los_Angeles": 34.1,
  "America/Phoenix": 33.4, "America/Anchorage": 61.2, "America/Toronto": 43.7, "America/Vancouver": 49.3,
  "America/Mexico_City": 19.4, "America/Sao_Paulo": -23.5, "America/Argentina/Buenos_Aires": -34.6,
  "Europe/London": 51.5, "Europe/Paris": 48.9, "Europe/Berlin": 52.5, "Europe/Madrid": 40.4, "Europe/Rome": 41.9,
  "Europe/Moscow": 55.8, "Asia/Tokyo": 35.7, "Asia/Shanghai": 31.2, "Asia/Kolkata": 19.1, "Asia/Singapore": 1.3,
  "Asia/Dubai": 25.2, "Australia/Sydney": -33.9, "Australia/Melbourne": -37.8, "Australia/Perth": -31.9,
  "Pacific/Auckland": -36.8, "Pacific/Honolulu": 21.3, "Africa/Johannesburg": -26.2, "Africa/Lagos": 6.5, "Africa/Cairo": 30.0,
};
const REGION_LAT = { America: 38, Europe: 50, Asia: 30, Africa: 5, Australia: -30, Pacific: -15, Atlantic: 35, Indian: -10, Antarctica: -75 };
export function placeFromTimeZone(now = new Date(), zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") {
  const y = now.getFullYear();
  const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset()); // minutes west, without summer time
  const lon = Math.max(-180, Math.min(180, (-std / 60) * 15));
  const lat = ZONE_LAT[zone] ?? REGION_LAT[zone.split("/")[0]] ?? 40;
  return { lat: coarse(lat), lon: coarse(lon), zone, guessed: true };
}
