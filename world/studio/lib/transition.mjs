// transition.mjs: the move from one material to another, carrying a payload, at time t in [0, 1].
//
//   import { transition } from './lib/transition.mjs';
//   const f = transition('raked-concrete', 'liquid', { kind: 'data', value: [3, 5, 2, 8] }, 0.4);
//   f.e            eased progress (the destination's measured arrival curve, held on its cadence)
//   f.material     the blend at e: core numbers interpolated, plates and voices stacked by weight
//   f.drive        the payload converted for this material (data to brushstroke, code to image, sound to paint,
//                  text to rhythm; anything to liquid when the destination flows)
//   f.image({ w, h, seed, mask })   compositor Layer for this frame (toRGBA in lanes/image.mjs to export)
//   f.score({ seed })               sound score for this frame's material
//   f.type({ seed })                lettering spec (technique, face, colours) for this frame
//
// Pure: the same arguments give the same frame, in node and in the browser. Materials are ids or objects.
import { MATERIALS, CODE_MATERIAL } from './materials.mjs';
import { normalize } from './schema.mjs';
import { lerpMaterial } from './blend.mjs';
import { motion } from './lanes/motion.mjs';
import { renderImage } from './lanes/image.mjs';
import { score } from './lanes/sound.mjs';
import { typeSpec } from './lanes/type.mjs';
import { textDrive, dataBrush, codeDrive, soundPaint, scoreFeatures, anyLiquid, mergeDrives } from './drivers.mjs';

export const resolve = m => (typeof m === 'string' ? (m === 'code' ? CODE_MATERIAL : MATERIALS.find(x => x.id === m)) : normalize(m)) ?? (() => { throw new Error(`transition: unknown material ${m}`); })();

// payload: { kind: 'text' | 'data' | 'code' | 'audio' | 'none', value }. audio value: a score, or { onsets, seconds }.
export function payloadDrive(payload, material, { mask = null } = {}) {
  const m = normalize(material), k = payload?.kind ?? 'none', v = payload?.value;
  const flows = m.hints.image.plates.some(p => p.kind === 'liquid' && p.opacity > 0.3);
  let d = null, series = null, onsets = null, seconds = m.core.durationS * 2;
  if (k === 'text') d = textDrive(v);
  else if (k === 'data') { d = dataBrush(v, m); series = d.series; }
  else if (k === 'code') d = codeDrive(v, m);
  else if (k === 'audio') {
    const sc = v.events ? v : { onsets: v.onsets ?? [], seconds: v.seconds ?? 4, events: [] };
    const f = sc.events.length ? scoreFeatures(sc) : {};
    onsets = sc.onsets; seconds = sc.seconds;
    d = soundPaint(sc.onsets, { seconds: sc.seconds, ...f });
  }
  return flows ? mergeDrives(d, anyLiquid({ mask, series, onsets, seconds })) : mergeDrives(d);
}

export function transition(from, to, payload = null, t = 0, { held = true } = {}) {
  const A = resolve(from), B = resolve(to), mo = motion(B), u = Math.min(1, Math.max(0, t));
  const e = held ? mo.value(u * mo.durationS) : mo.raw(u);
  const material = lerpMaterial(A, B, Math.min(1, Math.max(0, e)));
  const drive = (opts = {}) => payloadDrive(payload, material, opts);
  return {
    t: u, e, material, from: A.id, to: B.id,
    drive: drive(),
    image: ({ w = 640, h = 400, seed = 1, mask = null, marks = false } = {}) => renderImage(material, { w, h, seed, mask, marks, time: Math.max(0.05, e), drive: drive({ mask })?.image }),
    score: ({ seed = 1 } = {}) => score(material, { seed, drive: drive()?.sound }),
    type: ({ seed = 1 } = {}) => typeSpec(material, { seed }),
    frame: mo.frame(u * mo.durationS),
  };
}
