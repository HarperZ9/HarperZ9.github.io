// "Colour on a budget", as a Motion scene: one file for the video and for the interactive
// version. The script, the sources and the timing are the film's own files (film.json,
// evidence.json, timing.json); this scene adds no claim. Every cue is a sentence start (or a
// word inside one) in timing.json, so the pictures re-time when the narration lands. Draft:
// timing.json is provisional, and the predict beat is a silent still pending the author.
//
// One picture: a dusk sky over a lighthouse at 320 x 200, put through every budget the script
// names (scene/picture.mjs computes each one when the scene loads). Rerun hosts from its pixel
// tidepool at the cold open and the close (scene/host.mjs).
import { C, cues, tab, span, window, ease } from "./scene/lib.mjs";
import { budgets, toImage, bytesImage } from "./scene/picture.mjs";
import * as host from "./scene/host.mjs";
import * as s1 from "./scene/s1-budget.mjs";
import * as s2 from "./scene/s2-dither.mjs";

const FPS = 30;
// The camera: still, except a push in to the pixel grid at "320 by 200" and back out.
const HOME = { x: 960, y: 540, zoom: 1 };
const CROP = { x: s1.PIC.x + (226 + 8) * 3, y: s1.PIC.y + (49 + 5) * 3, zoom: 7 };

// A threshold mask (values 0..max-1) as a grey image, upscaled so pixel edges stay hard.
function maskImage(get, n, tile, max, f) {
  const w = n * tile * f, data = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const v = Math.round((get(Math.floor(x / f) % n, Math.floor(y / f) % n) / (max - 1)) * 255), o = (y * w + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  return { width: w, height: w, data };
}

const scene = {
  title: "Colour on a budget",
  duration: 230,   // set from the timing in load()
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  params: [],
  async load(ctx) {
    const [sans, head, mono, timing, evidence, film, rose] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"), ctx.json("timing.json"),
      ctx.json("evidence.json"), ctx.json("film.json"), ctx.json("scene/rosewood.json")]);
    const c = cues(timing), B = budgets(), A = { sans, head, mono, B, rose, H: await host.load(ctx) };
    const open = film.host.open.seconds, close = film.host.close.seconds, end = Math.round((c.last + close) * FPS) / FPS;
    scene.duration = end;
    // The picture's budgets as images (2 x, so the bilinear image paint keeps hard pixel edges).
    if (ctx.motion) {
      ctx.motion.image("src", bytesImage(B.src, 2));
      ctx.motion.image("mc", toImage(B.mc.map, B.mc.palette, 2));
      for (const k of ["egaNone", "egaBayer", "egaBlue", "egaFS"]) ctx.motion.image(k, toImage(B[k], B.ega, 2));
      ctx.motion.image("maskBayer", maskImage((x, y) => B.bayer8[y][x], 8, 8, 64, 4));
      ctx.motion.image("maskBlue", maskImage((x, y) => B.blue[y * 64 + x], 64, 1, 4096, 4));
    }
    A.T = {
      host: { openEnd: open, closeStart: c.last + 0.4, end },
      s1: { title: c.at(0, 0, 0), vga: c.at(1, 0, 0), mode: c.word(1, 0, 0, "320"), colours: c.at(1, 1, 0), mc: c.at(2, 0, 0), cut: c.word(2, 1, 1, "Cut"),
        collapse: c.at(2, 2, 0), bits: c.at(2, 3, 0), stripes: c.at(3, 0, 0), stripeWord: c.word(3, 0, 0, "stripes"), exit: c.at(4, 0, 0) },
      s2: { bayer: c.at(4, 0, 0), levels: c.at(4, 1, 0), egaB: c.word(4, 1, 0, "65") + 1.2, fs: c.at(5, 0, 0), weights: c.at(5, 1, 0), blend: c.at(5, 2, 0),
        blue: c.at(6, 0, 0), grain: c.at(6, 1, 0), oklab: c.at(7, 0, 0), oklabWord: c.word(7, 0, 0, "Oklab"), parity: c.at(8, 0, 0),
        parityWord: c.word(8, 0, 1, "16,777,216"), brender: c.at(8, 1, 0), close: c.at(9, 0, 0), two: c.at(9, 0, 2), voice: c.at(9, 1, 0), end: c.last + 0.3 },
    };
    const T = A.T;
    A.keys = [[0, HOME], [T.s1.mode - 0.2, HOME], [T.s1.mode + 2.8, CROP], [T.s1.colours - 0.4, CROP], [T.s1.colours + 1.6, HOME]];
    const tb = (id, t0, t1) => ({ shape: tab(evidence, id, mono), t0, t1 });
    A.tabs = [tb("vga", c.at(1, 0, 0), c.at(1, 1, 0)), tb("abrash", c.at(1, 1, 0), c.end(1, 1, 0) + 0.6), tb("heckbert1982", c.at(2, 0, 0), T.s1.stripes),
      tb("bayer1973", c.at(4, 0, 0), c.at(4, 1, 0)), tb("bouman2013", c.at(4, 1, 0), c.at(5, 0, 0)), tb("floyd-steinberg", c.at(5, 0, 0), c.at(6, 0, 0)),
      tb("ulichney1993", c.at(6, 0, 0), c.at(7, 0, 0)),
      tb("oklab2020", c.at(7, 0, 0), c.at(8, 0, 0)), tb("rn-dither", c.at(8, 0, 0), c.at(8, 1, 0)), tb("rosewood-texel", c.at(8, 1, 0), c.at(9, 0, 0))];
    s1.prepare(A); s2.prepare(A);
    scene.chapters = film.segments.map((s, i) => ({ title: s.heading, t: Math.max(0, i === 0 ? 0 : c.at(i, 0, 0) - 0.6) }));
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T;
    const painted = host.frame(t, ctx, A.H, T.host);
    if (painted) return painted;
    const items = [], camera = cameraAt(A.keys, t);
    s1.draw(t, A, T.s1, items);
    s2.draw(t, A, T.s2, items);
    for (const tb of A.tabs) {
      const a = window(t, tb.t0, tb.t1, 0.6, 0.6);
      if (a > 0) items.push({ shape: tb.shape, fill: C.dim, opacity: a, screen: true });
    }
    // The fade back to the tidepool at the end.
    const out = span(t, T.host.closeStart - 0.6, T.host.closeStart, ease.inOut);
    if (out > 0) items.push({ shape: [{ pts: new Float32Array([-20, -20, 1940, -20, 1940, 1100, -20, 1100]), closed: true }], fill: [0.004, 0.004, 0.01, 1], opacity: out, screen: true });
    return { background: C.void, camera, items, post: { bloom: 0.12, threshold: 0.95, vignette: 0.2, grain: 0 } };
  },
};

function cameraAt(keys, t) {
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i], [t0, a] = keys[i - 1];
    if (t < t1) {
      const u = span(t, t0, t1, ease.inOut);
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * u) };
    }
  }
  return keys[keys.length - 1][1];
}

export default scene;
