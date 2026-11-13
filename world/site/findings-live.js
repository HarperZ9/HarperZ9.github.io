// findings-live.js: the loader for live re-runs on findings pages. A chart that can be re-run in the browser carries
// a .fc-live block naming its kernel and its data file. Nothing runs until the reader presses Run, so the page is a
// still frame by default and under reduced motion. The work happens in a worker; the page stays responsive.
const blocks = document.querySelectorAll(".fc-live[data-live]");
for (const el of blocks) {
  const kind = el.dataset.live, src = el.dataset.src;
  import(`/world/site/findings-live/${kind}.js`).then((m) => m.mount(el, src)).catch((err) => {
    console.error(`findings-live: ${kind} did not load`, err);
    const p = document.createElement("p");
    p.textContent = "The live re-run did not load. The chart and table above hold the study's own numbers.";
    el.append(p);
  });
}
