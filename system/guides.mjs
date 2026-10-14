// system/guides.mjs: the guides' loops, introductions and the "Your call" moment.
//
// Loops ([data-gd-loop] on a .gd-frame): a 2 to 3 second silent loop loads only when its frame is
// near the screen, plays only while it is on screen, and never plays with reduced motion; the
// still under it stays otherwise. Introductions ([data-gd-intro] buttons): a press opens the
// introduction with captions on and starts it; nothing plays sound on its own and nothing plays
// the next thing when it ends. Your call ([data-gd-call]): any answer shows what the film found
// and plays Rerun's knock; nothing is scored or kept.

const reduced = matchMedia("(prefers-reduced-motion: reduce)");

function loops() {
  const frames = [...document.querySelectorAll("[data-gd-loop]")];
  if (!frames.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const box = e.target;
    let v = box.querySelector("video");
    if (e.isIntersecting && !reduced.matches) {
      if (!v) {
        v = Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, preload: "auto" });
        v.setAttribute("aria-hidden", "true");
        v.setAttribute("tabindex", "-1");
        v.src = box.dataset.gdLoop;
        v.addEventListener("playing", () => v.classList.add("gd-on"), { once: true });
        box.append(v);
      }
      v.play().catch(() => {});
    } else if (v) v.pause();
  }), { rootMargin: "120px 0px" });
  frames.forEach((f) => io.observe(f));
  reduced.addEventListener?.("change", () => frames.forEach((f) => f.querySelector("video")?.pause()));
}

function intros() {
  document.querySelectorAll("[data-gd-intro]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("aria-controls"), fig = document.getElementById(id);
      if (!fig) return;
      const open = fig.hidden;
      document.querySelectorAll("[data-gd-intro]").forEach((b) => {
        if (b === btn) return;
        const f = document.getElementById(b.getAttribute("aria-controls"));
        if (f && !f.hidden) { f.hidden = true; f.querySelector("video")?.pause(); b.setAttribute("aria-expanded", "false"); }
      });
      fig.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      const v = fig.querySelector("video");
      if (!v) return;
      if (open) {
        [...v.textTracks].forEach((t) => { if (t.kind === "captions") t.mode = "showing"; });
        v.play().catch(() => {});
      } else v.pause();
    });
  });
}

function yourCall() {
  document.querySelectorAll("[data-gd-call]").forEach((box) => {
    const answer = box.querySelector(".gd-answer"), said = box.querySelector("[data-gd-said]"), frame = box.querySelector(".gd-frame");
    box.querySelectorAll("button[data-gd-choice]").forEach((b) => b.addEventListener("click", () => {
      box.querySelectorAll("button[data-gd-choice]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      if (said) said.textContent = b.dataset.gdChoice;
      answer.hidden = false;
      if (!frame || reduced.matches) return;
      let v = frame.querySelector("video");
      if (!v) {
        v = Object.assign(document.createElement("video"), { muted: true, playsInline: true, preload: "auto" });
        v.setAttribute("aria-hidden", "true");
        v.src = frame.dataset.gdAction;
        frame.append(v);
      }
      v.currentTime = 0;
      v.classList.add("gd-on");
      v.play().catch(() => {});
    }));
  });
}

loops();
intros();
yourCall();
