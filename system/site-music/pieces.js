// pieces.js: the five meditations. Each one is a key, a tempo, a feel, a band and a small book of eight-bar sections
// written as chord symbols. The composer (score.js) gives the piece a shape (introduction, statement, a contrasting
// middle, return, ending) and writes the parts, so a piece keeps its character and does not repeat as a loop.
// In a section, one string is one bar; two symbols share the bar; "=" holds the chord before it for another bar.
//   ii-V-I       the motion at the centre of jazz harmony: the chord on the second degree, then the fifth, then home
//   modal vamp   two chords from one mode going back and forth, with no pull toward a home chord
//   swing        how late the off-beat eighth note falls: 0.50 is even, 0.667 is a triplet
//   break        a drum pattern cut into pieces and put back in a new order, the rhythm of drum and bass
// band: bass is "upright" (plucked), "guitar" (electric bass guitar) or "sub"; kit is "brush", "tight" or "break";
// lead is "sax", "reed" (a clarinet) or "flute", each over a tone measured from that instrument. human scales the timing and velocity spread
// (1 is a relaxed player, 0.5 a tight one). mix values are stem levels in dB before mastering; masterDb is the fixed
// gain that brings the mix to the house loudness (-14 LUFS), measured by the ear on the offline render.
// lead presets: noise 0.1 plays the breath noise as measured on the instrument; tone, when set, darkens the measured tone
const REED = { breath: 0.7, noise: 0.1, vibrato: 0.006, vibRate: 5.3, vibDelay: 0.35, scoop: 0.4 };
const FLUTE = { breath: 0.74, noise: 0.1, vibrato: 0.01, vibRate: 5.1, vibDelay: 0.4, scoop: 0.3 };

