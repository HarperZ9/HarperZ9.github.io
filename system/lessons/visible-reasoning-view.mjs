// "Slip in a hint", drawn: Tallow's night desk with twenty answer cards pinned to a board. With
// the hint slipped in, a yellow slip hangs on every card. When he reads them, his light passes
// over each card: a reasoning that names the hint gets a ring; an answer the hint changed whose
// reasoning does not name it gets a broken ring in the drift colour.
import { pose } from "../../media/raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { GUIDES } from "../../media/raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { thrillerSet } from "../../media/raw-native/tree-c6b114d/templates/guides/sets.mjs";
import { clipBeat } from "../../media/raw-native/tree-c6b114d/templates/guides/motion.mjs";
import { LOOKS } from "../../media/raw-native/tree-c6b114d/templates/guides/look.mjs";
import { rect, circle } from "../../media/raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../media/raw-native/tree-c6b114d/web/motion/text.mjs";

export const INK = "#ece5d6", OK = "#63d4ce", HOT = "#e29472";
const T = GUIDES.tallow, EACH = 0.3, TALLOW = { x: 300, y: 1010, s: 0.8 };
export const readLength = (n) => n * EACH + 0.6;
const cardAt = (i) => [520 + (i % 5) * 160, 170 + Math.floor(i / 5) * 112];
const word = (s, size, x, y, anchor, atlas, fill) => ({ shape: text(s, { atlas, size, x, y, anchor }).shape, fill });

function card(c, i, hint, read, atlas) {
  const [x, y] = cardAt(i), out = [{ shape: rect(x, y, 140, 92, 4), fill: "#e4d9bd", stroke: "#2a2219", width: 2 },
    word(c.given, 48, x + 36, y + 64, "center", atlas, "#1d1812")];
  for (let k = 0; k < 3; k++) out.push({ shape: rect(x + 66, y + 22 + k * 20, 58 - k * 12, 6), fill: "#5a4c3a", opacity: 0.7 });
  if (hint) out.push({ shape: rect(x + 92, y - 14, 42, 30, 2), fill: "#e8c85a", stroke: "#2a2219", width: 1.5 }, word(c.hinted, 22, x + 113, y + 9, "center", atlas, "#1d1812"));
  if (read && c.named) out.push({ shape: circle(x + 70, y + 46, 70, 48), fill: null, stroke: OK, width: 5 });
  if (read && c.flipped && !c.named) out.push({ shape: circle(x + 70, y + 46, 70, 48), fill: null, stroke: HOT, width: 5, dash: [14, 10] });
  return out;
}

// v: { cards, hint, readStart (time, or null) }.
export function frame(v, now, A, { reduced = false } = {}) {
  const items = [...thrillerSet(A), { shape: rect(490, 140, 840, 470, 6), fill: "#3a2a1c", stroke: "#0c0907", width: 6 }];
  const t = v.readStart === null ? -1 : reduced ? 1e9 : now - v.readStart, upTo = t < 0 ? -1 : Math.floor(t / EACH);
  v.cards.forEach((c, i) => items.push(...card(c, i, v.hint, i <= upTo, A.atlas)));
  const reading = t >= 0 && upTo < v.cards.length, [cx] = cardAt(Math.min(Math.max(upTo, 0), v.cards.length - 1));
  const b = clipBeat("tallow", "idle", { ...TALLOW, o: { armR: reading ? 150 : 40, elbR: reading ? 10 : 50, prop: reading ? "loupe" : null, lid: 0.45, look: [8, -6], lean: reading ? 14 + (cx - 520) / 60 : 0 } }, now % 2.4);
  items.push(...T.under(TALLOW.x, TALLOW.y, TALLOW.s, "thriller"), ...pose(T.parts(b.o), { x: TALLOW.x, y: TALLOW.y, s: TALLOW.s, shear: T.shear || 0 }));
  items.push(...T.light("thriller", { x: 960, y: 540, zoom: 1 }, { ...TALLOW, o: b.o }));
  const L = LOOKS.thriller;
  return { background: L.ground, camera: { x: 960, y: 540, zoom: 1 }, items, post: reduced ? { ...L.post, passes: L.post.passes.filter((p) => p.pass !== "crt-classic") } : L.post };
}
