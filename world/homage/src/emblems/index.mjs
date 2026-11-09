// src/emblems/index.mjs: emblem registry. An emblem stands in for a face where a likeness would be inappropriate
// (a living person, by default) or no licensable reference exists, and for works and movements, which have no face.
import { canvas } from './kit.mjs';
import * as ideas from './ideas.mjs';
import * as media from './media.mjs';

export const EMBLEMS = { ...ideas, ...media };

// Render emblem `name` at side S px. Returns { ink, spot } Plates. Deterministic for a given name, S and seed.
export function renderEmblem(name, S, seed = 1) {
  const f = EMBLEMS[name]; if (!f) throw new Error('no emblem ' + name);
  const c = canvas(S, seed); f(c); return { ink: c.ink, spot: c.spot };
}
