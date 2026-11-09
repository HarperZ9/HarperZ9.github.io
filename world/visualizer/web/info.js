// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// info.js: the quiet info toggle. Explanations (the definition in use, the mapping) live in the page as text that
// assistive technology always reads; on screen they show only when the viewer asks, and the choice is remembered
// for this viewer. Off by default: the picture carries data, not instructions.
export function infoToggle(btn) {
  const panels = (btn.getAttribute('aria-controls') ?? '').split(' ').map(id => document.getElementById(id)).filter(Boolean);
  let on = false; try { on = localStorage.getItem('vis.info') === '1'; } catch {}
  const set = v => { on = v; btn.setAttribute('aria-expanded', String(v)); for (const p of panels) p.classList.toggle('shown', v); try { localStorage.setItem('vis.info', v ? '1' : '0'); } catch {} };
  btn.addEventListener('click', () => set(!on)); set(on);
}
