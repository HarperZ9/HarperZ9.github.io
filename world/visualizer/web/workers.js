// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// workers.js: one module, three roles, chosen by the first message. Everything runs off the main thread.
//   analyse  { kind: 'audio', rate, channels } or { kind: 'series', values, labels, unit, duration, group }
//            -> the features the offline renderer uses (lib/features.mjs, lib/series.mjs), arrays transferred
//   water    { grid } then { t } per frame -> the wave surface at t (render/water.mjs on the glass module's Water)
//   body     { w, h } then { params } -> ribbon body (height, coverage) as RG floats (glass module sweep SDF)
import { analyse } from '../lib/features.mjs';
import { analyseSeries } from '../lib/series.mjs';
import { surfaceAt } from '../render/water.mjs';
import { barGeometry } from '../render/meter.mjs';
import { ribbonPaths, RIBBONS } from '../render/ribbons.mjs';
import { ribbons as sweep } from '../../glass/glass.js';

let role = null, grid = null, figure = null, events = null, bodySize = null, waterP = {};

function lite(F) {
  // strip the chroma matrix (only the meter needs it, and it ran here); keep series and the HUD spectrum
  const { chroma, ...rest } = F; return rest;
}
function transferables(F) { const t = Object.values(F.series).map(a => a.buffer); if (F.spec) t.push(F.spec.data.buffer); return t; }

onmessage = e => {
  const m = e.data;
  try {
    if (m.role) role = m.role;
    if (role === 'analyse') {
      const F = m.kind === 'audio' ? analyse({ rate: m.rate, channels: m.channels }) : analyseSeries(m.values, { labels: m.labels, unit: m.unit, name: m.name, duration: m.duration });
      if (m.kind === 'series' && m.group > 1) { const ph = m.groupAlign ? (m.group - (+F.labels[0]) % m.group) % m.group : 0; F.meter = { ...F.meter, beatsPerBar: m.group, phase: ph, identified: false, declared: true }; F.downbeats = F.beats.filter((_, i) => i % m.group === ph); }
      const L = lite(F); postMessage({ ok: true, F: L }, transferables(L));
    } else if (role === 'water') {
      if (m.grid) { grid = m.grid; figure = m.figure; waterP = m.water ?? {}; events = m.onsets.map(o => ({ t: o.t, vel: o.vel, size: o.vel })); postMessage({ ok: true }); return; }
      const place = ev => barGeometry(grid, ev.t, figure).pos;
      const S = surfaceAt(events, m.t, { nx: 192, ny: m.ny ?? 108, place, placeKey: `${figure.cx},${figure.cy},${figure.r},${figure.aspect}`,
        ...(waterP.damping !== undefined ? { damping: waterP.damping } : {}), ...(waterP.wind !== undefined ? { wind: waterP.wind } : {}), drop: { r: waterP.radius ?? 2.6, gain: waterP.gain ?? 1.1 } });
      const u = Float32Array.from(S.u); postMessage({ ok: true, u, nx: S.nx, ny: S.ny, t: m.t }, [u.buffer]);
    } else if (role === 'body') {
      if (m.size) { bodySize = m.size; postMessage({ ok: true }); return; }
      const [w, h] = bodySize, p = { ...RIBBONS, ...m.params, body: { ...RIBBONS.body, ...(m.params.body ?? {}) } };
      const B = sweep(w, h, ribbonPaths(w, h, p), { ...p.body, seed: p.seed }), rg = new Float32Array(w * h * 2);
      for (let i = 0; i < w * h; i++) { rg[i * 2] = B.height[i]; rg[i * 2 + 1] = B.mask[i]; }
      postMessage({ ok: true, rg, w, h, key: m.key }, [rg.buffer]);
    }
  } catch (err) { postMessage({ ok: false, error: String(err?.stack ?? err) }); }
};
