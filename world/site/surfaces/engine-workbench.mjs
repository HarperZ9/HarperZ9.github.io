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
  const discBar = wb.querySelector('#wb-discs');
  const groups = [...wb.querySelectorAll('[data-wb-group]')];
  const rows = [...wb.querySelectorAll('[data-wb-row]')];
  const stage = wb.querySelector('#wb-stage');
  const stageTitle = wb.querySelector('#wb-stage-title');
  const stageLink = wb.querySelector('#wb-stage-open');
  const stageBody = wb.querySelector('#wb-stage-body');
  const stageClose = wb.querySelector('#wb-stage-close');
  const stageSend = wb.querySelector('#wb-stage-send');
  const stagePrev = wb.querySelector('#wb-stage-prev');
  const stageNext = wb.querySelector('#wb-stage-next');
  const stageSplit = wb.querySelector('#wb-stage-split');
  const stageControls = wb.querySelector('#wb-stage-controls');
  let activeDisc = 'all';
  let currentStage = { title: '', target: '' };
  let splitStage = { active: false, title: '', target: '' };

  // Build ordered catalog of every stage-mountable surface for instant in-place switching and side-by-side comparison.
  const stageItems = [];
  for (const btn of wb.querySelectorAll('[data-wb-action="stage"]')) {
    const target = btn.dataset.wbTarget || '';
    if (!target) continue;
    const row = btn.closest('[data-wb-row]');
    const group = btn.closest('[data-wb-group]');
    const baseName = row?.querySelector('.wb-name')?.textContent?.trim() || btn.textContent.trim();
    const label = btn.textContent.trim();
    const title = (label && label !== 'Open' && !baseName.toLowerCase().includes(label.toLowerCase())) ? `${baseName} (${label})` : baseName;
    const disc = group?.querySelector('h3')?.firstChild?.textContent?.trim() || 'Workspace';
    stageItems.push({ title, target, disc, btn });
  }

  let jumpSelect = null;
  let splitSelect = null;
  if (stageControls && stageItems.length) {
    const buildSelect = (id, ariaLabel) => {
      const sel = document.createElement('select');
      sel.id = id;
      sel.className = 'wb-stage-select';
      sel.setAttribute('aria-label', ariaLabel);
      const byDisc = new Map();
      for (const item of stageItems) {
        if (!byDisc.has(item.disc)) byDisc.set(item.disc, []);
        byDisc.get(item.disc).push(item);
      }
      for (const [disc, list] of byDisc) {
        const og = document.createElement('optgroup');
        og.label = disc;
        for (const item of list) {
          const opt = document.createElement('option');
          opt.value = item.target;
          opt.textContent = item.title;
          og.appendChild(opt);
        }
        sel.appendChild(og);
      }
      return sel;
    };
    jumpSelect = buildSelect('wb-stage-jump', 'Switch active workspace surface');
    splitSelect = buildSelect('wb-stage-split-pick', 'Choose second surface for side-by-side comparison');
    splitSelect.hidden = true;
    stageControls.prepend(splitSelect);
    stageControls.prepend(jumpSelect);
  }

  const applyFilter = () => {
    const q = (filterInput?.value || '').trim().toLowerCase();
    let shown = 0;
    for (const group of groups) {
      const discOk = activeDisc === 'all' || group.dataset.wbDisc === activeDisc;
      let any = false;
      for (const row of group.querySelectorAll('[data-wb-row]')) {
        const hay = (row.dataset.wbSearch || row.textContent || '').toLowerCase();
        const hit = discOk && (!q || hay.includes(q));
        row.hidden = !hit;
        if (hit) { shown++; any = true; }
      }
      group.hidden = !any;
    }
    if (countEl) {
      countEl.textContent = (q || activeDisc !== 'all')
        ? `Showing ${shown} of ${rows.length} creative engines`
        : `${rows.length} creative engines across ${groups.length} disciplines`;
    }
  };

  discBar?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-wb-disc]');
    if (!btn) return;
    activeDisc = btn.dataset.wbDisc || 'all';
    for (const b of discBar.querySelectorAll('[data-wb-disc]')) {
      b.setAttribute('aria-pressed', String(b === btn));
    }
    applyFilter();
  });

  filterInput?.addEventListener('input', applyFilter);
  if (filterInput?.value) applyFilter();

  const clearActive = () => {
    for (const r of wb.querySelectorAll('[data-wb-active="true"]')) delete r.dataset.wbActive;
    for (const b of wb.querySelectorAll('[data-wb-action][aria-current="true"]')) b.removeAttribute('aria-current');
  };
  const markActive = (btn) => {
    clearActive();
    const row = btn?.closest?.('[data-wb-row]');
    if (row) row.dataset.wbActive = 'true';
    if (btn) btn.setAttribute('aria-current', 'true');
  };

  const syncUrl = () => {
    try {
      const u = new URL(location.href);
      if (currentStage.target) u.searchParams.set('open', currentStage.target);
      else u.searchParams.delete('open');
      if (splitStage.active && splitStage.target) u.searchParams.set('split', splitStage.target);
      else u.searchParams.delete('split');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch { /* ignore history restrictions */ }
  };

  const renderFrames = () => {
    if (!stageBody || !currentStage.target) return;
    const mk = (t, s) => {
      const embedSrc = s + (s.includes('?') ? '&' : '?') + 'embed=1';
      return `<iframe class="wb-frame" src="${esc(embedSrc)}" title="${esc(t)}" loading="eager" allow="autoplay; fullscreen"></iframe>`;
    };
    if (splitStage.active && splitStage.target) {
      stageBody.classList.add('is-split');
      stageBody.innerHTML = mk(currentStage.title, currentStage.target) + mk(splitStage.title, splitStage.target);
    } else {
      stageBody.classList.remove('is-split');
      stageBody.innerHTML = mk(currentStage.title, currentStage.target);
    }
  };

  const closeStage = () => {
    clearActive();
    currentStage = { title: '', target: '' };
    splitStage = { active: false, title: '', target: '' };
    if (stageSplit) stageSplit.setAttribute('aria-pressed', 'false');
    if (splitSelect) splitSelect.hidden = true;
    syncUrl();
    if (!stage || !stageBody) return;
    stage.hidden = true;
    stageBody.classList.remove('is-split');
    stageBody.innerHTML = '';
  };
  stageClose?.addEventListener('click', closeStage);
  stageSend?.addEventListener('click', async () => {
    if (!window.__studioCanvas && window.__openUnifiedStudio) await window.__openUnifiedStudio();
    window.__studioCanvas?.receiveEngine(currentStage);
  });

  const launchInline = (title, src, { scroll = true } = {}) => {
    if (!stage || !stageBody) return;
    currentStage = { title, target: src };
    stage.hidden = false;
    if (stageTitle) stageTitle.textContent = `Live stage: ${title}`;
    if (stageLink) { stageLink.href = src; stageLink.textContent = `Open ${title} full window`; }
    if (jumpSelect && jumpSelect.value !== src) jumpSelect.value = src;
    renderFrames();
    syncUrl();
    if (scroll) stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const stepStage = (delta) => {
    if (!stageItems.length) return;
    const idx = Math.max(0, stageItems.findIndex((i) => i.target === currentStage.target));
    const next = stageItems[(idx + delta + stageItems.length) % stageItems.length];
    markActive(next.btn);
    launchInline(next.title, next.target, { scroll: false });
  };
  stagePrev?.addEventListener('click', () => stepStage(-1));
  stageNext?.addEventListener('click', () => stepStage(1));
  jumpSelect?.addEventListener('change', () => {
    const item = stageItems.find((i) => i.target === jumpSelect.value);
    if (item) { markActive(item.btn); launchInline(item.title, item.target, { scroll: false }); }
  });
  stageSplit?.addEventListener('click', () => {
    splitStage.active = !splitStage.active;
    stageSplit.setAttribute('aria-pressed', String(splitStage.active));
    if (splitSelect) splitSelect.hidden = !splitStage.active;
    if (splitStage.active && !splitStage.target && stageItems.length > 1) {
      const alt = stageItems.find((i) => i.target !== currentStage.target) || stageItems[0];
      splitStage.title = alt.title;
      splitStage.target = alt.target;
      if (splitSelect) splitSelect.value = alt.target;
    }
    renderFrames();
    syncUrl();
  });
  splitSelect?.addEventListener('change', () => {
    const item = stageItems.find((i) => i.target === splitSelect.value);
    if (item) {
      splitStage = { active: true, title: item.title, target: item.target };
      renderFrames();
      syncUrl();
    }
  });

  // Honor deep-link URL state (?open=/path&split=/path) on initial boot.
  const params = new URLSearchParams(location.search);
  const openParam = params.get('open');
  if (openParam) {
    const found = stageItems.find((i) => i.target === openParam);
    const splitParam = params.get('split');
    if (splitParam) {
      const sFound = stageItems.find((i) => i.target === splitParam);
      if (sFound) {
        splitStage = { active: true, title: sFound.title, target: sFound.target };
        if (stageSplit) stageSplit.setAttribute('aria-pressed', 'true');
        if (splitSelect) { splitSelect.hidden = false; splitSelect.value = sFound.target; }
      }
    }
    if (found) {
      markActive(found.btn);
      launchInline(found.title, found.target, { scroll: true });
    }
  }

  wb.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-wb-action]');
    if (!btn) return;
    markActive(btn);
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
