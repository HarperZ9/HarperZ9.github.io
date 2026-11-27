// studio-patchbay-bridge.mjs: Consolidated 11-layer Patchbay runtime, origin-pinned stage bridge,
// Distill Layer-0 byte ingest, and multi-format exporters (PNG, WIF cloth, SVG plotter, SHA-256 receipt).
import * as patchbayCore from './patchbay-core.mjs';
import * as patchbayEngines from './patchbay-engines.mjs';
import { buildMaterialPalette } from './layer-elements-palette.mjs';
import { distillToPatchbayOutputs } from './layer-distill-ingest.mjs';
import { STACK_PRESETS, createConsolidatedPatchbay } from './unified-layer-registry.mjs';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createStudioBridgeRuntime(initialPreset = 'multimedia-master') {
  let presetId = STACK_PRESETS[initialPreset] ? initialPreset : 'multimedia-master';
  let pb = createConsolidatedPatchbay(patchbayCore, patchbayEngines, presetId);
  let lastDistill = null;

  const makeBridge = () => patchbayCore.createStageBridge(pb, {
    allowedOrigin: location.origin,
    postOut: (msg) => {
      const frame = document.querySelector('#wb-stage-body iframe');
      try { frame?.contentWindow?.postMessage(msg, location.origin); } catch {}
    },
  });
  let bridge = makeBridge();

  window.addEventListener('message', (ev) => {
    if (ev.origin === location.origin && ev.data?.protocol === patchbayCore.BRIDGE_PROTOCOL) {
      bridge.handleIncoming(ev);
    }
  });

  function setPreset(id) {
    if (!STACK_PRESETS[id]) return presetId;
    presetId = id;
    pb = createConsolidatedPatchbay(patchbayCore, patchbayEngines, presetId);
    bridge = makeBridge();
    return presetId;
  }

  function dispatch(state) {
    const tSeconds = Number((state.time || 0).toFixed(3));
    let res;
    if (presetId === 'audio-fourier-lab') {
      const feat = patchbayEngines.makeAudioFeatures({
        rms: state.audio.rms,
        spectralCentroidHz: state.audio.centroid,
        bands8: state.audio.bands8,
        beatPhase: state.audio.beatPhase,
        onset: state.audio.onset,
        bpm: state.daw.bpm,
        lufs: Number((-21 + state.audio.rms * 9).toFixed(1)),
      });
      res = pb.dispatch('daw', 'audio_features', feat, { tSeconds });
    } else if (presetId === 'low-water-glass-cinema') {
      const pal = state.oklabPalette || buildMaterialPalette();
      res = pb.dispatch('elements', 'palette', pal, { tSeconds });
    } else {
      const pal = lastDistill?.palette || state.oklabPalette || buildMaterialPalette();
      res = pb.dispatch('distill', 'palette', pal, { tSeconds });
    }
    const check = res.ok && res.chain.length ? patchbayCore.verifyHopChain(res.chain) : { ok: false, errors: ['EMPTY_CHAIN'] };
    return { res, check };
  }

  function ingestFileBytes(bytes, filename, state) {
    const out = distillToPatchbayOutputs(bytes, filename || 'drop.bin', patchbayCore.digestPayload);
    lastDistill = out;
    state.distill = out.anatomy;
    state.oklabPalette = out.palette;
    state.palette = out.palette.hex;
    state.audio = { ...out.audio_features, bass: out.audio_features.bands8[0] || 0.35, centroid: out.audio_features.spectralCentroidHz };
    const { res, check } = dispatch(state);
    return { ...out, res, check };
  }

  function exportArtifact(kind, { state, canvas, buildContourPaths, sampleLumaGrid, W, H }) {
    if (kind === 'png') {
      canvas.toBlob((blob) => { if (blob) downloadBlob(blob, 'playground-unified-studio.png'); }, 'image/png');
      return 'Exported 11-layer composite PNG (960x540).';
    }
    const { res, check } = dispatch(state);
    if (kind === 'wif') {
      const wif = res.outputs?.['loom:cloth_wif']?.wifText || '[WIF]\nVersion=1.1\n[WEAVING]\nShafts=4\nTreadles=4\n';
      downloadBlob(new Blob([wif], { type: 'text/plain;charset=utf-8' }), 'playground-loom-draft.wif');
      return `Exported Jacquard WIF draft (${wif.length} bytes) from active composite.`;
    }
    if (kind === 'svg') {
      const paths = buildContourPaths(state.time).map((pts) =>
        `  <path d="M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}" fill="none" stroke="#142230" stroke-width="1.2"/>`
      ).join('\n');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n${paths}\n</svg>\n`;
      downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'playground-plotter-contours.svg');
      return `Exported Plotter vector contour SVG (${paths.split('\n').length} paths).`;
    }
    const doc = {
      schema: patchbayCore.PATCHBAY_RECEIPT_SCHEMA,
      surface: 'playground-unified-11layer-studio',
      preset: presetId,
      verified: check.ok,
      errors: check.errors,
      lumaSample8x4: sampleLumaGrid(8, 4).map((v) => Number(v.toFixed(3))),
      layers: state.layers.map(({ id, on, opacity, blend }) => ({ id, on, opacity, blend })),
      chain: res.chain,
    };
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), 'playground-patchbay-receipt.json');
    return `Exported verified patchbay receipt JSON (${res.chain.length} hops, preset=${presetId}, verified=${check.ok}).`;
  }

  return { setPreset, dispatch, ingestFileBytes, exportArtifact };
}
