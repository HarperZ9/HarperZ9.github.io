// Motion for the guides: framings (wide, medium, close) and three clips per guide, an idle
// loop, a talk loop and one signature action. Each clip is a function of time that returns
// the guide's pose options and any extra things in the scene; loops repeat exactly (every
// cycle is a whole number of periods of the loop length). Pure: runs in Node.
import { S as isoS, depth as isoDepth, groundShadow } from "./worlds/iso_kit.mjs";
import { coneParts } from "./pylon.mjs";
import { P, INK } from "./rig.mjs";
import { sprite } from "./worlds/tidepool.mjs";

export const CLIPS = { idle: 2.4, talk: 2.4, action: 3.2 };
const TAU = Math.PI * 2;
// Secondary motion: a damped spring that follows a primary signal, so cloth, whiskers, stalks
// and the flame lag behind the body and overshoot a little. Clips are stateless (a frame is a
// function of t), so the spring is integrated from rest before t: three loop lengths for a
// loop, which settles it onto the loop, or from 0 for an action. f in Hz, zeta the damping.
export const SPRINGS = { soft: { f: 2.2, zeta: 0.32 }, firm: { f: 3.8, zeta: 0.55 } };
// Cloth and flame use the soft spring (34% overshoot, settles in 0.57 s); whiskers and stalks
// the firm one (12%, 0.21 s): PROGRESS.md, step 14. setSpring forces one for a test.
export let SPRING = null;
export const setSpring = (v) => { SPRING = v; };
export function follow(drive, t, { loop = 0, f, zeta, kind = "soft" } = {}) {
  const sp = { ...SPRINGS[SPRING || kind], ...(f ? { f } : {}), ...(zeta ? { zeta } : {}) }, w = TAU * sp.f, dt = 1 / 240;
  let tau = loop ? t - 3 * loop : 0, x = drive(tau), v = 0;
  const n = Math.max(0, Math.round((t - tau) / dt));
  for (let i = 0; i < n; i++) { const a = w * w * (drive(tau) - x) - 2 * sp.zeta * w * v; v += a * dt; x += v * dt; tau += dt; }
  return x;
}
// The lag of a part behind its driver: follower minus driver.
const lagOf = (drive, t, loop, kind = "soft") => follow(drive, t, { loop, kind }) - drive(t);
const wave = (t, T, k, ph = 0) => Math.sin(TAU * (k * t / T) + ph);
const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
// A blink: the lid closes and opens over 0.16 s, starting at t0.
const blink = (t, t0, base) => { const u = (t - t0) / 0.16; return u < 0 || u > 1 ? base : base + (1 - base) * (1 - Math.abs(2 * u - 1)); };
// Syllables: a fixed pattern of mouth openings, eight to the loop.
const SYL = [0.9, 0.4, 1, 0.2, 0.7, 0.95, 0.3, 0.6];
const talkOpen = (t, T) => { const n = SYL.length, u = (t / T) * n, i = Math.floor(u) % n; return SYL[i] * Math.sin(Math.PI * (u - Math.floor(u))); };

// Guide heights in rig units (feet to the top), for framing.
const HEIGHT = { tallow: 830, pylon: 650, rerun: 420 };

