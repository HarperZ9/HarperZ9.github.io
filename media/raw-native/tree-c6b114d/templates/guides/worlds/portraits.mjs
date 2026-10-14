// Pixel portraits: the three guides drawn as busts on the shore palette for true pixel close
// frames, where the vector rig cannot hold a face (Pylon's eyes and nose fell under two art
// pixels at zoom 6, PROGRESS.md step 15). Each portrait has its base and the frames that change
// on it: mouth shut, half and open, and a blink. Shapes are placed by hand-chosen coordinates
// and drawn with a few pixel primitives; every detail (catch-lights, wax drips, bands, receipt
// lines, the tally) is placed by hand. Original art for raw-native under its licence.
import { canvas } from "./tidepool_px.mjs";

// Pixel primitives on a canvas: filled ellipse, filled polygon (even-odd scanline), line.
function ell(c, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) c.set(x, y, ch);
}
function poly(c, pts, ch) {
  const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) c.set(x, y, ch);
  }
}
function line(c, x0, y0, x1, y1, ch) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), ch);
}
// An outline in K round every filled pixel that touches the clear background.
function outline(c) {
  const g = c.g.map((r) => r.slice());
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (g[y][x] !== ".") continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy] || [])[x + dx] && g[y + dy][x + dx] !== "." && g[y + dy][x + dx] !== "K")) c.set(x, y, "K");
  }
}

// Tallow: the candle head with its eye under the flame, the high collar of the coat.
function tallowBust(mouth = 0, blink = false) {
  const c = canvas(40, 52);
  poly(c, [[2, 52], [6, 36], [12, 31], [28, 31], [34, 36], [38, 52]], "N");            // coat
  poly(c, [[12, 31], [20, 44], [28, 31]], "B");                                          // shirt front, shadow
  poly(c, [[12, 31], [17, 31], [20, 40]], "R"); poly(c, [[28, 31], [23, 31], [20, 40]], "R"); // lapels
  for (const y of [42, 47]) c.set(20, y, "A");                                             // brass buttons
  poly(c, [[11, 33], [11, 13], [29, 13], [29, 33]], "W");                                  // wax
  for (let y = 13; y < 33; y++) { c.set(11, y, "G"); c.set(12, y, "G"); c.set(28, y, "G"); }
  c.span(13, 11, 29, "W"); c.span(12, 13, 27, "W");                                         // the melted rim
  for (const [x, y0, y1] of [[14, 13, 19], [26, 13, 23], [25, 13, 17]]) for (let y = y0; y <= y1; y++) c.set(x, y, "G"); // drips
  c.set(14, 20, "G"); c.set(26, 24, "G");
  line(c, 20, 12, 20, 9, "K");                                                              // wick
  poly(c, [[20, 1], [16, 7], [17, 10], [23, 10], [24, 7]], "c");                            // flame
  poly(c, [[20, 3], [18, 8], [22, 8]], "A"); c.set(20, 6, "y"); c.set(20, 7, "y"); c.set(19, 8, "W"); c.set(20, 8, "W");
  // The eye, under heavy wax: white, iris, lid line level.
  ell(c, 20, 21, 5, 2.4, "W"); c.span(21, 15, 25, "W");
  ell(c, 21, 21, 1.6, 1.6, "D"); c.set(21, 21, "K"); c.set(22, 20, "W");
  if (blink) { c.span(20, 15, 25, "G"); c.span(21, 15, 25, "G"); c.span(22, 16, 24, "K"); }
  else { c.span(19, 15, 25, "G"); c.span(20, 15, 25, "K"); }
  c.span(25, 16, 24, "G");                                                                  // the bag under the eye
  // The mouth: a crease, half open or open.
  if (mouth === 0) c.span(29, 17, 23, "D");
  else if (mouth === 1) { c.span(28, 17, 23, "D"); c.span(29, 18, 22, "K"); }
  else { c.span(28, 17, 23, "D"); c.span(29, 17, 23, "K"); c.span(30, 18, 22, "K"); c.span(31, 19, 21, "C"); }
  outline(c);
  return c.tile();
}

