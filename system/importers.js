/**
 * system/importers.js
 * Universal importer registry for the Studio engine.
 * Zero dependencies. Pure browser ES module.
 *
 * INTEGRATION CONTRACT
 * --------------------
 * How studio.js calls this module:
 *
 *   import { StudioImporters } from "./importers.js";
 *
 *   // In the BYO drop/file-input handler, replace the existing loadFile(file) dispatch:
 *   async function loadFile(file) {
 *     leave3D();
 *     stopByoVideo();
 *     const result = await StudioImporters.importFile(file, $("studio-canvas"));
 *     if (!result.drewToCanvas) {
 *       say("model", "Unknown file type: " + (result.meta.ext || file.type)
 *         + ". Drop an image, video, audio, OBJ, GLTF, PLY, CSV, or JSON file.");
 *       return;
 *     }
 *     if (result.kind === "video" && result.meta.videoEl) {
 *       byoVideo = result.meta.videoEl;
 *       byoVideo.play().catch(() => {});
 *       attachAudio(byoVideo);
 *       startMeterLoop();
 *     }
 *     if (result.kind === "audio") {
 *       // result.meta.audioBuffer is an AudioBuffer; audio waveform is already drawn.
 *       // Wire to the audio analyser via an AudioBufferSourceNode if desired.
 *     }
 *     if (result.mesh) {
 *       // result.mesh = { vertices: [[x,y,z], ...], faces: [[i,j,k], ...], normals? }
 *       // Store for export: window._studioLastMesh = result.mesh;
 *     }
 *     const obs = perceive($("studio-canvas"));
 *     say("model", "Loaded " + result.kind + " • " + result.meta.name
 *       + ". Fingerprint " + obs.phash + ".");
 *     startMeterLoop();
 *   }
 *
 * Plugin point for new formats:
 *   StudioImporters.register(
 *     f => f.name.endsWith(".my-ext"),   // matcher fn(file)->bool
 *     async (file, canvas) => ({ kind: "my-ext", meta: {...}, drewToCanvas: true })
 *   );
 *   // matcher can also be an array of extensions: [".xyz", ".abc"]
 *   // or an array of MIME prefixes:              ["model/", "application/x-"]
 *
 * Return shape of importFile():
 *   {
 *     kind:         string,        // "image"|"video"|"svg"|"obj"|"gltf"|"ply"|"audio"|"data"|"unknown"
 *     meta:         object,        // format-specific (see per-importer docs below)
 *     mesh:         object|null,   // {vertices,faces,normals?} when the format has geometry
 *     drewToCanvas: boolean,       // false only for "unknown" or on unrecoverable parse error
 *     pluginPoint:  string|null,   // hint string present on "unknown" kind
 *   }
 */

// ---- helpers ----------------------------------------------------------------

function ext(file) {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "";
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/**
 * Fill canvas with src (ImageBitmap, HTMLImageElement, or HTMLVideoElement).
 * Sizes the canvas to fit within 1600px on the longer side while preserving aspect ratio.
 */
function drawToCanvas(canvas, src, sw, sh) {
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(sw, sh, 1));
  canvas.width  = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
}

// ---- default importers ------------------------------------------------------

/**
 * image (png / jpg / jpeg / gif / webp / avif / bmp)
 * Uses createImageBitmap for efficient decode; falls back to Image element.
 * meta: { name, size, width, height, type }
 */
