# Performance budget

Written 2026-10-28 for phase 1 of the site rebuild. The author, the same day: "the website runs like crap." The
later phases (engine renders, interactive demos, video, music, characters) need a page that can carry heavy media
smoothly, so this budget comes first and every later phase is held to it.

The numbers live in `tests/perf/budget.json`. The gate is `tests/perf-budget.cjs`; it runs in CI as the step
"Performance budget". This file explains the numbers and records what they measured.

## The profile

| Setting | Value | Why |
|---|---|---|
| CPU | 4x slowdown (DevTools protocol) | a mid-range phone's main thread on a desktop machine |
| Network | 40 ms round trip, 10 Mb/s down | a good 4G link; bytes still cost |
| Desktop | 1440 x 900 at 1x | the author's working width |
| Phone | 390 x 844 at 3x, touch, mobile | a current phone |
| Phases | load, settle 3 s, idle 3 s, scroll the whole page 6 s, park mid page 2 s, hidden tab 2 s | each limit below is read in the phase it belongs to |
| Trace | Chrome trace of the scroll phase, one file per page and width | main-thread tasks, long tasks, dropped frames |

## The limits

| Limit | Value | How it is read |
|---|---|---|
| Frame time, idle | p95 at or under 16.7 ms | interval between animation frames, from the load event through settle and idle |
| Frame time, scroll | p95 at or under 16.7 ms | the same, while the page scrolls top to bottom |
| Live canvases and GPU contexts | at most 3 | DOM canvases holding a context, plus every WebGL or WebGPU context (offscreen 2D scratch surfaces are memory, not frames, and are not counted) |
| Canvas elements | at most 3 | every `<canvas>` in the document at its fullest |
| Offscreen work | 0 | no canvas outside the view draws while the page is parked; no offscreen video plays |
| Hidden tab | 0 | after `visibilitychange` to hidden, nothing draws and nothing plays |
| LCP | at or under 1.5 s | buffered `largest-contentful-paint` |
| CLS | under 0.05 | buffered `layout-shift` without recent input |
| First-view JS | at or under 150 KB gzip | scripts that arrived before the load event, compressed at gzip level 9 |
| Media resolution | no picture drawn above its source | source pixels at least the drawn CSS width times the device ratio (capped at 2), with object-fit counted |
| Full-bleed video | 1920 px source or larger, AV1 or VP9 with an H.264 fallback, a poster | checked on every visible video |

Frame times need a GPU. A CI runner has none, so Chrome draws on SwiftShader and every page with a canvas misses
frames, the budgeted ones included. On a software renderer the gate reports frame times and does not enforce them;
every other limit is enforced everywhere. `PERF_FRAMES=enforce` forces them on. The gate prints which renderer it
found.

First-view JS counts only what arrived before the load event. Work a page defers to idle time is not free: the idle
frame window starts at the load event, so a heavy boot after load shows as idle frames, and the report carries
`allJsKB`, everything fetched by the end of the scroll.

## Measured, 2026-10-28

Old main is `5d310375`; new is this branch. Each pair ran back to back on the same machine (RTX 4090, Chrome 156).
Another job held the GPU at 99 to 100 percent through every GPU run, and that is the condition these frame numbers
were taken under. Frame times on this machine swung by a factor of three between runs.

### Structural limits (stable between runs)

| Page, width | Canvases | Live contexts | Hidden-tab animators | Offscreen drawers | JS before load (KB gz) | JS after full scroll (KB gz) | CLS |
|---|---|---|---|---|---|---|---|
| Home, 1440, old | 145 | 20 to 32 | 4 | 0 to 6 | 175 to 536 | 536 | 0.029 |
| Home, 1440, new | 2 (3 with a living heading) | 2 to 3 | 0 | 0 | 37 | 516 | 0.002 to 0.010 |
| Home, 390, old | 145 | 21 to 38 | 4 | 0 to 4 | 126 to 536 | 536 | 0.006 |
| Home, 390, new | 2 (3 with a living heading) | 2 to 3 | 0 | 0 | 31 to 37 | 516 | 0 to 0.001 |
| Road page, 1440, old | 139 | 20 to 21 | 4 | 0 to 6 | 115 to 302 | 302 | 0.029 |
| Road page, 1440, new | 2 | 2 | 0 | 0 | 19 | 284 | 0.001 |
| Road page, 390, old | 139 | 17 to 41 | 4 | 0 | 115 to 302 | 302 | 0.006 |
| Road page, 390, new | 2 | 2 | 0 | 0 | 19 | 284 | 0 |

Old main's JS before load moves with how much of its idle boot lands before the load event; the range is real.

### LCP (ms)

| Run | Home 1440 old | new | Home 390 old | new | Road 1440 old | new | Road 390 old | new |
|---|---|---|---|---|---|---|---|---|
| SwiftShader (CI-equivalent) | 3276 | 564 | 564 | 912 | 568 | 508 | 532 | 488 |
| GPU, contended, run 1 | 3676 | 2112 | 568 | 1004 | 1144 | 1044 | 768 | 624 |
| GPU, contended, run 2 | 3712 | 2360 | 568 | 1276 | 468 | 760 | 640 | 572 |
| GPU, contended, run 3 | 4000 | 748 | 600 | 2420 | 612 | 488 | 520 | 616 |

| SwiftShader, after the two fixes below | | 564 | | 572 | | 444 | | 484 |

The first CI run of this branch failed the home at 1440 on LCP (2036 ms): the heading repainted when the world's
display face arrived. The worlds' faces now load as `optional`, so a first visit keeps the face it painted with.
The phone's largest paint had moved to the arrival video when it started, because the video's box was taller than
the still's; the two boxes now match. The row above is after both.

