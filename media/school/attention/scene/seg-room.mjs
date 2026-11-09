// Segments in the lamp room: the cold open (a match, then the lamp), the title, the sentence with a
// hole, and question, label and cargo (scores, shares and the blend, from the model's numbers).
import { rect, circle, polyline, C, rng, span, window, ease, lerp, words, label, pct, smooth01, clamp, darkness, glow, clipBeat } from "./lib.mjs";
import { night, glazing, lens, card, cardAt, beam, tallow, LENS, TALLOW } from "./room.mjs";

const sinT = (t, f) => Math.sin(t * f);

// Tallow's idle loop with options laid over it.
export function tallowO(t, extra = {}) {
  const base = clipBeat("tallow", "idle", { ...TALLOW, o: { armR: 30, elbR: 40, prop: null, lid: 0.45, look: [4, -2] } }, t % 2.4).o;
  return { ...base, flame: 0.92 + 0.08 * sinT(t, 11), ...extra };
}

// The room and its light, which every room segment draws first. lamp scales the lens's light.
export function roomBase(t, { lamp = 1, a = t * 1.3, dark = 0.62, iris = 1 } = {}) {
  return { back: [...night(t), ...glazing(), ...lens(t, { a, lamp, iris })],
    light: [darkness(LENS.x - 260, LENS.y + 120, 1300, dark), glow(LENS.x, LENS.y, 520 * lamp, [1, 0.62, 0.28], 0.35 * lamp)] };
}

// Cold open: black, a match strikes, sparks fall, Tallow's wick takes, then the great lamp.
export function open(t, A, T) {
  const items = [], strike = 0.5, lit = span(t, 0.9, 1.6, ease.out), lamp = span(t, 2.2, 3.4, ease.out);
  const r = rng(3);
  for (let i = 0; i < 70; i++) {
    const age = t - strike - r() * 0.15; if (age < 0 || age > 1.4) { r(); r(); continue; }
    const vx = (r() - 0.4) * 420, vy = -r() * 380, x = 620 + vx * age, y = 330 + vy * age + 600 * age * age;
    items.push({ shape: circle(x, y, 2.5 * (1 - age / 1.4), 8), fill: [1, 0.75, 0.35, 1 - age / 1.4], blend: "add" });
  }
  const R = roomBase(t, { lamp, dark: 0.95 - 0.33 * lamp });
  const room = lamp > 0 ? R.back.map((it) => (it.screen ? it : { ...it, opacity: (it.opacity ?? 1) * lamp })) : [];
  items.unshift(...room);
  items.push(...tallow(tallowO(t, { flame: lit, armR: 120 - 60 * lamp, elbR: 60, lid: 0.6 - 0.3 * lit })));
  items.push(darkness(620, 380, 260 + 1100 * Math.max(lit * 0.25, lamp), 0.98 - 0.36 * lamp));
  if (lit > 0) items.push(glow(626, 388, 300 * lit, [1, 0.6, 0.25], 0.5 * lit));
  if (lamp > 0) items.push(glow(LENS.x, LENS.y, 520 * lamp, [1, 0.62, 0.28], 0.35 * lamp));
  const cam = { x: lerp(640, 960, span(t, 1.2, T.openEnd, ease.inOut)), y: lerp(420, 540, span(t, 1.2, T.openEnd, ease.inOut)), zoom: lerp(2.4, 1, span(t, 1.2, T.openEnd, ease.inOut)) };
  return { items, camera: cam };
}

// Title: the word written into the lens glass as light.
export function title(t, A, T) {
  const R = roomBase(t), items = [...R.back, ...tallow(tallowO(t)), ...R.light];
  const a = window(t, T.say, T.end, 0.8, 0.8);
  if (a > 0) items.push({ shape: words("Attention", A.head, 96, LENS.x, LENS.y + 34, "center"), fill: [1, 0.92, 0.75, a], blend: "add" });
  return { items, camera: { x: 960, y: 540, zoom: 1 + 0.03 * span(t, T.say, T.end) } };
}

// The probe sentence on cards along the glass, a blank card for the hole, the sweep, the reveal.
export function hole(t, A, T, F) {
  const W = F.probe.words, n = W.length + 1, R = roomBase(t), items = [...R.back];
  const reveal = span(t, T.reveal, T.reveal + 1.4, ease.inOut), sweepOn = window(t, T.ask.start, T.reveal + 0.6, 0.5, 0.6);
  const sweepAt = ((t - T.ask.start) * 1.6) % n;
  const ans = F.probe.answerFrom;
  W.forEach((w, i) => {
    const arrive = span(t, lerp(T.say0, T.say1, i / n) - 0.2, lerp(T.say0, T.say1, i / n) + 0.5, ease.backOut);
    const near = Math.max(0, 1 - Math.abs(i - sweepAt) / 1.2) * sweepOn, lit = clamp(near + (i === ans ? reveal : 0), 0, 1);
    if (lit > 0.02) items.push(beam(cardAt(i, n).x, cardAt(i, n).y, lit));
    items.push(...card(A, w, cardAt(i, n), { arrive, lit, hot: i === W.length - 1 }));
  });
  const hp = cardAt(n - 1, n), ha = span(t, T.say1 - 0.2, T.say1 + 0.6, ease.backOut);
  items.push(...card(A, "", hp, { arrive: ha, blank: reveal < 0.95, lit: 0.3 * window(t, T.say1, T.reveal, 0.4, 0.4) * (0.6 + 0.4 * Math.sin(t * 6)) }));
  // The answer flies into the hole; then six or seven hops mark the distance back.
  if (reveal > 0) {
    const a = cardAt(ans, n), x = lerp(a.x, hp.x, reveal), y = lerp(a.y, hp.y, reveal) - 140 * Math.sin(Math.PI * reveal);
    items.push({ shape: words(F.probe.answer, A.sans, 38, x, y + 13, "center"), fill: reveal >= 1 ? "#1d1812" : [1, 0.9, 0.7, 1] });
    const hops = n - 1 - ans, hu = span(t, T.back, T.back + 2.2, ease.linear) * hops;
    for (let h = 0; h < Math.floor(hu); h++) { const c = cardAt(n - 1 - h - 1, n); items.push({ shape: circle(c.x, c.y - 84, 8, 16), fill: C.hot }); }
  }
  const lean = reveal > 0 ? 0 : 18 * window(t, T.say1, T.reveal, 0.5, 0.5);
  items.push(...tallow(tallowO(t, { lean, lid: lean ? 0.62 : 0.45, look: [8, -3] })), ...R.light);
  return { items, camera: { x: 960, y: 520, zoom: 1.02 } };
}