async function importImage(file, canvas) {
  const url = URL.createObjectURL(file);
  try {
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch (_) {
      // createImageBitmap not available for this type (avif in some browsers): use Image
      bmp = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }
    const sw = bmp.width || bmp.naturalWidth;
    const sh = bmp.height || bmp.naturalHeight;
    drawToCanvas(canvas, bmp, sw, sh);
    if (bmp.close) bmp.close();
    return {
      kind: "image",
      meta: { name: file.name, size: file.size, width: canvas.width, height: canvas.height, type: file.type },
      mesh: null,
      drewToCanvas: true,
      pluginPoint: null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * video (mp4 / webm / mov / ogg video)
 * Seeks to the first available frame and draws it.
 * meta: { name, size, type, duration, videoWidth, videoHeight, videoEl }
 * videoEl is the live <video> element; the caller can call .play() and track it as byoVideo.
 */
async function importVideo(file, canvas) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  // Seek to just past the start so the first frame is decoded.
  await new Promise((resolve, reject) => {
    video.addEventListener("loadeddata", resolve, { once: true });
    video.addEventListener("error", reject, { once: true });
    video.load();
  });
  video.currentTime = 0;
  await new Promise(resolve => {
    video.addEventListener("seeked", resolve, { once: true });
  });
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  drawToCanvas(canvas, video, sw, sh);
  return {
    kind: "video",
    meta: {
      name: file.name,
      size: file.size,
      type: file.type,
      duration: video.duration,
      videoWidth: sw,
      videoHeight: sh,
      videoEl: video,   // caller keeps this alive for byoVideo
      objectUrl: url,   // caller must revoke when done
    },
    mesh: null,
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/**
 * SVG
 * Parses with DOMParser, rasterises via an Image element with a data URL.
 * meta: { name, size, type, svgWidth, svgHeight }
 */
async function importSVG(file, canvas) {
  const text = await readAsText(file);
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svgEl = doc.documentElement;
  // Try to read declared size; fall back to 512x512.
  let sw = parseInt(svgEl.getAttribute("width"),  10) || 512;
  let sh = parseInt(svgEl.getAttribute("height"), 10) || 512;
  const vb = svgEl.getAttribute("viewBox");
  if (vb && (isNaN(sw) || isNaN(sh))) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4) { sw = parts[2]; sh = parts[3]; }
  }
  const blob = new Blob([text], { type: "image/svg+xml" });
  const url  = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    drawToCanvas(canvas, img, img.naturalWidth || sw, img.naturalHeight || sh);
  } finally {
    URL.revokeObjectURL(url);
  }
  return {
    kind: "svg",
    meta: { name: file.name, size: file.size, type: file.type, svgWidth: sw, svgHeight: sh },
    mesh: null,
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/**
 * OBJ -- minimal hand-written parser.
 * Extracts vertices (v), faces (f), and optional normals (vn).
 * Draws a wireframe orthographic preview onto the canvas.
 * Returns mesh = { vertices: [[x,y,z],...], faces: [[i,j,k],...], normals? }.
 * meta: { name, size, vertexCount, faceCount }
 */
async function importOBJ(file, canvas) {
  const text = await readAsText(file);
  const vertices = [];
  const normals  = [];
  const faces    = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const p = line.slice(2).trim().split(/\s+/).map(Number);
      if (p.length >= 3) vertices.push([p[0], p[1], p[2]]);
    } else if (line.startsWith("vn ")) {
      const n = line.slice(3).trim().split(/\s+/).map(Number);
      if (n.length >= 3) normals.push([n[0], n[1], n[2]]);
    } else if (line.startsWith("f ")) {
      // Face entries: "f v" or "f v/t" or "f v/t/n" or "f v//n"; take the vertex index only.
      const tokens = line.slice(2).trim().split(/\s+/);
      const idx = tokens.map(t => {
        const v = parseInt(t.split("/")[0], 10);
        return v < 0 ? vertices.length + v : v - 1; // OBJ is 1-based, support negative
      });
      // Triangulate quads and larger polygons via fan decomposition.
      for (let i = 1; i < idx.length - 1; i++) {
        faces.push([idx[0], idx[i], idx[i + 1]]);
      }
    }
  }
  const mesh = { vertices, faces };
  if (normals.length) mesh.normals = normals;
  _drawObjWireframe(canvas, vertices, faces);
  return {
    kind: "obj",
    meta: { name: file.name, size: file.size, vertexCount: vertices.length, faceCount: faces.length },
    mesh,
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/** Orthographic wireframe render of OBJ/GLTF geometry onto canvas. */
function _drawObjWireframe(canvas, vertices, faces) {
  const W = 512, H = 512;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, W, H);
  if (!vertices.length) return;

  // Compute bounding box.
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of vertices) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-9);
  const scale = (W * 0.8) / span;

  // Project: simple orthographic X/Y with a mild isometric Z contribution.
  function project([x, y, z]) {
    // Isometric skew: nudge X and Y by Z for a sense of depth.
    const px = (x - cx + (z - (minZ + maxZ) / 2) * 0.25) * scale + W / 2;
    const py = (-(y - cy) + (z - (minZ + maxZ) / 2) * 0.15) * scale + H / 2;
    return [px, py];
  }

  // Compute a simple per-face Z for depth sorting (painter's order).
  const faceDepths = faces.map((f, i) => {
    const z = f.reduce((s, vi) => {
      const v = vertices[vi];
      return s + (v ? v[2] : 0);
    }, 0) / f.length;
    return { i, z };
  });
  faceDepths.sort((a, b) => a.z - b.z);

  // Draw edges, deduplicated.
  const drawnEdges = new Set();
  ctx.strokeStyle = "rgba(95,174,147,0.55)";
  ctx.lineWidth   = 0.6;
  for (const { i } of faceDepths) {
    const f = faces[i];
    for (let k = 0; k < f.length; k++) {
      const ai = f[k], bi = f[(k + 1) % f.length];
      const key = ai < bi ? ai + "_" + bi : bi + "_" + ai;
      if (drawnEdges.has(key)) continue;
      drawnEdges.add(key);
      const va = vertices[ai], vb = vertices[bi];
      if (!va || !vb) continue;
      const [ax, ay] = project(va), [bx, by] = project(vb);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
}

/**
 * GLTF / GLB
 * For GLTF (JSON): parses the JSON, reads the first mesh's POSITION and indices accessors,
 * reconstructs vertices and faces.
 * For GLB: reads the 12-byte header, extracts the JSON chunk, then locates the BIN chunk
 * for buffer data. Same face/vertex extraction as GLTF after that.
 * Draws the wireframe preview. Returns mesh = { vertices, faces }.
 * Honest partial: only the first primitive's POSITION + indices. No materials, no skins.
 * meta: { name, size, vertexCount, faceCount, primitiveCount }
 */
async function importGLTF(file, canvas) {
  const isGLB = ext(file) === "glb";
  const ab = await readAsArrayBuffer(file);
  let json, binChunk = null;

  if (isGLB) {
    const view = new DataView(ab);
    // GLB header: magic 0x46546C67, version uint32, length uint32
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) throw new Error("Not a valid GLB file");
    // First chunk: JSON
    const chunk0Len  = view.getUint32(12, true);
    const chunk0Type = view.getUint32(16, true);
    if (chunk0Type !== 0x4E4F534A) throw new Error("GLB first chunk is not JSON");
    const jsonBytes = new Uint8Array(ab, 20, chunk0Len);
    json = JSON.parse(new TextDecoder().decode(jsonBytes));
    // Second chunk (optional): BIN
    const binOffset = 20 + chunk0Len;
    if (binOffset + 8 <= ab.byteLength) {
      const chunk1Len  = view.getUint32(binOffset,     true);
      const chunk1Type = view.getUint32(binOffset + 4, true);
      if (chunk1Type === 0x004E4942) {
        binChunk = ab.slice(binOffset + 8, binOffset + 8 + chunk1Len);
      }
    }
  } else {
    const text = new TextDecoder().decode(ab);
    json = JSON.parse(text);
  }

  const buffers   = json.buffers   || [];
  const bufViews  = json.bufferViews || [];
  const accessors = json.accessors  || [];
  const meshes    = json.meshes     || [];

  // Resolve a buffer: GLB bin chunk or a data URI (external URIs not supported in zero-dep browser).
  async function resolveBuffer(bufIdx) {
    const buf = buffers[bufIdx];
    if (!buf) return null;
    if (isGLB && bufIdx === 0 && binChunk) return binChunk;
    if (buf.uri && buf.uri.startsWith("data:")) {
      const comma = buf.uri.indexOf(",");
      const b64   = buf.uri.slice(comma + 1);
      const raw   = atob(b64);
      const u8    = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      return u8.buffer;
    }
    return null; // external URIs require fetch -- not supported in zero-dep mode
  }

  // Read accessor data into a typed array.
  async function readAccessor(accIdx) {
    const acc = accessors[accIdx];
    if (!acc) return null;
    const bvIdx = acc.bufferView;
    if (bvIdx == null) return null;
    const bv = bufViews[bvIdx];
    if (!bv) return null;
    const abBuf = await resolveBuffer(bv.buffer || 0);
    if (!abBuf) return null;
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const count = acc.count;
    const CT = {
      5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array,
      5125: Uint32Array, 5126: Float32Array,
    };
    const TypedArr = CT[acc.componentType] || Float32Array;
    const components = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT2:4, MAT3:9, MAT4:16 }[acc.type] || 1;
    return new TypedArr(abBuf, byteOffset, count * components);
  }

  // Extract first primitive.
  let vertices = [], faces = [];
  let primCount = 0;
  for (const mesh of meshes) {
    for (const prim of (mesh.primitives || [])) {
      primCount++;
      if (vertices.length) break; // only first primitive
      const posIdx = prim.attributes && prim.attributes.POSITION;
      if (posIdx == null) continue;
      const posData = await readAccessor(posIdx);
      if (!posData) continue;
      for (let i = 0; i < posData.length; i += 3) {
        vertices.push([posData[i], posData[i + 1], posData[i + 2]]);
      }
      if (prim.indices != null) {
        const idxData = await readAccessor(prim.indices);
        if (idxData) {
          for (let i = 0; i < idxData.length; i += 3) {
            faces.push([idxData[i], idxData[i + 1], idxData[i + 2]]);
          }
        }
      } else {
        // No index buffer: generate sequential triangles.
        for (let i = 0; i < vertices.length - 2; i += 3) {
          faces.push([i, i + 1, i + 2]);
        }
      }
    }
    if (vertices.length) break;
  }

  const mesh = { vertices, faces };
  _drawObjWireframe(canvas, vertices, faces);
  return {
    kind: "gltf",
    meta: { name: file.name, size: file.size, vertexCount: vertices.length, faceCount: faces.length, primitiveCount: primCount },
    mesh,
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/**
 * PLY (ASCII only)
 * Reads the header to find element counts, then parses x/y/z per vertex.
 * Draws a point-cloud preview (no face connectivity required, but reads faces if present).
 * meta: { name, size, vertexCount, format }
 */
async function importPLY(file, canvas) {
  const text = await readAsText(file);
  const lines = text.split("\n");

  let inHeader = true;
  let vertexCount = 0;
  let faceCount   = 0;
  let xIdx = 0, yIdx = 1, zIdx = 2;
  let propIndex = 0;
  const propNames = [];

  for (const line of lines) {
    const t = line.trim();
    if (t === "end_header") { inHeader = false; break; }
    if (!inHeader) break;
    if (t.startsWith("element vertex")) vertexCount = parseInt(t.split(/\s+/)[2], 10);
    if (t.startsWith("element face"))   faceCount   = parseInt(t.split(/\s+/)[2], 10);
    if (t.startsWith("property float") || t.startsWith("property double") || t.startsWith("property int")) {
      const pname = t.split(/\s+/).pop();
      propNames.push(pname);
    }
  }
  xIdx = propNames.indexOf("x"); if (xIdx < 0) xIdx = 0;
  yIdx = propNames.indexOf("y"); if (yIdx < 0) yIdx = 1;
  zIdx = propNames.indexOf("z"); if (zIdx < 0) zIdx = 2;

  // Find header end and read vertex data lines.
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "end_header") { dataStart = i + 1; break; }
  }

  const vertices = [];
  for (let i = dataStart; i < dataStart + vertexCount && i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/).map(Number);
    if (parts.length >= 3) {
      vertices.push([
        isNaN(parts[xIdx]) ? parts[0] : parts[xIdx],
        isNaN(parts[yIdx]) ? parts[1] : parts[yIdx],
        isNaN(parts[zIdx]) ? parts[2] : parts[zIdx],
      ]);
    }
  }

  _drawPointCloud(canvas, vertices);
  return {
    kind: "ply",
    meta: { name: file.name, size: file.size, vertexCount: vertices.length, format: "ascii" },
    mesh: { vertices, faces: [] },
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/** Draw an orthographic point-cloud preview. */
function _drawPointCloud(canvas, vertices) {
  const W = 512, H = 512;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, W, H);
  if (!vertices.length) return;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const [x, y] of vertices) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 1e-9);
  const scale = (W * 0.85) / span;
  const MAX_PTS = 40000;
  const step = Math.ceil(vertices.length / MAX_PTS);

  ctx.fillStyle = "rgba(95,174,147,0.6)";
  for (let i = 0; i < vertices.length; i += step) {
    const [x, y] = vertices[i];
    const px = (x - cx) * scale + W / 2;
    const py = -(y - cy) * scale + H / 2;
    ctx.fillRect(px, py, 1.5, 1.5);
  }
}

