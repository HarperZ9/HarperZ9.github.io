# Media-First Studio Redesign

Date: 2026-07-09
Status: Approved direction, ready for implementation planning
Scope: `studio.html`, `system/system.css`, and narrowly related Studio tests/checks

## Purpose

The Studio should read first as an art, media, and perception instrument. The current page over-weights verification, certificates, audit trails, and stack explanation in the first viewport. Those pieces are useful, but they currently compete with the rendered frame and make the page feel like a verification dashboard instead of the place where the user experiences generated media and measured perception.

The approved direction is Option B: a media-first Studio shell.

## Goals

- Make the live canvas the dominant object in the first viewport.
- Let the user immediately experience rendered media, motion, and measured perception.
- Keep measurement visible and legible without making it feel like compliance evidence.
- Reduce apparent control density by collapsing secondary controls into drawers and mode-specific panels.
- Move verification, certificates, audit trail, and project-stack explanation out of the primary path.
- Preserve existing engine wiring, source tabs, export buttons, model chat, perception JSON, and certificate functionality.
- Keep desktop and mobile layouts usable without horizontal scroll.

## Non-Goals

- Do not rewrite Studio engines or rendering logic.
- Do not remove certificate, audit, export, or model-connect capabilities.
- Do not split Studio into multiple public pages in this pass.
- Do not redesign the entire site shell outside changes needed for Studio consistency.

## Current Problems

The current three-column layout gives the left rail, center canvas, and right panel roughly equal weight. The right panel leads with model-facing and certificate language, and the page includes a full feature-stack section before the user has spent time with the media. The source picker uses category labels such as Create, Observe, and Verify; the "Verify" grouping reinforces the wrong first impression. Chat is visually heavy and competes with the measurements. On large screens, the canvas is framed like a preview instead of the primary surface.

## Proposed Structure

### 1. Studio Shell

Desktop layout becomes a media-first shell:

- Top: existing site nav remains.
- Main: a dominant canvas stage occupying most available width and height.
- Left: compact source switcher, narrower and quieter than today.
- Right: Live Perception panel, not a verification panel.
- Bottom or below-canvas: compact render toolbar with the most common actions.

The canvas should feel like the hero. Its frame should be less card-like, with cleaner integration into the surrounding generative background. The toolbar should be visually subordinate and use concise labels.

### 2. Source Picker

The left rail should act as a mode picker and control drawer:

- Rename the source menu mental model from category-heavy to media-oriented.
- Primary visible modes should emphasize what the user can experience: Atelier, Dimensions, Fractals, Music, Bring media, Watch, Physics, Showcase.
- Detailed source controls stay available, but only the active source should show its first important controls by default.
- Deeper parameters should sit in collapsed details sections.
- The rail introduction should be shortened to one sentence.

### 3. Live Perception Panel

The right panel should lead with measurement, not proof:

- First card: Live Perception summary, current source, size, hash, and plain-language readout.
- Second card: color grid, dominant colors, motion sparkline, visual/audio channels.
- Measurement labels should be user-facing and sensory: Color map, Motion, Structure, Balance, Audio, Source.
- Keep raw values available, but make them supporting data.

### 4. Receipts and Verification

Certificate, audit trail, and project-stack content should move to a secondary surface:

- Create a collapsed "Receipts" section beneath Live Perception.
- Put witnessed certificate, re-check, audit trail, and feature-stack details there.
- The section should remain accessible and functional, but should not dominate the first viewport.
- Certificate language should be neutral and compact in the Studio context.

### 5. Chat

Chat should be present but not dominant:

- Collapse chat by default on desktop or make it a compact lower dock.
- Keep question chips and text input.
- Preserve model connection controls inside Advanced.
- Chat copy should refer to "the frame" and "the measurements" rather than foregrounding verification.

### 6. Mobile

Mobile should be single-column and canvas-first:

- Source picker appears before the canvas only as a compact horizontal or wrapped control row.
- Canvas appears early and occupies most of the first viewport.
- Live Perception follows the canvas.
- Receipts and Advanced model controls stay collapsed.
- No horizontal scroll from toolbar, source buttons, measurement cards, or long hashes.

## Implementation Boundaries

This pass can be implemented mostly in HTML structure and CSS:

- Reorder sections within `studio.html`.
- Add Studio-specific classes for media-first layout.
- Update `system/system.css` Studio rules.
- Leave existing IDs intact so `system/studio.js` continues to bind controls.
- Avoid renaming IDs used by JavaScript.
- Keep hidden/export controls compatible with current scripts.
- Add or adjust tests only where they protect the new layout contract.

## Acceptance Criteria

- Desktop first viewport visually prioritizes the canvas over rails and proof panels.
- Right panel first visible content is Live Perception and measurement, not certificate/audit/project-stack content.
- Certificate and audit trail remain present but are collapsed or below primary measurement content.
- Source controls are less dense in the first view; deeper controls are available but visually secondary.
- Chat no longer dominates the right panel.
- Studio has no horizontal scroll on desktop or mobile.
- Visible buttons, source tabs, toolbar actions, and details summaries keep usable touch targets.
- Existing Studio scripts still load without console errors when served with correct `.mjs` MIME type.
- Existing tests continue to pass.

## Verification Plan

- Run `python -m pytest tests\test_portfolio_visual_contract.py`.
- Run `node --test system\*.test.mjs`.
- Run `node tests\linkcheck.mjs`.
- Use Chrome DevTools against local Studio to verify:
  - No console errors.
  - No horizontal overflow.
  - Canvas is dominant in desktop first viewport.
  - Live Perception appears before Receipts.
  - Mobile layout keeps source picker, canvas, perception, receipts, and chat in the intended order.

## Risks

- Studio has many existing JavaScript bindings by ID; structural changes must preserve those IDs.
- The local Python server serves `.mjs` as `text/plain`; Studio browser QA may need a MIME-correct local server for module checks.
- CSS overrides near the bottom of `system/system.css` are order-sensitive.

## Decision

Proceed with Option B: media-first Studio shell. Preserve existing functionality, but reframe the experience around rendered media and measured perception. Verification stays available as receipts, not the first impression.
