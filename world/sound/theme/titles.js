// The title system. Every piece gets one short concrete word and a credit line in a fixed shape:
//   Scale x Crowd x Original Type Piece - "Hum" (Made by Zain Dana Harper + the engine)
// The shape is borrowed from how type beats are titled. The content is turned around. Where a type beat names the
// artist whose sound it wears, ours names the families the piece is about, and says "Original" because nothing is worn.
// "Type" also means letters, which is the joke the pieces are allowed to keep.
export const FAMILIES = {
  scale: 'Scale', cut: 'Cut', label: 'Label', record: 'Record', crowd: 'Crowd', momentum: 'Momentum', costume: 'Costume', oracle: 'Oracle',
  thought: 'Thought', trauma: 'Trauma', pain: 'Pain', longing: 'Longing', memory: 'Memory',
};

// One word each, short and concrete. Words used by the channel we studied are left out on purpose.
const LEX = {
  scale: ['Pan', 'Beam', 'Weight', 'Tare', 'Ounce', 'Flat', 'Level', 'Plumb'],
  cut: ['Splice', 'Seam', 'Crop', 'Edit', 'Shear', 'Snip', 'Clause', 'Trim'],
  label: ['Tag', 'Stamp', 'Brand', 'Badge', 'Pin', 'Name', 'Sticker', 'Hallmark'],
  record: ['Needle', 'Ghost', 'Fade', 'Erase', 'Dent', 'Groove', 'Trace', 'Scrape'],
  crowd: ['Chorus', 'Many', 'Echo', 'Throng', 'Choir', 'Swarm', 'Ditto', 'Unison'],
  momentum: ['Drift', 'Roll', 'Wheel', 'Loop', 'Again', 'Coast', 'Slope', 'Ratchet'],
  costume: ['Mask', 'Cloak', 'Wig', 'Suit', 'Hem', 'Guise', 'Rental', 'Cape'],
  oracle: ['Omen', 'Cipher', 'Augur', 'Verdict', 'Vane', 'Pier', 'Sign', 'Coin'],
  thought: ['Alias', 'Sample', 'Staircase', 'Nyquist'], trauma: ['Needle', 'Skip', 'Scar', 'Repeat'], pain: ['Ceiling', 'Clip', 'Flatline', 'Burn'],
  longing: ['Dial', 'Static', 'Station', 'Wow'], memory: ['Lossy', 'Hash', 'Thumb', 'Squeeze'],
};

export function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// A deterministic word for a seed, picked from the first family's list, skipping words already taken.
export function titleFor(seed, families, taken = new Set()) {
  const pool = families.flatMap((f) => LEX[f] || []).filter((w) => !taken.has(w));
  if (!pool.length) return 'Untitled';
  return pool[fnv(String(seed) + families.join()) % pool.length];
}

export function credit({ families, word, by = 'Zain Dana Harper', with: collab = 'the engine' }) {
  const tags = families.map((f) => FAMILIES[f]).join(' x ');
  return `${tags} x Original Type Piece - "${word}" (Made by ${by} + ${collab})`;
}

// Our own pieces. href points at the exhibit when it exists; built is false for pieces still to make.
const PH = '../../exhibit/';
export const PIECES = [
  { word: 'Hum', families: ['scale', 'crowd'], line: 'The theme beat. The hum starts flat of the bells, and the crowd is one voice.', href: '#top', built: true },
  { word: 'Pan', families: ['scale', 'oracle'], line: 'The False Balance. Four claims, and the scale reads true every time.', href: PH + 'balance.html', built: true },
  { word: 'Twin', families: ['cut', 'label'], line: 'The mirror. Six careful and loud pairs of the same fact.', href: PH + 'mirror.html', built: true },
  { word: 'Tenfold', families: ['cut'], line: 'Powers of Ten, for a Lie. Zoom out and count the words you lost.', href: PH + 'powers.html', built: true },
  { word: 'Scrape', families: ['record'], line: 'Palimpsest. What was written under the page is still there.', href: PH + 'palimpsest.html', built: true },
  { word: 'Alias', families: ['thought'], line: 'Sampling. A voice resampled until it sings a melody it never sang.', href: '../sound.html#h-motifs', built: false },
  { word: 'Needle', families: ['trauma', 'momentum'], line: 'The skipping groove. Every copy kept the skip.', href: '../sound.html#h-motifs', built: false },
  { word: 'Ceiling', families: ['pain'], line: 'Clipping. Past the line it does not get louder. It gets flatter.', href: '../sound.html#h-motifs', built: false },
  { word: 'Dial', families: ['longing'], line: 'Between stations. It almost resolves, and the dial does not stop.', href: '../sound.html#h-motifs', built: false },
  { word: 'Lossy', families: ['memory'], line: 'A photograph, compressed again and again. The hash stays and the picture goes.', href: '../sound.html#h-motifs', built: false },
];
