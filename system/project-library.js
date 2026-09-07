const STORE_NAME = 'projects';
const DB_VERSION = 1;
const MAX_PROJECTS = 24;
const MAX_AGGREGATE_BYTES = 256 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

export const PROJECT_LIBRARY_DB_NAME = 'zentropy-project-library-v1';

const SUPPORTED = Object.freeze({
  'zentropy.poster': Object.freeze({ editor: 'Poster', max: 9 * 1024 * 1024 }),
  'zentropy.loom': Object.freeze({ editor: 'Loom', max: 24 * 1024 * 1024 }),
  'zentropy.shader-room': Object.freeze({ editor: 'Shader Room', max: 32 * 1024 * 1024 }),
});

function userError(message) {
  return new Error(message);
}

function bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeTitle(title) {
  if (typeof title !== 'string') throw userError('Project title must be text.');
  const clean = title.trim();
  if (!clean) throw userError('Project title cannot be empty.');
  if (clean.length > 80) throw userError('Project title must be 80 characters or fewer.');
  return clean;
}

function previewSize(preview) {
  return bytes(preview || '');
}

function validatePreview(preview) {
  if (typeof preview !== 'string') throw userError('Project preview must be a PNG or JPEG data URL.');
  if (previewSize(preview) > MAX_PREVIEW_BYTES) throw userError('Project preview must be 2 MB or smaller.');
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(preview);
  if (!match) throw userError('Project preview must be a PNG or JPEG data URL.');
  let header;
  try { header = atob(match[2].slice(0, 48)); } catch (_) { throw userError('Project preview could not be read.'); }
  const isPng = match[1] === 'png' && header.slice(0, 8) === '\x89PNG\r\n\x1a\n';
  const isJpeg = match[1] === 'jpeg' && header.charCodeAt(0) === 0xff && header.charCodeAt(1) === 0xd8;
  if (!isPng && !isJpeg) throw userError('Project preview must be a valid PNG or JPEG data URL.');
  return preview;
}

function validateId(id) {
  if (typeof id !== 'string' || !id) throw userError('Project id is missing.');
  return id;
}

function storageError() {
  return userError('Browser project storage is unavailable. Allow browser storage and try again.');
}

function openDatabase() {
  if (typeof indexedDB === 'undefined' || !indexedDB?.open) return Promise.reject(storageError());
  return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDB.open(PROJECT_LIBRARY_DB_NAME, DB_VERSION); }
    catch (_) { reject(storageError()); return; }
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      try { request.result?.close(); } catch (_) {}
      finish(reject, storageError());
    }, 4000);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onerror = request.onblocked = () => finish(reject, storageError());
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      db.onversionchange = () => db.close();
      finish(resolve, db);
    };
  });
}

function transactionFailure() {
  return userError('The project library could not finish that storage change. Your editor work is unchanged.');
}

function metadata(record) {
  if (!record || typeof record !== 'object') throw userError('A saved project record is invalid.');
  const id = validateId(record.id);
  const title = normalizeTitle(record.title);
  const kind = Object.hasOwn(SUPPORTED, record.schema) ? SUPPORTED[record.schema] : null;
  if (!kind || record.editor !== kind.editor) throw userError('A saved project record uses an unsupported editor.');
  if (!(record.file instanceof File)) throw userError('A saved project file is unavailable in this browser.');
  if (!Number.isFinite(record.size) || record.size !== record.file.size || record.size < 1 || record.size > kind.max) {
    throw userError('A saved project file has an invalid size.');
  }
  const preview = validatePreview(record.preview);
  for (const field of ['createdAt', 'updatedAt']) {
    if (typeof record[field] !== 'string' || Number.isNaN(Date.parse(record[field]))) {
      throw userError('A saved project record has an invalid timestamp.');
    }
  }
  return { id, title, schema: record.schema, editor: kind.editor, preview, createdAt: record.createdAt, updatedAt: record.updatedAt, size: record.size };
}

function compareNewest(a, b) {
  const changed = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (changed) return changed;
  const created = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return created || b.id.localeCompare(a.id);
}

async function classifyFile(file) {
  if (!(file instanceof File)) throw userError('Choose a native project File.');
  if (file.size < 1) throw userError('Project file is empty.');
  if (file.size > SUPPORTED['zentropy.shader-room'].max) throw userError('Project file exceeds the 32 MB native project limit.');
  let value;
  try { value = JSON.parse(await file.text()); }
  catch (_) { throw userError('Project file must be a supported native project JSON file.'); }
  const kind = Object.hasOwn(SUPPORTED, value?.schema) ? SUPPORTED[value.schema] : null;
  if (!kind) throw userError('Project schema is not supported by the creative workspace.');
  if (value.version !== 1) throw userError('Project version is not supported by the creative workspace.');
  if (file.size > kind.max) throw userError(`${kind.editor} projects must be ${kind.max / 1024 / 1024} MB or smaller.`);
  return { schema: value.schema, editor: kind.editor };
}