// The camera for a framing of a beat in its style. Wide keeps the beat's own camera.
export function framing(guide, style, beat, name, base) {
  if (!name || name === "wide") return {};
  let x = beat.x, y = beat.y;
  if (beat.cell) [x, y] = isoS(...beat.cell);
  const h = HEIGHT[guide] * beat.s;
  // Where a close frame is centred, as a share of the way up the body: Rerun's face sits low,
  // under his shell (PROGRESS.md, step 15).
  const focus = { tallow: 0.74, pylon: 0.72, rerun: 0.5 }[guide], closeShare = guide === "rerun" ? 1.2 : 1.5;
  if (style === "pixel") {
    // Pixel mode keeps one art pixel per frame pixel, so the zoom must divide 480 and 270: one of
    // 1, 2, 3, 5, 6, 10. A medium frame picks the zoom nearest 0.75 of the frame height. A close
    // frame is a hand-drawn portrait bust (worlds/portraits.mjs) at zoom 5 (96 x 54), its foot on
    // the guide's feet: the vector rig cannot hold a face at that size (PROGRESS.md, step 15).
    const grid = 8;
    if (name === "close") return { noFront: true, portrait: true, camera: { x: Math.round(x / grid) * grid, y: Math.round((y - 26 * 4) / grid) * grid, zoom: 5 }, pixel: { width: 96, height: 54, mode: "integer" } };
    const want = (270 * 0.75) / (h / 4);
    const zoom = [1, 2, 3, 5, 6, 10].filter((z) => z <= 5).reduce((b, z) => (Math.abs(z - want) < Math.abs(b - want) ? z : b), 1);
    return { noFront: true, camera: { x: Math.round((x + 20) / grid) * grid, y: Math.round((y - h * 0.45) / grid) * grid, zoom }, pixel: { width: 480 / zoom, height: 270 / zoom, mode: "integer" } };
  }
  // Guide height as a share of the frame, and the point framed (a share of the way up the body).
  // Medium shows the guide at 0.85 of the frame (knees up for Tallow), close at 1.5 (head and
  // shoulders); PROGRESS.md, step 12.
  const k = name === "close" ? [closeShare, focus] : [0.85, 0.52];
  const zoom = (1080 * k[0]) / h;
  return { camera: { ...base, x: x + (name === "close" ? 0 : 60 / zoom), y: y - h * k[1], zoom } };
}

// Tallow: breath and a flickering flame; talk with the mouth and the free hand; the flame gutters.
function tallow(kind, t, o) {
  const T = CLIPS[kind] || 2.4;
  if (kind === "idle") {
    const sway = (u) => 6 * wave(u, T, 1, 0.4), lag = lagOf(sway, t, T);
    return { ...o, flame: 1 + 0.05 * wave(t, T, 7) + 0.03 * wave(t, T, 11, 1), lean: (o.lean || 0) + 4 * wave(t, T, 3) - 2.2 * lag, lid: blink(t, 1.5, o.lid ?? 0.5), dy: 3 * wave(t, T, 1), dx: sway(t), coatSway: 0.04 * lag };
  }
  if (kind === "talk") {
    // Overlap: the forearm follows the upper arm a beat late (its own spring on the shoulder angle).
    const sh = (u) => 18 + 14 * (0.5 + 0.5 * wave(u, T, 1)), sway = (u) => 4 * wave(u, T, 2, 1), lag = lagOf(sway, t, T);
    return { ...o, mouth: 0.15 + 0.85 * talkOpen(t, T), flame: 1 + 0.04 * wave(t, T, 9), lean: 3 * wave(t, T, 4) - 2 * lag,
      armR: sh(t), elbR: 70 + 1.6 * (follow(sh, t, { loop: T }) - 18), prop: null, lid: blink(t, 0.9, 0.5), dy: 1.5 * wave(t, T, 2), dx: sway(t), coatSway: 0.04 * lag };
  }
  // The flame gutters: it shrinks, thrashes, nearly goes, and comes back. His eye narrows.
  // He flinches back as it drops (anticipation: a small squash first), and the coat trails the flinch.
  const low = smooth(0.5, 1.1, t) * (1 - smooth(1.9, 2.7, t)), back = (u) => -14 * smooth(0.45, 0.7, u) * (1 - smooth(1.9, 2.6, u)), lag = lagOf(back, t, 0);
  return { ...o, flame: 1 - 0.68 * low + 0.12 * low * wave(t, 0.4, 1), lean: 26 * low * wave(t, 0.5, 1) + 4 * wave(t, T, 2) - 2.5 * lag, lid: (o.lid ?? 0.5) + 0.25 * low,
    dx: back(t), coatSway: 0.03 * lag, squash: 0.05 * smooth(0.3, 0.45, t) * (1 - smooth(0.45, 0.6, t)) - 0.03 * smooth(0.5, 0.65, t) * (1 - smooth(0.7, 0.9, t)) };
}

