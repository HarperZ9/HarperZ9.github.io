// Frame sequences for the hysteresis checks, from the owned street fixture.
//   flicker: static camera, t = f / 24 (the lamp flickers by about 8% and the coat sways).
//   orbit:   the camera orbits the target by 0.5 degrees a frame, with motion vectors.
//   ramp:    static camera, lamp gain from 1 to 2 over the sequence (a genuine, large change).
//   static:  the same frame repeated.
import { streetScene, motionVectors } from "../fixtures/street.mjs";

const TARGET = [0.2, 0.8, 0], EYE = [5.2, 4.6, 6.4];
function orbitEye(deg) {
  const a = (deg * Math.PI) / 180, dx = EYE[0] - TARGET[0], dz = EYE[2] - TARGET[2];
  return [TARGET[0] + dx * Math.cos(a) - dz * Math.sin(a), EYE[1], TARGET[2] + dx * Math.sin(a) + dz * Math.cos(a)];
}
export function sequence(name, w, h, frames) {
  const out = [];
  let prev = null;
  for (let f = 0; f < frames; f++) {
    let s;
    if (name === "flicker") s = streetScene(w, h, f / 24);
    else if (name === "orbit") s = streetScene(w, h, 0, { eye: orbitEye(0.5 * f), target: TARGET });
    else if (name === "ramp") s = streetScene(w, h, 0, { lampGain: 1 + f / Math.max(1, frames - 1) });
    else if (name === "static") s = streetScene(w, h, 0);
    else throw new Error("unknown sequence " + name);
    const motion = name === "orbit" && prev ? motionVectors(prev, s) : null;
    out.push({ frame: s, motion, dist: s.depth });
    prev = s;
  }
  return out;
}
