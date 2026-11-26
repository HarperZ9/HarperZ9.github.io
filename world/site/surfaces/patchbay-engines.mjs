// patchbay-engines.mjs: Concrete multi-discipline engine adapters for the
// Unified Playground Patchbay (Wave 29B / 31A). Zero external dependencies; pure ESM.
// Covers all 7 Playground disciplines + DAW with real deterministic transforms.
import { createPatchbay, digestPayload } from './patchbay-core.mjs';

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const rgbHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function buildFrame(width, height, lumaGrid, source, extra = {}) {
  const quantized = lumaGrid.map((v) => Math.round(clamp01(v) * 255));
  return {
    width,
    height,
    lumaGrid: quantized,
    pixelsSha256: digestPayload({ width, height, quantized, source }),
    transfer: 'srgb-u8',
    source,
    ...extra,
  };
}

export function makeAudioFeatures({
  rms = 0.42, spectralCentroidHz = 1840, bands8 = [0.7, 0.55, 0.48, 0.4, 0.32, 0.25, 0.18, 0.12],
  beatPhase = 0.25, onset = true, bpm = 162, lufs = -14.1,
} = {}) {
  return {
    rms: clamp01(rms),
    spectralCentroidHz: Math.max(20, Number(spectralCentroidHz) || 440),
    bands8: bands8.slice(0, 8).map(clamp01),
    beatPhase: clamp01(beatPhase),
    onset: Boolean(onset),
    bpm: Math.max(40, Math.min(240, Number(bpm) || 120)),
    lufs: Number(lufs),
  };
}

export function estuaryTransform(input, ctx) {
  const w = 8, h = 4;
  const audio = ctx.inPort === 'audio_features' ? input : makeAudioFeatures({ rms: 0.25, onset: false });
  const pal = ctx.inPort === 'palette' ? input : null;
  const energy = clamp01(audio.rms * 0.75 + (audio.onset ? 0.2 : 0));
  const luma = [];
  const oklab = [];
  const hex = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const band = audio.bands8[x % 8] ?? 0.3;
      const v = clamp01(0.18 + 0.55 * band + 0.27 * energy * Math.sin((x + y + audio.beatPhase * 4) * 0.65));
      luma.push(v);
    }
  }
  const swatchCount = 4;
  for (let i = 0; i < swatchCount; i++) {
    const L = pal?.oklab?.[i]?.[0] ?? clamp01(0.32 + i * 0.16 + energy * 0.12);
    const a = pal?.oklab?.[i]?.[1] ?? Number(((audio.bands8[i] - 0.5) * 0.18).toFixed(4));
    const b = pal?.oklab?.[i]?.[2] ?? Number(((audio.bands8[i + 4] - 0.5) * 0.16).toFixed(4));
    oklab.push([Number(L.toFixed(4)), a, b]);
    hex.push(rgbHex(L * 235 + a * 180, L * 220, L * 210 - b * 160));
  }
  return {
    frame: buildFrame(w, h, luma, 'estuary', { haloclineMix: Number((0.35 + energy * 0.5).toFixed(4)) }),
    palette: { oklab, hex, mix: hex[1], ground: hex[0] },
  };
}

export function retroFxTransform(input, ctx) {
  const srcFrame = ctx.inPort === 'frame' ? input : ctx.lastByEnginePort.get('estuary:frame') || buildFrame(8, 4, Array(32).fill(0.5), 'retro-fallback');
  const audio = ctx.inPort === 'audio_features' ? input : ctx.lastByEnginePort.get('daw:audio_features');
  const bloom = clamp01(0.15 + (audio ? audio.rms * 0.65 + (audio.onset ? 0.18 : 0) : 0.1));
  const outLuma = srcFrame.lumaGrid.map((px, idx) => {
    const row = Math.floor(idx / srcFrame.width);
    const scanline = row % 2 === 0 ? 1.0 : 0.86;
    const levels = 6;
    const v = clamp01((px / 255) * scanline + bloom * 0.25);
    return Math.round(v * (levels - 1)) / (levels - 1);
  });
  const frame = buildFrame(srcFrame.width, srcFrame.height, outLuma, 'retro-fx', {
    bloom: Number(bloom.toFixed(4)),
    ditherMode: 'bayer-4x4-crt',
  });
  const mean = outLuma.reduce((s, v) => s + v, 0) / Math.max(1, outLuma.length);
  const palette = {
    oklab: [[Number(mean.toFixed(4)), 0.04, -0.03], [Number(clamp01(mean + 0.2).toFixed(4)), -0.02, 0.05]],
    hex: [rgbHex(mean * 210, mean * 230, mean * 195), rgbHex(mean * 245, mean * 185, mean * 120)],
    mix: rgbHex(mean * 220, mean * 210, mean * 170),
    ground: '#101318',
  };
  return { frame, palette };
}