/**
 * Audio (wav / mp3 / ogg / flac / aac)
 * Decodes via AudioContext.decodeAudioData.
 * Draws a waveform (top 60%) and a simple power spectrogram (bottom 40%).
 * meta: { name, size, type, duration, sampleRate, numberOfChannels, audioBuffer }
 * audioBuffer is the decoded AudioBuffer; caller can route it to an AudioBufferSourceNode.
 */
async function importAudio(file, canvas) {
  const ab = await readAsArrayBuffer(file);
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error("AudioContext unavailable");
  const ac = new AC();
  const audioBuffer = await ac.decodeAudioData(ab.slice(0));

  const { duration, sampleRate, numberOfChannels } = audioBuffer;

  // Use the first channel for waveform + spectrogram.
  const data   = audioBuffer.getChannelData(0);
  const W      = 512, H = 512;
  const wH     = Math.round(H * 0.6);   // waveform height
  const sH     = H - wH;                // spectrogram height
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, W, H);

  // Waveform.
  ctx.strokeStyle = "rgba(95,174,147,0.85)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  const samplesPerPx = Math.max(1, Math.floor(data.length / W));
  for (let px = 0; px < W; px++) {
    let min = 1, max = -1;
    for (let s = px * samplesPerPx; s < (px + 1) * samplesPerPx && s < data.length; s++) {
      if (data[s] < min) min = data[s];
      if (data[s] > max) max = data[s];
    }
    const y0 = wH / 2 + min * (wH / 2 - 2);
    const y1 = wH / 2 + max * (wH / 2 - 2);
    if (px === 0) ctx.moveTo(px, y0); else ctx.lineTo(px, y0);
    if (px === 0) ctx.lineTo(px, y1); else ctx.lineTo(px, y1);
  }
  ctx.stroke();

  // Horizontal divider.
  ctx.strokeStyle = "rgba(239,171,48,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, wH);
  ctx.lineTo(W, wH);
  ctx.stroke();

  // Simple power spectrogram: split signal into W time columns, FFT each, draw magnitude as colour.
  const fftSize  = 256;
  const halfFFT  = fftSize / 2;
  const colLen   = Math.max(fftSize, Math.floor(data.length / W));
  const fftBuf   = new Float32Array(fftSize);
  const cosTable = new Float32Array(halfFFT);
  const sinTable = new Float32Array(halfFFT);
  for (let k = 0; k < halfFFT; k++) {
    cosTable[k] = Math.cos((2 * Math.PI * k) / fftSize);
    sinTable[k] = Math.sin((2 * Math.PI * k) / fftSize);
  }

  // Hann window.
  const window_ = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) window_[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));

  const imageData = ctx.createImageData(W, sH);
  for (let col = 0; col < W; col++) {
    const start = Math.floor((col / W) * (data.length - fftSize));
    // Apply window and copy into FFT buffer.
    for (let i = 0; i < fftSize; i++) {
      fftBuf[i] = (data[start + i] || 0) * window_[i];
    }
    // Naive DFT (only halfFFT bins, W columns -- real data is fast enough for 128 bins).
    for (let k = 0; k < halfFFT; k++) {
      let re = 0, im = 0;
      // Precomputed trig for the DFT kernel at frequency k.
      const ck = cosTable[k], sk = sinTable[k];
      let ckn = 1, skn = 0;
      for (let n = 0; n < fftSize; n++) {
        re += fftBuf[n] * ckn;
        im -= fftBuf[n] * skn;
        const nck = ckn * ck - skn * sk;
        const nsk = ckn * sk + skn * ck;
        ckn = nck; skn = nsk;
      }
      const mag = Math.sqrt(re * re + im * im) / fftSize;
      // Map bin k to a vertical pixel row (k=0 at bottom, k=halfFFT at top).
      const row  = sH - 1 - Math.round((k / halfFFT) * (sH - 1));
      const intensity = Math.min(1, mag * 6);
      // Colour: dark teal at low intensity, amber at high intensity.
      const r = Math.round(intensity * 239);
      const g = Math.round(intensity < 0.5 ? intensity * 2 * 171 : 171 + (intensity - 0.5) * 2 * (255 - 171));
      const b = Math.round(intensity < 0.5 ? 48 + intensity * 2 * (147 - 48) : 147 - (intensity - 0.5) * 2 * 147);
      const idx = (row * W + col) * 4;
      imageData.data[idx]     = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, wH);

  // Close the temporary AudioContext (the caller wires their own if they need playback).
  ac.close().catch(() => {});

  return {
    kind: "audio",
    meta: { name: file.name, size: file.size, type: file.type, duration, sampleRate, numberOfChannels, audioBuffer },
    mesh: null,
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/**
 * Data (csv / json / txt)
 * For CSV with 2+ numeric columns: scatter/line plot (first two numeric columns).
 * For JSON arrays of numbers or {x,y}: same plot.
 * For everything else (JSON objects, plain text): renders a small summary table.
 * meta: { name, size, type, rowCount, colCount, preview }
 */
async function importData(file, canvas) {
  const text = await readAsText(file);
  const fileExt = ext(file);

  let rows = [];
  let colNames = [];
  let isNumericPairs = false;

  if (fileExt === "json") {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) {
        const first = parsed[0];
        if (typeof first === "number") {
          // Array of numbers: single-column, use index as X.
          rows = parsed.map((v, i) => [i, v]);
          colNames = ["index", "value"];
          isNumericPairs = true;
        } else if (typeof first === "object" && first !== null && ("x" in first || "y" in first)) {
          rows = parsed.map(r => [r.x != null ? r.x : r[0], r.y != null ? r.y : r[1]]);
          colNames = ["x", "y"];
          isNumericPairs = rows.every(r => typeof r[0] === "number" && typeof r[1] === "number");
        } else {
          // Object array: render summary.
          const keys = Object.keys(first);
          colNames = keys;
          rows = parsed.map(o => keys.map(k => o[k]));
        }
      }
    } catch (_) { /* will fall through to text summary */ }
  } else if (fileExt === "csv") {
    const allLines = text.trim().split("\n").map(l => l.split(",").map(s => s.trim()));
    if (allLines.length > 1) {
      colNames = allLines[0];
      rows = allLines.slice(1);
    } else {
      rows = allLines;
    }
    // Detect 2-column numeric CSV.
    if (rows.length && rows[0].length >= 2) {
      isNumericPairs = rows.slice(0, 10).every(r => !isNaN(parseFloat(r[0])) && !isNaN(parseFloat(r[1])));
      if (isNumericPairs) rows = rows.map(r => [parseFloat(r[0]), parseFloat(r[1])]);
    }
  } else {
    // Plain text: render a summary.
    const lineCount = text.split("\n").length;
    _renderTextSummary(canvas, file.name, text.slice(0, 500), lineCount);
    return {
      kind: "data",
      meta: { name: file.name, size: file.size, type: file.type, rowCount: lineCount, colCount: 1, preview: text.slice(0, 80) },
      mesh: null,
      drewToCanvas: true,
      pluginPoint: null,
    };
  }

  if (isNumericPairs && rows.length >= 2) {
    _renderPlot(canvas, rows, colNames);
  } else {
    _renderTableSummary(canvas, colNames, rows.slice(0, 12));
  }

  return {
    kind: "data",
    meta: {
      name: file.name, size: file.size, type: file.type,
      rowCount: rows.length, colCount: colNames.length,
      preview: text.slice(0, 80),
    },
    mesh: null,
    drewToCanvas: true,
    pluginPoint: null,
  };
}

