// css.cjs: pointer.css, the rules that hand each element its cursor image. Written by scripts/build-pointer.cjs.
'use strict';
const F = require('./forms.cjs');

const R = 'html.ptr:not(.plain)';
const PRESS = ':is(a[href],button,summary,label[for],select,[role="button"],[role="tab"],[role="switch"],[role="link"],input:is([type="checkbox"],[type="radio"],[type="button"],[type="submit"],[type="reset"],[type="file"],[type="color"]))';
const TEXT = ':is(input:is([type="text"],[type="search"],[type="email"],[type="url"],[type="number"],[type="password"],[type="tel"],:not([type])),textarea,[contenteditable="true"],[contenteditable=""])';
const DRAG = ':is(input[type="range"],[data-drag])';

function img(setting, name, hot) {
  const f = `/world/ui/shell/pointer/${setting}-${name}`;
  return `-webkit-image-set(url(${f}.png) 1x,url(${f}@2x.png) 2x) ${hot[0]} ${hot[1]}`;
}
function vars(setting) {
  const out = [];
  for (const [state, st] of Object.entries(F.STATES)) {
    if (F.SETTINGS[setting].hue && !F.HUE_STATES.includes(state)) continue;
    if (st.frames) for (let f = 0; f < st.frames; f++) out.push(`--p-${state}-${f}:${img(setting, `${state}-${f}`, st.hot)}`);
    else out.push(`--p-${state}:${img(setting, state, st.hot)}`);
  }
  return out.join(';');
}

function css() {
  const hues = Object.keys(F.HUES).map((h) => `${R} [data-hue="${h}"]${h === 'theplygrnd' ? `,${R} [data-hue="game"]` : ''}{${vars(h)}}`).join('\n');
  const busy = [0, 1, 2, 3].map((f) => `${f * 25}%{cursor:var(--p-busy-${f}),progress}`).join('');
  return `/* pointer.css: written by scripts/build-pointer.cjs; do not edit by hand. A stylus of measured materials as native
   cursor images, moved by the operating system. html.ptr is set by world/ui/shell/pointer.js for a fine pointer only,
   and never in Plain view, in forced colours, or after the visitor turns the drawn pointer off. Each rule ends in the
   system's own keyword. Day, night and sky choose the materials; a platform's colour is its barrel's lacquer. */
@supports (cursor:-webkit-image-set(url(a.png) 1x) 1 1,auto){
@media (pointer:fine) and (forced-colors:none){
${R}{${vars('day')}}
@media (prefers-color-scheme:dark){${R}:not([data-theme="light"]){${vars('night')}}}
${R}[data-theme="dark"]{${vars('night')}}
${R}[data-ptr-sky]{${vars('sky')}}
${hues}
${R},${R} [data-hue]{cursor:var(--p-rest),auto}
${R} ${PRESS}{cursor:var(--p-give),pointer}
${R} ${PRESS}:active{cursor:var(--p-pressed),pointer}
${R} :is(:disabled,[aria-disabled="true"]),${R} ${PRESS}:is(:disabled,[aria-disabled="true"]){cursor:var(--p-rest),not-allowed}
${R} ${DRAG}{cursor:var(--p-reach),grab}
${R} ${DRAG}:active{cursor:var(--p-hold),grabbing}
${R} ${TEXT}{cursor:var(--p-text),text}
${R} [aria-busy="true"]{cursor:var(--p-busy-0),progress}
@keyframes ptr-busy{${busy}}
@media (prefers-reduced-motion:no-preference){${R}:not(.alive-still) [aria-busy="true"]{animation:ptr-busy .8s steps(1) infinite}}
}
}
/* the glow: an optional light under the nib, on its own compositor layer, moved by transform only (pointer.js) */
.ptr-glow{--ptr-light:rgb(255 250 240 / .9);position:fixed;left:0;top:0;width:44px;height:44px;margin:-16px 0 0 -16px;border-radius:50%;pointer-events:none;z-index:2147483646;background:radial-gradient(closest-side,var(--ptr-light),transparent);opacity:.32;will-change:transform;contain:strict}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .ptr-glow{--ptr-light:rgb(255 182 107 / .9)}}
html[data-theme="dark"] .ptr-glow{--ptr-light:rgb(255 182 107 / .9)}
html[data-ptr-sky] .ptr-glow{--ptr-light:rgb(190 220 255 / .9)}
html.plain .ptr-glow,html.alive-still .ptr-glow,html:not(.ptr) .ptr-glow{display:none}
@media (prefers-reduced-motion:reduce),(forced-colors:active){.ptr-glow{display:none}}
`;
}

module.exports = { css, PRESS, TEXT, DRAG };