// Pylon: a slow sway and a blink; talk with the bark and nods; she places a cone on a claim.
function pylon(kind, t, o) {
  const T = CLIPS[kind] || 2.4;
  const tiltI = (u) => 3 * wave(u, T, 1), tiltT = (u) => 4 * wave(u, T, 2);
  if (kind === "idle") return { ...o, tilt: (o.tilt || 0) + tiltI(t), lid: blink(t, 1.7, o.lid ?? 0.5), dy: 3 * wave(t, T, 2), flipR: (o.flipR || 0) * (0.85 + 0.15 * wave(t, T, 1, 1)), whisk: -4 * lagOf(tiltI, t, T, "firm") };
  if (kind === "talk") return { ...o, bark: 0.1 + 0.4 * talkOpen(t, T), tilt: (o.tilt || 0) + tiltT(t), lid: blink(t, 1.2, 0.5), dy: 2 * wave(t, T, 4), whisk: -4 * lagOf(tiltT, t, T, "firm") };
  // Place a cone: the right flipper rises with a cone, swings down to the claim, lets go, returns.
  // Overlap: the head leads by 0.1 s, the flipper follows; anticipation squash before the lift,
  // a stretch at the top, a small squash as the cone lands, whiskers trailing the head.
  const up = smooth(0.1, 0.8, t), down = smooth(0.8, 1.5, t), back = smooth(1.9, 2.6, t);
  const flipR = 20 + 75 * up - 40 * down * (1 - back) - 55 * back;
  const tiltA = (u) => -9 * smooth(0.7, 1.4, u) * (1 - smooth(1.8, 2.5, u));
  const pulse = (a, b) => smooth(a, (a + b) / 2, t) * (1 - smooth((a + b) / 2, b, t));
  return { ...o, card: false, board: false, flipR, tilt: (o.tilt || 0) + tiltA(t), lid: blink(t, 2.75, 0.5), look: [6 * (1 - back), 6 * down * (1 - back)], coneT: t,
    squash: 0.06 * pulse(0, 0.25) - 0.045 * pulse(0.45, 0.9) + 0.04 * pulse(1.45, 1.75), whisk: -4 * lagOf(tiltA, t, 0, "firm") };
}

// Rerun: stalks bob and the flare twinkles; talk with the small claw; knock, knock: hollow.
function rerun(kind, t, o) {
  const T = CLIPS[kind] || 2.4;
  const bob = (u) => 6 * wave(u, T, 2), sx = (u) => 10 * wave(u, T, 1, 0.8);
  if (kind === "idle") return { ...o, stalk: 1 + 0.08 * wave(t, T, 2), flare: 0.85 + 0.15 * wave(t, T, 3), clawR: (o.clawR || 0) * 0.3 + 6 * wave(t, T, 1), clawL: 4 * wave(t, T, 1, 2), look: [3 * wave(t, T, 1), 0], dy: bob(t), dx: sx(t), stalkLag: 0.02 * lagOf(sx, t, T, "firm") };
  if (kind === "talk") return { ...o, clawL: 18 + 22 * talkOpen(t, T), stalk: 1.05 + 0.1 * talkOpen(t, T), clawR: 8, look: [0, -2], dy: bob(t) / 2, dx: sx(t) / 2, stalkLag: 0.02 * lagOf((u) => sx(u) / 2, t, T, "firm") };
  // Two knocks, a pause, the shell rings hollow, and Rerun backs off.
  const strike = (t0) => smooth(t0 - 0.28, t0 - 0.08, t) * (1 - smooth(t0, t0 + 0.06, t));
  const raise = Math.max(strike(0.75), strike(1.3)), after = smooth(1.8, 2.8, t);
  // Anticipation: a squash as the claw winds up, a stretch on each strike; the stalks trail the backing off.
  const pulse = (a, b) => smooth(a, (a + b) / 2, t) * (1 - smooth((a + b) / 2, b, t)), back = (u) => -40 * smooth(1.8, 2.8, u);
  return { ...o, clawR: -4 + 100 * raise, stalk: 1.2 - 0.35 * after, look: [5 * (1 - after), -2], dx: back(t), knockT: t,
    squash: 0.07 * pulse(0.4, 0.7) - 0.05 * pulse(0.7, 0.85) + 0.06 * pulse(1.0, 1.25) - 0.05 * pulse(1.25, 1.4), stalkLag: 0.02 * lagOf(back, t, 0, "firm") };
}
const BY = { tallow, pylon, rerun };