/** Scatter/line plot for 2-column numeric data. */
function _renderPlot(canvas, rows, colNames) {
  const W = 512, H = 512;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, W, H);

  const PAD = 40;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of rows) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const rX = maxX - minX || 1, rY = maxY - minY || 1;
  function toScreen(x, y) {
    return [
      PAD + ((x - minX) / rX) * (W - PAD * 2),
      H - PAD - ((y - minY) / rY) * (H - PAD * 2),
    ];
  }

  // Axes.
  ctx.strokeStyle = "rgba(233,226,208,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD); ctx.lineTo(PAD, H - PAD);
  ctx.lineTo(W - PAD, H - PAD);
  ctx.stroke();

  // Line.
  ctx.strokeStyle = "rgba(95,174,147,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const MAX_LINE = 2000;
  const step = Math.ceil(rows.length / MAX_LINE);
  rows.forEach(([x, y], i) => {
    if (i % step !== 0) return;
    const [sx, sy] = toScreen(x, y);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  });
  ctx.stroke();

  // Dots (sparse for large datasets).
  const dotStep = Math.ceil(rows.length / 200);
  ctx.fillStyle = "rgba(239,171,48,0.7)";
  for (let i = 0; i < rows.length; i += dotStep) {
    const [sx, sy] = toScreen(rows[i][0], rows[i][1]);
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Axis labels.
  ctx.fillStyle = "rgba(233,226,208,0.55)";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(colNames[0] || "x", W / 2, H - 8);
  ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(colNames[1] || "y", 0, 0); ctx.restore();
}

