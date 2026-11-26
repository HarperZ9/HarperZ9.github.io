// patchbay-core.mjs: Zero-dependency Unified Playground Interop Patchbay (Wave 29B / 31A).
// Typed signal ports across all 7 disciplines + DAW, DAG cycle guard, chained
// SHA-256 hop receipts (superstack/flicks aligned), and origin-pinned stage bridge.
export const PATCHBAY_RECEIPT_SCHEMA = 'playground.patchbay-hop/v1';
export const BRIDGE_PROTOCOL = 'playground.patchbay-msg/v1';
export const FLICKS_PER_SECOND = 705600000;
export const PORT_TYPES = Object.freeze([
  'frame', 'palette', 'audio_features', 'vector', 'cloth_wif', 'type_field', 'receipt',
]);

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  const len = bytes.length;
  const pad = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  pad.set(bytes);
  pad[len] = 0x80;
  const dv = new DataView(pad.buffer);
  dv.setUint32(pad.length - 8, Math.floor(len / 0x20000000), false);
  dv.setUint32(pad.length - 4, (len * 8) >>> 0, false);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < pad.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}

export function canonicalJson(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new RangeError('non-finite number in canonical payload');
    return Object.is(v, -0) ? '0' : String(v);
  }
  if (Array.isArray(v) || ArrayBuffer.isView(v)) {
    return '[' + Array.from(v, canonicalJson).join(',') + ']';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',') + '}';
  }
  throw new TypeError(`unsupported canonical type: ${typeof v}`);
}

export const digestPayload = (obj) => 'sha256:' + sha256Hex(canonicalJson(obj));

export function validatePortPayload(portType, payload) {
  if (!PORT_TYPES.includes(portType)) return `UNKNOWN_PORT_TYPE:${portType}`;
  if (!payload || typeof payload !== 'object') return `INVALID_PAYLOAD:${portType}`;
  if (portType === 'frame' && (!(payload.width > 0 && payload.height > 0) || !payload.pixelsSha256)) {
    return 'INVALID_FRAME_PAYLOAD';
  }
  if (portType === 'palette' && (!Array.isArray(payload.oklab) || !payload.oklab.length)) {
    return 'INVALID_PALETTE_PAYLOAD';
  }
  if (portType === 'audio_features') {
    if (!Number.isFinite(payload.rms) || !Array.isArray(payload.bands8) || payload.bands8.length !== 8) {
      return 'INVALID_AUDIO_FEATURES_PAYLOAD';
    }
  }
  if (portType === 'vector' && (typeof payload.svg !== 'string' || !payload.svg.includes('<svg'))) {
    return 'INVALID_VECTOR_PAYLOAD';
  }
  if (portType === 'cloth_wif' && (typeof payload.wifText !== 'string' || !payload.wifText.includes('[WEAVING]'))) {
    return 'INVALID_CLOTH_WIF_PAYLOAD';
  }
  if (portType === 'type_field' && (typeof payload.text !== 'string' || !payload.glyphMetrics)) {
    return 'INVALID_TYPE_FIELD_PAYLOAD';
  }
  return null;
}

export function sealHopReceipt({
  hopIndex, fromEngine, toEngine, portType, inputSha256, outputSha256,
  parentReceiptSha256 = 'sha256:genesis', tSeconds = 0, backend = 'patchbay-esm',
}) {
  const body = {
    schema: PATCHBAY_RECEIPT_SCHEMA,
    hopIndex,
    fromEngine,
    toEngine,
    portType,
    inputSha256,
    outputSha256,
    parentReceiptSha256,
    tFlicks: Math.round((Number(tSeconds) || 0) * FLICKS_PER_SECOND),
    backend,
  };
  return Object.freeze({ ...body, receiptSha256: digestPayload(body) });
}

export function verifyHopChain(chain) {
  const errors = [];
  if (!Array.isArray(chain) || !chain.length) return { ok: false, errors: ['EMPTY_CHAIN'] };
  let expectedParent = 'sha256:genesis';
  for (let i = 0; i < chain.length; i++) {
    const hop = chain[i];
    if (!hop || typeof hop !== 'object' || hop.schema !== PATCHBAY_RECEIPT_SCHEMA) {
      errors.push('INVALID_SCHEMA');
      continue;
    }
    if (hop.hopIndex !== i) errors.push('HOP_INDEX_MISMATCH');
    if (hop.parentReceiptSha256 !== expectedParent) errors.push('BROKEN_PARENT_CHAIN');
    const { receiptSha256, ...body } = hop;
    const recomputed = digestPayload(body);
    if (receiptSha256 !== recomputed) errors.push('TAMPERED_RECEIPT_SHA256');
    expectedParent = recomputed;
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)].sort() };
}