async function withDatabase(work) {
  const db = await openDatabase();
  try { return await work(db); }
  finally { db.close(); }
}

export async function saveProject(file, { title, preview } = {}) {
  const selected = await classifyFile(file);
  const cleanTitle = normalizeTitle(title);
  const cleanPreview = validatePreview(preview);
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    schema: selected.schema,
    editor: selected.editor,
    preview: cleanPreview,
    createdAt: now,
    updatedAt: now,
    size: file.size,
    file,
  };
  const result = metadata(record);
  return withDatabase(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let count = 0;
    let total = result.size + previewSize(result.preview);
    let failure = null;
    const timer = setTimeout(() => {
      failure = transactionFailure();
      try { tx.abort(); } catch (_) {}
    }, 5000);
    tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
    tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(failure || transactionFailure()); };
    const cursor = store.openCursor();
    cursor.onerror = () => {
      failure = transactionFailure();
      try { tx.abort(); } catch (_) {}
    };
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) {
        if (count >= MAX_PROJECTS) {
          failure = userError('Project library is full at 24 projects. Download or remove a project before saving another.');
          tx.abort();
          return;
        }
        if (total > MAX_AGGREGATE_BYTES) {
          failure = userError('Project library is full at the 256 MB browser-local capacity. Download or remove a project before saving another.');
          tx.abort();
          return;
        }
        store.add(record);
        return;
      }
      try {
        const meta = metadata(item.value);
        count += 1;
        total += meta.size + previewSize(meta.preview);
      } catch (error) {
        failure = error;
        tx.abort();
        return;
      }
      item.continue();
    };
  }));
}

export async function listProjects() {
  return withDatabase(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    const timer = setTimeout(() => {
      try { tx.abort(); } catch (_) {}
    }, 5000);
    tx.oncomplete = () => clearTimeout(timer);
    tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(transactionFailure()); };
    request.onerror = () => {
      try { tx.abort(); } catch (_) {}
    };
    request.onsuccess = () => {
      try { resolve(request.result.map(metadata).sort(compareNewest)); }
      catch (error) { reject(error); }
    };
  }));
}

export async function getProject(id) {
  validateId(id);
  return withDatabase(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    const timer = setTimeout(() => {
      try { tx.abort(); } catch (_) {}
    }, 5000);
    tx.oncomplete = () => clearTimeout(timer);
    tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(transactionFailure()); };
    request.onerror = () => {
      try { tx.abort(); } catch (_) {}
    };
    request.onsuccess = () => {
      if (!request.result) { resolve(null); return; }
      try { resolve({ ...metadata(request.result), file: request.result.file }); }
      catch (error) { reject(error); }
    };
  }));
}

export async function deleteProject(id) {
  validateId(id);
  return withDatabase(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let existed = false;
    const timer = setTimeout(() => {
      try { tx.abort(); } catch (_) {}
    }, 5000);
    tx.oncomplete = () => { clearTimeout(timer); resolve(existed); };
    tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(transactionFailure()); };
    const request = store.get(id);
    request.onerror = () => {
      try { tx.abort(); } catch (_) {}
    };
    request.onsuccess = () => {
      existed = !!request.result;
      store.delete(id);
    };
  }));
}

export async function renameProject(id, title) {
  validateId(id);
  const cleanTitle = normalizeTitle(title);
  return withDatabase(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let updated = null;
    let failure = null;
    const timer = setTimeout(() => {
      failure = transactionFailure();
      try { tx.abort(); } catch (_) {}
    }, 5000);
    tx.oncomplete = () => { clearTimeout(timer); resolve(updated); };
    tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(failure || transactionFailure()); };
    const request = store.get(id);
    request.onerror = () => {
      failure = transactionFailure();
      try { tx.abort(); } catch (_) {}
    };
    request.onsuccess = () => {
      if (!request.result) {
        failure = userError('This project is no longer in this browser.');
        tx.abort();
        return;
      }
      try {
        metadata(request.result);
        const next = { ...request.result, title: cleanTitle, updatedAt: new Date().toISOString() };
        updated = metadata(next);
        store.put(next);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
  }));
}
