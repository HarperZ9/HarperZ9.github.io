// The front door: a facet index that works as tabs, one open panel, and the
// generated form that turns toward whichever facet is chosen.
import { aperture } from "./form-aperture";
import { astrolabe } from "./form-astrolabe";
import { crystal } from "./form-crystal";
import { mountChoose, mountNewest, mountWipe } from "./demos";
import { dressCollage } from "./collage";
import { mountPhaseMap } from "./phase-map";
import { createSound } from "./sound";
import { mountStage, type Stage } from "./stage";

const FORMS = { aperture, crystal, astrolabe };
export const DEFAULT_FORM: keyof typeof FORMS = "astrolabe";

function chooseForm() {
  const asked = new URLSearchParams(location.search).get("form");
  return asked && asked in FORMS ? FORMS[asked as keyof typeof FORMS] : FORMS[DEFAULT_FORM];
}

function setupTabs(links: HTMLAnchorElement[], panels: HTMLElement[], onSelect: (i: number, how: "key" | "pointer" | "load") => void) {
  const list = links[0].closest("ul");
  list?.setAttribute("role", "tablist");
  list?.setAttribute("aria-orientation", "vertical");
  links.forEach((a, i) => {
    a.parentElement?.setAttribute("role", "presentation");
    a.setAttribute("role", "tab");
    a.setAttribute("aria-controls", panels[i].id);
    a.id = `tab-${panels[i].id}`;
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", a.id);
    panels[i].tabIndex = -1;
    a.addEventListener("click", (e) => { e.preventDefault(); onSelect(i, "pointer"); });
    a.addEventListener("keydown", (e) => {
      const n = links.length;
      const move: Record<string, number> = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: n - 1 };
      if (!(e.key in move)) return;
      e.preventDefault();
      const next = ((move[e.key] % n) + n) % n;
      onSelect(next, "key");
      links[next].focus();
    });
  });
}

// Heavy things in a panel wait until it first opens: the film's poster and the newest list.
function wake(panel: HTMLElement) {
  if (panel.dataset.awake) return;
  panel.dataset.awake = "1";
  panel.querySelectorAll<HTMLVideoElement>("video[data-poster]").forEach((v) => { v.poster = v.dataset.poster ?? ""; });
  // The archive loops play muted when their facet opens, never under reduced motion.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    panel.querySelectorAll<HTMLVideoElement>("video.fd-loop").forEach((v) => {
      v.play().catch((err: unknown) => console.warn("[front door] loop did not start:", err));
    });
  }
  const newest = panel.querySelector<HTMLElement>("[data-newest]");
  if (newest) void mountNewest(newest);
}

function mountToys(sound: ReturnType<typeof createSound>) {
  const toys = document.querySelector<HTMLElement>(".fd-toys");
  const button = toys?.querySelector<HTMLButtonElement>(".fd-sound");
  if (!toys || !button) return;
  button.addEventListener("click", () => {
    sound.setOn(!sound.on());
    button.setAttribute("aria-pressed", String(sound.on()));
  });
  toys.hidden = false;
}

export function mountFrontDoor() {
  const root = document.documentElement;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".fd-list a[data-facet]"));
  const panels = links.map((a) => document.getElementById(a.dataset.facet ?? ""));
  if (!links.length || panels.some((p) => !p)) return;
  const panelEls = panels as HTMLElement[];
  root.classList.add("fd-live", "fd-ready");

  let stage: Stage | null = null;
  const sound = createSound();
  let current = -1;
  const select = (i: number, how: "key" | "pointer" | "load") => {
    if (i === current) return;
    current = i;
    links.forEach((a, k) => {
      a.setAttribute("aria-selected", String(k === i));
      a.tabIndex = k === i ? 0 : -1;
    });
    panelEls.forEach((p, k) => { p.hidden = k !== i; });
    wake(panelEls[i]);
    stage?.select(i);
    sound.facet(i);
    stage?.setWater(panelEls[i].id === "low-water");
    if (how !== "load") history.replaceState(null, "", `#${panelEls[i].id}`);
    if (how === "pointer" && !window.matchMedia("(min-width: 64rem)").matches) {
      const box = panelEls[i].getBoundingClientRect();
      if (box.top > window.innerHeight * 0.8) {
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        panelEls[i].scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      }
    }
  };

  setupTabs(links, panelEls, select);
  links.forEach((a, i) => {
    a.addEventListener("pointerenter", () => stage?.preview(i));
    a.addEventListener("pointerleave", () => stage?.preview(null));
    a.addEventListener("focus", () => stage?.preview(null));
  });

  const canvas = document.querySelector<HTMLCanvasElement>(".fd-canvas");
  if (canvas) {
    try {
      const status = document.querySelector<HTMLElement>(".fd-status");
      const collage = dressCollage(root);
      stage = mountStage(canvas, chooseForm(), links.length, {
        pick: (i) => select(i, "pointer"),
        mood: (m) => {
          if (m.dream) collage.wake("volvelle");
          if (m.hold) collage.wake("eye");
          root.classList.toggle("fd-dream", m.dream);
          root.classList.toggle("fd-hold", m.hold);
        },
        touched: (kind) => sound.touch(kind),
        secret: (on) => {
          collage.wake("eclipse");
          collage.wake("eye");
          root.classList.toggle("fd-eclipse", on);
          if (status) status.textContent = on ? "Eclipse. The form turns inside out." : "The eclipse passes.";
        },
      });
      mountToys(sound);
    } catch (err) {
      console.error("[front door] the form could not start; the index still works:", err);
      canvas.closest(".fd-form")?.remove();
    }
  }

  document.querySelectorAll<HTMLElement>('[data-demo="choose"]').forEach(mountChoose);
  document.querySelectorAll<HTMLElement>('[data-demo="wipe"]').forEach(mountWipe);

  const here = document.getElementById("here");
  if (here) {
    const pillars = links.slice(1).map((a) => (a.textContent ?? "").replace(/^\s*\d+\s*/, "").trim());
    mountPhaseMap(here, pillars, (i) => select(i + 1, "pointer"), () => sound.touch("ripple"));
  }

  const fromHash = panelEls.findIndex((p) => `#${p.id}` === location.hash);
  select(fromHash >= 0 ? fromHash : 0, "load");
  // A deep link opens its facet in place; on a wide screen the stage already shows it,
  // so undo the browser's jump to the anchor.
  const stay = () => {
    if (!window.matchMedia("(min-width: 64rem)").matches) return;
    requestAnimationFrame(() => window.scrollTo(0, 0));
  };
  if (fromHash >= 0) { stay(); window.addEventListener("load", stay, { once: true }); }
  window.addEventListener("hashchange", () => {
    const k = panelEls.findIndex((p) => `#${p.id}` === location.hash);
    if (k >= 0) { select(k, "load"); stay(); }
  });
}
