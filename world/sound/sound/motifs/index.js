// All motifs in one registry. Exhibit pages import { MOTIFS, play } from 'sound/motifs/index.js'
// or import a single module, for example: import * as thought from 'sound/motifs/thought.js'.
import * as falseScale from './false-scale.js';
import * as crowdOfOne from './crowd-of-one.js';
import * as vanishingRecord from './vanishing-record.js';
import * as momentum from './momentum.js';
import * as thought from './thought.js';
import * as trauma from './trauma.js';
import * as pain from './pain.js';
import * as longing from './longing.js';
import * as memory from './memory.js';
import * as shepard from './shepard.js';
import * as phantomWords from './phantom-words.js';
import * as spectrogramPicture from './spectrogram-picture.js';

export const MOTIFS = { 'false-scale': falseScale, 'crowd-of-one': crowdOfOne, 'vanishing-record': vanishingRecord, momentum, thought, trauma, pain, longing, memory, shepard, 'phantom-words': phantomWords, 'spectrogram-picture': spectrogramPicture };
export const play = (engine, id, opts) => MOTIFS[id].play(engine, opts);
export const list = () => Object.entries(MOTIFS).map(([id, m]) => ({ id, ...m.meta }));
export { falseScale, crowdOfOne, vanishingRecord, momentum, thought, trauma, pain, longing, memory, shepard, phantomWords, spectrogramPicture };
