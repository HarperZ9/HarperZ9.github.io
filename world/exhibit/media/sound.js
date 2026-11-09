// media/sound.js: sound for the set pieces, muted until the viewer turns it on. Built on our own engine in
// media/sound-engine/, a vendored copy of sound/sound (no dependencies; sync and hash check with tools/vendor_engine.py there). Same API as the earlier stub, plus:
//   S.engine()   the live Engine (voices, fx, sequencer live on it), or null while sound is off
//   S.motif(id, opts)   play a motif: false-scale, crowd-of-one, vanishing-record, momentum, thought, trauma, pain, longing, memory
// tracks: { name: { url, loop?, gain? } } are the cleared archival clips in assets/audio. Nothing plays and no audio is fetched
// until the first click on the sound button. Turning it off mutes the engine and stops every bed and motif.
const ENGINE = new URL('./sound-engine/', import.meta.url);
export function sound(tracks = {}) {
  let ctx = null, master = null, E = null, mods = null; const buf = {}, beds = {}, live = new Set(), S = { on: false, level: 1 };
  const load = async n => { if (buf[n]) return buf[n]; const r = await fetch(tracks[n].url), a = await r.arrayBuffer(); return buf[n] = await ctx.decodeAudioData(a); };
  const engineMods = async () => mods || (mods = { Engine: (await import(new URL('engine.js', ENGINE))).Engine, motifs: (await import(new URL('motifs/index.js', ENGINE))).MOTIFS });
  S.mount = host => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sndbtn'; b.setAttribute('aria-pressed', 'false'); b.textContent = 'Sound off';
    b.title = 'Sound is off until you turn it on'; host.append(b);
    b.onclick = async () => { S.on = !S.on; b.setAttribute('aria-pressed', S.on); b.textContent = S.on ? 'Sound on' : 'Sound off';
      if (S.on) {
        try { const { Engine } = await engineMods(); E = E || await Engine.live(); } catch (e) { console.error('sound engine failed to start', e); S.on = false; b.setAttribute('aria-pressed', 'false'); b.textContent = 'Sound off'; return; }
        ctx = E.ctx; master = E.out; E.mute(false); E.setVolume(S.level); for (const n in beds) S.bed(n, beds[n]);
      } else { if (E) E.mute(true); for (const n in beds) stopBed(n, true); live.forEach(h => h.stop(0.05)); live.clear(); if (gen) { gen.dispose(); gen = null; } } };
    return b;
  };
  const stopBed = (n, keep) => { const o = beds[n]; if (o && o.src) { try { o.src.stop(); } catch (e) { console.warn('bed stop', e); } o.src = null; o.gn = null; } if (!keep) delete beds[n]; };
  // A looping bed at a gain from 0 to 1. Call again to change the gain.
  S.bed = async (n, g) => {
    const had = beds[n]; beds[n] = { g, src: had ? had.src : null, gn: had ? had.gn : null }; if (!S.on || !ctx) return;
    const o = beds[n]; if (!o.src) { const b = await load(n); const s = ctx.createBufferSource(), gn = ctx.createGain(); s.buffer = b; s.loop = true; s.connect(gn); gn.connect(master); s.start(); o.src = s; o.gn = gn; }
    if (o.gn) { const v = (Number.isFinite(g) ? g : 1) * (tracks[n].gain ?? 1); o.gn.gain.setTargetAtTime(Number.isFinite(v) ? v : 0, ctx.currentTime, .15); }
  };
  S.once = async (n, o = {}) => { if (!S.on || !ctx) return; const b = await load(n), s = ctx.createBufferSource(), gn = ctx.createGain(); s.buffer = b; s.playbackRate.value = o.rate || 1; gn.gain.value = (o.gain ?? 1) * (tracks[n].gain ?? 1); s.connect(gn); gn.connect(master); s.start(0, o.offset || 0); return s; };
  S.motif = async (id, o = {}) => { if (!S.on || !E) return null; const { motifs } = await engineMods(); if (!motifs[id]) throw new Error('unknown motif ' + id); const h = motifs[id].play(E, o); live.add(h); h.ended.then(() => live.delete(h)); return h; };
  // S.wander(true, { level }): the generative score (jazz-funk, atmospheric drum and bass, spiritual-jazz reeds, DMV and
  // industrial moods) as a quiet room ambience that never repeats exactly. Only while sound is on; off again with false.
  let gen = null;
  S.wander = async (on = true, o = {}) => { if (!on) { if (gen) { gen.dispose(); gen = null; } return null; } if (!S.on || !E) return null;
    const { Generative } = await import(new URL('v3/generative.js', ENGINE)); gen = gen || new Generative(E, { level: o.level ?? 0.25, seed: o.seed }); gen.start(); return gen; };
  S.engine = () => (S.on ? E : null); S.ctx = () => ctx; S.buffer = load; S.master = () => master;
  return S;
}
