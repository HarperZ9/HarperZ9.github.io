// The sky on the host: the engine's Preetham clear sky (src/renderer/sky.cpp, Preetham, Shirley and Smits 1999),
// its sun illuminance, and the ambient cube the real-time path lights with. Numbers are linear Rec.709 in nits
// and lux, as the engine's are.
const perezY = (T) => [0.1787 * T - 1.4630, -0.3554 * T + 0.4275, -0.0227 * T + 5.3251, 0.1206 * T - 2.5771, -0.0670 * T + 0.3703];
const perezx = (T) => [-0.0193 * T - 0.2592, -0.0665 * T + 0.0008, -0.0004 * T + 0.2125, -0.0641 * T - 0.8989, -0.0033 * T + 0.0452];
const perezy = (T) => [-0.0167 * T - 0.2608, -0.0950 * T + 0.0092, -0.0079 * T + 0.2102, -0.0441 * T - 1.6537, -0.0109 * T + 0.0529];
const MX = [[0.00166, -0.00375, 0.00209, 0.0], [-0.02903, 0.06377, -0.03202, 0.00394], [0.11693, -0.21196, 0.06052, 0.25886]];
const MY = [[0.00275, -0.00610, 0.00317, 0.0], [-0.04214, 0.08970, -0.04153, 0.00516], [0.15346, -0.26756, 0.06670, 0.26688]];
const chroma = (M, T, ts) => { const t = [T * T, T, 1], s = [ts ** 3, ts * ts, ts, 1]; let r = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) r += t[i] * M[i][j] * s[j]; return r; };
const perez = ([A, B, C, D, E], ct, g) => (1 + A * Math.exp(B / Math.max(ct, 0.01))) * (1 + C * Math.exp(D * g) + E * Math.cos(g) ** 2);

export function sunDirection(azimuthDeg, elevationDeg) {
  const a = azimuthDeg * Math.PI / 180, e = elevationDeg * Math.PI / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

export function skyModel(sun, turbidity = 2.5, groundAlbedo = 0.25) {
  const T = turbidity, ts = Math.acos(Math.min(1, Math.max(0, sun[1])));
  const chi = (4 / 9 - T / 120) * (Math.PI - 2 * ts);
  const Yz = 1000 * ((4.0453 * T - 4.9710) * Math.tan(chi) - 0.2155 * T + 2.4192);
  const pY = perezY(T), px = perezx(T), py = perezy(T);
  const zen = [Yz / perez(pY, 1, ts), chroma(MX, T, ts) / perez(px, 1, ts), chroma(MY, T, ts) / perez(py, 1, ts)];
  const m = 1 / Math.max(sun[1], 0.05), tau = 0.08 + 0.025 * T;
  const sunE = [1e5 * Math.exp(-tau * 0.6 * m), 1e5 * Math.exp(-tau * m), 1e5 * Math.exp(-tau * 1.8 * m)];
  const radiance = (d0) => {
    let d = d0, ground = 1;
    if (d[1] < 0) { const l = Math.hypot(d[0], d[2]); d = l > 1e-9 ? [d[0] / l, 0.01, d[2] / l] : [1, 0.01, 0]; const n = Math.hypot(...d); d = d.map((v) => v / n); ground = groundAlbedo; }
    const g = Math.acos(Math.max(-1, Math.min(1, d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2])));
    const Y = zen[0] * perez(pY, d[1], g), x = zen[1] * perez(px, d[1], g), y = zen[2] * perez(py, d[1], g);
    const X = x / y * Y, Z = (1 - x - y) / y * Y;
    return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z].map((v) => Math.max(0, v) * ground);
  };
  // the ambient cube: irradiance on +x -x +y -y +z -z from 4,096 directions on a Fibonacci sphere
  const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], amb = axes.map(() => [0, 0, 0]), N = 4096;
  for (let k = 0; k < N; k++) {
    const z = 1 - (2 * k + 1) / N, r = Math.sqrt(1 - z * z), ph = k * 2.39996323, d = [r * Math.cos(ph), z, r * Math.sin(ph)];
    const L = radiance(d);
    axes.forEach((a, j) => { const c = d[0] * a[0] + d[1] * a[1] + d[2] * a[2]; if (c > 0) for (let q = 0; q < 3; q++) amb[j][q] += L[q] * c * 4 * Math.PI / N; });
  }
  const floats = [...pY.slice(0, 4), pY[4], ...px.slice(0, 3), px[3], px[4], py[0], py[1], py[2], py[3], py[4], groundAlbedo, ...zen, 0];
  return { floats, sunE, amb, radiance, zenith: Yz };
}
