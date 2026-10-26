// living/passages.mjs: the specimen's passages, one word each, walked through its stops (also read by the OCR set).
export const PASSAGES = [
  { id: 'water', title: 'Water', stops: [{ state: 'ink', text: 'water' }, { state: 'charcoal' }, { state: 'plant' }, { state: 'paint' }, { state: 'ink', text: 'wæter', lang: 'ang', note: 'Old English' }] },
  { id: 'signal', title: 'Signal', stops: [{ state: 'pixel', text: 'signal' }, { state: 'ink' }, { state: 'engraved' }, { state: 'pixel' }] },
  { id: 'leaf', title: 'Leaf', stops: [{ state: 'code', text: 'leaf' }, { state: 'illustration' }, { state: 'plant' }] },
  { id: 'still', title: 'Still', stops: [{ state: 'print', text: 'still' }, { state: 'print-live' }, { state: 'print' }] },
  { id: 'engrave', title: 'Engrave', stops: [{ state: 'ink', text: 'engrave' }, { state: 'burin', params: { lines: 4 } }, { state: 'burin', params: { lines: 6 }, animate: { param: 'lines', from: 4, to: 8, timing: { curves: [{ curve: 'heartbeat', weight: 1, params: { bpm: 18 } }] } } }] },
  { id: 'name', title: 'Name', fit: true, stops: [{ state: 'tiles-code', text: 'Zain Dana Harper' }, { state: 'ink' }, { state: 'charcoal' }] },
];
