// Standard MIDI File format 0 writer. SMF 1.1 byte layout:
// all multi-byte integers big-endian, MThd length always 6, exactly
// one MTrk chunk holding every event. Pure byte math, no DOM.

// VLQ: value split into 7-bit groups, most significant group first,
// bit 7 set on every byte except the last. Range 0 to 0x0FFFFFFF.
export function vlq(n) {
  let v = Math.max(0, Math.min(0x0FFFFFFF, Math.floor(n)));
  const groups = [v & 0x7F];
  v >>>= 7;
  while (v > 0) {
    groups.push(v & 0x7F);
    v >>>= 7;
  }
  groups.reverse();
  for (let i = 0; i < groups.length - 1; i++) groups[i] |= 0x80;
  return groups;
}

// Channel status nibbles: off 8n, on 9n, cc Bn, prog Cn. ch 0..15.
const STATUS = { off: 0x80, on: 0x90, cc: 0xB0, prog: 0xC0 };

// prog carries one data byte, the rest carry two. Data bytes 0..127.
function eventBytes(ev) {
  const status = STATUS[ev.type] | (ev.ch & 0x0F);
  if (ev.type === "prog") return [status, ev.a & 0x7F];
  return [status, ev.a & 0x7F, (ev.b ?? 0) & 0x7F];
}

// Track body: tempo meta at tick 0, sorted events with VLQ deltas,
// End of Track meta FF 2F 00 (required by spec).
function trackBytes(events, tempoBPM) {
  const out = [];
  // Set Tempo FF 51 03: 24-bit microseconds per quarter note, MSB first.
  const usPerQ = Math.round(60000000 / tempoBPM);
  out.push(0x00, 0xFF, 0x51, 0x03,
    (usPerQ >> 16) & 0xFF, (usPerQ >> 8) & 0xFF, usPerQ & 0xFF);
  const sorted = events.slice().sort((x, y) => x.tick - y.tick);
  let last = 0;
  for (const ev of sorted) {
    if (!(ev.type in STATUS)) continue;
    const tick = Math.max(0, Math.round(ev.tick));
    out.push(...vlq(tick - last), ...eventBytes(ev));
    last = tick;
  }
  out.push(0x00, 0xFF, 0x2F, 0x00);
  return out;
}

// opts: {ticksPerQuarter default 480, tempoBPM default 96, events:
// [{tick, type, ch, a, b}]}. Events may arrive unsorted.
export function writeMIDI(opts = {}) {
  const tpq = opts.ticksPerQuarter ?? 480;
  const tempoBPM = opts.tempoBPM ?? 96;
  const track = trackBytes(opts.events ?? [], tempoBPM);
  const n = track.length;
  const bytes = [
    // MThd, length 6, format 0, one track, division in tpq mode (bit 15 = 0)
    0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6,
    0, 0,
    0, 1,
    (tpq >> 8) & 0x7F, tpq & 0xFF,
    // MTrk, 32-bit data byte count
    0x4D, 0x54, 0x72, 0x6B,
    (n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF,
  ];
  bytes.push(...track);
  return Uint8Array.from(bytes);
}
