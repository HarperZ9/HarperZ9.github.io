// settype.mjs: set a line in the house type (the forge masters via the super framework's type adapter) as a coverage
// mask. One shared setter, so the strata captions and the subtitle line use the same type path.
import { setText } from '../../superframe/adapters/type.mjs';
import { fillNonzero } from '../../superframe/lib/fill.mjs';

export const set = (style = 'text', weight = 420) => (text, w, h) => fillNonzero(setText(text, w, h, { style, weight, fill: 0.9 }).polys, w, h);
