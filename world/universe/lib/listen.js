// listen.js: the auditory view of a stop (PRINCIPLES-BRIEF 5: every element in every view, complementary rather
// than redundant). The stop's element is read as a score: its picture is cut into columns, scanned left to right;
// in each column the inked rows sound, higher rows higher in pitch, more ink louder, the column's place in the
// picture panned left to right. Pitches come from the sound theme's own scale rules: root, ninth, fifth, flat sixth
// and flat seventh, with the third kept out (music-third-thin, music-b6-colour). Onsets follow the place's own
// clock, so a stop on diffusion's time starts quick and slows, and a stop that keeps the theme's time lands on its
// kicks. Sound plays only when the visitor presses Listen, and stops when pressed again or when another stop plays.
//
//   const L = listener();  L.play(canvas, { clock, seconds, root }) -> Promise   L.stop()   L.playing
const DEGREES = [0, 2, 7, 8, 10];  // semitones above the root: the third is left out on purpose

export function listener() {
  let ctx = null, nodes = [], done = null, timer = 0;
  const stop = () => { for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } } nodes = []; clearTimeout(timer); done?.(); done = null; };
  return {
    get playing() { return nodes.length > 0; },
    stop,
    async play(canvas, { clock = (a) => a, seconds = 6, root = 110, cols = 24, rows = 12 } = {}) {
      stop();
      ctx = ctx || new AudioContext(); if (ctx.state === "suspended") await ctx.resume();
      const o = new OffscreenCanvas(cols, rows), x = o.getContext("2d", { willReadFrequently: true }); x.drawImage(canvas, 0, 0, cols, rows);
      const d = x.getImageData(0, 0, cols, rows).data, t0 = ctx.currentTime + 0.08, out = ctx.createGain(); out.gain.value = 0.18; out.connect(ctx.destination);
      for (let i = 0; i < cols; i++) {
        const at = t0 + seconds * clock(i / cols), voices = [];
        for (let j = 0; j < rows; j++) {
          const k = 4 * (j * cols + i), a = d[k + 3] / 255, lum = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255, ink = a * (1 - lum);
          if (ink > 0.18) voices.push([rows - 1 - j, ink]);
        }
        voices.sort((p, q) => q[1] - p[1]).slice(0, 3).forEach(([row, ink]) => {
          const deg = DEGREES[row % DEGREES.length] + 12 * Math.floor(row / DEGREES.length), f = root * 2 ** (deg / 12);
          const osc = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
          osc.type = "sine"; osc.frequency.value = f; pan.pan.value = (i / (cols - 1)) * 1.6 - 0.8;
          g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.35 * ink, at + 0.02); g.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
          osc.connect(g).connect(pan).connect(out); osc.start(at); osc.stop(at + 0.65); nodes.push(osc);
        });
      }
      return new Promise((res) => { done = res; timer = setTimeout(() => { nodes = []; done?.(); done = null; }, (seconds + 0.8) * 1000); });
    },
  };
}
