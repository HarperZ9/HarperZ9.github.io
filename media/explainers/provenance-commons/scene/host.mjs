// The host, Pylon, in her home style: the painted isometric harbour (raw-native
// templates/guides). A cone means nobody has checked a claim yet (CHARACTERS.md).
//
// Cold open: a paper boat has washed up on the quay. She sets a cone on it: a claim nobody has
// checked, and nobody can yet say where it came from. No words; the voice starts after her.
// Close: the same boat now carries its manifest, with a fine thread back out to sea where it
// was made. Her cone stands beside it, off the boat. She looks at the viewer and leaves the call
// to them. Both beats are wordless: the paint pass would smear type, so all words stay in the net.
import { shot } from "../../../raw-native/tree-c6b114d/templates/guides/stage.mjs";
import { BEATS } from "../../../raw-native/tree-c6b114d/templates/guides/beats.mjs";
import { coneParts } from "../../../raw-native/tree-c6b114d/templates/guides/pylon.mjs";
import { P, INK } from "../../../raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { S as isoS, depth as isoDepth, groundShadow } from "../../../raw-native/tree-c6b114d/templates/guides/worlds/iso_kit.mjs";
import { rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { span, ease, lerp } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";

const HOME = BEATS.pylon.painted;
// The boat she cones (the action clip's own target: one cell along i, a little back in j).
export const BOAT = [HOME.cell[0] + 1.2, HOME.cell[1] - 0.3];
// Framed between her and the boat, closer than the template's wide shot.
const [bx, by] = isoS(...BOAT), [px, py] = isoS(...HOME.cell);
const CAM = { x: (bx + px) / 2 + 20, y: Math.min(by, py) - 120, zoom: 1.55 };

export const openShot = shot({ guide: "pylon", style: "painted", clip: "action", beat: { ...HOME, camera: CAM }, layer: "art" });

// The checked boat: manifest sheet on the mast, a thread back to sea, the cone set down beside it.
function manifestBoat() {
  const [x, y] = isoS(...BOAT), k = 1.5;   // drawn larger than the other boats: it is the one that matters
  const q = (dx, dy) => `${(x + dx * k).toFixed(1)} ${(y + dy * k).toFixed(1)}`;
  const items = [
    { shape: P(`M ${q(-30, -8)} L ${q(30, -8)} L ${q(18, 6)} L ${q(-18, 6)} Z`), fill: "#ddd2b6", stroke: INK, width: 2.5 },
    { shape: P(`M ${q(-15, -8)} L ${q(2, -46)} L ${q(15, -8)} Z`), fill: "#efe6d0", stroke: INK, width: 2.5 },
    // The manifest: a sheet pinned to the sail, ruled with three lines.
    { shape: P(`M ${q(4, -40)} L ${q(30, -44)} L ${q(32, -14)} L ${q(6, -10)} Z`), fill: "#f4ecd6", stroke: INK, width: 2 },
    { shape: P(`M ${q(9, -33)} L ${q(26, -36)} M ${q(10, -26)} L ${q(27, -29)} M ${q(10, -19)} L ${q(22, -21)}`), fill: null, stroke: "#5b4e3c", width: 1.6 },
  ];
  // Its provenance: a fine bone thread from the boat out over the water, ending at a maker's mark.
  const [sx, sy] = isoS(BOAT[0] + 5.2, BOAT[1] + 1.2);   // out past the quay edge, over the water
  items.push({ shape: P(`M ${x + 30 * k} ${y - 2} Q ${(x + sx) / 2 + 30} ${(y + sy) / 2 + 30} ${sx} ${sy}`), fill: null, stroke: "#efe6d0", width: 2.2 });
  items.push({ shape: P(`M ${sx - 7} ${sy - 7} L ${sx + 7} ${sy - 7} L ${sx + 7} ${sy + 7} L ${sx - 7} ${sy + 7} Z`), fill: "#efe6d0", stroke: INK, width: 2 });
  const [cx, cy] = isoS(BOAT[0] - 0.55, BOAT[1] + 0.45);
  const cone = coneParts(cx, cy, { scale: 0.36 * k }).map((p) => ({ shape: P(p.d), fill: p.fill, stroke: INK, width: 2 }));
  return [{ d: isoDepth(...BOAT), items: [...groundShadow(...BOAT, 0.3, 0.8), ...items] },
    { d: isoDepth(BOAT[0] - 0.55, BOAT[1] + 0.45), items: [...groundShadow(BOAT[0] - 0.55, BOAT[1] + 0.45, 0.2, 0.8), ...cone] }];
}

export const closeShot = shot({ guide: "pylon", style: "painted", clip: "idle", layer: "art",
  beat: { ...HOME, camera: { ...CAM, zoom: CAM.zoom * 1.08 }, o: { tilt: 4, lid: 0.45, flipR: 30, look: [0, 3] },
    things: () => [...HOME.things(), ...manifestBoat()] } });

export async function load(ctx) {
  return openShot.load(ctx);   // both shots share the same harbour, guide and atlas
}

// A dark veil drawn over the art: how a host beat fades to and from the night.
const veil = (o) => ({ shape: rect(-20, -20, 1960, 1120), screen: true, fill: [0.004, 0.005, 0.01, 1], opacity: o });

// The painted frame at film time t, or null outside the host beats. T: { openEnd, closeStart, end }.
export function frame(t, ctx, H, T) {
  if (t < T.openEnd) {
    const f = openShot.frame(Math.min(t, 3.19), { ...ctx, assets: H });
    // A slow push toward the coned boat while she works; the night closes in at the end.
    f.camera = { ...f.camera, zoom: f.camera.zoom * lerp(1, 1.1, span(t, 0, T.openEnd, ease.inOut)) };
    const dark = Math.max(1 - span(t, 0, 0.7, ease.out), span(t, T.openEnd - 0.7, T.openEnd, ease.inOut));
    if (dark > 0.003) f.items = [...f.items, veil(dark)];
    return f;
  }
  if (t >= T.closeStart) {
    const u = t - T.closeStart, f = closeShot.frame(u % 2.4, { ...ctx, assets: H });
    const dark = Math.max(1 - span(u, 0, 0.8, ease.out), span(t, T.end - 0.9, T.end, ease.inOut));
    if (dark > 0.003) f.items = [...f.items, veil(dark)];
    return f;
  }
  return null;
}