// Pylon: a seal's round head, the cone, deadpan lids, the muzzle and whiskers, the sash.
function pylonBust(mouth = 0, blink = false) {
  const c = canvas(48, 52);
  poly(c, [[2, 52], [6, 38], [16, 32], [32, 32], [42, 38], [46, 52]], "r");               // shoulders
  ell(c, 24, 47, 13, 9, "F");                                                               // belly
  poly(c, [[6, 40], [10, 37], [40, 51], [35, 52]], "C");                                    // sash
  ell(c, 22, 44, 2.4, 2.4, "A"); c.set(22, 44, "y");                                        // badge
  ell(c, 24, 25, 15, 12, "r");                                                              // head
  for (const [x, y] of [[13, 21], [33, 19], [30, 31], [16, 30], [36, 26]]) c.set(x, y, "R"); // mottling
  // The cone, tilted a little, with its two bands and a rim.
  poly(c, [[14, 15], [22, 0], [25, 0], [33, 15]], "c");
  poly(c, [[17, 9], [30, 9], [31, 11], [16, 11]], "W"); poly(c, [[19, 4], [27, 4], [28, 6], [18, 6]], "W");
  poly(c, [[11, 14], [36, 14], [35, 17], [12, 17]], "C");
  // Eyes: dark, under level grey lids with an ink line; catch-lights at the outer corners.
  for (const [ex, cl] of [[17, 16], [31, 32]]) {
    ell(c, ex, 23, 3.6, 4.2, "K");
    if (blink) { for (let y = 19; y <= 25; y++) c.span(y, ex - 4, ex + 4, "r"); c.span(25, ex - 3, ex + 3, "K"); }
    else { for (let y = 18; y <= 20; y++) c.span(y, ex - 4, ex + 4, "r"); c.span(21, ex - 4, ex + 4, "K"); c.set(cl, 24, "W"); }
  }
  // Muzzle pads, nose, whiskers.
  ell(c, 21, 29, 3.4, 2.4, "G"); ell(c, 27, 29, 3.4, 2.4, "G"); c.set(20, 28, "W"); c.set(26, 28, "W");
  poly(c, [[22, 25], [26, 25], [24, 28]], "K");
  for (const [y, dy] of [[28, -1], [29, 0], [30, 1]]) { line(c, 16, y, 7, y + dy * 2, "W"); line(c, 32, y, 41, y + dy * 2, "W"); }
  if (mouth === 0) c.span(32, 22, 26, "K");
  else if (mouth === 1) { ell(c, 24, 32.5, 1.6, 1.2, "K"); }
  else { ell(c, 24, 33, 2.2, 2, "K"); c.set(24, 34, "C"); }
  outline(c);
  return c.tile();
}