Before those fixes, the phone home's LCP rose: its arrival still is now the 1280 px poster (53 KB) where old main drew a 640 px one
(14 KB) at 2x the size it was made for. The sharper picture costs about 300 to 400 ms on this link; one contended
run read 2420 ms.

### Frame times, scroll p95 (ms)

| Run | Home 1440 old | new | Home 390 old | new | Road 1440 old | new | Road 390 old | new |
|---|---|---|---|---|---|---|---|---|
| GPU, contended, run 1 | 1192 | 917 | 525 | 1454 | 1121 | 392 | 329 | 379 |
| GPU, contended, run 2 | 1000 | 529 | 758 | 379 | 917 | 1088 | 229 | 1208 |
| GPU, contended, run 3 | 1196 | 304 | 1063 | 908 | 1225 | 517 | 296 | 546 |

The same scripted scroll of the home at 1440 (60 px steps, 33 ms apart, screen-recorded) took 3 min 19 s on old
main and 2 min 19 s on this branch, both under the same contended GPU. Before the GPU job started, two early runs of
the new home at 1440 read scroll p95 16.6 and 12.5 ms; no matching old-main run was taken then, so those two numbers
stand alone.

**The frame budget is not met.** Neither the old home nor the new one holds 16.7 ms under a 4x CPU slowdown on a
saturated GPU. The trace of the scroll shows where the new one still blocks:

- synchronous GPU readbacks: the water's `export()` (`readPixels`, now once per transfer, was once a second), the
  transfer grid (`getImageData` on a 72 by 45 copy), and the plates' mosaic sources. On a busy GPU each waits for
  the queue. The fix is an asynchronous readback (pixel buffer plus fence) in the superframe's medium engine, and
  the mosaic sources built in a worker.
- the transfer front (`growFront` in `world/universe/lib/ticks.mjs`), about 1.1 s of main-thread time over a full
  scroll at 4x. It now builds in idle time ahead of each transfer; a worker would take it off the main thread.

## What changed to get here

- **One shared renderer.** `world/site/stage.js`: one fixed canvas composites every drawn layer in z order. The
  road's three full-view canvases became offscreen surfaces the stage scales up (the road at a quarter size with
  its blocks kept square, the strata at a quarter, the transfer at 1x). Each stop's three sheets became boxes with
  offscreen surfaces; the stage draws only the stops beside the walker, with each sheet's fan eased the way the
  CSS transition used to. The places' crossing, the uncovering stills and the theme's waveform are stage layers.
- **Static output.** The type engine room's 26 thumbnails render once to images (`world/typeengine/room/room.mjs`).
- **Nothing offscreen, nothing hidden.** The stage, the loops and the walk stop when the tab hides; loops play only
  while a quarter of them is in view.
- **Deferred boot.** The home's road, places and living type load once the page is idle after its load event, or at
  the first act. The road page boots its road the same way. The shell's control dressings (brushed panels, the
  sand plate) load at the first act; the sand plate's canvas exists only once the menu opens.
- **The water adapts.** Without a GPU timer the water engine now steps its backing store down by a quarter when
  the page misses frames, as far as half a CSS pixel.
- **Media.** The name-art loops ship at 1280 and 1920 px, AV1 in WebM with an H.264 MP4 fallback, encoded from the
  1920 px H.264 masters, with WebP posters at both widths. `world/site/loops.js` picks the file by the device pixels
  the slot needs. The arrival is now full bleed at 1920 px on desktop and fits the width on phones.

## Cuts, each with its reason

| Cut | Reason |
|---|---|
| The second water layer (`world/ui/directions/common/flow/ground.js` on the home) | two full-screen fluid simulations ran at once and both wrote `window.__medium`; the road's own medium stays |
| The alive layer on the home (`world/alive`: animated grain at 12 Hz, breathing stills) | full-screen redraw every frame that carried no content; ablation halved scroll frame time; the two living stills are now `data-slot="render"` for engine renders |
| The 33 transfer records (three small squares per stop) | 33 canvases restating numbers no reader could read; `window.__transfers` keeps the record |
| The header strip of 33 stop squares, each labelled 0 | clutter in the hand; the worlds switch now sits there |
| Living type on the 33 road stop headings | each heading built and dropped a WebGL context as the walker passed; the arrival and the places keep living type, one context at a time |
| The 640 px loops and posters | drawn at up to 2.4x their size on phones |
| The animated crossing and uncover canvases as separate elements | folded into stage layers, not removed |

## Not yet under the budget

- Frame times, as measured above.
- The type engine room (`/world/typeengine/room/`) and the Gallery (`/gallery.html`) are watched, not gated: the
  gate measures them on every run and reports them as OVER. The room is down from 29 canvases to 3 and holds its
  scroll; its JS before load (220 to 230 KB) and its idle frames (thumbnails rendered on the main thread) are over.
  The Gallery has 60 canvases and is untouched in this phase.
- No 4K master exists for the arrival loops; a 2x screen at 1440 wants 2880 px. The engine-render phase should
  render the arrival slot at 3840.

## Running it

```
python tests/lib/serve.py 8820 &
npm install --no-save playwright@1.62.1
SITE_BASE_URL=http://127.0.0.1:8820 BROWSER_CHANNEL=chrome node tests/perf-budget.cjs --out perf-out
```

`PERF_WATCH=0` skips the watched pages, `--only /index.html` measures one page and gates it, `PERF_SOFTWARE=1`
forces SwiftShader. `tests/perf/capture.cjs OUTDIR` writes the full-size screenshots (1440 and 390, light and dark,
four depths) and a scroll recording at each width.
