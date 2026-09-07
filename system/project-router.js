// Route native project files without flattening them or replacing their codecs.
const ROUTES = Object.freeze({
  'zentropy.poster': { label: 'Poster', path: 'studio.html?source=poster', input: '[data-poster-project-file]', max: 9 * 1024 * 1024 },
  'zentropy.loom': { label: 'Loom', path: 'loom.html', input: '#wv-project-file', max: 24 * 1024 * 1024 },
  'zentropy.shader-room': { label: 'Shader Room', path: 'retro.html', input: '#re-project-file', max: 32 * 1024 * 1024 },
  'zentropy.gallery': { label: 'Gallery', path: 'gallery.html', input: '[data-gallery-project-file]', max: 12 * 1024 * 1024 },
});
const INPUTS = Object.values(ROUTES).map(r => r.input).join(',');
const BASE = new URL('../', import.meta.url);
const DB_NAME = 'zentropy-project-transfer-v1';
const TTL = 5 * 60 * 1000;
const REVISION_EVENTS = Object.freeze(['beforeinput', 'input', 'change', 'click', 'keydown', 'pointerdown']);
const bypass = new WeakSet();
let revision = 0, operation = 0;

function message(text, state, input) {
  let el = document.getElementById('project-routing-status');
  if (!el) {
    el = document.createElement('p'); el.id = 'project-routing-status';
    el.className = 'transform-note re-status'; el.setAttribute('role', 'status');
    if (input) input.parentElement.after(el);
    else (document.querySelector('main') || document.body).prepend(el);
  }
  el.hidden = false; el.textContent = text; el.dataset.state = state;
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let settled = false;
    const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('Browser storage is unavailable.')); } };
    const timer = setTimeout(fail, 4000);
    request.onupgradeneeded = () => request.result.createObjectStore('transfers');
    request.onerror = request.onblocked = fail;
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true; clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
async function transferStore(action, id, record) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('transfers', 'readwrite'), store = tx.objectStore('transfers');
      let result;
      const timer = setTimeout(() => { try { tx.abort(); } catch (_) {} }, 5000);
      tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
      tx.onabort = tx.onerror = () => { clearTimeout(timer); reject(new Error('The project could not be kept for the next editor.')); };
      if (action === 'put') {
        let count = 0;
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) { if (count >= 4) tx.abort(); else store.put(record, id); return; }
          if (!Number.isFinite(item.value.expires) || item.value.expires <= Date.now()) item.delete();
          else count++;
          item.continue();
        };
      } else if (action === 'take') {
        const request = store.get(id);
        request.onsuccess = () => { result = request.result; store.delete(id); };
      } else store.delete(id);
    });
  } finally { db.close(); }
}
function deliver(input, file) {
  const data = new DataTransfer(); data.items.add(file);
  input.files = data.files;
  const event = new Event('change', { bubbles: true });
  bypass.add(event); input.dispatchEvent(event);
}
function clearActiveInput(input, file, active) {
  if (active === operation && input.files?.[0] === file) input.value = '';
}
// Classification is not validation. The destination's native importer remains
// authoritative for fields, images, allocation limits and shader compilation.
async function classify(file) {
  if (!file || file.size > 32 * 1024 * 1024) return null;
  let value;
  try { value = JSON.parse(await file.text()); } catch (_) { return null; }
  if (!value || value.version !== 1 || !Object.hasOwn(ROUTES, value.schema)) return null;
  const route = ROUTES[value.schema];
  if (file.size > route.max) return null;
  return { schema: value.schema, route };
}
// Used by the library, which has no unsaved editor state of its own. The native
// importer still decides whether the project can actually be opened.
export async function openProjectInEditor(file) {
  const selected = await classify(file);
  if (!selected) throw new Error('Choose a Gallery, Poster, Loom or Shader Room project file.');
  const id = crypto.randomUUID();
  try {
    await transferStore('put', id, { schema: selected.schema, file, expires: Date.now() + TTL });
  } catch (_) {
    throw new Error(`The project could not be transferred. Open this file directly in ${selected.route.label}, or allow browser storage and try again.`);
  }
  const destination = new URL(selected.route.path, BASE);
  destination.searchParams.set('project-transfer', id);
  location.assign(destination.href);
}
for (const name of REVISION_EVENTS) document.addEventListener(name, event => {
  if (!bypass.has(event) && !event.target.matches?.(INPUTS)) revision++;
}, true);

document.addEventListener('change', async event => {
  const input = event.target;
  if (bypass.has(event) || !input.matches?.(INPUTS)) return;
  const file = input.files?.[0]; if (!file) return;
  event.stopImmediatePropagation();
  const active = ++operation, before = revision;
  const stale = () => active !== operation || before !== revision;
  let id;
  try {
    const selected = await classify(file);
    if (active !== operation) return;
    if (stale()) { clearActiveInput(input, file, active); message('Your newer changes were kept. Open the project again when ready.', 'cancelled', input); return; }
    if (!selected || input.matches(selected.route.input)) { deliver(input, file); return; }
    if (!confirm(`This project opens in ${selected.route.label}. Unsaved work in this editor will not move with it. Cancel to save your work first, or continue to open the file.`)) {
      input.value = ''; message('Opening cancelled. Your current work is still here.', 'cancelled', input); return;
    }
    message(`Preparing to open in ${selected.route.label}…`, 'loading', input);
    id = crypto.randomUUID();
    await transferStore('put', id, { schema: selected.schema, file, expires: Date.now() + TTL });
    if (stale()) {
      await transferStore('delete', id);
      if (active === operation) {
        clearActiveInput(input, file, active);
        message('Your newer changes were kept. Open the project again when ready.', 'cancelled', input);
      }
      return;
    }
    const destination = new URL(selected.route.path, BASE);
    destination.searchParams.set('project-transfer', id);
    location.assign(destination.href);
  } catch (_) {
    if (active === operation) {
      input.value = '';
      message('The project could not be transferred. Your work is still here. Open the file directly in its original editor, or allow browser storage and try again.', 'error', input);
    }
  }
}, true);

function waitForInput(selector) {
  return new Promise((resolve, reject) => {
    let observer, timer;
    const check = () => {
      const input = document.querySelector(selector);
      if (!input) return;
      observer?.disconnect(); clearTimeout(timer); resolve(input);
    };
    observer = new MutationObserver(check);
    observer.observe(document.body, {childList:true,subtree:true});
    timer = setTimeout(() => { observer.disconnect(); reject(new Error('Editor unavailable')); }, 20000);
    check();
  });
}
async function receive() {
  const url = new URL(location.href), id = url.searchParams.get('project-transfer');
  if (!id) return;
  url.searchParams.delete('project-transfer');
  history.replaceState(history.state, '', url);
  const before = revision;
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid transfer');
    const record = await transferStore('take', id);
    if (!record || !Object.hasOwn(ROUTES, record.schema) || !(record.file instanceof File) ||
        !Number.isFinite(record.expires) || record.expires <= Date.now() || record.expires > Date.now() + TTL) throw new Error('Expired transfer');
    const route = ROUTES[record.schema], expected = new URL(route.path, BASE);
    if (location.pathname !== expected.pathname || (expected.searchParams.has('source') && url.searchParams.get('source') !== expected.searchParams.get('source'))) throw new Error('Wrong editor');
    const input = await waitForInput(route.input);
    if (before !== revision) { message('Opening cancelled because you started editing. Open the original project file to try again.', 'cancelled', input); return; }
    deliver(input, record.file);
  } catch (_) {
    message('This project transfer expired or is unavailable. Open the original project file again; it has not been changed.', 'error');
  }
}
receive();