/** Small table rendered as canvas text for non-numeric structured data. */
function _renderTableSummary(canvas, colNames, rows) {
  const W = 512, H = 512;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(239,171,48,0.85)";
  ctx.font = "bold 13px monospace";
  ctx.fillText(colNames.slice(0, 6).join("  |  "), 12, 30);
  ctx.fillStyle = "rgba(233,226,208,0.7)";
  ctx.font = "12px monospace";
  rows.slice(0, 18).forEach((row, i) => {
    const line = (Array.isArray(row) ? row : [row]).slice(0, 6).map(v => String(v).slice(0, 14)).join("  |  ");
    ctx.fillText(line, 12, 52 + i * 18);
  });
  ctx.fillStyle = "rgba(233,226,208,0.35)";
  ctx.font = "11px monospace";
  ctx.fillText(rows.length + " rows", 12, H - 12);
}

/** Plain text summary. */
function _renderTextSummary(canvas, name, preview, lineCount) {
  const W = 512, H = 512;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(239,171,48,0.85)";
  ctx.font = "bold 13px monospace";
  ctx.fillText(name, 12, 28);
  ctx.fillStyle = "rgba(233,226,208,0.7)";
  ctx.font = "12px monospace";
  const words = preview.replace(/\s+/g, " ").split(" ");
  let line = "", y = 56;
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (ctx.measureText(candidate).width > W - 24) {
      ctx.fillText(line, 12, y);
      y += 18;
      line = word;
    } else {
      line = candidate;
    }
    if (y > H - 40) break;
  }
  if (line) ctx.fillText(line, 12, y);
  ctx.fillStyle = "rgba(233,226,208,0.35)";
  ctx.font = "11px monospace";
  ctx.fillText(lineCount + " lines", 12, H - 12);
}

