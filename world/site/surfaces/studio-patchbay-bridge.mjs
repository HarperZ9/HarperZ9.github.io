// studio-patchbay-bridge.mjs: Lazy-loaded Patchbay dispatch, origin-pinned stage bridge,
// and multi-format studio exporters (WIF cloth, SVG plotter contours, verified SHA-256 receipt).
import { BRIDGE_PROTOCOL, PATCHBAY_RECEIPT_SCHEMA, createStageBridge, verifyHopChain } from './patchbay-core.mjs';
import { createDefaultStudioPatchbay, makeAudioFeatures } from './patchbay-engines.mjs';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createStudioBridgeRuntime() {
  const pb = createDefaultStudioPatchbay();
  pb.connect('daw', 'audio_features', 'estuary');
  pb.connect('estuary', 'frame', 'retro-fx');
  pb.connect('retro-fx', 'frame', 'loom');
  pb.connect('loom', 'cloth_wif', 'poster-plotter');

  const bridge = createStageBridge(pb, {
    allowedOrigin: location.origin,
    postOut: (msg) => {
      const frame = document.querySelector('#wb-stage-body iframe');
      try { frame?.contentWindow?.postMessage(msg, location.origin); } catch {}
    },
  });
  window.addEventListener('message', (ev) => {
    if (ev.origin === location.origin && ev.data?.protocol === BRIDGE_PROTOCOL) {
      bridge.handleIncoming(ev);
    }
  });

  function dispatch(state) {
    const feat = makeAudioFeatures({
      rms: state.audio.rms,
      spectralCentroidHz: state.audio.centroid,
      bands8: state.audio.bands8,
      beatPhase: state.audio.beatPhase,
      onset: state.audio.onset,
      bpm: state.daw.bpm,
      lufs: Number((-21 + state.audio.rms * 9).toFixed(1)),
    });
    const res = pb.dispatch('daw', 'audio_features', feat, { tSeconds: Number(state.time.toFixed(3)) });
    const check = res.ok && res.chain.length ? verifyHopChain(res.chain) : { ok: false, errors: ['EMPTY_CHAIN'] };
    return { res, check };
  }

  function exportArtifact(kind, { state, canvas, buildContourPaths, sampleLumaGrid, W, H }) {
    if (kind === 'png') {
      canvas.toBlob((blob) => { if (blob) downloadBlob(blob, 'playground-unified-studio.png'); }, 'image/png');
      return 'Exported composite PNG (960x540).';
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
      schema: PATCHBAY_RECEIPT_SCHEMA,
      surface: 'playground-unified-studio',
      verified: check.ok,
      errors: check.errors,
      lumaSample8x4: sampleLumaGrid(8, 4).map((v) => Number(v.toFixed(3))),
      layers: state.layers.map(({ id, on, opacity, blend }) => ({ id, on, opacity, blend })),
      chain: res.chain,
    };
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), 'playground-patchbay-receipt.json');
    return `Exported verified patchbay receipt JSON (${res.chain.length} hops, verified=${check.ok}).`;
  }

  return { pb, bridge, dispatch, exportArtifact };
}
