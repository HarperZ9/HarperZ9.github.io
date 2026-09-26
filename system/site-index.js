const controls = document.querySelector('[data-search-controls]');
const input = document.querySelector('#index-query');
if (controls && input) {
  const sections = [...document.querySelectorAll('[data-index-section]')];
  const entries = [...document.querySelectorAll('[data-index-entry]')];
  const status = document.querySelector('[data-search-status]');
  const empty = document.querySelector('[data-no-results]');
  // The sector count comes from the shortcut row, so a new pillar updates the line.
  const sectorCount = document.querySelectorAll('.directory-pillars a').length || sections.length;
  const sectorWords = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const sectors = `${sectorWords[sectorCount] || sectorCount} ${sectorCount === 1 ? 'sector' : 'sectors'}`;
  function filter() {
    const terms = input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const entry of entries) {
      const context = entry.closest('[data-index-section]').querySelector('header').textContent;
      const text = `${context} ${entry.textContent} ${entry.dataset.searchText || ''}`.toLocaleLowerCase();
      entry.hidden = !terms.every(term => text.includes(term));
      if (!entry.hidden) visible++;
    }
    for (const section of sections) {
      section.hidden = ![...section.querySelectorAll('[data-index-entry]')].some(entry => !entry.hidden);
    }
    status.textContent = terms.length ? `${visible} of ${entries.length} pages match.` : `${entries.length} pages across ${sectors}.`;
    empty.hidden = visible !== 0;
  }
  controls.hidden = false;
  input.addEventListener('input', filter);
  document.querySelector('[data-clear]').addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus();
  });
  filter();
}