// Question, label and cargo: each card gets a tab and a crate; the reading word's beam brings back
// a score per card (the model's own), the scores become shares in one column, and the crates blend.
export function lamp(t, A, T, F) {
  const W = F.probe.words, n = W.length, q = n - 1, R = roomBase(t, { a: 2.2 }), items = [...R.back];
  const tabs = span(t, T.parts, T.parts + 1.2), sc = span(t, T.scores, T.scores + 1.6), sh = span(t, T.shares, T.shares + 2.0, ease.inOut), mv = span(t, T.blend, T.blend + 2.6, ease.inOut);
  const smax = Math.max(...F.scores.slice(0, q + 1).map(Math.abs));
  W.forEach((w, i) => {
    const p = cardAt(i, n), lit = i === q ? 0.4 : clamp(sh * F.shares[i] * 1.8 + sc * 0.08, 0, 1);
    if (i < q && sc > 0) items.push(beam(p.x, p.y, clamp(0.15 * sc + sh * F.shares[i] * 1.6, 0, 1), { half: 70 }));
    items.push(...card(A, w, p, { lit, hot: i === q }));
    if (tabs > 0) items.push({ shape: rect(p.x - 30, p.y - 96, 60, 26, 3), fill: [0.38, 0.55, 0.62, tabs] }, { shape: rect(p.x - 20, p.y + 66, 40, 30 * (i === q ? 1 : 1 - mv * 0.9), 3), fill: [0.62, 0.45, 0.25, tabs], stroke: "#0b0a0c", width: 2 });
    // The score, counting up, over the card; it fades as the shares take over.
    if (sc > 0 && i <= q) {
      const v = F.scores[i] * sc, op = 1 - sh * 0.6;
      items.push({ shape: words(v.toFixed(1), A.mono, 28, p.x, p.y - 112, "center"), fill: v >= 0 ? C.ink : "#9fb4d0", opacity: op });
      items.push({ shape: rect(p.x - 6, p.y - 150 - Math.max(0, v / smax) * 60, 12, Math.abs(v / smax) * 60, 2), fill: v >= 0 ? [1, 0.85, 0.6, 0.6 * op] : [0.6, 0.75, 1, 0.6 * op] });
    }
  });
  // One column that the shares stack into: it always reads 100 percent.
  if (sh > 0) {
    const x = 1790, y0 = 920, H = 470;
    let acc = 0;
    for (let i = 0; i <= q; i++) {
      const h = F.shares[i] * H * sh;
      items.push({ shape: rect(x - 34, y0 - acc - h, 68, Math.max(0, h - 2)), fill: i === F.probe.answerFrom ? [0.89, 0.58, 0.45, 0.9] : [0.93, 0.88, 0.75, 0.25 + 0.6 * F.shares[i]] });
      if (F.shares[i] > 0.06 && sh > 0.9) items.push({ shape: words(`${W[i]} ${pct(F.shares[i])}`, A.mono, 28, x - 50, y0 - acc - h / 2 + 7, "right"), fill: C.ink });
      acc += h;
    }
    items.push(label(A, "100%", 26, x, y0 - H - 24, C.ink, "center", sh, "mono"));
  }
  // The crates travel down the beams, sized by share, and merge at the reading word.
  if (mv > 0 && mv < 1) {
    const qp = cardAt(q, n);
    for (let i = 0; i < q; i++) { const p = cardAt(i, n), u = smooth01(mv * 1.3 - i * 0.02), s = 10 + 60 * F.shares[i]; items.push({ shape: rect(lerp(p.x, qp.x, u) - s / 2, lerp(p.y + 80, qp.y + 80, u) - s / 2, s, s, 3), fill: [0.75, 0.55, 0.3, 0.95], stroke: "#0b0a0c", width: 2 }); }
  }
  items.push(...tallow(tallowO(t, { armR: 140, elbR: 20, look: [10, -6], lid: 0.4 })), ...R.light);
  return { items, camera: { x: 960 + 40 * sh, y: 520, zoom: 1.0 } };
}
