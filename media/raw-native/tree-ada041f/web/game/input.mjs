// Input as actions (runtime stage G1, ADR 0014). Pure: runs in Node; the browser adapter is
// input_web.mjs.
//
// A game reads named actions, never keys. An action is a button (held, pressed this step,
// released this step) or an axis (a number in [-1, 1]). Bindings are strings, so a map
// serialises to JSON and a player can rebind any action at run time:
//
//   key:KeyW          a keyboard key by its layout-independent code (KeyboardEvent.code)
//   -key:KeyS         the same, contributing -1 to an axis
//   pad.button:0      gamepad button 0 (standard mapping: 0 is the bottom face button)
//   pad.axis:1        gamepad axis 1; -pad.axis:1 inverts it
//   pointer:0         pointer button 0 (primary)
//   wheel             the wheel's steps this sample, as an axis (+1 per step down)
//
// An axis sums its bindings and clamps to [-1, 1]; gamepad axes inside the dead zone read 0,
// and outside it are rescaled so the response starts at 0. A button is held when any of its
// bindings is (a gamepad axis counts as held past 0.5).
//
// The device state is a plain record a host fills (input_web.mjs, or a test):
//   { keys: Set<code>, taps: Set<code>, padButtons: number[], padAxes: number[],
//     pointer: { x, y, buttons: Set<number>, taps: Set<number> } | null, wheel: number }
// `taps` latch a key or button that went down and up between two samples, so a tap shorter
// than one fixed step still registers as pressed for one step.
//
// A sample is an action frame: { held: {..}, pressed: {..}, released: {..}, axes: {..},
// pointer: [x, y] | null }, in the order the actions were declared. Frames are plain data, so
// a recording of frames replays the same simulation (record() and replay()).

export const DEAD_ZONE = 0.2;

export function parseBinding(b) {
  const m = /^(-?)(key|pad\.button|pad\.axis|pointer|wheel)(?::(.+))?$/.exec(b);
  if (!m) throw new Error(`input: bad binding "${b}"`);
  const [, neg, kind, arg] = m;
  if (kind !== "wheel" && arg === undefined) throw new Error(`input: binding "${b}" needs a target`);
  if ((kind === "pad.button" || kind === "pad.axis" || kind === "pointer") && !/^\d+$/.test(arg)) throw new Error(`input: binding "${b}" needs a number`);
  return { sign: neg ? -1 : 1, kind, arg: kind === "key" ? arg : arg === undefined ? null : Number(arg) };
}

const deadZone = (v, dz) => (Math.abs(v) <= dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz));
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// One binding's value on a device: 0..1 for buttons, -1..1 for axes (before the sign).
function readBinding(p, dev, { tapsToo = true } = {}) {
  switch (p.kind) {
    case "key": return dev.keys.has(p.arg) || (tapsToo && dev.taps && dev.taps.has(p.arg)) ? 1 : 0;
    case "pad.button": return +((dev.padButtons && dev.padButtons[p.arg]) || 0);
    case "pad.axis": return deadZone((dev.padAxes && dev.padAxes[p.arg]) || 0, DEAD_ZONE);
    case "pointer": return dev.pointer && (dev.pointer.buttons.has(p.arg) || (tapsToo && dev.pointer.taps && dev.pointer.taps.has(p.arg))) ? 1 : 0;
    case "wheel": return dev.wheel || 0;
    default: return 0;
  }
}

export const emptyDevice = () => ({ keys: new Set(), taps: new Set(), padButtons: [], padAxes: [], pointer: null, wheel: 0 });

