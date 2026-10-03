// system/media-engine/plugins/evidence.mjs
// Evidence surfaces as an engine plugin. BRender Archival and Engine Revival have no renderer on the
// web yet (a WebAssembly build of the restored rasterizer is a reserved slot, see slots.mjs). What
// they do have is receipted media: media/retro-systems-lab/manifest.json lists every file with its
// SHA-256 and the first-party release it rests on. This plugin re-hashes each file in the browser,
// names the verdict, and draws the surface's identity image. Nothing is taken on trust.
//
// params: { surface: "brender" | "revival" }

import { verifyBytes } from "../receipt.mjs";

export const MANIFEST_URL = "media/retro-systems-lab/manifest.json";

const SURFACES = {
  brender: { evidence: "brenderArchival", media: "brender-verify-capture", page: "brender-archival.html", name: "BRender Archival" },
  revival: { evidence: "engineRevival", media: "engine-preserve-capture", page: "engine-revival.html", name: "Engine Revival" },
};

export function surfaceInfo(id) { return SURFACES[id] || null; }

// Fetch the manifest and re-hash every listed file. Resolves to { manifest, checks }, where each
// check is { id, href, verdict, expected, hash }. Fetch failures read UNVERIFIABLE, never MATCH.
export async function verifyManifest(base = "", fetcher = fetch) {
  const res = await fetcher(base + MANIFEST_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("manifest HTTP " + res.status);
  const manifest = await res.json();
  const checks = await Promise.all((manifest.media || []).map(async (m) => {
    try {
      const r = await fetcher(base + m.href, { cache: "no-cache" });
      if (!r.ok) return { id: m.id, href: m.href, verdict: "UNVERIFIABLE", expected: m.sha256, hash: null };
      const v = await verifyBytes(new Uint8Array(await r.arrayBuffer()), m.sha256);
      return { id: m.id, href: m.href, verdict: v.verdict, expected: m.sha256, hash: v.hash };
    } catch (_) {
      return { id: m.id, href: m.href, verdict: "UNVERIFIABLE", expected: m.sha256, hash: null };
    }
  }));
  return { manifest, checks };
}

export const evidence = {
  id: "evidence",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params, requestRedraw }) {
    const info = SURFACES[params.surface] || SURFACES.brender;
    let img = null, drawn = "", state = { manifest: null, checks: [] };
    const ready = verifyManifest().then((r) => {
      state = r;
      const entry = (r.manifest.media || []).find((m) => m.id === info.media);
      if (!entry) return;
      img = new Image();
      img.decoding = "async";
      img.alt = entry.alt || "";
      img.onload = () => { drawn = ""; if (requestRedraw) requestRedraw(); };
      img.src = entry.href;
    });
    return {
      backend: "canvas2d",
      static: true,
      ready,
      get state() { return state; },
      info,
      // Draws into the canvas at whatever size the host gave it, letterboxed, and redraws when that
      // size changes (the host may clear the canvas by resizing it).
      frame() {
        if (!img || !img.complete || !img.naturalWidth) return;
        const key = canvas.width + "x" + canvas.height;
        if (drawn === key) return;
        const w = canvas.width, h = canvas.height;
        const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        drawn = key;
      },
      readPixels() {
        const c = canvas.getContext("2d");
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() { img = null; },
    };
  },
};
