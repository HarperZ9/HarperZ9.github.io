# Explainer guides

Three characters host the explainer films and lessons. Each one carries the film's mechanism in its body, and each lives in one of the three style templates (ADR 0016).

| Guide | What it is | Home style | The mechanism in its body |
|---|---|---|---|
| Tallow | A night clerk whose head is a lit candle | Retro thriller | The wax is the budget of hours; the flame is what has been checked |
| Pylon | A harbour seal in a traffic cone, the town's claims inspector | Painted isometric | A cone marks a claim nobody has checked yet |
| Rerun | A hermit crab with a glass prism for a shell | Pixel 2.5D | The shell is the evidence a claim carries with it |

Every guide can stand in every world, at three framings (wide, medium, close), and in four clips (idle, talk, signature action, a narrated introduction).

## Files

| Path | What it holds |
|---|---|
| `rig.mjs` | The 2D rig: a pose is a list of filled vector parts, with path, gradient and ellipse helpers. |
| `tallow.mjs`, `pylon.mjs`, `rerun.mjs` | Each guide's parts, its props and its test switches. |
| `guides.mjs` | The registry: parts, sheet poses, how each guide lights a scene. |
| `beats.mjs` | Props and on-screen key terms for each guide's beat in each world, and the Night Shift lesson still. |
| `motion.mjs` | Clips and secondary motion: a damped spring for the coat, flame, whiskers and stalks; overlap; squash and stretch; camera moves. |
| `intro.mjs` | The narrated introductions: poses timed to sentences, cuts between framings. |
| `intros/*.mouth.json` | Mouth curves measured from each guide's approved voice take (Tallow round 7, Pylon round 7, Rerun round 11). |
| `look.mjs` | Each world's post stack (film and halation, oil paint, palette and dither), all from the engine's own passes. |
| `sets.mjs` | The thriller's night desk. |
| `worlds/` | The painted harbour (built from an isometric map with `iso_kit.mjs`) and the pixel tidepool (six parallax depths, a fixed shore palette, its own tiles and sprites), plus the pixel portraits. |
| `stage.mjs` | A shot: a guide posed in a world, with its look. `shots/*.mjs` are the fixed shots; `clips/clip.mjs` takes its clip from the URL. |

## Render

Every render runs on Chrome's CPU WebGPU adapter by default, so no GPU is needed.

    python tools/guides/render_all.py --out DIR           # every shot as a still, and a contact sheet
    python tools/guides/render_clips.py --out DIR         # the motion clips and a reel

A painted still takes its type from a separate layer (`?layer=hud-black` and `?layer=hud-white`), because the paint pass would otherwise paint the letters. `tools/guides/post_still.mjs` recovers the type's coverage from the pair and lays it over the art.

## Tests

    node --test templates/guides/motion.test.mjs templates/guides/guides.test.mjs templates/guides/worlds/worlds.test.mjs

CI runs them with every other node test.

## Rules the guides keep

- The guide never decides for the viewer. It asks, waits, and shows the source.
- A reaction stands for something. A flame that gutters, a head tilt or a sideways scuttle marks an estimate or a range, and appears only where the claim is one.
- No streaks, reward drips, autoplay chains or guilt lines. A film or a lesson ends, and the guide lets the viewer go.
- The voices are synthesized, and every surface that plays one says so.