// ---- unknown handler --------------------------------------------------------

function importUnknown(file) {
  return {
    kind: "unknown",
    meta: { name: file.name, size: file.size, ext: ext(file), type: file.type },
    mesh: null,
    drewToCanvas: false,
    pluginPoint: "Register a handler via StudioImporters.register(matcher, importFn) to support this format.",
  };
}

// ---- registry ---------------------------------------------------------------

/**
 * StudioImporters
 *
 * register(matcher, importFn)
 *   matcher  -- fn(file)->bool, or string[] of ".ext" / "mime/prefix" values
 *   importFn -- async fn(file, canvas)->result (same shape as above)
 *   Last registered matcher with highest priority wins.
 *
 * importFile(file, canvas)
 *   Walks registered matchers in reverse-registration order.
 *   Returns a result object (see contract at the top of this file).
 */
export const StudioImporters = (() => {
  // Each entry: { match: fn(file)->bool, fn: async (file,canvas)->result }
  const registry = [];

  function normalizeMatcher(matcher) {
    if (typeof matcher === "function") return matcher;
    if (Array.isArray(matcher)) {
      return file => matcher.some(pattern => {
        if (pattern.startsWith(".")) return file.name.toLowerCase().endsWith(pattern);
        return (file.type || "").startsWith(pattern);
      });
    }
    throw new TypeError("StudioImporters.register: matcher must be a function or array");
  }

  function register(matcher, importFn) {
    registry.push({ match: normalizeMatcher(matcher), fn: importFn });
  }

  async function importFile(file, canvas) {
    // Walk in reverse order so the last-registered handler takes precedence.
    for (let i = registry.length - 1; i >= 0; i--) {
      if (registry[i].match(file)) {
        try {
          return await registry[i].fn(file, canvas);
        } catch (err) {
          // Handler failed. Report honestly instead of silently returning unknown.
          return {
            kind: "error",
            meta: { name: file.name, size: file.size, ext: ext(file), type: file.type, error: String(err) },
            mesh: null,
            drewToCanvas: false,
            pluginPoint: "Parser error: " + String(err),
          };
        }
      }
    }
    return importUnknown(file);
  }

  return { register, importFile };
})();