export function loomTransform(input, ctx) {
  const frame = ctx.inPort === 'frame' ? input : buildFrame(8, 4, Array(32).fill(0.45), 'loom-palette');
  const shafts = 4, treadles = 4;
  const threading = [];
  for (let x = 0; x < frame.width; x++) {
    const colAvg = frame.lumaGrid.filter((_, i) => i % frame.width === x).reduce((a, b) => a + b, 0) / frame.height;
    threading.push((Math.floor((colAvg / 256) * shafts) % shafts) + 1);
  }
  const tieup = [[1, 2], [2, 3], [3, 4], [4, 1]];
  const treadling = [];
  const pickNotesHz = [];
  const scaleHz = [220, 261.63, 293.66, 329.63, 392.0, 440.0];
  for (let y = 0; y < frame.height; y++) {
    const rowSlice = frame.lumaGrid.slice(y * frame.width, (y + 1) * frame.width);
    const rowAvg = rowSlice.reduce((a, b) => a + b, 0) / Math.max(1, rowSlice.length);
    const tr = (Math.floor((rowAvg / 256) * treadles) % treadles) + 1;
    treadling.push(tr);
    pickNotesHz.push(scaleHz[Math.floor((rowAvg / 256) * scaleHz.length) % scaleHz.length]);
  }
  const wifLines = [
    '[WIF]', 'Version=1.1', 'Source Program=HarperZ9 Playground Patchbay',
    '[WEAVING]', `Shafts=${shafts}`, `Treadles=${treadles}`,
    '[THREADING]', ...threading.map((s, i) => `${i + 1}=${s}`),
    '[TIEUP]', ...tieup.map((ts, i) => `${i + 1}=${ts.join(',')}`),
    '[TREADLING]', ...treadling.map((t, i) => `${i + 1}=${t}`),
  ];
  const clothLuma = frame.lumaGrid.map((px, i) => {
    const x = i % frame.width, y = Math.floor(i / frame.width);
    const raised = tieup[treadling[y] - 1].includes(threading[x]);
    return raised ? clamp01(px / 255 * 0.7 + 0.3) : clamp01(px / 255 * 0.5);
  });
  return {
    cloth_wif: { shafts, treadles, threading, tieup, treadling, wifText: wifLines.join('\n'), pickNotesHz },
    frame: buildFrame(frame.width, frame.height, clothLuma, 'loom-cloth'),
  };
}

export function posterPlotterTransform(input, ctx) {
  const paths = [];
  if (ctx.inPort === 'cloth_wif') {
    input.treadling.forEach((tr, rowIdx) => {
      const y = 20 + rowIdx * 24;
      const x1 = 16 + tr * 14;
      const x2 = 240 - tr * 10;
      paths.push(`M ${x1} ${y} L ${x2} ${y}`);
    });
  } else if (ctx.inPort === 'frame') {
    for (let y = 0; y < input.height; y++) {
      const pts = [];
      for (let x = 0; x < input.width; x++) {
        const px = input.lumaGrid[y * input.width + x] / 255;
        pts.push(`${(16 + x * 28).toFixed(1)} ${(28 + y * 24 - px * 12).toFixed(1)}`);
      }
      paths.push(`M ${pts[0]} L ${pts.slice(1).join(' L ')}`);
    }
  } else {
    paths.push('M 16 40 L 240 40', 'M 16 80 L 240 80');
  }
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 160" width="256" height="160">',
    ...paths.map((d) => `  <path d="${d}" fill="none" stroke="#182026" stroke-width="1.2"/>`),
    '</svg>',
  ].join('\n');
  return { vector: { svg, paths, viewBox: '0 0 256 160', strokeCount: paths.length } };
}

