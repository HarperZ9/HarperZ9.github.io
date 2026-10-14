// "One box, many eyes", the raw-native release film, as a Motion scene: one file for the video
// and for the live version. The script, sources and timing are the film's own files (film.json,
// evidence.json, timing.json); every number on screen is read by key from evidence.json's facts
// block or from the release's ao-check facts.json, and the scene adds no claim. Every cue is a
// sentence or a word in timing.json, so the pictures re-time when the narration lands. Until
// then timing.json is provisional (tools/explainer/film/provisional_timing.py).
// Host: Rerun (pixel 2.5D), at the cold open and the close. Storyboard: media-excellence films,
// raw-native-showcase/storyboard.md. The predict beat is a 2.5 s still with no question shown.
import { loadTidepool } from "../../raw-native/tree-c6b114d/templates/guides/worlds/tidepool.mjs";
import { C, FACETS, cues, cameraOn, move, LENS_CAM, ZF, span, ease, lerp } from "./scene/world.mjs";
import * as host from "./scene/host.mjs";
import * as lens from "./scene/lens.mjs";
import * as s1 from "./scene/s1-check.mjs";
import * as s2 from "./scene/s2-bytes.mjs";
import * as s3 from "./scene/s3-colour.mjs";
import * as s4 from "./scene/s4-tube.mjs";
import * as s5 from "./scene/s5-film.mjs";
import * as s6 from "./scene/s6-looks.mjs";
import * as s6b from "./scene/s6-landed.mjs";
import * as s7 from "./scene/s7-close.mjs";

const SEGMENTS = [s1, s2, s3, s4, s5, s6, s6b, s7];
// ?host=shore|floor on the module URL picks the host's setting (the test in PROGRESS.md, step 4).
const HOST_Q = new URL(import.meta.url).searchParams.get("host");
if (HOST_Q) host.setHostStyle(HOST_Q);

export default {
  title: "One box, many eyes",
  duration: 288.3,
  fps: 30,
  design: [1920, 1080],
  chapters: [],
  async load(ctx) {
    const [sans, head, mono, timing, ev, film, facts] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("evidence.json"), ctx.json("film.json"), ctx.json("../../releases/raw-native/v0.6.0/ao-check/facts.json")]);
    const c = cues(timing), A = { sans, head, mono, ev, film };
    A.guide = { pixel: await loadTidepool(ctx.motion) };
    const open = film.host.open.seconds, close = film.host.close.seconds;
    A.H = { knock: 0.5, push: open - 1.4, end: open, start: c.last + 0.8, close };
    this.duration = Math.round((c.last + close) * 30) / 30;
    A.end = this.duration;
    host.prepare(A); lens.prepare(A);
    for (const s of SEGMENTS) s.prepare(A, facts, c);
    // Where the camera goes: into each facet as its chapter starts, out to the lens at the close.
    A.stops = [["lens", A.H.end], ...SEGMENTS.flatMap((s) => s.stops(c, A))].sort((a, b) => a[1] - b[1]);
    A.titleAt = c.at(0, 0);
    A.firstSeen = {};
    for (const [key, t] of A.stops) if (FACETS.includes(key) && !(key in A.firstSeen)) A.firstSeen[key] = t;
    this.chapters = film.segments.map((s, i) => ({ title: s.heading, t: Math.max(0, (i === 0 ? c.at(0, 0) : c.at(i, 0)) - 1.2) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, H = A.H;
    if (t < H.end) return host.frame(t, A, H, "open");
    if (t >= H.start) return host.frame(t, A, H, "close");
    const cam = camera(t, A), items = [];
    const at = (k) => A.firstSeen[k] ?? Infinity;
    lens.draw(t, A, { draw: span(t, H.end, H.end + 2.6, ease.linear), lit: (k) => span(t, at(k), at(k) + 1.5), spin: s7.spin(t, A), cam }, items);
    lens.title(t, A, A.titleAt, A.T1.enter - 0.8, items);
    for (const s of SEGMENTS) s.draw(t, A, items, cam);
    host.glint(t, H.end, items);
    const L = look(t, A, cam, items);
    return { background: C.void, camera: cam, items, post: L.post, ...(L.pixel ? { pixel: L.pixel } : {}) };
  },
};

// The camera at time t: hold on each stop, moving between stops over the 1.6 s before and the
// 1.8 s after each one (out to the lens and back in, zoom in log space).
function camera(t, A) {
  const S = A.stops, cam = (key) => (key === "lens" ? LENS_CAM : key === "far" ? { ...LENS_CAM, zoom: 0.42 } : cameraOn(key));
  let cur = cam(S[0][0]);
  for (let i = 1; i < S.length; i++) {
    const [key, ts] = S[i];
    if (t < ts - 1.6) break;
    cur = move(t, cur, cam(key), ts - 1.6, ts + 1.8);
  }
  // Out of the prism: the camera starts inside the lens's core and pulls back as the line-work draws on.
  if (t < S[1][1] - 1.6) cur = { ...cur, zoom: Math.exp(lerp(Math.log(3.2), 0, span(t, A.H.end, A.H.end + 3.4, ease.out))) };
  return cur;
}
// The post stack: a facet's own pass runs only while the camera is all the way inside that
// facet; a glint marks the moment the pass comes on, as if the camera passed through the glass.
function look(t, A, cam, items) {
  const base = { bloom: 0.3, threshold: 0.85, vignette: 0.28, grain: 0.008 };
  if (cam.zoom < ZF * 0.97) return { post: base };
  for (const s of SEGMENTS) {
    const p = s.look && s.look(t, A, cam);
    if (p) {
      if (p.since != null) host.glint(t, p.since, items);
      return { post: { ...base, ...p.post }, pixel: p.pixel };
    }
  }
  return { post: base };
}
