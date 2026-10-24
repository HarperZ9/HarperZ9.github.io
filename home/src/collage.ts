// The collage behind the form: real scans from public domain and CC0 archives
// (see media/front-door/CREDITS.md). The brass astrolabe loads after the page has
// painted; the dragon wheel, the engraved eye and the eclipse load only when the
// visitor first reaches the state that shows them. Phones get the small cut.

const wide = window.matchMedia("(min-width: 64rem)");

function load(img: HTMLImageElement) {
  if (img.getAttribute("src")) return;
  const set = (img.dataset.srcset ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const pick = wide.matches ? set[set.length - 1] : set[0];
  const url = pick?.split(/\s+/)[0];
  if (!url) return;
  img.addEventListener("error", () => console.warn("[front door] collage layer did not load:", url), { once: true });
  img.src = url;
}

export type Collage = { wake(layer: "volvelle" | "eye" | "eclipse"): void };

export function dressCollage(root: HTMLElement): Collage {
  const layer = (name: string) => document.querySelector<HTMLImageElement>(`.fd-collage .fc-${name}`);
  const go = () => {
    const astro = layer("astro");
    if (astro) load(astro);
    root.classList.add("fd-dressed");
  };
  const later = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 600);
  };
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
  return {
    wake(name) {
      const img = layer(name);
      if (img) load(img);
    },
  };
}