// actions: { name: { type: "button" | "axis", bind: [binding, ...] } }
export function createActionMap(actions) {
  const defs = new Map();
  const set = (name, type, bind) => {
    if (type !== "button" && type !== "axis") throw new Error(`input: action ${name} is a button or an axis, got ${type}`);
    defs.set(name, { type, bind: [...bind], parsed: bind.map(parseBinding) });
  };
  for (const [name, a] of Object.entries(actions)) set(name, a.type, a.bind || []);
  let prevHeld = {};
  const map = {
    get names() { return [...defs.keys()]; },
    type(name) { return defs.get(name)?.type; },
    bindings(name) { const d = defs.get(name); if (!d) throw new Error(`input: no action ${name}`); return [...d.bind]; },
    // Replace an action's bindings. Returns the previous ones so a menu can undo.
    rebind(name, bind) { const d = defs.get(name); if (!d) throw new Error(`input: no action ${name}`); const old = d.bind; set(name, d.type, bind); return old; },
    toJSON() { return Object.fromEntries([...defs].map(([n, d]) => [n, { type: d.type, bind: [...d.bind] }])); },
    // Read every action from a device; pressed and released compare with the previous sample.
    sample(dev) {
      const held = {}, pressed = {}, released = {}, axes = {};
      for (const [name, d] of defs) {
        if (d.type === "axis") {
          let v = 0;
          for (const p of d.parsed) v += p.sign * readBinding(p, dev);
          axes[name] = clamp1(v);
        } else {
          let on = false;
          for (const p of d.parsed) { const v = p.sign * readBinding(p, dev); if (p.kind === "pad.axis" ? v > 0.5 : v > 0) on = true; }
          held[name] = on;
          pressed[name] = on && !prevHeld[name];
          released[name] = !on && !!prevHeld[name];
        }
      }
      // A tap (down and up within one sample) is held and pressed now, and released next sample.
      prevHeld = held;
      return { held, pressed, released, axes, pointer: dev.pointer ? [dev.pointer.x, dev.pointer.y] : null };
    },
    reset() { prevHeld = {}; },
  };
  return map;
}

// The first input held on dev that is not held on base: a binding string for "press a key to
// bind". Returns null when nothing new is held.
export function captureBinding(dev, base = emptyDevice()) {
  for (const k of dev.keys) if (!base.keys.has(k)) return `key:${k}`;
  for (const [i, v] of (dev.padButtons || []).entries()) if (v > 0.5 && !((base.padButtons || [])[i] > 0.5)) return `pad.button:${i}`;
  for (const [i, v] of (dev.padAxes || []).entries()) if (Math.abs(v) > 0.6 && !(Math.abs((base.padAxes || [])[i] || 0) > 0.6)) return `${v < 0 ? "-" : ""}pad.axis:${i}`;
  if (dev.pointer) for (const b of dev.pointer.buttons) if (!(base.pointer && base.pointer.buttons.has(b))) return `pointer:${b}`;
  return null;
}

// An empty action frame for a map (no input), and a frame built from plain values (for
// scripted input tracks and tests): frame(map, { axes: { moveX: 1 }, held: ["use"] }).
export function idleFrame(map) { return frame(map, {}); }
export function frame(map, { axes = {}, held = [], pressed = [], pointer = null } = {}) {
  const f = { held: {}, pressed: {}, released: {}, axes: {}, pointer };
  for (const n of map.names) {
    if (map.type(n) === "axis") f.axes[n] = clamp1(axes[n] || 0);
    else { f.held[n] = held.includes(n) || pressed.includes(n); f.pressed[n] = pressed.includes(n); f.released[n] = false; }
  }
  return f;
}

// A recording: the action frame of every step, as JSON-safe data. replay(rec)(i) returns
// frame i (an idle frame past the end).
export function createRecorder() {
  const frames = [];
  return {
    frames,
    wrap(source) { return (i) => { const f = source(i); frames[i] = structuredClone(f); return f; }; },
    toJSON() { return { version: "raw-native.input-track/1", frames }; },
  };
}
export function replay(track, idle = null) {
  const frames = Array.isArray(track) ? track : track.frames;
  return (i) => (i < frames.length ? frames[i] : idle || { held: {}, pressed: {}, released: {}, axes: {}, pointer: null });
}
