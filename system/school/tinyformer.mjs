// Public entry point for the tiny transformer used by the attention lab and
// its explainer film. Pure ES modules, no DOM and no dependencies, so the same
// file trains in a browser tab, a worker, or Node.
//
//   tinyformer-ops.mjs    rng, dense layers, layer norm, GELU, softmax, base64
//   tinyformer-attn.mjs   causal multi-head attention, forward and backward
//   tinyformer-model.mjs  parameters, forward, manual backprop, FLOPS
//   tinyformer-train.mjs  AdamW, step trainer, evaluation, probes, weights JSON

export { rng } from "./tinyformer-ops.mjs";
export { DEFAULT_CONFIG, createModel, forward, lossAndGrad, lossOnly, FLOPS } from "./tinyformer-model.mjs";
export { CLIP_NORM, createAdamState, adam, createTrainer, train, evaluate, attentionOn, toJSON, fromJSON } from "./tinyformer-train.mjs";
