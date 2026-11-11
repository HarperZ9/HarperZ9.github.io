// lead.js: the lead line. A piece has one theme: a rhythm and a contour (how many steps up or down each note moves along
// the notes the chord allows). Every later phrase is the theme changed in a named way, so the line develops instead of
// starting over each time:
//   theme      the idea as first stated          answer     the same rhythm, the second half turned to fall
//   varied     one step of the contour changed   sequence   the opening fragment, then the same fragment a step higher
//   inversion  every step turned upside down     augmented  the same contour at one and a half times the length
//   reprise    the theme again, as stated        close      the opening fragment, ending long on the home chord
// The statement uses theme, answer and varied; the middle uses sequence, inversion and augmented in a higher register;
// the return uses reprise and answer; the ending uses close. Long notes are chord tones (third, seventh or ninth); short
// notes may pass through the key's scale. Between phrases the lead rests for several beats.
const RHYTHMS = [[1, 0.5, 0.5, 2.5], [0.5, 0.5, 1, 3], [1.5, 0.5, 3], [0.5, 1, 0.5, 1, 3], [1, 1, 0.5, 0.5, 3], [0.5, 0.5, 0.5, 0.5, 2.5], [1.5, 0.5, 1, 3]];
const STEPS = [-2, -1, -1, 1, 1, 1, 2];
const PLAN = { statement: ['theme', 'answer', 'varied', 'theme'], middle: ['sequence', 'inversion', 'augmented'], return: ['reprise', 'answer', 'reprise'], ending: ['close'], intro: ['theme'] };

export function newLead(P, r) { const pick = (a) => a[Math.floor(r() * a.length)], rhythm = pick(RHYTHMS); return { theme: { rhythm, steps: rhythm.map((_, i) => (i === 0 ? 0 : pick(STEPS))) }, home: (P.lead.range[0] + P.lead.range[1]) >> 1, last: null, count: {}, queue: [], free: 0, kinds: [] }; }

function shape(kind, theme, r, stretch) {
  const pick = (a) => a[Math.floor(r() * a.length)]; let rhythm = theme.rhythm.slice(), steps = theme.steps.slice(), lift = 0;
  if (kind === 'answer') { const h = Math.ceil(steps.length / 2); steps = steps.map((s, i) => (i >= h ? -Math.abs(s || 1) : s)); }
  else if (kind === 'varied') { const i = 1 + Math.floor(r() * (steps.length - 1)); steps[i] = pick(STEPS.filter((s) => s !== steps[i])); }
  else if (kind === 'sequence') { const n = Math.min(3, rhythm.length - 1), fr = rhythm.slice(0, n).map((d) => Math.min(d, 1)); rhythm = [...fr, ...fr, 2.5]; steps = [...steps.slice(0, n), 1, ...steps.slice(1, n), 1]; lift = 4; }
  else if (kind === 'inversion') { steps = steps.map((s) => -s); lift = 5; }
  else if (kind === 'augmented') { rhythm = rhythm.map((d) => Math.min(3.5, d * 1.5)); lift = 3; }
  else if (kind === 'close') { const n = Math.min(3, rhythm.length - 1); rhythm = [...rhythm.slice(0, n), 3.8 / (stretch || 1)]; steps = [...steps.slice(0, n), -1]; }
  return { rhythm, steps, lift };
}

// Write the next phrase starting at absolute beat `start`. chordAt(beat) returns { pcs, end } for the chord sounding then.
// Returns [{ abs, m, beats, vel }] and updates the lead state (where the line is, when the lead is free again).
export function phrase(L, P, r, role, start, chordAt, { dyn = 1, tonic = null } = {}) {
  const list = PLAN[role] || PLAN.statement, n = L.count[role] = (L.count[role] || 0) + 1, kind = list[(n - 1) % list.length], k = P.lead.stretch || 1, sh = shape(kind, L.theme, r, k), [lo, hi] = P.lead.range;
  const ladder = (ch, short) => { const ok = new Set(ch.pcs); if (short) for (const pc of P.scale) if (!ch.pcs.includes((pc + 11) % 12)) ok.add(pc); const out = []; for (let m = lo; m <= hi; m++) if (ok.has(m % 12)) out.push(m); return out; };
  const nearest = (list2, m) => list2.reduce((b, x, i) => (Math.abs(x - m) < Math.abs(list2[b] - m) ? i : b), 0);
  // the theme and its reprise start from the same place, so the return is heard as a return
  let beat = start, m = kind === 'theme' || kind === 'reprise' || L.last === null ? L.home : Math.max(lo + 3, Math.min(hi - 3, (kind === 'answer' ? L.last : L.home) + sh.lift)); const out = [];
  sh.rhythm.forEach((d, i) => {
    const last = i === sh.rhythm.length - 1, len = d * k, ch = chordAt(beat); if (!ch) return;
    let lad = ladder(ch, len <= 0.75 && !last);   // only a note under three quarters of a beat may pass through a tone outside the chord
    if (last) { const guide = kind === 'close' && tonic ? [tonic.pcs[0], tonic.pcs[1]] : [ch.pcs[1], ch.pcs[3], ch.pcs[4] ?? ch.pcs[2]]; const g = lad.filter((x) => guide.includes(x % 12)); if (g.length) lad = g; }
    m = lad[Math.max(0, Math.min(lad.length - 1, nearest(lad, m) + (i === 0 ? 0 : sh.steps[i] ?? 0)))];
    let beats = len; if (beat + len > ch.end + 1e-9) { const nx = chordAt(ch.end); if (!nx || !nx.pcs.includes(m % 12)) beats = Math.max(0.5, ch.end - beat); }
    out.push({ abs: beat, m, beats: beats * (last ? 0.96 : 0.9), vel: Math.min(0.85, (0.5 + 0.1 * r() - (last ? 0.04 : 0) + (i === 0 ? 0.04 : 0)) * dyn), kind }); beat += len;
  });
  L.last = m; L.kinds.push(kind); L.restAt = beat; L.free = beat + P.lead.rest[0] + Math.floor(r() * (P.lead.rest[1] - P.lead.rest[0] + 1));
  return out;
}
