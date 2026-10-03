// system/explainer/live.mjs
// Turns an explainer figure (tools/explainer/embed.py) into a live, interactive one driven by
// the media engine. The figure's video, captions and transcript stay in the page: they are what a
// reader without script gets, and the video is one click away for everyone else.
//
// The live stage reads the same spec.json the video was rendered from, checks its SHA-256
// against the video's build receipt, and draws through the page's one engine scheduler: nothing
// draws off screen or in a hidden tab, a paused stage costs nothing, and with reduced motion the
// stage shows one still per step. Requests go only to the explainer's own folder on this site.

import { usePlugin } from "../media-engine/page.mjs";
import { explainer, registerExplainer } from "../media-engine/plugins/explainer.mjs";
import { digest } from "../media-engine/receipt.mjs";
import { locate, stillTime, resolvedScenes, timeline } from "./state.mjs";
import { mountRecall } from "./recall.mjs";
import { secs, pole, stageParts, paramPanel, howWeKnow, tuckVideo, dueBanner, download } from "./dom.mjs";

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => reducedQuery.matches;
const FILES = ["spec.json", "receipt.json", "recall.json"];

// Only the explainer's own folder, as a relative path on this site.
async function own(folder, name) {
  if (!/^media\/explainers\/[a-z0-9-]+$/.test(folder) || !FILES.includes(name)) throw new Error("explainer: not an explainer file");
  const res = await fetch(`${folder}/${name}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.text();
}

async function load(fig) {
  const slug = fig.dataset.explainer, folder = fig.dataset.folder;
  const [specText, receiptText, recallText] = await Promise.all(FILES.map((f) => own(folder, f).catch(() => null)));
  if (!specText) return null;
  const spec = JSON.parse(specText), receipt = receiptText ? JSON.parse(receiptText) : null;
  const art = new Image();
  art.decoding = "async";
  art.src = `${folder}/aperture.png`;
  registerExplainer(slug, { spec, receipt, art });
  if (document.fonts) await Promise.all(['600 54px "Hanken Grotesk"', '28px "Conso"'].map((f) => document.fonts.load(f).catch(() => null)));
  return { slug, folder, spec, receipt, recall: recallText ? JSON.parse(recallText) : null,
    specSha: await digest(new TextEncoder().encode(specText)) };
}

class Player {
  constructor(fig, data) {
    Object.assign(this, data);
    this.fig = fig;
    this.rows = timeline(data.spec, data.receipt);
    this.end = this.rows[this.rows.length - 1][2];
    this.stepOf = Object.fromEntries(this.rows.map((r, i) => [r[0], i + 1]));
    this.defaults = Object.fromEntries((data.spec.params || []).map((p) => [p.id, p.default]));
    this.overrides = {};
    this.playing = false;
    this.shownStep = -1;
    this.stillStep = 0; // a step shows its settled still; Play from a still starts that step
    this.doneChecks = new Set();
  }

  buildDom() {
    const ui = this.ui = stageParts(this.spec, this.end);
    this.params = paramPanel(this.spec, (p, v) => this.setParam(p, v), () => this.setOverrides({}));
    this.how = howWeKnow(this);
    this.recallHost = document.createElement("div");
    this.recallHost.className = "xl-recall";
    for (const part of [this.params && this.params.root, this.how.root, this.recallHost]) if (part) ui.root.append(part);
    ui.root.dataset.slug = this.slug;
    this.fig.insertBefore(ui.root, this.fig.firstChild);
    ui.root.dataset.pole = pole(this.fig);
    tuckVideo(this.fig);
    this.fig.classList.add("xl-on");
    this.relabel();
  }

  async mount() {
    const engine = await usePlugin(explainer);
    const { canvas, stage } = this.ui;
    const fit = () => { const w = Math.max(320, Math.round(stage.clientWidth * Math.min(2, devicePixelRatio || 1))); canvas.width = w; canvas.height = Math.round(w * 9 / 16); };
    fit();
    this.handle = engine.mount(canvas, "explainer", {
      params: { slug: this.slug, spec_sha256: this.specSha, overrides: {}, t: stillTime(this.rows, 0), playing: false },
      minFrameMs: 33, seed: this.slug,
    });
    this.inst = this.handle.instance;
    this.inst.onTick = (now, before) => this.tick(now, before);
    new ResizeObserver(() => { fit(); this.handle.resize(); }).observe(stage);
  }

  mountRecall() {
    if (!this.recall) { this.checkAt = new Map(); return; }
    const r = this.recallUi = mountRecall(this.recallHost, this.recall, { slug: this.slug, steps: this.stepOf,
      onContinue: () => { this.ui.play.focus({ preventScroll: true }); this.setPlaying(true); } });
    this.checkAt = new Map(r.groups.map((g, i) => [this.rows[this.stepOf[g.after] - 1][2], i]));
    if (r.dueCount) this.ui.root.insertBefore(dueBanner(r.dueCount, () => r.open(r.groups.indexOf(r.dueGroups[0]))), this.ui.stage);
  }

  wire() {
    const { play, prev, next, scrub, stepButtons } = this.ui;
    const here = () => locate(this.rows, this.inst.playhead)[0];
    play.addEventListener("click", () => this.setPlaying(!this.playing));
    prev.addEventListener("click", () => this.goStep(here() - 1));
    next.addEventListener("click", () => this.goStep(here() + 1));
    scrub.addEventListener("input", () => { const t = Number(scrub.value); this.setPlaying(false); this.stillStep = -1; this.seek(t); });
    stepButtons.forEach((b, i) => b.addEventListener("click", () => this.goStep(i)));
    this.how.save.addEventListener("click", () => this.saveReceipt());
    reducedQuery.addEventListener("change", () => this.goStep(here()));
  }

  relabel() {
    const name = (s, i) => `${i + 1}. ${s.layout === "title" ? "Title" : s.layout === "close" ? "Close" : s.heading}`;
    resolvedScenes(this.spec, this.overrides).forEach((s, i) => { this.ui.stepButtons[i].textContent = name(s, i); });
  }

  sync() {
    const t = this.inst.playhead, [i] = locate(this.rows, t), { scrub, clock, caption, play, stepButtons } = this.ui;
    scrub.value = t.toFixed(1);
    scrub.setAttribute("aria-valuetext", `Step ${i + 1} of ${this.rows.length}, ${secs(t)}`);
    clock.textContent = `${secs(t)} / ${secs(this.end)}`;
    if (i !== this.shownStep) {
      this.shownStep = i;
      caption.textContent = this.spec.scenes[i].say;
      stepButtons.forEach((b, j) => b.setAttribute("aria-current", j === i ? "step" : "false"));
    }
    play.hidden = reduced(); // with reduced motion there is nothing to play: one still per step
    play.textContent = this.playing ? "Pause" : t >= this.end - 0.05 ? "Play again" : "Play";
  }

  seek(t) { this.inst.playhead = Math.min(Math.max(0, t), this.end); this.handle.redraw(); requestAnimationFrame(() => this.sync()); }

  goStep(i) {
    i = Math.min(Math.max(0, i), this.rows.length - 1);
    this.setPlaying(false);
    this.seek(stillTime(this.rows, i));
    this.stillStep = i;
  }

  setPlaying(on) {
    if (reduced()) on = false;
    if (on && this.inst.playhead >= this.end - 0.05) this.inst.playhead = 0;
    else if (on && this.stillStep >= 0) this.inst.playhead = this.rows[this.stillStep][1];
    this.stillStep = -1;
    this.playing = on;
    this.handle.setParams({ playing: on });
    this.handle.redraw();
    this.sync();
  }

  setOverrides(next) {
    this.overrides = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== this.defaults[k]));
    if (this.params) this.params.changed(Object.keys(this.overrides).length > 0);
    this.handle.setParams({ overrides: this.overrides });
    this.relabel();
  }

  setParam(p, v) {
    this.setOverrides({ ...this.overrides, [p.id]: v });
    const [i] = locate(this.rows, this.inst.playhead);
    if (!this.playing && this.rows[i][0] !== p.scene) this.goStep(this.stepOf[p.scene] - 1);
    else { this.handle.redraw(); requestAnimationFrame(() => this.sync()); }
  }

  // Playing: stop at the end of a step group the first time through and open its recall check.
  tick(now, before) {
    for (const [at, gi] of this.checkAt) {
      if (before < at && now >= at && !this.doneChecks.has(gi)) {
        this.doneChecks.add(gi);
        this.inst.playhead = at - 0.001;
        this.setPlaying(false);
        this.recallUi.open(gi);
        return;
      }
    }
    if (now >= this.end) this.setPlaying(false);
    this.sync();
  }

  async saveReceipt() {
    this.setPlaying(false);
    this.handle.setParams({ t: +this.inst.playhead.toFixed(3) });
    const r = await this.handle.receipt(this.inst.playhead);
    r.video_receipt = `${this.folder}/receipt.json`;
    r.does_not_prove = "A matching pixel hash shows the same pixels on the same browser and device class. It does not show that the figure is correct.";
    download(`${this.slug}-frame-receipt.json`, r);
  }
}

async function build(fig) {
  const data = await load(fig);
  if (!data) return;
  const player = new Player(fig, data);
  player.buildDom();
  await player.mount();
  player.mountRecall();
  player.wire();
  player.sync();
  player.ui.root.dataset.ready = "";
  fig.explainerHandle = player.handle; // for tests and the bench: handle.instance.playhead, handle.stats
}

export function enhanceExplainers(root = document) {
  const figs = [...root.querySelectorAll("figure.explainer[data-explainer]")];
  const start = (fig) => { if (fig.dataset.live) return; fig.dataset.live = "1"; build(fig).catch((e) => console.error("[explainer] live figure failed; the video stays:", e)); };
  if (typeof IntersectionObserver !== "function") { figs.forEach(start); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); }
  }, { rootMargin: "600px 0px" });
  figs.forEach((f) => io.observe(f));
}

enhanceExplainers();