export const PIECES = {
  'low-tide': {
    title: 'Low Tide', topic: 'Ink and water', key: 'D-flat major', tonic: 'Db6/9', cadence: ['Ebm9', 'Ab13'], bpm: 72, swing: 0.62, feel: 'ballad', intro: 4, human: 1,
    band: { bass: 'upright', kit: 'brush', lead: 'sax', keysFx: 'tremolo' }, scale: [1, 3, 5, 6, 8, 10, 0],
    why: 'The water place is about slow movement that never repeats exactly. A ballad in D-flat with ii-V-I motion resolves the way a wave does: it leans, breaks and settles. This is the slow, sparse one, for rest, and the sea is the loudest layer of ambience here.',
    sections: {
      A: ['Ebm9', 'Ab13', 'Dbmaj9', 'Bbm9', 'Ebm9', 'Absus13', 'Dbmaj9', 'Db6/9'],
      B: ['Gbmaj9', 'Cm7b5 F7alt', 'Bbm9', 'Bbm11', 'Ebm9', 'Ab13', 'Dbmaj9', 'Ebm9 Ab13'],
      C: ['Dbmaj9', 'Fm9', 'Gbmaj9', 'Absus13', 'Bbm9', 'Eb13', 'Ebm9', 'Ab7alt'],
    },
    next: { A: { A: 0.3, B: 0.7 }, B: { A: 0.6, B: 0.4 } }, middle: 'C',
    lead: { rest: [6, 11], range: [56, 75], stretch: 1, preset: { breath: 0.58, noise: 0.12, vibrato: 0.012, vibRate: 4.8, vibDelay: 0.5, scoop: 0.8, tone: 3600 } },
    ambience: { sea: 1, wind: 0.35, air: 0.4, period: [8, 13] },
    mix: { keys: 0, bass: -1, sub: -60, drums: 5, lead: -4, pad: -6, room: -3, ambience: -7.8 }, masterDb: 5.0,
  },
  'night-school': {
    title: 'Night School', topic: 'Night School', key: 'D dorian', tonic: 'Dm11', cadence: ['Em7b5', 'A7alt'], bpm: 90, swing: 0.57, feel: 'modal', intro: 4, human: 1,
    band: { bass: 'upright', kit: 'brush', lead: 'flute', keysFx: 'chorus' }, scale: [2, 4, 5, 7, 9, 11, 0],
    why: 'Night School teaches one idea at a time and returns to it. A modal vamp does the same: two chords from one mode, heard again and again from a slightly different side, with long rests to think in. The wind is steadier than the sea here.',
    sections: {
      A: ['Dm9', 'Dm9', 'G13', 'G13', 'Dm11', 'Dm11', 'G13', 'Gsus13'],
      B: ['Fmaj9', 'Fmaj9', 'Am9', 'Am9', 'Bbmaj9', 'Bbmaj9#11', 'A7alt', 'A7alt'],
      C: ['Dm11', 'Cmaj9', 'Bbmaj9', 'A7alt', 'Dm9', 'G13', 'Cmaj9', 'Em7b5 A7alt'],
    },
    next: { A: { A: 0.45, B: 0.55 }, B: { A: 0.7, B: 0.3 } }, middle: 'C',
    lead: { rest: [8, 14], range: [65, 84], stretch: 1.2, preset: FLUTE },
    ambience: { sea: 0.55, wind: 0.8, air: 0.35, period: [9, 15] },
    mix: { keys: 0, bass: -1, sub: -60, drums: 4, lead: -4, pad: -5, room: -3, ambience: -9.9 }, masterDb: 6.0,
  },
  'glass-hour': {
    title: 'Glass Hour', topic: 'Light and glass', key: 'A major', tonic: 'A6/9', cadence: ['Bm9', 'E13'], bpm: 100, swing: 0.5, feel: 'bossa', intro: 4, human: 0.8,
    band: { bass: 'guitar', kit: 'brush', lead: 'reed', keysFx: 'tremolo' }, scale: [9, 11, 1, 2, 4, 6, 8], tine: { bell: 0.7, tone: 6200, tine: 1.1 },
    why: 'Light through glass is bright and even. This one keeps even eighth notes in a bossa pattern, in A major with sixth and ninth chords that stay open at the top, over an electric bass guitar. The air of an open sky is the main ambience, with a small sea far off.',
    sections: {
      A: ['Amaj9', 'F#m9', 'Bm9', 'E13', 'Amaj9', 'F#m11', 'Bm9', 'Esus13'],
      B: ['Dmaj9', 'D6/9', 'C#m9', 'F#m9', 'Bm9', 'E13', 'A6/9', 'Bm9 E7alt'],
      C: ['F#m9', 'B13', 'Emaj9', 'C#m9', 'Dmaj9#11', 'D#m7b5 G#7alt', 'C#m9', 'Bm9 E13'],
    },
    next: { A: { A: 0.35, B: 0.65 }, B: { A: 0.6, B: 0.4 } }, middle: 'C',
    lead: { rest: [6, 12], range: [64, 81], stretch: 1.2, preset: REED },
    ambience: { sea: 0.45, wind: 0.4, air: 0.9, period: [10, 16] },
    mix: { keys: 0, bass: 2, sub: -60, drums: 7, lead: -2, pad: -6, room: -4, ambience: -7.0 }, masterDb: 3.9,
  },
  'deep-current': {
    title: 'Deep Current', topic: 'The engine', key: 'F minor', tonic: 'Fm9', cadence: ['Bbm9', 'C7alt'], bpm: 172, swing: 0.5, feel: 'dnb', intro: 8, human: 0.5,
    band: { bass: 'sub', fills: 'guitar', kit: 'break', lead: 'sax', keysFx: 'chorus' }, scale: [5, 7, 8, 10, 0, 1, 3],
    why: 'The engine runs fast so that what sits on top of it can be calm. This is atmospheric drum and bass in that shape: a soft, chopped break at 172 beats a minute under chords that change every two bars, long pads, a round sub bass and the sea. The drums are quick and quiet; everything above them moves slowly.',
    sections: {
      A: ['Fm9', '=', 'Dbmaj9', '=', 'Ebsus13', '=', 'Cm9', '='],
      B: ['Dbmaj9', '=', 'Abmaj9', '=', 'Bbm9', '=', 'C7alt', '='],
      C: ['Abmaj9', '=', 'Gbmaj9#11', '=', 'Fm11', '=', 'Ebsus13', '='],
      D: ['Dbmaj9', '=', 'Ebsus13', '=', 'Abmaj9', '=', 'Bbm9', '='],
    },
    // the arc: two statements, a middle and a return; a breakdown where the kit drops out and a build that brings it back
    // into a varied return; then a second idea (the lift, on new harmony that rises) for the last third
    form: ['statement', 'statement', 'middle', 'return', 'breakdown', 'build', 'variation', 'middle', 'return', 'breakdown', 'build', 'lift', 'lift', 'variation', 'lift', 'return'], lift: 'D',
    next: { A: { A: 0.4, B: 0.6 }, B: { A: 0.65, B: 0.35 } }, middle: 'C',
    lead: { rest: [14, 30], range: [58, 77], stretch: 2.5, preset: { breath: 0.5, noise: 0.16, vibrato: 0.012, vibRate: 4.6, vibDelay: 0.6, scoop: 0.9, tone: 3000 } },
    ambience: { sea: 0.85, wind: 0.5, air: 0.55, period: [8, 14] },
    kit: { tune: -1, decay: 0.75, snap: 0.45, tight: 0.6, grit: 0.05, swing: 0.5, ghosts: 0.6, human: 0.4, pocket: 0.1 }, pad: { cutoff: 2800, air: 0.2, attack: 1, release: 1.5 }, tine: { bell: 0.6, tone: 6000, tine: 1.1 },
    mix: { keys: 0, bass: -4, sub: -2, drums: -1, lead: -6, pad: 0, room: 0, ambience: -7.7 }, masterDb: 4.3,
  },
  'clear-line': {
    title: 'Clear Line', topic: 'Type and lettering', key: 'E major', tonic: 'E6/9', cadence: ['F#m9', 'B13'], bpm: 120, swing: 0.5, feel: 'fusion', intro: 4, human: 0.5,
    band: { bass: 'guitar', kit: 'tight', lead: 'sax', keysFx: 'chorus' }, scale: [4, 6, 8, 9, 11, 1, 3], tine: { bell: 0.65, tone: 6400, tine: 1.2 },
    why: 'Lettering is clean strokes placed exactly. This piece is in the bright, precise idiom of Japanese jazz fusion: major seventh and added ninth chords, quick ii-V turns, a step up into another key and back, a tight quiet kit, and an electric bass guitar that plays the busy, singing line under a saxophone melody.',
    sections: {
      A: ['Emaj9', 'C#m9', 'F#m9 B13', 'Emaj9', 'Amaj9', 'G#7alt C#m9', 'F#m9', 'Bsus13 B13'],
      B: ['Gmaj9', 'Em9', 'Am9 D13', 'Gmaj9', 'Cmaj9', 'F#m7b5 B7alt', 'Emaj9', 'F#m9 B13'],
      C: ['C#m9', 'F#13', 'Amaj9', 'Bsus13', 'C#m9', 'A6/9', 'F#m9', 'Bsus13 B7alt'],
    },
    next: { A: { A: 0.3, B: 0.7 }, B: { A: 0.7, B: 0.3 } }, middle: 'C',
    lead: { rest: [8, 14], range: [60, 79], stretch: 1.4, preset: { breath: 0.7, noise: 0.07, vibrato: 0.01, vibRate: 5.4, vibDelay: 0.35, scoop: 0.45, tone: 5200 } },
    ambience: { sea: 0.5, wind: 0.35, air: 0.8, period: [10, 16] },
    kit: { tune: 1, decay: 0.7, snap: 0.5, tight: 0.7, grit: 0.05, swing: 0.5, ghosts: 0.5, human: 0.3, pocket: 0.1 },
    pad: { cutoff: 2600 },
    mix: { keys: 0, bass: 3, sub: -60, drums: 3, lead: -4, pad: -6, room: -4, ambience: -7.7 }, masterDb: 4.0,
  },
};
export const PIECE_IDS = Object.keys(PIECES);
