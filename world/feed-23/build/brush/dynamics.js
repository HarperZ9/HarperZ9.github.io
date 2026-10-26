// brush/dynamics.js: what the hand does to the dab. Pressure, tilt and speed in; size, flow, aspect, angle out.
// A pen gives pressure and tilt; a mouse gives neither, so pressure is synthesised from speed (slow is heavy).
import { clamp, lerp } from './core.js';

// Pointer tilt (tiltX, tiltY in degrees, as PointerEvent gives them) to azimuth and tilt from vertical, radians.
export function tiltToPolar(tiltX = 0, tiltY = 0) {
  const tx = Math.tan((tiltX * Math.PI) / 180), ty = Math.tan((tiltY * Math.PI) / 180);
  const tilt = Math.atan(Math.hypot(tx, ty));
  return { azimuth: tilt > 1e-6 ? Math.atan2(ty, tx) : 0, tilt };
}

// A gamma curve on 0..1, so presets can say "pressure mostly at the heavy end" without a lookup table.
export const curve = (x, gamma = 1) => clamp(x) ** gamma;

// Synthesised pressure for devices that report none: 1 when still, falling toward `floor` at `vmax` px/s.
export function speedPressure(speed, vmax = 2400, floor = 0.35) {
  return lerp(1, floor, clamp(speed / vmax));
}

// Map one input sample to dab parameters. brush: a preset; s: { p, tiltX, tiltY, speed, dir } ; unit: px per
// canvas width. Returns { radius, flowAlpha, aspect, angle }.
export function dabParams(brush, s, unit, R) {
  const pr = curve(s.p ?? 1, brush.pressure?.gamma ?? 1);
  const [s0, s1] = brush.pressure?.size ?? [1, 1], [f0, f1] = brush.pressure?.flow ?? [1, 1];
  let radius = 0.5 * brush.size * unit * lerp(s0, s1, pr);
  let flow = (brush.flow ?? 1) * lerp(f0, f1, pr);
  if (brush.velocity?.size) radius *= clamp(1 + brush.velocity.size * clamp((s.speed ?? 0) / 2400), 0.2, 3);
  const j = brush.jitter ?? {};
  if (j.size) radius *= 1 + j.size * (R() * 2 - 1);
  if (j.flow) flow *= 1 - j.flow * R();
  const { azimuth, tilt } = tiltToPolar(s.tiltX, s.tiltY);
  const aspect = 1 + (brush.tilt?.aspect ?? 0) * Math.sin(tilt) + (brush.aspect ? brush.aspect - 1 : 0);
  let angle = typeof brush.angle === 'number' ? brush.angle : brush.angle === 'stroke' ? (s.dir ?? 0) : 0;
  if (tilt > 0.05 && brush.tilt?.aspect) angle = azimuth;
  if (j.angle) angle += j.angle * Math.PI * (R() * 2 - 1);
  return { radius: Math.max(0.05, radius), flowAlpha: clamp(flow), aspect, angle };
}
