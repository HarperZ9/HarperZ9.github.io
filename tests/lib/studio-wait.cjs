// Condition waits for the Studio's browser tests (10 October 2026). Fixed sleeps passed on an idle
// machine and failed on a busy one; these wait for the thing the test needs and give up only after
// a generous timeout, so a slow machine is slower but not wrong.
//   ready(page, source)        the source is on stage, its stage painted, its frame settled
//   frame(page)                the stage canvas as a short SHA-256 (WebGL canvases read through a copy)
//   settled(page)              poll until two reads 150 ms apart agree; returns that frame
//   changed(page, from)        poll until the frame differs from `from`, then settled
//   becomes(page, want)        poll until the frame equals `want` (returns what it last read)
//   until(page, fn, arg)       poll a page predicate
const DEFAULT_TIMEOUT = +(process.env.STUDIO_WAIT_MS || 60000);

async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    if (!c || !c.width || !c.height) return 'none';
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    const x = t.getContext('2d'); x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, t.width, t.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return t.width + 'x' + t.height + ':' + [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeout = DEFAULT_TIMEOUT, every = 150) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) { last = await fn(); if (last && last.ok) return last.value; await sleep(every); }
  return last ? last.value : undefined;
}
async function settled(page, timeout = DEFAULT_TIMEOUT) {
  let prev = null;
  return poll(async () => { const f = await frame(page); const ok = f !== 'none' && f === prev; prev = f; return { ok, value: f }; }, timeout);
}
async function changed(page, from, timeout = DEFAULT_TIMEOUT) {
  await poll(async () => { const f = await frame(page); return { ok: f !== from && f !== 'none', value: f }; }, timeout);
  return settled(page, timeout);
}
async function becomes(page, want, timeout = DEFAULT_TIMEOUT) {
  return poll(async () => { const f = await frame(page); return { ok: f === want, value: f }; }, timeout);
}
async function until(page, fn, arg, timeout = DEFAULT_TIMEOUT) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); }
  catch (e) {
    const state = await page.evaluate(() => ({ source: window.__studioActiveSource, painted: !!document.querySelector('#viewport-stage.is-painted') })).catch(() => ({}));
    throw new Error(`waited ${timeout} ms for ${String(fn).replace(/s+/g, ' ').slice(0, 120)} (arg ${JSON.stringify(arg)}; page: ${JSON.stringify(state)})`);
  }
}
async function ready(page, source, timeout = DEFAULT_TIMEOUT) {
  await until(page, (s) => window.__studioActiveSource === s && document.getElementById('viewport-stage').classList.contains('is-painted'), source, timeout);
  const hub = { gallery: '#src-gallery #desk-seed', loom: '#src-loom #wv-panel', type: '#src-engine #tf-text', films: '#films-stage video' }[source];
  if (hub) await page.waitForSelector(hub, { state: 'attached', timeout });
  return settled(page, timeout);
}
module.exports = { frame, settled, changed, becomes, until, ready, sleep };