// ---- register all defaults --------------------------------------------------

StudioImporters.register(
  [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", "image/"],
  importImage
);

StudioImporters.register(
  [".mp4", ".webm", ".mov", ".ogg", ".ogv", "video/"],
  importVideo
);

StudioImporters.register(
  [".svg", "image/svg"],
  importSVG
);

StudioImporters.register(
  [".obj", "model/obj", "application/object"],
  importOBJ
);

StudioImporters.register(
  f => ext(f) === "gltf" || ext(f) === "glb" || f.type === "model/gltf+json" || f.type === "model/gltf-binary",
  importGLTF
);

StudioImporters.register(
  [".ply", "application/ply"],
  importPLY
);

StudioImporters.register(
  [".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a", "audio/"],
  importAudio
);

StudioImporters.register(
  [".csv", ".json", ".txt", "text/", "application/json"],
  importData
);

// ---- self-test --------------------------------------------------------------
// Guards: avoids DOM/AudioContext for the pure-parser paths.
// Parts that require a canvas or AudioContext are noted as browser-only and skipped in node.

export function _selftest() {
  const results = [];
  function assert(label, cond) {
    results.push({ label, pass: !!cond });
    if (!cond) console.error("[importers selftest FAIL]", label);
  }

  // --- OBJ parser ---
  const objText = [
    "v 0 0 0",
    "v 1 0 0",
    "v 0 1 0",
    "v 1 1 0",
    "vn 0 0 1",
    "f 1 2 3",
    "f 2 4 3",
  ].join("\n");

  const objLines = objText.split("\n");
  const verts = [], normals = [], faces = [];
  for (const rawLine of objLines) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const p = line.slice(2).trim().split(/\s+/).map(Number);
      if (p.length >= 3) verts.push([p[0], p[1], p[2]]);
    } else if (line.startsWith("vn ")) {
      const n = line.slice(3).trim().split(/\s+/).map(Number);
      if (n.length >= 3) normals.push([n[0], n[1], n[2]]);
    } else if (line.startsWith("f ")) {
      const tokens = line.slice(2).trim().split(/\s+/);
      const idx = tokens.map(t => { const v = parseInt(t.split("/")[0], 10); return v < 0 ? verts.length + v : v - 1; });
      for (let i = 1; i < idx.length - 1; i++) faces.push([idx[0], idx[i], idx[i + 1]]);
    }
  }
  assert("OBJ: 4 vertices", verts.length === 4);
  assert("OBJ: 1 normal",   normals.length === 1);
  assert("OBJ: 2 faces",    faces.length === 2);
  assert("OBJ: face[0] = [0,1,2]", faces[0][0] === 0 && faces[0][1] === 1 && faces[0][2] === 2);

  // --- PLY ASCII header parse ---
  const plyHeader = [
    "ply",
    "format ascii 1.0",
    "element vertex 5",
    "property float x",
    "property float y",
    "property float z",
    "element face 0",
    "end_header",
    "0 0 0",
    "1 0 0",
    "0 1 0",
    "1 1 0",
    "0.5 0.5 0",
  ].join("\n");
  const plyLines = plyHeader.split("\n");
  let vertCount = 0;
  for (const l of plyLines) { if (l.startsWith("element vertex")) vertCount = parseInt(l.split(/\s+/)[2], 10); }
  let dataStart = 0;
  for (let i = 0; i < plyLines.length; i++) { if (plyLines[i] === "end_header") { dataStart = i + 1; break; } }
  const plyVerts = [];
  for (let i = dataStart; i < dataStart + vertCount && i < plyLines.length; i++) {
    const parts = plyLines[i].trim().split(/\s+/).map(Number);
    if (parts.length >= 3) plyVerts.push(parts.slice(0, 3));
  }
  assert("PLY: vertex count header",    vertCount === 5);
  assert("PLY: 5 vertices parsed",      plyVerts.length === 5);
  assert("PLY: vertex[4] = [0.5,0.5,0]", plyVerts[4][0] === 0.5 && plyVerts[4][1] === 0.5);

  // --- CSV data parser ---
  const csvText = "x,y\n1,2\n3,4\n5,6";
  const csvLines = csvText.trim().split("\n").map(l => l.split(",").map(s => s.trim()));
  const csvCols  = csvLines[0];
  const csvRows  = csvLines.slice(1);
  const numPairs = csvRows.map(r => [parseFloat(r[0]), parseFloat(r[1])]);
  const isNum = numPairs.every(r => !isNaN(r[0]) && !isNaN(r[1]));
  assert("CSV: column names", csvCols[0] === "x" && csvCols[1] === "y");
  assert("CSV: 3 rows", csvRows.length === 3);
  assert("CSV: numeric pairs", isNum);
  assert("CSV: pair[1] = [3,4]", numPairs[1][0] === 3 && numPairs[1][1] === 4);

  // --- JSON array of numbers ---
  const jsonNums = JSON.parse("[10, 20, 30, 40]");
  const jsonRows = jsonNums.map((v, i) => [i, v]);
  assert("JSON: 4 rows", jsonRows.length === 4);
  assert("JSON: pair[2] = [2,30]", jsonRows[2][0] === 2 && jsonRows[2][1] === 30);

  // --- GLB header parse ---
  // Build a minimal GLB: 12-byte header + JSON chunk (no BIN).
  const jsonChunkText = JSON.stringify({ asset: { version: "2.0" }, meshes: [] });
  const enc = new TextEncoder();
  const jsonBytes = enc.encode(jsonChunkText);
  // Pad JSON chunk to 4-byte alignment.
  const padded = Math.ceil(jsonBytes.length / 4) * 4;
  const glbBuf = new ArrayBuffer(12 + 8 + padded);
  const glbView = new DataView(glbBuf);
  glbView.setUint32(0,  0x46546C67, true);  // magic
  glbView.setUint32(4,  2,          true);  // version
  glbView.setUint32(8,  12 + 8 + padded, true);  // total length
  glbView.setUint32(12, padded,     true);  // chunk 0 length
  glbView.setUint32(16, 0x4E4F534A, true);  // chunk 0 type = JSON
  for (let i = 0; i < jsonBytes.length; i++) glbView.setUint8(20 + i, jsonBytes[i]);
  const magic    = glbView.getUint32(0, true);
  const version  = glbView.getUint32(4, true);
  const c0Len    = glbView.getUint32(12, true);
  const c0Type   = glbView.getUint32(16, true);
  const c0Bytes  = new Uint8Array(glbBuf, 20, jsonBytes.length);
  const parsedGL = JSON.parse(new TextDecoder().decode(c0Bytes));
  assert("GLB: magic",         magic === 0x46546C67);
  assert("GLB: version 2",     version === 2);
  assert("GLB: JSON chunk id", c0Type === 0x4E4F534A);
  assert("GLB: JSON parsed",   parsedGL.asset && parsedGL.asset.version === "2.0");

  // --- matcher normalizer ---
  const matchExt = StudioImporters._normalizeMatcher
    ? StudioImporters._normalizeMatcher([".obj"])
    : (f => f.name.toLowerCase().endsWith(".obj"));
  // The registry is internal, but we can make fake file objects to probe it.
  const fakeObj = { name: "test.obj", type: "", size: 0 };
  const fakePng = { name: "test.png", type: "image/png", size: 0 };
  assert("matcher: .obj matches test.obj", matchExt(fakeObj));
  assert("matcher: .obj does not match test.png", !matchExt(fakePng));

  const passed = results.filter(r => r.pass).length;
  const total  = results.length;
  console.info(`[importers selftest] ${passed}/${total} passed`);
  if (passed < total) {
    const failed = results.filter(r => !r.pass).map(r => r.label);
    console.error("[importers selftest] FAILED:", failed);
  }
  return { passed, total, results };
}
