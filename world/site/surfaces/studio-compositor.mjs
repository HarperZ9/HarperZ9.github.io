// studio-compositor.mjs: Consolidated 11-Layer Live Multimedia Studio (#studio-canvas-shell) for /playground/.
// Combines Estuary, Low Water, Glass & Water, 3D Mesh, Elements Palette, Fourier, Living Type, Retro 46 FX,
// Loom Jacquard, Plotter Contours, and Distill Layer-0 File Ingest with 4 presets + docked 4-lane modal DAW.
import { LAYER_RENDERERS, STACK_PRESETS, STUDIO_LAYERS, createLayerStack } from './unified-layer-registry.mjs';

const BLENDS = ['normal', 'screen', 'multiply', 'overlay', 'difference'];
const BMAP = { normal: 'source-over', screen: 'screen', multiply: 'multiply', overlay: 'overlay', difference: 'difference' };
const SCALES = [['phrygian', 'Phrygian'], ['dorian', 'Dorian'], ['lydian', 'Lydian']];
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LANES = [
  ['kick', 'Kick', [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]],
  ['snare', 'Snare', [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1]],
  ['hat', 'Hat', [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1]],
  ['chord', 'Chord', [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0]],
];
const W = 960, H = 540;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function setupRoving(el, sel) {
  const get = () => [...el.querySelectorAll(sel)].filter((n) => !n.disabled && n.offsetParent !== null);
  const reset = () => get().forEach((n, i) => { n.tabIndex = i === 0 ? 0 : -1; });
  reset();
  el.addEventListener('keydown', (ev) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(ev.key)) return;
    if (ev.target.tagName === 'INPUT' && (ev.target.type === 'text' || ev.target.type === 'range')) return;
    if (ev.target.tagName === 'SELECT' && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) return;
    const list = get(), cur = list.indexOf(document.activeElement);
    if (cur < 0) return;
    ev.preventDefault();
    const nx = ev.key === 'Home' ? 0 : ev.key === 'End' ? list.length - 1
      : (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? (cur + 1) % list.length : (cur - 1 + list.length) % list.length;
    list.forEach((n, i) => { n.tabIndex = i === nx ? 0 : -1; });
    list[nx].focus();
  });
  el.addEventListener('focusin', (ev) => {
    const list = get(), idx = list.indexOf(ev.target);
    if (idx >= 0) list.forEach((n, i) => { n.tabIndex = i === idx ? 0 : -1; });
  });
  return reset;
}

function hopChainNodes(presetId) {
  const p = STACK_PRESETS[presetId] || STACK_PRESETS['multimedia-master'];
  const nodes = [];
  for (const [from, , to] of p.wires) {
    if (!nodes.length) nodes.push(from);
    nodes.push(to);
  }
  return nodes;
}

