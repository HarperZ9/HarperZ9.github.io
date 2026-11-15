// Copy buttons, loaded by base.js on the first press of a [data-copy] button. The default export wires every
// copy button; base.js then repeats the press.

// Copy buttons: [data-copy] copies the text of the element its value names.
export default function initCopy() {
  for (const b of document.querySelectorAll("[data-copy]")) {
    b.hidden = false;
    b.addEventListener("click", async () => {
      const src = document.getElementById(b.dataset.copy);
      try { await navigator.clipboard.writeText(src.textContent.trim()); b.textContent = "Copied"; }
      catch (e) { console.warn("copy: clipboard refused", e); b.textContent = "Select and copy"; }
      setTimeout(() => { b.textContent = "Copy"; }, 1600);
    });
  }
}
