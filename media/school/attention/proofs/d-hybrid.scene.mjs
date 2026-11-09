// Direction D, a hybrid of B and C: Tallow's lamp room (the world), and inside the great lens the
// data view (the mechanism). The camera pushes into the lens; the lens opens as an aperture until
// the data view fills the frame. Thriller film stock over both, so world and data share one look.
import { circle, rect } from "../../../raw-native/tree-ada041f/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-ada041f/web/motion/text.mjs";
import { pose } from "../../../raw-native/tree-ada041f/templates/guides/rig.mjs";
import { GUIDES } from "../../../raw-native/tree-ada041f/templates/guides/guides.mjs";
import { LOOKS, darkness, glow } from "../../../raw-native/tree-ada041f/templates/guides/look.mjs";
import { room, lens, LENS } from "./b-thriller.scene.mjs";
import { dataItems } from "./c-dataart.scene.mjs";
import { smooth, loadAtlas } from "./common.mjs";

export default {
  title: "Attention proof D: the lens opens onto the data", duration: 6, fps: 30,
  async load(ctx) { return loadAtlas(ctx); },
  frame(t, ctx) {
    const A = ctx.assets, push = smooth(0.3, 2.4, t), open = smooth(1.6, 3.0, t);
    // World: the lamp room, with Tallow raising the query card to the lens.
    const g = GUIDES.tallow, T = { x: 640, y: 1010, s: 0.62 };
    const world = [...room(), ...lens(t), ...g.under(T.x, T.y, T.s, "thriller"),
      ...pose(g.parts({ armR: 150, elbR: 30, prop: "card", lid: 0.45, look: [9, -6], flame: 0.9 + 0.1 * Math.sin(t * 9), lean: 16 }), { ...T, shear: g.shear }),
      darkness(LENS[0] - 200, LENS[1] + 80, 1250, 0.6), glow(LENS[0], LENS[1], 520, [1, 0.62, 0.28], 0.35)];
    // The aperture: a circle on the lens that grows past the frame; the data view is clipped to it.
    // The data view is drawn in screen space so it fills the frame once the aperture is open.
    const r = 40 + open * 1400, cam = { x: 960 + (LENS[0] - 960) * push, y: 540 + (LENS[1] - 540) * push, zoom: 1 + 1.6 * push };
    const [sx, sy] = [960 + (LENS[0] - cam.x) * cam.zoom, 540 + (LENS[1] - cam.y) * cam.zoom];
    const hole = circle(sx, sy, r, 128);
    const data = open > 0 ? dataItems(A, 1.0 + (t - 1.6) * 1.4).items.map((it) => ({ ...it, screen: true, clip: hole })) : [];
    const back = open > 0 ? [{ shape: hole, fill: [0, 0, 0, 1], screen: true }] : [];
    const hud = [{ shape: text("inside the lamp: the computation", { atlas: A.atlas, size: 34, x: 960, y: 70, anchor: "center" }).shape, fill: "#d9cdb4", opacity: smooth(3.2, 3.8, t), screen: true },
      { shape: rect(0, 0, 1, 1), fill: [0, 0, 0, 0], screen: true }];
    const L = LOOKS.thriller;
    return { background: L.ground, camera: cam, items: [...world, ...back, ...data, ...hud], post: L.post };
  },
};
