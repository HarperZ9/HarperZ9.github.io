// hand-labels.mjs: every control in the hand says what it does, in a word under its form (the author, 2026-11-03,
// on the icons: "I can't really tell what each one does either"). The word is the control's accessible name, so
// what a reader sees is what a screen reader or voice control hears. Shapes stay; no boxes or pills.
const WORDS = [
  [/(<a data-o="band"[^>]*?) aria-label="The map"><\/a>/, '$1><span class="o-name">Map</span></a>'],
  [/<span class="o-name">Menu \(M\)<\/span>/, '<span class="o-name">Places</span>'],
  [/(data-o="fold" aria-controls="o-menu")/, '$1 aria-keyshortcuts="m"'],
  [/<span class="o-name">Lamp<\/span>/, '<span class="o-name">Day</span>'],
  [/<span class="o-name">Plain view<\/span>/, '<span class="o-name">Plain</span>'],
];
// a control whose form clips its own content (the peel's folded corner, the motion thumbnail) keeps its name inside
// for assistive technology and shows the same word beside it, outside the clip
const OUTSIDE = [[/<button type="button" data-o="peel"[\s\S]*?<\/button>/, "Plain"], [/<button type="button" class="o-motion[\s\S]*?<\/button>/, "Motion"]];
export function labelHand(html) {
  let out = html;
  for (const [re, to] of WORDS) out = out.replace(re, to);
  for (const [re, word] of OUTSIDE) out = out.replace(re, (b) => `<span class="o-cell">${b}<span class="o-under" aria-hidden="true">${word}</span></span>`);
  return out.replace(/<header class="o-hand"/, '<header class="o-hand o-said"');
}