export function mountUnifiedStudio(host) {
  if (!host || host.dataset.scReady) return null;
  host.dataset.scReady = '1';
  if (!document.querySelector('link[data-sc-css]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/world/site/surfaces/studio-compositor.css'; l.dataset.scCss = '1';
    document.head.appendChild(l);
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layerStack = createLayerStack('multimedia-master');
  const state = {
    preset: 'multimedia-master',
    time: 0.85, stirX: 0.52, stirY: 0.46, stirEnergy: 0.35, text: 'ESTUARY',
    palette: ['#132a3a', '#2b5f73', '#d79e35', '#ece5d6'],
    oklabPalette: null, sunLight: null, distill: null,
    daw: { playing: false, step: 0, scale: 'phrygian', bpm: 132, detune: 0.18, retune: 0, space: 0.34, pocket: 0.22, grit: 0.2, chaos: 0.14 },
    audio: { rms: 0.34, onset: false, bass: 0.42, centroid: 1640, beatPhase: 0.25, bands8: [0.58, 0.48, 0.44, 0.38, 0.3, 0.24, 0.18, 0.12] },
    layers: layerStack.list(),
  };

  let bridgeP = null, dawP = null, dawApi = null, raf = 0, lastTs = 0, drag = false;
  const knobDefs = [
    ['bpm', 'BPM', 84, 172, state.daw.bpm, ''], ['detune', 'Detune', 0, 100, 18, '%'],
    ['retune', 'Retune', 0, 100, 0, '%'], ['space', 'Space', 0, 100, 34, '%'],
    ['pocket', 'Pocket / Clock-Drift', 0, 100, 22, '%'], ['grit', 'Grit', 0, 100, 20, '%'], ['chaos', 'Chaos', 0, 100, 14, '%'],
  ];
  const presetBtns = Object.values(STACK_PRESETS).map((p) =>
    `<button type="button" class="sc-preset" data-sc-preset="${p.id}" aria-pressed="${p.id === state.preset}">${esc(p.label)}</button>`
  ).join('');

  host.innerHTML = `<div class="sc-presets" id="sc-presets" role="toolbar" aria-label="Studio stack presets"><span class="sc-kicker">Presets (11 engines)</span><div class="sc-preset-row">${presetBtns}</div></div>
<div class="sc-grid">
<aside class="sc-rail" id="sc-rail" aria-label="Composite layer stack">
<div class="sc-rail-head"><span class="sc-kicker" id="sc-rail-count">Layer stack (11 engines)</span>
<label class="sc-type-in"><span>Living Type / Fourier Word</span><input type="text" id="sc-type-text" value="${esc(state.text)}" maxlength="18" aria-label="Living Type text"></label></div>
<ol class="sc-layers" id="sc-layers"></ol>
<div class="sc-add-row"><select id="sc-add-sel" aria-label="Add studio layer">${STUDIO_LAYERS.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select><button type="button" id="sc-add-btn">Add layer</button></div>
</aside>
<div class="sc-stage-col">
<div class="sc-toolbar" id="sc-toolbar" role="toolbar" aria-label="Studio exports, Distill ingest, and patchbay">
<div class="sc-hops" id="sc-hops" aria-label="Patchbay hop chain"></div>
<div class="sc-exports"><button type="button" id="sc-distill-btn">Drop / Load File</button><input type="file" id="sc-distill-file" hidden aria-label="Load local file into Distill layer"><button type="button" data-sc-export="png">PNG</button><button type="button" data-sc-export="wif">WIF</button><button type="button" data-sc-export="svg">SVG</button><button type="button" data-sc-export="receipt">Receipt</button></div>
</div>
<div class="sc-canvas-wrap" id="sc-dropzone"><canvas id="sc-canvas" class="sc-canvas" width="${W}" height="${H}" aria-label="Consolidated 11-layer multimedia studio composite. Drag to stir or drop any local file to Distill."></canvas>
<div class="sc-hud" aria-hidden="true"><span id="sc-hud-mode">11-layer consolidated studio</span><span id="sc-hud-sha">patchbay: ready (6 hops)</span></div></div>
<p class="sc-status" id="sc-status" role="status" aria-live="polite">Unified 11-layer studio ready: Multimedia Master preset active. Audio starts muted until Play is pressed.</p>
</div></div>
<div class="sc-daw" id="sc-daw" role="toolbar" aria-label="DAW sequencer and synthesizer">
<div class="sc-daw-top"><button type="button" class="sc-play" id="sc-play" aria-pressed="false">Play DAW</button>
<label class="sc-scale"><span>Scale</span><select id="sc-scale" aria-label="DAW modal scale">${SCALES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
<div class="sc-meter" id="sc-meter" aria-hidden="true">${'<i></i>'.repeat(8)}</div>
<div class="sc-knobs">${knobDefs.map(([k, lbl, lo, hi, v, u]) => `<label class="sc-knob"><span>${lbl} <output data-sc-kout="${k}">${v}${u}</output></span><input type="range" min="${lo}" max="${hi}" value="${v}" data-sc-knob="${k}" aria-label="DAW ${lbl}"></label>`).join('')}</div></div>
<div class="sc-seq">${LANES.map(([id, lbl, st]) => `<div class="sc-seq-row"><span class="sc-seq-lbl">${lbl}</span><div class="sc-seq-steps">${st.map((v, i) => `<button type="button" class="sc-step${v ? ' is-on' : ''}" data-lane="${id}" data-step="${i}" aria-pressed="${Boolean(v)}" aria-label="${lbl} step ${i + 1}"></button>`).join('')}</div></div>`).join('')}</div></div>`;

  const prev = document.getElementById('sc-preview');
  if (prev) prev.hidden = true;
  host.hidden = false;

  const canvas = host.querySelector('#sc-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const layersEl = host.querySelector('#sc-layers');
  const hopsEl = host.querySelector('#sc-hops');
  const countEl = host.querySelector('#sc-rail-count');
  const statusEl = host.querySelector('#sc-status');
  const shaEl = host.querySelector('#sc-hud-sha');
  const modeEl = host.querySelector('#sc-hud-mode');
  const meters = [...host.querySelectorAll('#sc-meter i')];
  const stepBtns = [...host.querySelectorAll('.sc-step')];
  const fileInput = host.querySelector('#sc-distill-file');

  const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: w < W })]; };
  const [layerBuf, gLayer] = mk();
  const [smFx, gSm] = mk(160, 90);
  const [smGlass] = mk(192, 108);
  const [smElem] = mk(160, 90);

  let resetRailRoving = () => {};

  function renderLayerRail() {
    state.layers = layerStack.list();
    const activeN = state.layers.filter((l) => l.on).length;
    countEl.textContent = `Layer stack (${activeN}/${state.layers.length} active)`;
    layersEl.innerHTML = state.layers.map((L, i) => `<li class="sc-layer${L.on ? ' is-active' : ''}" data-sc-layer="${L.id}">
<div class="sc-layer-top"><button type="button" class="sc-eye" data-sc-eye="${L.id}" aria-pressed="${L.on}" aria-label="Toggle ${esc(L.name)}">${L.on ? 'On' : 'Off'}</button>
<span class="sc-lname">${i + 1}. ${esc(L.name)}</span>
<span class="sc-ord"><button type="button" class="sc-mv" data-sc-mv="${L.id}:-1" aria-label="Move ${esc(L.name)} up">^</button><button type="button" class="sc-mv" data-sc-mv="${L.id}:1" aria-label="Move ${esc(L.name)} down">v</button><button type="button" class="sc-mv" data-sc-rm="${L.id}" aria-label="Remove ${esc(L.name)}">x</button></span>
<span class="sc-route">${esc(L.route)}</span></div>
<div class="sc-layer-ctrl"><label class="sc-op"><span>Op <output data-sc-op-out="${L.id}">${Math.round(L.opacity * 100)}%</output></span>
<input type="range" min="0" max="100" value="${Math.round(L.opacity * 100)}" data-sc-op="${L.id}" aria-label="${esc(L.name)} opacity"></label>
<label class="sc-bl"><span>Blend</span><select id="sc-blend-${L.id}" data-sc-blend="${L.id}" aria-label="${esc(L.name)} blend mode">${BLENDS.map((b) => `<option value="${b}"${b === L.blend ? ' selected' : ''}>${b}</option>`).join('')}</select></label></div></li>`).join('');
    hopsEl.innerHTML = hopChainNodes(state.preset).map((h) => `<span class="sc-hop">${esc(h)}</span>`).join('<span class="sc-arrow" aria-hidden="true">-&gt;</span>');
    modeEl.textContent = `${STACK_PRESETS[state.preset]?.label || state.preset} (${activeN} layers live)`;
    resetRailRoving();
  }

  function sampleLumaGrid(w = 8, h = 4) {
    gSm.drawImage(canvas, 0, 0, w, h);
    const d = gSm.getImageData(0, 0, w, h).data, out = [];
    for (let i = 0; i < w * h; i++) { const o = i * 4; out.push((0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255); }
    return out;
  }

  function drawEstuary(g, t) {
    g.clearRect(0, 0, W, H);
    const a = state.audio, energy = 0.25 + a.rms * 0.75 + (a.onset ? 0.18 : 0);
    const cx = state.stirX * W, cy = state.stirY * H;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) {
      const x = 64 + col * 92, y = 62 + row * 102, dist = Math.hypot(x - cx, y - cy) / 220;
      const band = a.bands8[(col + row) % 8] || 0.3;
      const wv = 0.5 + 0.5 * Math.sin(dist * 4.4 - t * 2.2 + band * 3.1);
      const r = 9 + wv * 16 * energy + band * 7;
      g.fillStyle = `hsla(${(192 + wv * 34 - row * 7 + (a.centroid - 1400) * 0.015).toFixed(1)},48%,${(30 + wv * 36).toFixed(1)}%,${(0.16 + wv * 0.36).toFixed(2)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(236,229,214,${(0.1 + wv * 0.22).toFixed(2)})`; g.lineWidth = 1; g.strokeRect(x - 36, y - 36, 72, 72);
    }
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      for (let x = 0; x <= W; x += 24) {
        const y = 88 + i * 50 + Math.sin(x * 0.011 + t * 1.4 + i * 0.65) * (12 + energy * 20);
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = i % 3 === 0 ? 'rgba(215,158,53,.35)' : 'rgba(130,198,212,.22)'; g.lineWidth = 1.2; g.stroke();
    }
  }

  function drawType(g, t) {
    g.clearRect(0, 0, W, H);
    const a = state.audio, text = (state.text || 'ESTUARY').trim().toUpperCase() || 'ESTUARY';
    const wt = Math.min(900, Math.round(420 + a.rms * 420 + (a.onset ? 80 : 0)));
    const sz = Math.max(52, Math.min(132, Math.round(740 / Math.max(4, text.length))));
    const trk = 6 + a.rms * 16 + (a.onset ? 8 : 0);
    g.font = `${wt} ${sz}px "Hanken Grotesk",system-ui,sans-serif`; g.textBaseline = 'middle';
    const chars = [...text], ws = chars.map((ch) => g.measureText(ch).width);
    let x = (W - (ws.reduce((s, w) => s + w, 0) + trk * Math.max(0, chars.length - 1))) / 2;
    for (let i = 0; i < chars.length; i++) {
      const band = a.bands8[i % 8] || 0.3;
      g.save(); g.translate(x + ws[i] / 2, H * 0.5 + Math.sin(t * 2.1 + i * 0.85) * (7 + band * 18));
      g.transform(1, 0, Math.cos(t * 1.3 + i * 0.6) * (0.04 + a.rms * 0.08), 1, 0, 0);
      g.fillStyle = 'rgba(244,239,230,.92)'; g.fillText(chars[i], -ws[i] / 2, 0);
      g.strokeStyle = 'rgba(215,158,53,.65)'; g.lineWidth = 1.4; g.strokeText(chars[i], -ws[i] / 2, 0);
      g.restore(); x += ws[i] + trk;
    }
  }

  function drawRetro(g, src, t) {
    g.clearRect(0, 0, W, H);
    const sw = smFx.width, sh = smFx.height;
    gSm.drawImage(src, 0, 0, sw, sh);
    const img = gSm.getImageData(0, 0, sw, sh), d = img.data;
    const bloom = 0.14 + state.audio.rms * 0.35 + (state.audio.onset ? 0.12 : 0), shift = Math.sin(t * 0.7) * 14 + state.daw.grit * 24;
    for (let y = 0; y < sh; y++) {
      const sc = (y & 1) ? 0.84 : 1.06;
      for (let x = 0; x < sw; x++) {
        const o = (y * sw + x) * 4, th = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 44;
        d[o] = Math.round(Math.max(0, Math.min(255, d[o] * sc + th + bloom * 42 + shift)) / 51) * 51;
        d[o + 1] = Math.round(Math.max(0, Math.min(255, d[o + 1] * sc + th + bloom * 30)) / 51) * 51;
        d[o + 2] = Math.round(Math.max(0, Math.min(255, d[o + 2] * sc + th + bloom * 56 - shift * 0.4)) / 51) * 51;
        d[o + 3] = 220;
      }
    }
    gSm.putImageData(img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(smFx, 0, 0, W, H);
    g.fillStyle = 'rgba(8,16,26,.24)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  }

  function drawLoom(g, t) {
    g.clearRect(0, 0, W, H);
    const p = 16, a = state.audio, sh = Math.floor((t * 3 + a.beatPhase * 8) % 4);
    for (let y = 0; y < H; y += p) {
      const r = (y / p) | 0, b = a.bands8[r % 8] || 0.3;
      for (let x = 0; x < W; x += p) {
        if ((((x / p) | 0) + r + sh) % 4 < 2) { g.fillStyle = `rgba(215,158,53,${(0.16 + b * 0.3).toFixed(2)})`; g.fillRect(x + 2, y + 4, p - 4, p - 8); }
        else { g.fillStyle = `rgba(176,224,230,${(0.12 + a.rms * 0.22).toFixed(2)})`; g.fillRect(x + 4, y + 2, p - 8, p - 4); }
      }
    }
  }

  function buildContourPaths(t) {
    const a = state.audio, paths = [];
    for (let r = 0; r < 12; r++) {
      const b = a.bands8[r % 8] || 0.3, pts = [], by = 52 + (r / 11) * (H - 104);
      for (let c = 0; c <= 32; c++) {
        const x = 32 + (c / 32) * (W - 64), dx = x / W - state.stirX, dy = by / H - state.stirY;
        pts.push([x, by - Math.exp(-(dx * dx + dy * dy) * 14) * (22 + a.rms * 38) + Math.sin(c * 0.42 + t * 1.4 + r * 0.5) * (6 + b * 14)]);
      }
      paths.push(pts);
    }
    return paths;
  }

  function drawPlotter(g, t) {
    g.clearRect(0, 0, W, H);
    const paths = buildContourPaths(t); g.lineWidth = 1.2;
    paths.forEach((pts, i) => {
      g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = i % 3 === 0 ? 'rgba(244,239,230,.82)' : 'rgba(215,158,53,.55)'; g.stroke();
    });
    g.strokeStyle = 'rgba(244,239,230,.55)'; g.lineWidth = 1;
    for (const [rx, ry] of [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]]) {
      g.beginPath(); g.moveTo(rx - 8, ry); g.lineTo(rx + 8, ry); g.moveTo(rx, ry - 8); g.lineTo(rx, ry + 8); g.stroke();
    }
  }

  function composite() {
    const t = state.time;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#091521'; ctx.fillRect(0, 0, W, H);
    for (const l of state.layers) {
      if (!l.on || l.opacity <= 0.001) continue;
      gLayer.globalCompositeOperation = 'source-over'; gLayer.globalAlpha = 1;
      if (l.id === 'estuary') drawEstuary(gLayer, t);
      else if (l.id === 'type') drawType(gLayer, t);
      else if (l.id === 'retro') drawRetro(gLayer, canvas, t);
      else if (l.id === 'loom') drawLoom(gLayer, t);
      else if (l.id === 'plotter') drawPlotter(gLayer, t);
      else if (l.id === 'low-water') state.sunLight = LAYER_RENDERERS['low-water'](gLayer, state);
      else if (l.id === 'mesh-3d') LAYER_RENDERERS['mesh-3d'](gLayer, state, { sunLight: state.sunLight });
      else if (l.id === 'fourier') LAYER_RENDERERS.fourier(gLayer, state);
      else if (l.id === 'glass-water') LAYER_RENDERERS['glass-water'](gLayer, canvas, state, { scratch: smGlass });
      else if (l.id === 'elements') LAYER_RENDERERS.elements(gLayer, canvas, state, { scratch: smElem, palette: state.oklabPalette });
      else if (l.id === 'distill') LAYER_RENDERERS.distill(gLayer, state, { anatomy: state.distill });
      ctx.save(); ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = BMAP[l.blend] || 'source-over';
      ctx.drawImage(layerBuf, 0, 0); ctx.restore();
    }
    meters.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.12, state.audio.bands8[i] || 0.12).toFixed(2)})`; });
  }

  const getBridge = () => (bridgeP ||= import('./studio-patchbay-bridge.mjs').then((m) => m.createStudioBridgeRuntime(state.preset)));
  const dispatch = async (why) => {
    const rt = await getBridge(), { res, check } = rt.dispatch(state);
    if (res.ok && res.chain.length) {
      const h = res.chain.at(-1).receiptSha256;
      shaEl.textContent = `patchbay: ${res.chain.length} hops (${check.ok ? 'verified' : 'invalid'}) ${h.slice(0, 15)}...`;
      if (why !== 'tick') statusEl.textContent = `Patchbay ${why}: ${res.chain.length} chained hops verified (${h.slice(0, 19)}...).`;
    }
  };
  const getDaw = () => (dawP ||= import('./studio-daw.mjs').then(({ createStudioDaw }) => {
    dawApi = createStudioDaw((idx, feat) => {
      state.daw.step = idx;
      state.audio = { ...feat, bass: feat.bands8[0] || 0.3, centroid: feat.spectralCentroidHz };
      stepBtns.forEach((b) => b.classList.toggle('is-now', Number(b.dataset.step) === idx));
      composite();
      if (idx % 4 === 0) dispatch('tick').catch(() => {});
    });
    return dawApi;
  }));

  async function ingestDroppedFile(file) {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rt = await getBridge();
    const out = rt.ingestFileBytes(bytes, file.name, state);
    if (!state.layers.some((l) => l.id === 'distill')) layerStack.addLayer('distill', { on: true });
    else layerStack.toggleLayer('distill', true);
    renderLayerRail(); composite();
    const h = out.res?.chain?.at(-1)?.receiptSha256 || out.receipt.bytesSha256;
    shaEl.textContent = `distill/1 ${out.anatomy.format}: ${out.res?.chain?.length || 0} hops (${out.check?.ok ? 'verified' : 'ok'}) ${h.slice(0, 15)}...`;
    statusEl.textContent = `Distilled "${file.name}" (${out.anatomy.format}, ${out.anatomy.bytes} B, residual=${out.anatomy.coverage.residualBytes} B) into live palette, audio & composite.`;
  }

  host.addEventListener('click', async (ev) => {
    const pre = ev.target.closest('[data-sc-preset]');
    if (pre) {
      const id = pre.dataset.scPreset;
      state.preset = id; layerStack.applyPreset(id);
      host.querySelectorAll('[data-sc-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b === pre)));
      renderLayerRail(); composite();
      const rt = await getBridge(); rt.setPreset(id); await dispatch(`preset:${id}`); return;
    }
    const eye = ev.target.closest('[data-sc-eye]');
    if (eye) {
      const item = layerStack.toggleLayer(eye.dataset.scEye); if (!item) return;
      renderLayerRail(); composite(); statusEl.textContent = `${item.name} ${item.on ? 'enabled' : 'hidden'}.`; return;
    }
    const mv = ev.target.closest('[data-sc-mv]');
    if (mv) {
      const [id, d] = mv.dataset.scMv.split(':'), cur = state.layers.findIndex((x) => x.id === id);
      if (cur >= 0) { layerStack.reorderLayer(id, cur + Number(d)); renderLayerRail(); composite(); statusEl.textContent = `Reordered layer ${id}.`; }
      return;
    }
    const rm = ev.target.closest('[data-sc-rm]');
    if (rm) { layerStack.removeLayer(rm.dataset.scRm); renderLayerRail(); composite(); statusEl.textContent = `Removed layer ${rm.dataset.scRm}.`; return; }
    if (ev.target.id === 'sc-add-btn') {
      const id = host.querySelector('#sc-add-sel')?.value;
      if (id) { layerStack.addLayer(id, { on: true }); layerStack.toggleLayer(id, true); renderLayerRail(); composite(); statusEl.textContent = `Layer ${id} added and active.`; }
      return;
    }
    if (ev.target.id === 'sc-distill-btn') { fileInput?.click(); return; }
    const sb = ev.target.closest('.sc-step');
    if (sb) {
      const daw = await getDaw(), on = daw.toggleStep(sb.dataset.lane, Number(sb.dataset.step));
      sb.classList.toggle('is-on', Boolean(on)); sb.setAttribute('aria-pressed', String(Boolean(on)));
      statusEl.textContent = `DAW ${sb.dataset.lane} step ${Number(sb.dataset.step) + 1} ${on ? 'active' : 'muted'}.`; return;
    }
    if (ev.target.id === 'sc-play') {
      const daw = await getDaw();
      if (daw.isRunning()) { daw.stop(); state.daw.playing = false; ev.target.setAttribute('aria-pressed', 'false'); ev.target.textContent = 'Play DAW'; statusEl.textContent = 'DAW stopped. Composite remains live.'; }
      else { daw.start(); state.daw.playing = true; ev.target.setAttribute('aria-pressed', 'true'); ev.target.textContent = 'Stop DAW'; statusEl.textContent = `DAW playing ${state.daw.scale} at ${state.daw.bpm} BPM.`; await dispatch('daw-play'); }
      return;
    }
    const exp = ev.target.closest('[data-sc-export]');
    if (exp) { const rt = await getBridge(); statusEl.textContent = rt.exportArtifact(exp.dataset.scExport, { state, canvas, buildContourPaths, sampleLumaGrid, W, H }); }
  });

  fileInput?.addEventListener('change', () => { if (fileInput.files?.[0]) ingestDroppedFile(fileInput.files[0]); });
  const dz = host.querySelector('#sc-dropzone');
  dz?.addEventListener('dragover', (ev) => { ev.preventDefault(); dz.classList.add('is-drop'); });
  dz?.addEventListener('dragleave', () => dz.classList.remove('is-drop'));
  dz?.addEventListener('drop', (ev) => { ev.preventDefault(); dz.classList.remove('is-drop'); if (ev.dataTransfer?.files?.[0]) ingestDroppedFile(ev.dataTransfer.files[0]); });

  host.addEventListener('input', (ev) => {
    const op = ev.target.closest('[data-sc-op]');
    if (op) {
      const item = layerStack.setOpacity(op.dataset.scOp, Number(op.value) / 100); if (!item) return;
      state.layers = layerStack.list(); host.querySelector(`[data-sc-op-out="${item.id}"]`).textContent = `${op.value}%`;
      composite(); statusEl.textContent = `${item.name} opacity set to ${op.value}%.`; return;
    }
    if (ev.target.id === 'sc-type-text') { state.text = ev.target.value || 'ESTUARY'; composite(); statusEl.textContent = `Living Type / Fourier word updated to "${state.text}".`; return; }
    const kn = ev.target.closest('[data-sc-knob]');
    if (kn) {
      const k = kn.dataset.scKnob, raw = Number(kn.value), val = k === 'bpm' ? raw : raw / 100;
      state.daw[k] = val; host.querySelector(`[data-sc-kout="${k}"]`).textContent = k === 'bpm' ? `${raw}` : `${raw}%`;
      if (dawApi) dawApi.setParam(k, val);
      state.stirEnergy = 0.25 + state.daw.space * 0.5 + state.daw.chaos * 0.4;
      composite(); statusEl.textContent = `DAW ${k} set to ${k === 'bpm' ? `${raw} BPM` : `${raw}%`}.`;
    }
  });

  host.addEventListener('change', (ev) => {
    const bl = ev.target.closest('[data-sc-blend]');
    if (bl) {
      const item = layerStack.setBlend(bl.dataset.scBlend, bl.value); if (!item) return;
      state.layers = layerStack.list(); composite(); statusEl.textContent = `${item.name} blend mode set to ${bl.value}.`; return;
    }
    if (ev.target.id === 'sc-scale') {
      state.daw.scale = ev.target.value; if (dawApi) dawApi.setParam('scale', ev.target.value);
      state.palette = ev.target.value === 'dorian' ? ['#102e35', '#2a6f74', '#e0a943', '#f2ece1']
        : ev.target.value === 'lydian' ? ['#1d2642', '#4c5e8c', '#e6b44c', '#f5f0e6'] : ['#132a3a', '#2b5f73', '#d79e35', '#ece5d6'];
      composite(); statusEl.textContent = `DAW modal scale set to ${ev.target.value}.`;
    }
  });

  const stir = (ev) => {
    const r = canvas.getBoundingClientRect();
    state.stirX = Math.max(0.05, Math.min(0.95, (ev.clientX - r.left) / r.width));
    state.stirY = Math.max(0.05, Math.min(0.95, (ev.clientY - r.top) / r.height));
    state.stirEnergy = 0.85; composite();
  };
  canvas.addEventListener('pointerdown', (ev) => { drag = true; canvas.setPointerCapture(ev.pointerId); stir(ev); });
  canvas.addEventListener('pointermove', (ev) => { if (drag) stir(ev); });
  canvas.addEventListener('pointerup', () => { drag = false; });

  resetRailRoving = setupRoving(host.querySelector('#sc-rail'), 'button, input, select');
  setupRoving(host.querySelector('#sc-presets'), 'button');
  setupRoving(host.querySelector('#sc-toolbar'), 'button');
  setupRoving(host.querySelector('#sc-daw'), 'button, input, select');
  renderLayerRail(); composite();

  if (!reduced) {
    const tick = (ts) => {
      raf = 0;
      if (!document.hidden) {
        const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016; lastTs = ts; state.time += dt;
        if (!state.daw.playing) {
          const p = state.time * 1.1; state.audio.rms = 0.28 + 0.14 * Math.sin(p * 1.7); state.audio.beatPhase = (state.time * 0.5) % 1;
          for (let i = 0; i < 8; i++) state.audio.bands8[i] = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(p * (1 + i * 0.25) + i));
        }
        composite();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  const api = {
    applyPreset: async (id) => { host.querySelector(`[data-sc-preset="${id}"]`)?.click(); },
    ingestBytes: async (bytes, name) => {
      const rt = await getBridge();
      const out = rt.ingestFileBytes(bytes, name || 'studio.bin', state);
      if (!state.layers.some((l) => l.id === 'distill')) layerStack.addLayer('distill', { on: true });
      else layerStack.toggleLayer('distill', true);
      renderLayerRail(); composite();
      statusEl.textContent = `Distilled "${name || 'studio.bin'}" (${out.anatomy.format}, residual=${out.anatomy.coverage.residualBytes} B).`;
      return out;
    },
    receiveEngine({ title, target }) {
      const label = String(title || 'STUDIO').replace(/[^a-zA-Z0-9 ]+/g, '').trim().slice(0, 14) || 'ESTUARY';
      state.text = label.toUpperCase();
      const inp = host.querySelector('#sc-type-text'); if (inp) inp.value = state.text;
      state.stirX = 0.35 + ((label.charCodeAt(0) || 65) % 30) / 100; state.stirEnergy = 0.9;
      composite(); dispatch(`stage:${label.toLowerCase()}`).catch(() => {});
      statusEl.textContent = `Routed "${title}" (${target || 'direct'}) into 11-Layer Unified Studio composite.`;
      document.getElementById('studio-canvas-shell')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    },
    destroy() { if (raf) cancelAnimationFrame(raf); dawApi?.stop(); },
  };
  window.__studioCanvas = api;
  return api;
}