// The beat at time t of a clip: pose options, a small body offset, and the action's props.
export function clipBeat(guide, kind, beat, t) {
  const o = BY[guide](kind, t, beat.o || {});
  const b = { ...beat, o, offset: [(o.dx || 0) * beat.s, (o.dy || 0) * beat.s] };
  if (guide === "pylon" && kind === "action") b.things = withCone(beat, o);
  if (guide === "rerun" && kind === "action") b.front = knocking(beat, o);
  return b;
}

// Pylon's cone: carried at the right flipper's tip, then left standing on the claim it marks.
function withCone(beat, o) {
  const base = beat.things ? beat.things() : [];
  return () => {
    const [x, y] = isoS(...beat.cell), s = beat.s, a = (-o.flipR * Math.PI) / 180;
    const tx = 30, ty = 150, px = 138 + Math.cos(a) * tx - Math.sin(a) * ty, py = -236 + Math.sin(a) * tx + Math.cos(a) * ty;
    const target = [beat.cell[0] + 1.2, beat.cell[1] - 0.3], [gx, gy] = isoS(...target);
    const placed = o.coneT >= 1.5, cx = placed ? gx : x + px * s, cy = placed ? gy : y + py * s + 30 * s;
    const cone = coneParts(cx, cy, { scale: 0.5 * s * 2 }).map((p) => ({ shape: P(p.d), fill: p.fill, stroke: INK, width: 2 }));
    const boat = [{ shape: P(`M ${gx - 34} ${gy - 8} L ${gx + 34} ${gy - 8} L ${gx + 20} ${gy + 6} L ${gx - 20} ${gy + 6} Z`), fill: "#ddd2b6", stroke: INK, width: 2.5 },
      { shape: P(`M ${gx - 16} ${gy - 8} L ${gx + 2} ${gy - 46} L ${gx + 16} ${gy - 8} Z`), fill: "#efe6d0", stroke: INK, width: 2.5 }];
    return [...base.filter((th) => th.d < isoDepth(...target) - 0.5 || th.d > isoDepth(...target) + 0.5),
      { d: isoDepth(...target), items: [...groundShadow(...target, 0.3, 0.8), ...boat, ...(placed ? cone : [])] },
      ...(placed ? [] : [{ d: isoDepth(...beat.cell) + 1, items: cone }])];
  };
}

// Rerun's knock: one shell beside the big claw; ring marks on each hit; it goes dark (hollow).
function knocking(beat, o) {
  return (style, A) => {
    const items = [], t = o.knockT, lx = 182, ly = 220;
    items.push(sprite(A.pixel, t > 1.7 ? "hollow" : "unknocked", lx, ly));
    const hit = (t > 0.75 && t < 0.95) || (t > 1.3 && t < 1.5) || (t > 1.9 && t < 2.4);
    if (hit) for (const [dx, dy, w] of [[-3, -3, 3], [12, -4, 3], [-4, 2, 2], [13, 3, 2]]) items.push({ shape: P(`M ${(lx + dx) * 4} ${(ly + dy) * 4} L ${(lx + dx + w) * 4} ${(ly + dy) * 4}`), fill: null, stroke: "#efe6cf", width: 4 });
    return items;
  };
}

// Camera moves. pan: the pixel shore slides 64 art pixels to the right over the clip, so the
// six depths move at their own rates (mode "integer" or "sharp", PROGRESS.md step 14).
// push: a slow push-in on a painted close, 15% over the clip (ease "linear" or "inout").
export const MOVES = {
  pan: (opts = {}) => (t, cam, b) => {
    const D = opts.duration || 4.8, u = t / D, e = opts.ease === "linear" ? u : u * u * (3 - 2 * u);
    return { camera: { ...cam, x: cam.x - 128 + 256 * e }, pixel: { width: 480, height: 270, mode: opts.mode || "sharp" } };
  },
  push: (opts = {}) => (t, cam) => {
    const D = opts.duration || 4.8, u = t / D, e = opts.ease === "linear" ? u : u * u * (3 - 2 * u);
    return { camera: { ...cam, zoom: cam.zoom * (1 + 0.15 * e) } };
  },
};
