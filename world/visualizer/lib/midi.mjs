// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// midi.mjs: Standard MIDI Files, read and written, no dependency. Pure, so it runs in Node and in the browser.
//   parseMidi(bytes) -> { format, ppq, tempos: [{ tick, t, bpm }], tracks: [{ name, notes }], notes, duration }
//       notes: [{ t (s), dur (s), pitch, vel (0..1), ch, track }], sorted by time. Times follow the whole tempo map,
//       not only the first tempo event. Running status, note-on with velocity 0 as note-off, and overlapping notes on
//       one key (first in, first out) are handled. SMPTE time division is rejected with a message.
//   writeMidi({ ppq, bpm, tracks: [{ name, notes: [{ t, dur, pitch, vel, ch }] }] }) -> Uint8Array (format 1)
//   toEvents(midi) -> superframe events ({ duration, events: [{ t, voice, role, args: { note, dur, vel, track } }] })
//   fromEvents(events, { bpm }) -> the writeMidi input (one track per voice)

function vlq(bytes, p) { let v = 0, b; do { b = bytes[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return [v, p]; }
const u32 = (b, p) => ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0, u16 = (b, p) => (b[p] << 8) | b[p + 1];
const str = (b, p, n) => String.fromCharCode(...b.subarray(p, p + n));

export function parseMidi(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (str(b, 0, 4) !== 'MThd') throw new Error('midi: not a Standard MIDI File (no MThd header)');
  const format = u16(b, 8), ntrk = u16(b, 10), div = u16(b, 12);
  if (div & 0x8000) throw new Error('midi: SMPTE time division is not supported; re-save the file with ticks per quarter note');
  const ppq = div, raw = [], tempoEv = [];
  let p = 8 + u32(b, 4);
  for (let k = 0; k < ntrk && p < b.length; k++) {
    if (str(b, p, 4) !== 'MTrk') throw new Error(`midi: track ${k} has no MTrk header`);
    const end = p + 8 + u32(b, p + 4); p += 8;
    let tick = 0, status = 0, name = '';
    const on = new Map(), notes = [];
    while (p < end) {
      let d; [d, p] = vlq(b, p); tick += d;
      let s = b[p];
      if (s & 0x80) p++; else s = status;          // running status
      if (s === 0xff) {
        const type = b[p++]; let len; [len, p] = vlq(b, p);
        if (type === 0x51) tempoEv.push({ tick, us: (b[p] << 16) | (b[p + 1] << 8) | b[p + 2] });
        if (type === 0x03 && !name) name = str(b, p, len);
        p += len; continue;
      }
      if (s === 0xf0 || s === 0xf7) { let len; [len, p] = vlq(b, p); p += len; continue; }
      status = s;
      const hi = s & 0xf0, ch = s & 0x0f, a = b[p], c = b[p + 1];
      p += hi === 0xc0 || hi === 0xd0 ? 1 : 2;
      const key = ch * 128 + a;
      if (hi === 0x90 && c > 0) { if (!on.has(key)) on.set(key, []); on.get(key).push({ tick, vel: c / 127 }); }
      else if (hi === 0x80 || (hi === 0x90 && c === 0)) {
        const q = on.get(key); if (q?.length) { const n = q.shift(); notes.push({ tick: n.tick, end: tick, pitch: a, vel: n.vel, ch, track: k }); }
      }
    }
    for (const [key, q] of on) for (const n of q) notes.push({ tick: n.tick, end: tick, pitch: key % 128, vel: n.vel, ch: key >> 7, track: k });   // unterminated: end of track
    raw.push({ name, notes });
    p = end;
  }
  // tempo map: tick -> seconds, piecewise linear
  const map = [{ tick: 0, us: 500000 }, ...tempoEv.sort((x, y) => x.tick - y.tick)].reduce((m, e) => { if (m.length && m[m.length - 1].tick === e.tick) m[m.length - 1] = e; else m.push(e); return m; }, []);
  let acc = 0; const seg = map.map((e, i) => { if (i) acc += (e.tick - map[i - 1].tick) * map[i - 1].us / 1e6 / ppq; return { ...e, t: acc }; });
  const sec = tick => { let i = seg.length - 1; while (i > 0 && seg[i].tick > tick) i--; return seg[i].t + (tick - seg[i].tick) * seg[i].us / 1e6 / ppq; };
  const tracks = raw.map(r => ({ name: r.name, notes: r.notes.map(n => ({ t: sec(n.tick), dur: sec(n.end) - sec(n.tick), pitch: n.pitch, vel: n.vel, ch: n.ch, track: n.track })).sort((x, y) => x.t - y.t || x.pitch - y.pitch) }));
  const notes = tracks.flatMap(t => t.notes).sort((x, y) => x.t - y.t || x.track - y.track || x.pitch - y.pitch);
  return { format, ppq, tempos: seg.map(e => ({ tick: e.tick, t: e.t, bpm: 60e6 / e.us })), tracks, notes, duration: notes.reduce((m, n) => Math.max(m, n.t + n.dur), 0) };
}

function wvlq(v) { const out = [v & 0x7f]; while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80); return out; }
function chunk(type, data) { const n = data.length; return [...type].map(c => c.charCodeAt(0)).concat([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], data); }

export function writeMidi({ ppq = 480, bpm = 120, tracks }) {
  const tick = t => Math.round(t * bpm / 60 * ppq), us = Math.round(60e6 / bpm);
  const meta = [0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x2f, 0];
  const out = chunk('MThd', [0, 1, 0, tracks.length + 1, (ppq >> 8) & 255, ppq & 255]).concat(chunk('MTrk', meta));
  for (const tr of tracks) {
    const ev = [];
    for (const n of tr.notes) {
      const ch = (n.ch ?? 0) & 15, v = Math.max(1, Math.min(127, Math.round((n.vel ?? 0.8) * 127)));
      ev.push({ k: tick(n.t), o: 1, d: [0x90 | ch, n.pitch, v] }, { k: tick(n.t + Math.max(0.001, n.dur ?? 0.1)), o: 0, d: [0x80 | ch, n.pitch, 0] });
    }
    ev.sort((x, y) => x.k - y.k || x.o - y.o);   // at one tick, note-offs before note-ons
    const data = [];
    if (tr.name) { const nb = [...tr.name].map(c => c.charCodeAt(0) & 0x7f); data.push(0, 0xff, 0x03, ...wvlq(nb.length), ...nb); }
    let last = 0; for (const e of ev) { data.push(...wvlq(e.k - last), ...e.d); last = e.k; }
    data.push(0, 0xff, 0x2f, 0);
    out.push(...chunk('MTrk', data));
  }
  return Uint8Array.from(out);
}

export function toEvents(midi) {
  const names = midi.tracks.map((t, i) => t.name || `track ${i}`);
  const events = midi.notes.map(n => ({ t: n.t, voice: names[n.track], role: 'note', args: { note: n.pitch, dur: n.dur, vel: n.vel, track: n.track, ch: n.ch } }));
  return { duration: midi.duration, events };
}

export function fromEvents(ev, { bpm = 120 } = {}) {
  const by = new Map();
  for (const e of ev.events) {
    const k = e.voice ?? 'notes'; if (!by.has(k)) by.set(k, { ch: by.size % 16, notes: [] });
    const tr = by.get(k); tr.notes.push({ t: e.t, dur: e.args?.dur ?? 0.1, pitch: Math.round(e.args?.note ?? 60), vel: e.args?.vel ?? 0.8, ch: tr.ch });
  }
  return { bpm, tracks: [...by].map(([name, tr]) => ({ name, notes: tr.notes })) };
}
