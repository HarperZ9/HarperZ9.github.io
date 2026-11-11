// surface-chart.mjs: the charts as a surface. mount(host, { elements, focus, settings, view, property }, ctx).
//   view 'element' (default): every measured property of one element against the table, with a control on each
//                             property the well can be driven by. Moving a control calls ctx.onSet(id, key, value);
//                             "Back to the measured values" calls ctx.onSet(id, null).
//   view 'compare':           many elements on one chosen property. Choosing a row calls ctx.onPick(id).
import { propertyChart, compareChart, pos, valueAt } from './charts.mjs';
import { DRIVES, fmt } from './elements-data.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mount(host, input, ctx) {
  const { ix } = ctx;
  let state = { view: 'element', property: ix.propNames[0], ...input };
  host.classList.add('sf-chart');
  const focus = () => ix.byId.get(state.focus || state.elements[0]);

  function render() {
    if (state.view === 'compare') {
      host.innerHTML = `<label class="cmp-pick">Property <select>${ix.propNames.map((n) => `<option value="${esc(n)}"${n === state.property ? ' selected' : ''}>${esc(n)} (${ix.spread.get(n).count} elements)</option>`).join('')}</select></label>` +
        compareChart(ix, state.property, { selected: state.elements });
      return;
    }
    const el = focus(); if (!el) { host.innerHTML = ''; return; }
    const set = state.settings?.[el.id] || {}, changed = Object.keys(set).length > 0;
    host.innerHTML = propertyChart(ix, el, { settings: set }) +
      `<p class="pc-foot"><button type="button" data-act="measured"${changed ? '' : ' disabled'}>Back to the measured values</button>` +
      `<span>Each row is one property. The small ticks are every element that has it, the pale band is the middle half of the table, the bar is this element's own middle half, and the mark is its median. Drag a control and the open ring shows your setting; the well follows it.</span></p>`;
  }
  const onInput = (ev) => {
    const r = ev.target.closest('input[data-drive]'); if (!r) return;
    const el = focus(), key = r.dataset.drive, s = ix.spread.get(DRIVES[key].prop), v = valueAt(s, +r.value);
    r.setAttribute('aria-valuetext', fmt(v));
    const tr = r.closest('.pc-plot').querySelector('.pc-track');
    let ring = tr.querySelector('.pc-set'); if (!ring) { ring = document.createElement('i'); ring.className = 'pc-set'; tr.append(ring); }
    ring.style.left = pos(s, v) + '%'; ring.title = `your setting ${fmt(v)}`;
    state.settings = { ...state.settings, [el.id]: { ...(state.settings?.[el.id] || {}), [key]: v } };
    host.querySelector('[data-act="measured"]')?.removeAttribute('disabled');
    ctx.onSet?.(el.id, key, v);
  };
  const onChange = (ev) => { if (ev.target.matches('.cmp-pick select')) { state.property = ev.target.value; render(); } };
  const onClick = (ev) => {
    const row = ev.target.closest('[data-id]');
    if (row && state.view === 'compare') { ctx.onPick?.(row.dataset.id); return; }
    if (ev.target.closest('[data-act="measured"]')) { const el = focus(); const s = { ...state.settings }; delete s[el.id]; state.settings = s; render(); ctx.onSet?.(el.id, null); }
  };
  host.addEventListener('input', onInput); host.addEventListener('change', onChange); host.addEventListener('click', onClick);
  render();
  return {
    update(next) { state = { ...state, ...next }; render(); },
    value: () => ({ focus: focus()?.id, settings: state.settings, property: state.property }),
    destroy() { host.removeEventListener('input', onInput); host.removeEventListener('change', onChange); host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove('sf-chart'); },
  };
}
