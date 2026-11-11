// pieces.js: the three meditations. Each one is a key, a tempo, a feel and a small book of eight-bar sections written as
// chord symbols. The composer (score.js) walks the book in a seeded order and writes the parts, so a piece keeps its
// character and does not repeat as a loop. One string is one bar; two symbols in a string share the bar.
//   ii-V-I       the motion at the centre of jazz harmony: the chord on the second degree, then the fifth, then home
//   modal vamp   two chords from one mode going back and forth, with no pull toward a home chord
//   swing        how late the off-beat eighth note falls: 0.50 is even, 0.667 is a triplet
// mix values are stem levels in dB before mastering; masterDb is the fixed gain that brings the mix to the house loudness
// (-14 LUFS), measured by the ear on the offline render and used as is by the live form.
export const PIECES = {
  'low-tide': {
    title: 'Low Tide', topic: 'Ink and water', key: 'D-flat major', tonic: 'Db6/9', bpm: 66, swing: 0.62, feel: 'ballad', leadVoice: 'reed', scale: [1, 3, 5, 6, 8, 10, 0],
    why: 'The water place is about slow movement that never repeats exactly. A ballad in D-flat with ii-V-I motion resolves the way a wave does: it leans, breaks and settles. The sea is the loudest layer of ambience here.',
    sections: {
      A: ['Ebm9', 'Ab13', 'Dbmaj9', 'Bbm9', 'Ebm9', 'Absus13', 'Dbmaj9', 'Db6/9'],
      B: ['Gbmaj9', 'Cm7b5 F7alt', 'Bbm9', 'Bbm11', 'Ebm9', 'Ab13', 'Dbmaj9', 'Ebm9 Ab13'],
      C: ['Dbmaj9', 'Fm9', 'Gbmaj9', 'Absus13', 'Bbm9', 'Eb13', 'Ebm9', 'Ab7alt'],
    },
    next: { A: { A: 0.25, B: 0.45, C: 0.3 }, B: { A: 0.6, C: 0.4 }, C: { A: 0.55, B: 0.45 } },
    lead: { rest: [5, 10], range: [63, 80], preset: { model: 'reed', breath: 0.6, noise: 0.07, vibrato: 0.009, vibRate: 4.9, vibDelay: 0.45, reedStiff: 0.33, tone: 3200, scoop: 0.7 } },
    ambience: { sea: 1, wind: 0.35, air: 0.35, period: [8, 13] },
    mix: { keys: 0, bass: -1, drums: 4, lead: -1, pad: -6, room: -4, ambience: -9 }, masterDb: 4.5,
  },
  'night-school': {
    title: 'Night School', topic: 'Night School', key: 'D dorian', tonic: 'Dm11', bpm: 76, swing: 0.57, feel: 'modal', leadVoice: 'flute', scale: [2, 4, 5, 7, 9, 11, 0],
    why: 'Night School teaches one idea at a time and returns to it. A modal vamp does the same: two chords from one mode, heard again and again from a slightly different side, with long rests to think in. The wind is steadier than the sea here.',
    sections: {
      A: ['Dm9', 'Dm9', 'G13', 'G13', 'Dm11', 'Dm11', 'G13', 'Gsus13'],
      B: ['Fmaj9', 'Fmaj9', 'Am9', 'Am9', 'Bbmaj9', 'Bbmaj9', 'A7alt', 'A7alt'],
      C: ['Dm11', 'Cmaj9', 'Bbmaj9', 'A7alt', 'Dm9', 'G13', 'Cmaj9', 'Em7b5 A7alt'],
    },
    next: { A: { A: 0.4, B: 0.35, C: 0.25 }, B: { A: 0.7, C: 0.3 }, C: { A: 0.7, B: 0.3 } },
    lead: { rest: [6, 12], range: [65, 84], preset: { model: 'flute', breath: 0.72, noise: 0.14, vibrato: 0.01, vibRate: 5.1, vibDelay: 0.4, reedStiff: 0.3, tone: 4800, scoop: 0.3 } },
    ambience: { sea: 0.55, wind: 0.8, air: 0.3, period: [9, 15] },
    mix: { keys: 0, bass: -1, drums: 3, lead: -4, pad: -5, room: -3, ambience: -10 }, masterDb: 5.3,
  },
  'glass-hour': {
    title: 'Glass Hour', topic: 'Light and glass', key: 'A major', tonic: 'A6/9', bpm: 84, swing: 0.5, feel: 'bossa', leadVoice: 'reed', scale: [9, 11, 1, 2, 4, 6, 8],
    why: 'Light through glass is bright and even. This one keeps even eighth notes in a bossa pattern, in A major with sixth and ninth chords that stay open at the top. The air of an open sky is the main ambience, with a small sea far off.',
    sections: {
      A: ['Amaj9', 'F#m9', 'Bm9', 'E13', 'Amaj9', 'F#m11', 'Bm9', 'Esus13'],
      B: ['Dmaj9', 'D6/9', 'C#m9', 'F#m9', 'Bm9', 'E13', 'A6/9', 'Bm9 E7alt'],
      C: ['F#m9', 'B13', 'Emaj9', 'C#m9', 'Dmaj9#11', 'D#m7b5 G#7alt', 'C#m9', 'Bm9 E13'],
    },
    next: { A: { A: 0.3, B: 0.4, C: 0.3 }, B: { A: 0.6, C: 0.4 }, C: { A: 0.6, B: 0.4 } },
    lead: { rest: [4, 9], range: [64, 81], preset: { model: 'reed', breath: 0.7, noise: 0.05, vibrato: 0.008, vibRate: 5.3, vibDelay: 0.35, reedStiff: 0.27, tone: 3800, scoop: 0.5 } },
    ambience: { sea: 0.45, wind: 0.4, air: 0.9, period: [10, 16] }, tine: { bell: 0.75, tone: 6200, tine: 0.9 },
    mix: { keys: 0, bass: -2, drums: 7, lead: -2, pad: -6, room: -4, ambience: -8 }, masterDb: 4.1,
  },
};
export const PIECE_IDS = Object.keys(PIECES);
