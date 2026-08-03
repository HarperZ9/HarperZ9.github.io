# Spatial instrument: piecewise visual QA record

Date: 2026-08-03. Method and findings for the sweep that closed the first
rendering-quality loop. Fixes landed in PR 94 (switching), PR 95 (atlas
presence), PR 96 (piecewise QA fixes).

## Method

An in-page sweep harness (installed via the browser devtools MCP, not
shipped) renders one tile per knob step onto a labeled contact sheet:
set state, force synchronous frames, blit the canvas, caption the tile.
Sheets produced: atlas scene sampler (one per profile family), atlas knob
sweeps (depth, splat size, exposure, opacity, transform modes, camera
envelope), Crystal City camera boundary plus full material set, folded
light, and importance-ordered granularity tiers (1,500 to full).

Operational rules learned:
- Iterate in a fresh isolated browser context per code change: deep module
  imports are unversioned and memory-cache aggressively during local dev.
- The app pane may not composite (rAF starved); the devtools-owned browser
  is the verification surface, and forced synchronous frames make canvas
  readback deterministic.
- Numeric pixel probes catch dead renders, not weak ones. Contact sheets
  reviewed by eye are the gate for creative work.

## Findings ledger

Fixed (PR 96): hybrid-switch context poisoning (naked canvas claimed as 2d
mid-fetch; replacement now prepared detached, context claimed off-DOM);
exposure knob authority (EV curve); folded-light veil grammar (fold
frequency at plane scale, alpha ceiling under charged glow); failed-world
chip retry.

Verified good: monotonic depth/size/opacity response; inversphere and holo
transforms; full camera envelope including inside-the-field dolly;
Crystal City materials at boundary extremes with no black wedges or support
exposure; granularity degradation preserving load-bearing structure at
1,500 splats.

Open, by design or deferred: atlas glow at maximum clips highlights
(inspection range, matching the session's charged-preset caveat); atlas
studies carry the v0.5 all-splat softness their disclosure already states;
exposure range could widen once the EV curve has field feedback.
