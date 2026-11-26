// engine-workbench.mjs: unified creative engine launcher & cross-medium stage for /playground/.
// Lazy-loaded only on visitor interaction (filter input or engine button press) so zero heavy bytes
// fetch before intent. Routes bus-native modules straight onto the shared Playground bus, and mounts
// full interactive creative engines (Loom, Thread, Posters, Studio, Fractals, Plotter, Fourier, Distill,
// Splats, Elements, Glass, Swatches, Accession, Gallery) inline inside one continuous stage.
import { open as openRoom } from './rooms.mjs';
import { start as startExchange } from './surface-page.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initWorkbench(root = document) {
  const wb = root.getElementById('workbench');
  if (!wb || wb.dataset.wbReady) return;
  wb.dataset.wbReady = '1';

  const filterInput = wb.querySelector('#wb-filter');
  const countEl = wb.querySelector('#wb-count');
  const rows = [...wb.querySelectorAll('[data-wb-row]')];
  const stage = wb.querySelector('#wb-stage');
  const stageTitle = wb.querySelector('#wb-stage-title');
  const stageLink = wb.querySelector('#wb-stage-open');
  const stageBody = wb.querySelector('#wb-stage-body');
  const stageClose = wb.querySelector('#wb-stage-close');

  const applyFilter = () => {
    const q = (filterInput?.value || '').trim().toLowerCase();
    let shown = 0;
    for (const row of rows) {
      const hay = (row.dataset.wbSearch || row.textContent || '').toLowerCase();
      const hit = !q || hay.includes(q);
      row.hidden = !hit;
      if (hit) shown++;
    }
    for (const group of wb.querySelectorAll('[data-wb-group]')) {
      const any = [...group.querySelectorAll('[data-wb-row]')].some((r) => !r.hidden);
      group.hidden = !any;
    }
    if (countEl) {
      countEl.textContent = q ? `Showing ${shown} of ${rows.length} creative engines` : `${rows.length} creative engines across 7 disciplines`;
    }
  };

  filterInput?.addEventListener('input', applyFilter);
  if (filterInput?.value) applyFilter();

  const closeStage = () => {
    if (!stage || !stageBody) return;
    stage.hidden = true;
    stageBody.innerHTML = '';
  };
  stageClose?.addEventListener('click', closeStage);

  const launchInline = (title, src) => {
    if (!stage || !stageBody) return;
    stage.hidden = false;
    if (stageTitle) stageTitle.textContent = title;
    if (stageLink) { stageLink.href = src; stageLink.textContent = `Open ${title} full window`; }
    stageBody.innerHTML = `<iframe class="wb-frame" src="${esc(src)}" title="${esc(title)}" loading="eager" allow="autoplay; fullscreen"></iframe>`;
    stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  wb.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-wb-action]');
    if (!btn) return;
    const action = btn.dataset.wbAction;
    const target = btn.dataset.wbTarget || '';
    const title = btn.dataset.wbTitle || btn.closest('[data-wb-row]')?.querySelector('.wb-name')?.textContent?.trim() || btn.textContent.trim();

    if (action === 'room') {
      const sec = document.getElementById(target);
      if (sec) {
        if (!sec.hasAttribute('data-room-live') && sec.dataset.room) {
          try { await openRoom(sec.dataset.room, sec, { press: null }); } catch (e) { console.error('workbench: room open failed', e); }
        }
        sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
      return;
    }
    if (action === 'exchange') {
      const startBtn = document.getElementById('sx-start');
      if (startBtn && !startBtn.disabled && !document.documentElement.hasAttribute('data-surface-page-ready')) {
        try { await startExchange(); } catch (e) { console.error('workbench: exchange start failed', e); }
      }
      if (target) {
        const pressBtn = document.querySelector(`[data-sx-press="${target}"]`);
        if (pressBtn && !pressBtn.disabled && !pressBtn.closest('p')?.hidden) pressBtn.click();
      }
      document.getElementById('m-exchange')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (action === 'section') {
      document.getElementById(target)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (action === 'stage' && target) {
      launchInline(title, target);
    }
  });
}
