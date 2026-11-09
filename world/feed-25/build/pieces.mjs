// pieces.mjs: the registry of compositions. render(W, { plates }) -> { sheet, grain, meta }.
import { sheetOne, sheetTwo } from './pieces-sheets.mjs';
import { glyphField, staticWeather } from './pieces-glyph.mjs';

export const PIECES = {
  'sheet-one': { title: 'Sheet I, plate and crowd', render: async (W) => sheetOne(W) },
  'sheet-two': { title: 'Sheet II, archive carried', render: async (W, { plates }) => sheetTwo(W, plates) },
  'glyph-field': { title: 'Glyph field', render: async (W) => glyphField(W) },
  'static-weather': { title: 'Static weather', render: async (W) => staticWeather(W) },
};
