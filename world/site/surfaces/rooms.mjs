// rooms.mjs: what every room of a surface page shares. A room is a section of the page built by
// scripts/build-surfaces.mjs from the surface's manifest: words and a still, then one press that brings in the room's
// module (surface-start.js imports this file on that press, or when the address names the room).
//
//   page()            the one bus of the page, the handles of every mounted module, and the last value sent of each
//                     medium, so a room opened later still takes what was made before it
//   pictures          a picture is a canvas, which the bus cannot seal or hash. So an image envelope carries
//                     { width, height, of: the maker's module id }, the maker keeps a function here that returns its
//                     canvas as it stands, and a taker asks for it with pictureOf(envelope). picture() is the last one
//                     handed on, with the maker's name, or null. watch holds functions told of every value sent.
//                     A room may also ask for one maker's picture as it stands (ctx.pictureFrom), handed on or not.
//   open(id, section) mount the room's module from the registry, join it to the bus, hand it what was sent before,
//                     and write each hand-over under it in words
//
// The address holds the open rooms (room=type,sound) beside each room's own state, so a link opens the same piece.
import registry from './registry.mjs';
import { createBus } from './bus.mjs';

const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const name = (id) => registry.SURFACES[id]?.name ?? id;
const lower = (s) => s[0].toLowerCase() + s.slice(1);
// the registry's word for a picture is "image"; the page says picture
const word = (medium) => (medium === 'image' ? 'picture' : medium);
const an = (word) => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
let made = null;

export function page(surface = 'playground') {
  if (!made) {
    const bus = createBus({ surface }), last = {};
    made = { bus, last, handles: {}, pictures: {}, watch: new Set(),
      pictureOf(env) { const canvas = env?.medium === 'image' ? made.pictures[env.value?.of]?.() : null; return canvas && canvas.width && canvas.height ? canvas : null; },
      picture() { const env = last.image, canvas = made.pictureOf(env); return canvas ? { canvas, of: env.value.of, name: name(env.value.of) } : null; },
      send(from, medium, value, opts) { const out = bus.send(from, medium, value, opts); if (out.ok) { last[medium] = bus.derived(out.id); for (const fn of made.watch) fn(medium, last[medium]); } return out; } };
  }
  return made;
}

// Set or clear query fields without touching the rest of the address; null clears a field.
export function address(pairs) {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(pairs)) { if (v === null || v === undefined || v === '') q.delete(k); else q.set(k, v); }
  const s = q.toString().replace(/=(?=&|$)/g, '').replace(/%2C/g, ',');
  history.replaceState(null, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
}

function styles(href) {
  if (!href || document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = href;
  return new Promise((done) => { css.onload = css.onerror = done; document.head.append(css); });
}

export async function open(id, sec) {
  const row = registry.SURFACES[id], p = page(sec.dataset.home || 'playground'), host = sec.querySelector('.rm-host'), say = sec.querySelector('.rm-say');
  if (!row?.load) throw new Error(`rooms: "${id}" has no module behind it`);
  if (p.handles[id]) return p.handles[id];
  await styles(sec.dataset.css);
  // the line under the room keeps the last thing it took and the last thing it gave
  const told = { took: '', gave: '' }, tell = () => { say.textContent = [told.took, told.gave].filter(Boolean).join(' '); };
  const ctx = { query: new URLSearchParams(location.search), address, pictureOf: (env) => p.pictureOf(env), offerPicture(fn) { p.pictures[id] = fn; },
    // the picture a module shows as it stands, asked for by the module's id; a room's own picture is not lent back to it
    pictureFrom(of) { const c = of === id ? null : p.pictures[of]?.(); return c && c.width && c.height ? c : null; }, nameOf: (module) => { const n = lower(name(module)); return n.startsWith('the ') ? n : `the ${n}`; },
    send(medium, value, opts) {
      const out = p.send(id, medium, value, opts);
      told.gave = !out.ok ? `The ${word(medium)} was not handed on: ${out.why}.`
        : out.heard.length ? `${row.name} handed its ${word(medium)} to ${list(out.heard.map((n) => lower(name(n))))}.`
          : `${row.name} made ${an(word(medium))}. Nothing open on the page takes it yet.`;
      tell();
      sec.dataset.sent = String(+(sec.dataset.sent || 0) + (out.ok ? 1 : 0));
      return out;
    } };
  host.hidden = false;
  const handle = p.handles[id] = await registry.mount(host, id, {}, ctx);
  const hear = (env) => { handle.update({ heard: env }); told.took = `${row.name} took the ${word(env.medium)} from ${lower(name(env.from.module))}.`; tell(); sec.dataset.heard = env.medium; };
  p.bus.join(id, hear);
  for (const medium of row.takes) if (p.last[medium] && p.last[medium].from.module !== id) hear(p.last[medium]);
  sec.querySelector('.rm-before').hidden = true;
  const rooms = new Set((ctx.query.get('room') || '').split(',').filter(Boolean)); rooms.add(sec.id); address({ room: [...rooms].join(',') });
  window.__rooms = p;
  sec.setAttribute('data-room-live', '');
  host.tabIndex = -1; host.focus({ preventScroll: true });
  return handle;
}
