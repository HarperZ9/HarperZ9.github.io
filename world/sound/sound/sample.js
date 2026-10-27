// Archival sound. Only cleared items (public domain or CC0 through open-archives) live in assets/audio.
// Credits and receipts are listed in ASSETS.md and mirrored here so a page can show the credit next to the sound.
export const ARCHIVE = {
  'drum-conversation': { file: 'drum-conversation.opus', title: 'Drum Conversation', source: 'Internet Archive, 78rpm collection', licence: 'CC0', use: 'chopped drums' },
  'brass-march': { file: 'brass-march.opus', title: 'March brass band playing parading by', source: 'Wikimedia Commons', licence: 'Public domain', use: 'marching figure, crowd texture' },
  'fm-static': { file: 'fm-static.opus', title: 'FM Radio Static', source: 'Openverse', licence: 'CC0', use: 'between stations' },
  'human-voice': { file: 'human-voice.opus', title: 'Wikipedia: Human voice (spoken by AI voice)', source: 'Wikimedia Commons', licence: 'Public domain', use: 'thought and aliasing' },
  'vinyl-crackle': { file: 'vinyl-crackle.opus', title: 'Vinyl snap, crackle and pop redux', source: 'Openverse', licence: 'CC0', use: 'surface texture' },
};

const cache = new WeakMap();
export async function loadArchive(ctx, key, base = new URL('./assets/audio/', import.meta.url)) {
  let m = cache.get(ctx); if (!m) cache.set(ctx, (m = {}));
  if (m[key]) return m[key];
  const meta = ARCHIVE[key]; if (!meta) throw new Error('unknown archive item ' + key);
  const res = await fetch(new URL(meta.file, base));
  if (!res.ok) throw new Error('archive fetch failed ' + meta.file + ' ' + res.status);
  return (m[key] = await ctx.decodeAudioData(await res.arrayBuffer()));
}

// Cut a buffer into n equal slices, or at detected onsets when onsets is true.
export function chop(buf, n = 8, { onsets = false } = {}) {
  if (!onsets) return Array.from({ length: n }, (_, i) => ({ start: (buf.duration * i) / n, dur: buf.duration / n }));
  const d = buf.getChannelData(0), hop = Math.floor(buf.sampleRate * 0.01), e = [];
  for (let i = 0; i + hop < d.length; i += hop) { let s = 0; for (let k = 0; k < hop; k++) s += d[i + k] * d[i + k]; e.push(Math.sqrt(s / hop)); }
  const marks = []; let last = -1;
  for (let i = 2; i < e.length; i++) if (e[i] > 0.04 && e[i] > e[i - 2] * 2.2 && i - last > 12) { marks.push(i * 0.01); last = i; }
  const cuts = marks.slice(0, n);
  return cuts.map((s, i) => ({ start: s, dur: Math.min((cuts[i + 1] ?? buf.duration) - s, 0.6) }));
}

export function playSlice(ctx, dest, t, buf, { start = 0, dur = 0.3, rate = 1, vel = 0.8, reverse = false, fade = 0.004 } = {}) {
  let b = buf;
  if (reverse) {
    b = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) b.getChannelData(c).set(Array.from(buf.getChannelData(c)).reverse());
    start = buf.duration - start - dur;
  }
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.playbackRate.value = rate;
  const len = dur / rate; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + fade); g.gain.setValueAtTime(vel, t + Math.max(fade, len - fade)); g.gain.linearRampToValueAtTime(0.0001, t + len);
  s.connect(g); g.connect(dest); s.start(t, Math.max(0, start), dur); return s;
}