// Rerun: the glass prism shell with its receipts and the one flare, eyes on stalks, the
// carapace, mouthparts and both claws, the tally scratched on the big one.
function rerunBust(mouth = 0, blink = false, gesture = null) {
  // Gestures (drawn for the close lines of his intro): "wave", the small claw up; "tally", the
  // big claw lifted toward the eyes with the scratches showing; "droop", stalks shorter and eyes down.
  const c = canvas(64, 48), drop = gesture === "droop" ? 3 : 0;
  poly(c, [[10, 34], [14, 8], [30, 1], [50, 6], [54, 30], [36, 38]], "T");                 // shell body
  poly(c, [[14, 8], [30, 1], [50, 6], [34, 13]], "F");                                       // lit top face
  poly(c, [[34, 13], [50, 6], [54, 30], [36, 38]], "B");                                     // shadow face
  for (let i = 0; i < 9; i++) line(c, 15 + (i % 2), 14 + i * 2.4, 30 - (i % 3) * 3, 13 + i * 2.4, "S"); // receipts inside
  line(c, 16, 9, 30, 3, "W"); line(c, 37, 13, 50, 7, "W");                                   // glints
  // The flare: one spectral fan from the shell's corner.
  [["e", -3], ["c", -2], ["y", -1], ["S", 0], ["b", 1], ["v", 2]].forEach(([ch, k]) => line(c, 51, 6, 63, 1 + k * 1.6, ch));
  c.set(51, 6, "W"); c.set(50, 6, "W");
  // Carapace and claws.
  ell(c, 28, 40, 14, 7, "C"); ell(c, 26, 38, 8, 3, "c");
  if (gesture === "wave") { poly(c, [[10, 37], [4, 24], [8, 20], [13, 33]], "C"); poly(c, [[4, 24], [1, 17], [6, 16], [8, 20]], "c"); line(c, 2, 14, 0, 12, "W"); line(c, 7, 13, 8, 11, "W"); }
  else { poly(c, [[6, 40], [1, 33], [6, 30], [10, 36]], "C"); poly(c, [[1, 33], [0, 28], [5, 29]], "c"); }   // small claw
  if (gesture === "tally") {
    poly(c, [[42, 38], [46, 26], [56, 20], [60, 28], [50, 36]], "C"); poly(c, [[46, 26], [50, 16], [57, 15], [56, 20]], "c");
    for (const x of [49, 51, 53, 55]) line(c, x, 24, x - 1, 28, "W"); line(c, 48, 27, 56, 25, "W");      // four and the fifth across
  } else {
    poly(c, [[44, 40], [52, 34], [61, 36], [62, 44], [50, 46]], "C"); poly(c, [[52, 34], [60, 28], [63, 34], [58, 37]], "c"); // big claw
    for (const x of [53, 55, 57, 59]) line(c, x, 39, x - 1, 42, "W");                        // the tally
  }
  // Eye stalks and eyes; looking at the claw for "tally", down for "droop".
  const lookX = gesture === "tally" ? 1 : 0, lookY = gesture === "droop" ? 1 : gesture === "tally" ? 0 : -1;
  for (const sx of [21, 31]) {
    line(c, sx, 37, sx + (sx < 26 ? -2 : 2), 26 + drop, "C"); line(c, sx + 1, 37, sx + 1 + (sx < 26 ? -2 : 2), 26 + drop, "c");
    const ex = sx + (sx < 26 ? -2 : 2);
    ell(c, ex, 23 + drop, 3, 3, "K");
    if (blink) { c.span(23 + drop, ex - 2, ex + 2, "C"); c.span(22 + drop, ex - 2, ex + 2, "C"); } else c.set(ex + 1 + lookX, 23 + drop + lookY, "W");
  }
  // Mouthparts: two small plates that part as it talks.
  const gap = [0, 1, 2][mouth];
  poly(c, [[25 - gap, 42], [27 - gap, 46], [28 - gap, 42]], "R"); poly(c, [[29 + gap, 42], [30 + gap, 46], [32 + gap, 42]], "R");
  if (gap) c.span(43, 28 - gap + 1, 29 + gap - 1, "K");
  outline(c);
  return c.tile();
}

export const RERUN_GESTURES = ["wave", "tally", "droop"];
const MAKE = { tallow: tallowBust, pylon: pylonBust, rerun: rerunBust };
// Every frame of every portrait: NAME-m0, -m1, -m2 (mouth) and NAME-blink, and Rerun's gestures.
export function portraitFrames() {
  const out = {};
  for (const [g, f] of Object.entries(MAKE)) { for (const m of [0, 1, 2]) out[`${g}-m${m}`] = f(m, false); out[`${g}-blink`] = f(0, true); }
  // Rerun's gesture frames, each with its mouths and blink: NAME-GESTURE-m0..m2, NAME-GESTURE-blink.
  for (const gst of RERUN_GESTURES) { for (const m of [0, 1, 2]) out[`rerun-${gst}-m${m}`] = rerunBust(m, false, gst); out[`rerun-${gst}-blink`] = rerunBust(0, true, gst); }
  return out;
}