export function livingTypeTransform(input, ctx) {
  const audio = ctx.inPort === 'audio_features' ? input : makeAudioFeatures({ rms: 0.2, onset: false });
  const weight = Math.round(320 + audio.rms * 480);
  const slant = Number(((audio.spectralCentroidHz - 1000) / 400).toFixed(2));
  const opticalSize = Number((16 + (audio.bands8[0] || 0) * 32).toFixed(2));
  const text = 'ESTUARY';
  const glyphMetrics = { weight, slant, opticalSize, advanceEm: Number((text.length * 0.62).toFixed(3)) };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64"><path d="M 12 48 L ${Math.round(120 + audio.rms * 100)} 48"/></svg>`;
  return {
    type_field: { text, family: 'ZainMint-Living', axes: { weight, slant, opticalSize }, glyphMetrics },
    vector: { svg, paths: [`M 12 48 L ${Math.round(120 + audio.rms * 100)} 48`], viewBox: '0 0 240 64', strokeCount: 1 },
  };
}

export function studio3dTransform(input, ctx) {
  const audio = ctx.inPort === 'audio_features' ? input : makeAudioFeatures({ rms: 0.3, onset: false });
  const luma = Array.from({ length: 32 }, (_, i) => clamp01(0.25 + 0.5 * audio.bands8[i % 8] + 0.2 * audio.rms));
  return { frame: buildFrame(8, 4, luma, 'studio-3d', { mode: 'raymarched-heightfield' }) };
}

export function createDefaultStudioPatchbay() {
  const pb = createPatchbay();
  pb.register({ id: 'daw', name: 'Playground DAW & Site Music', discipline: 'Sound, Music & Acoustics', takes: ['cloth_wif'], gives: ['audio_features'], bridgeMode: 'direct' });
  pb.register({ id: 'estuary', name: 'Estuary Perret Lantern', discipline: 'Native Engine, Living World & Inspection', takes: ['audio_features', 'palette'], gives: ['frame', 'palette'], transform: estuaryTransform, bridgeMode: 'direct' });
  pb.register({ id: 'retro-fx', name: 'GLSL Sandbox & Retro 46 FX', discipline: 'Paint, Pigment, Glass, Film & Shaders', takes: ['frame', 'audio_features', 'palette'], gives: ['frame', 'palette'], transform: retroFxTransform, bridgeMode: 'direct' });
  pb.register({ id: 'loom', name: 'The Loom (Jacquard & WIF)', discipline: 'Weave, Loom & Textile', takes: ['frame', 'palette'], gives: ['cloth_wif', 'frame'], transform: loomTransform, bridgeMode: 'iframe' });
  pb.register({ id: 'poster-plotter', name: 'Poster & Pen Plotter (SVG/G-code)', discipline: 'Posters, Print, Plotter & Fabrication', takes: ['cloth_wif', 'frame', 'palette', 'type_field'], gives: ['vector'], transform: posterPlotterTransform, bridgeMode: 'iframe' });
  pb.register({ id: 'living-type', name: 'Living Type & Zain Mint Forge', discipline: 'Type, Lettering & Epicycles', takes: ['audio_features', 'palette'], gives: ['type_field', 'vector'], transform: livingTypeTransform, bridgeMode: 'direct' });
  pb.register({ id: 'studio-3d', name: 'The Studio Workstation & 3D Fractals', discipline: 'The Studio, Fractals, Attractors, Splats & 3D', takes: ['audio_features', 'palette', 'frame'], gives: ['frame'], transform: studio3dTransform, bridgeMode: 'iframe' });
  return pb;
}
