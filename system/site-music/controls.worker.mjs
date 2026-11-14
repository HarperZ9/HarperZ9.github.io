// One share of the false-success controls, in a worker thread (see controls.test.mjs). It renders the two clean
// excerpts, plants the defects it was given, listens to each, and posts the readings back.
import { parentPort, workerData } from 'node:worker_threads';
import { runControls } from './controls.mjs';

const { clean, rows } = runControls({ seed: workerData.seed, only: workerData.only });
parentPort.postMessage({ clean, rows });
