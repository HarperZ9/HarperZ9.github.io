// A6. Phantom words, after Diana Deutsch's demonstrations (Deutsch 1995, "Phantom words and other curiosities"; her own audio
// is not used and none is reproduced). Two short syllables repeat in a loop on the left channel, and the same loop plays on the right
// offset by half a syllable, so the channels interleave. Listeners report words that are not in either stream, and the words differ
// by listener and by what they were primed to expect. The synthesis here is our own: a noise burst for the consonant and a formant
// voice for the vowel.
// Limits. Whether our synthesis draws the effect from listeners is untested; Deutsch's effect depends on two separated sources or
// headphones and weakens or goes in mono. mode 'plain' plays one channel only, for the comparison.
import { playMotif } from './play.js';
import { mtof, noiseSource, stopAt } from '../util.js';
import { voice } from '../voices.js';

export const meta = { id: 'phantom-words', family: 'Contrasts A6: you hear what you expect', title: 'Phantom words', line: 'Two streams of the same two syllables. Type what you heard.' };

// consonant: burst centre in Hz and length; vowel formant set from voices.js
const SYLLABLES = {
  ba: { burst: 450, len: 0.012, vowel: 'a' }, da: { burst: 3200, len: 0.014, vowel: 'a' }, ga: { burst: 1800, len: 0.016, vowel: 'a' },
  na: { burst: 0, len: 0, vowel: 'a', nasal: 280 }, ma: { burst: 0, len: 0, vowel: 'a', nasal: 220 }, lo: { burst: 0, len: 0, vowel: 'o', nasal: 350 },
  ve: { burst: 5500, len: 0.02, vowel: 'e' }, ti: { burst: 4200, len: 0.012, vowel: 'i' }, bo: { burst: 450, len: 0.012, vowel: 'o' }, ku: { burst: 2400, len: 0.014, vowel: 'u' },
};
export const syllableNames = () => Object.keys(SYLLABLES);

export function syllable(ctx, dest, t, key, { dur = 0.2, note = 52, vel = 0.5, pan = 0 } = {}) {
  const s = SYLLABLES[key] || SYLLABLES.ba, p = ctx.createStereoPanner(), bus = ctx.createGain(); p.pan.value = pan; bus.connect(p); p.connect(dest);
  if (s.len) { // consonant burst, bandpassed noise with a short smooth envelope
    const n = noiseSource(ctx, 'white'), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = s.burst; f.Q.value = 1.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + s.len + 0.01); n.connect(f); f.connect(g); g.connect(bus); n.start(t); stopAt(n, t + s.len + 0.03);
  }
  voice(ctx, bus, t + s.len * 0.6, { note, dur: dur - s.len * 0.6, vel, vowel: s.vowel, vibrato: 0, depth: 0, attack: 0.02, release: dur * 0.35 });
}

export function render(ctx, dest, t, { loop = ['ba', 'na'], rate = 2.4, duration = 20, mode = 'phantom', note = 52, vel = 0.5, fade = 0.4 } = {}) {
  const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(1, t + fade); bus.gain.setValueAtTime(1, t + duration - fade); bus.gain.linearRampToValueAtTime(0.0001, t + duration); bus.connect(dest);
  const per = 1 / rate, n = Math.floor(duration / per);
  for (let i = 0; i < n; i++) {
    const key = loop[i % loop.length];
    syllable(ctx, bus, t + i * per, key, { dur: per * 0.9, note, vel, pan: -1 });
    if (mode === 'phantom') syllable(ctx, bus, t + i * per + per / 2, loop[(i + 1) % loop.length], { dur: per * 0.9, note, vel, pan: 1 });
  }
  return { duration, loop, mode, syllables: n };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
