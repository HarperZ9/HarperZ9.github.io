// lib/medium/index.mjs: the medium as one import. Medium.prototype.view is attached here so the class file stays
// free of the analysis views it does not need to step the physics.
import { Medium, DT, LAWS } from './medium.mjs';
import { KINDS, absorb } from './additives.mjs';
import { render, LOOK } from './render.mjs';
import { view, stack, exploded, core, mosaicView, exportSheets, SHEETS, PLANES, printSheets, sheetLaw, WEBER, DENSITY_W, TRAP } from './view.mjs';
import { composite, SHEET_LAWS } from './sheets.mjs';
import { tank, tankAdditives, still, loop } from './scenes.mjs';
import { additivesFromPort } from './ports.mjs';

Medium.prototype.view = function (opts) { return view(this, opts); };
Medium.prototype.render = function (W, H, opts) { return render(this, W, H, opts); };
Medium.prototype.core = function (x, y) { return core(this, x, y); };

import { ART, artTank, fitView } from './artscenes.mjs';
export { ART, artTank, fitView };
export { Medium, DT, LAWS, KINDS, absorb, render, LOOK, view, stack, exploded, core, mosaicView, exportSheets, SHEETS, PLANES, printSheets, sheetLaw, composite, SHEET_LAWS, WEBER, DENSITY_W, TRAP, tank, tankAdditives, still, loop, additivesFromPort };
