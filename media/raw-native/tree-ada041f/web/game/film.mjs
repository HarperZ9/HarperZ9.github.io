// A game played as a film: the bridge that lets a template with a `game` run in the Motion
// player, the offline capture and the CI template check, where frame(t) must be a pure
// function of t. Pure: runs in Node.
//
// A game module (the `game` export of a template scene):
//   hz                      fixed steps per second (60 by default)
//   actions                 the default action map (input.mjs format)
//   init(seed, assets)      -> state
//   step(state, input, dt, assets) -> state
//   lerp(prev, curr, alpha) -> view state (optional)
//   view(viewState, assets, ctx) -> a Motion display list { background, camera, items, post }
//   demo(index, map)        -> the action frame of step index for the scripted demo (a film,
//                              the capture and the CI check play this; a person plays live)
//
// filmFrame(game, ctx, t) replays the demo from step 0 up to time t and draws the interpolated
// view, caching the session so a forward-moving film costs one step per 1 / hz seconds.
import { createSession } from "./loop.mjs";
import { createActionMap } from "./input.mjs";

const US = 1_000_000;

export function filmFrame(game, ctx, t, { seed = 1 } = {}) {
  const hz = game.hz || 60;
  const want = Math.round(t * US) * hz;                 // the same integer clock as the loop
  const steps = Math.floor(want / US), alpha = (want % US) / US;
  let c = ctx.gameFilm;
  if (!c || c.game !== game || c.session.loop.steps > steps) {
    const map = createActionMap(game.actions || {});
    c = ctx.gameFilm = { game, map, session: createSession(game, { seed, assets: ctx.assets, hz, maxSteps: Number.MAX_SAFE_INTEGER }) };
  }
  const s = c.session, input = (i) => game.demo(i, c.map);
  const need = steps - s.loop.steps;
  if (need > 0) s.stepN(need, input);
  // The interpolation factor is the film's position inside the current step.
  const view = game.lerp ? game.lerp(s.previous, s.state, need >= 0 ? alpha : 0) : s.state;
  return game.view(view, ctx.assets, ctx);
}