export function createPatchbay() {
  const engines = new Map();
  const wires = [];
  const hopSubscribers = new Set();
  const lastByEnginePort = new Map();

  function hasPath(startId, goalId) {
    const stack = [startId], seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (cur === goalId) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const w of wires) if (w.from === cur) stack.push(w.to);
    }
    return false;
  }

  function register(spec) {
    if (!spec?.id || !Array.isArray(spec.takes) || !Array.isArray(spec.gives)) {
      throw new Error('INVALID_ENGINE_SPEC');
    }
    for (const p of [...spec.takes, ...spec.gives]) {
      if (!PORT_TYPES.includes(p)) throw new Error(`UNKNOWN_PORT_TYPE:${p}`);
    }
    engines.set(spec.id, Object.freeze({ bridgeMode: 'direct', ...spec }));
    return spec.id;
  }

  function connect(from, outPort, to, inPort = outPort) {
    const src = engines.get(from), dst = engines.get(to);
    if (!src || !dst) return { ok: false, error: 'UNKNOWN_ENGINE' };
    if (from === to) return { ok: false, error: 'CYCLE_DETECTED' };
    if (outPort !== inPort) return { ok: false, error: 'PORT_TYPE_MISMATCH' };
    if (!src.gives.includes(outPort) || !dst.takes.includes(inPort)) {
      return { ok: false, error: 'PORT_TYPE_MISMATCH' };
    }
    if (hasPath(to, from)) return { ok: false, error: 'CYCLE_DETECTED' };
    if (!wires.some((w) => w.from === from && w.outPort === outPort && w.to === to && w.inPort === inPort)) {
      wires.push(Object.freeze({ from, outPort, to, inPort }));
    }
    return { ok: true, error: null };
  }

  function compatibleTargets(sourceId, outPort) {
    const src = engines.get(sourceId);
    if (!src || !src.gives.includes(outPort)) return [];
    const out = [];
    for (const [id, eng] of engines) {
      if (id === sourceId || !eng.takes.includes(outPort) || hasPath(id, sourceId)) continue;
      out.push({ id, name: eng.name, discipline: eng.discipline, bridgeMode: eng.bridgeMode });
    }
    return out;
  }

  function dispatch(sourceId, outPort, payload, { tSeconds = 0, maxHops = 32 } = {}) {
    const src = engines.get(sourceId);
    if (!src || !src.gives.includes(outPort)) return { ok: false, error: 'INVALID_SOURCE_OR_PORT', chain: [], outputs: {} };
    const bad = validatePortPayload(outPort, payload);
    if (bad) return { ok: false, error: bad, chain: [], outputs: {} };

    const chain = [];
    const outputs = { [`${sourceId}:${outPort}`]: payload };
    lastByEnginePort.set(`${sourceId}:${outPort}`, payload);
    const queue = [{ fromId: sourceId, port: outPort, data: payload, parentSha: 'sha256:genesis' }];

    while (queue.length) {
      if (chain.length >= maxHops) return { ok: false, error: 'MAX_HOPS_EXCEEDED', chain, outputs };
      const item = queue.shift();
      const targets = wires.filter((w) => w.from === item.fromId && w.outPort === item.port);
      for (const w of targets) {
        const dst = engines.get(w.to);
        const inputSha = digestPayload(item.data);
        const produced = dst.transform ? dst.transform(item.data, { inPort: w.inPort, from: item.fromId, lastByEnginePort }) : {};
        const entries = Object.entries(produced || {});
        const primaryOut = entries[0]?.[1] ?? item.data;
        const hop = sealHopReceipt({
          hopIndex: chain.length,
          fromEngine: item.fromId,
          toEngine: w.to,
          portType: w.inPort,
          inputSha256: inputSha,
          outputSha256: digestPayload(primaryOut),
          parentReceiptSha256: item.parentSha,
          tSeconds,
        });
        chain.push(hop);
        for (const fn of hopSubscribers) fn(hop, produced);
        for (const [nextPort, nextVal] of entries) {
          if (!dst.gives.includes(nextPort)) continue;
          const vErr = validatePortPayload(nextPort, nextVal);
          if (vErr) return { ok: false, error: vErr, chain, outputs };
          outputs[`${w.to}:${nextPort}`] = nextVal;
          lastByEnginePort.set(`${w.to}:${nextPort}`, nextVal);
          queue.push({ fromId: w.to, port: nextPort, data: nextVal, parentSha: hop.receiptSha256 });
        }
      }
    }
    return { ok: true, error: null, chain, outputs };
  }

  return {
    register,
    connect,
    compatibleTargets,
    dispatch,
    wires: () => wires.slice(),
    engines: () => [...engines.values()],
    onHop(fn) { hopSubscribers.add(fn); return () => hopSubscribers.delete(fn); },
  };
}

export function createStageBridge(patchbay, { allowedOrigin, postOut = null, broadcast = null } = {}) {
  if (!allowedOrigin) throw new Error('ALLOWED_ORIGIN_REQUIRED');

  function sendToStage(engineId, portType, payload, receipt = null) {
    const msg = Object.freeze({ protocol: BRIDGE_PROTOCOL, kind: 'dispatch', engineId, portType, payload, receipt, origin: allowedOrigin });
    postOut?.(msg, allowedOrigin);
    broadcast?.postMessage?.(msg);
    return msg;
  }

  function handleIncoming(event) {
    if (!event || event.origin !== allowedOrigin) return { ok: false, error: 'ORIGIN_MISMATCH' };
    const d = event.data;
    if (!d || d.protocol !== BRIDGE_PROTOCOL || d.kind !== 'dispatch') return { ok: false, error: 'INVALID_BRIDGE_MESSAGE' };
    const res = patchbay.dispatch(d.engineId, d.portType, d.payload, { tSeconds: d.tSeconds || 0 });
    if (res.ok && res.chain.length) {
      const ack = Object.freeze({
        protocol: BRIDGE_PROTOCOL, kind: 'receipt', engineId: d.engineId,
        chain: res.chain, origin: allowedOrigin,
      });
      postOut?.(ack, allowedOrigin);
      broadcast?.postMessage?.(ack);
    }
    return res;
  }

  return { sendToStage, handleIncoming };
}
