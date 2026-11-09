// Report helpers for lesson K23: the sources with what they claim, and the
// lab's measurement plan (shared with tools/school/measure_fused.mjs).

export function sourcesBlock() {
  return {
    about: "What the sources claim, read for this lesson (arXiv PDFs read in full; the WGSL and WebGPU specifications are W3C Candidate Recommendation Drafts of September 2026). Every count in the other blocks is this lesson's own emulator on its own kernels; none of it is a measurement of the papers' GPUs. Differences: the kernels here run one head, without masking (the JavaScript tiled attention also runs causal), keep the query loop outside and the key loop inside (the order of FlashAttention-2, not Algorithm 1's outer loop over K and V), and write only O, not the statistics m and l that Algorithm 1 keeps in HBM for the backward pass.",
    flashAttention: {
      cite: "Dao, Fu, Ermon, Rudra and Re, FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness, NeurIPS 2022, arXiv:2205.14135",
      claims: [
        "Algorithm 0 (section 2.2): load Q, K by blocks, compute S = Q K^T, write S to HBM; read S, compute P = softmax(S), write P to HBM; load P and V by blocks, compute O = P V, write O",
        "Algorithm 1 (section 3.1): block sizes Bc = ceil(M / 4d), Br = min(ceil(M / 4d), d) for on-chip SRAM of size M; O, l and m live in HBM and are written back after each block",
        "section 3.1: softmax is computed one block at a time by keeping the statistics m(x) and l(x) and rescaling by e^(m(x_i) - m(x))",
        "Theorem 1: exact attention with O(N^2 d) FLOPs and O(N) additional memory",
        "Theorem 2: with d <= M <= N d, standard attention needs Theta(N d + N^2) HBM accesses and FlashAttention Theta(N^2 d^2 / M)",
        "Proposition 3: no exact attention algorithm needs o(N^2 d^2 / M) HBM accesses for all M in [d, N d]",
        "section 2.1: an A100 has 40 to 80 GB of HBM at 1.5 to 2.0 TB/s and 192 KB of SRAM per each of 108 streaming multiprocessors, SRAM bandwidth estimated around 19 TB/s",
        "Figure 2 (A100, GPT-2 medium, N 1024, d 64, 16 heads, batch 64): HBM reads and writes 40.3 GB standard against 4.4 GB FlashAttention; runtime 41.7 ms against 7.3 ms; 66.6 against 75.2 GFLOPs",
        "abstract and section 4: 15 percent end-to-end speedup on BERT-large (N 512) against the MLPerf 1.1 record; 3x on GPT-2 (N 1K) against HuggingFace, 1.8x against Megatron; memory linear in N",
      ],
    },
    onlineSoftmax: {
      cite: "Milakov and Gimelshein, Online normalizer calculation for softmax, arXiv:1805.02867 (v2, 2018, a preprint)",
      claims: [
        "Algorithm 3: m_j = max(m_(j-1), x_j); d_j = d_(j-1) e^(m_(j-1) - m_j) + e^(x_j - m_j), with m_0 = -infinity and d_0 = 0; Theorem 1 proves d_V = sum_j e^(x_j - m_V)",
        "section 2: the safe softmax (max, then sum, then divide) makes 4 memory accesses per element; the naive one makes 3 but is unsafe; section 3: the online normaliser brings the safe one to 3",
        "section 3.1: the (m, d) pairs combine with an associative, commutative operator, so the reduction can run in parallel",
        "section 5 (Tesla V100 PCIe 16 GB, fp32): softmax up to 1.3x faster at large vectors (about V 4000, batch 4000); softmax and top-k fused up to 5x",
      ],
    },
    higham: { cite: "Higham, Accuracy and Stability of Numerical Algorithms, 2nd ed., SIAM 2002, equation 3.5", use: "gamma_n = n u / (1 - n u) bounds a float inner product of length n; it is used for the score and sum terms of the bound in fused.mjs. The bound as a whole is derived for this lesson, first order in u, and is not a theorem from the book." },
    wgsl: { cite: "WebGPU Shading Language, W3C Candidate Recommendation Draft 21 September 2026, section 15.7.4.1 Accuracy of Concrete Floating Point Expressions", exp: "exp(x) in f32: 3 + 2 |x| ULP (in f16: 1 + 2 |x| ULP)", use: "the bound allows this exp error, so a GPU's exp is held to the same check as the emulator's" },
    webgpu: { cite: "WebGPU, W3C Candidate Recommendation Draft 15 September 2026, section 3.6.2 Limits", maxComputeWorkgroupStorageSize: 16384 },
  };
}

// What the lab measures on the reader's GPU. The film never shows these.
export function plan() {
  return {
    about: "The lab's measurement, run only in a browser on the reader's own GPU through WebGPU (system/school/fused-gpu.mjs, runAttention). For each variant and size it first checks O against the float64 reference within the bound in fused.mjs (every row up to N = 1024, the first 64 rows above that, and it says which), then times reps runs after one warm-up and reports the median wall time from submit to onSubmittedWorkDone (submission overhead included). Every result is labelled with the adapter's vendor, architecture and description. It is not run by the fill or the tests, and the GPU is not used while another job holds it.",
    sizes: [256, 512, 1024, 2048, 4096], heads: [16, 64], kinds: ["unfused", "fused", "broken"], reps: 9, warmup: 1, rowsCheckedAbove1024: 64,
    measures: ["medianMs per run (unfused: three dispatches in one submit)", "fused over unfused speed ratio at each N and d", "checker result for every run, including the broken kernel"],
    predicts: "The emulator counts global traffic: the fused kernel saves exactly 4 N^2 floats (16 N^2 bytes), the score matrix written, read, written as P and read again. The traffic block gives that saving's share of the unfused traffic at each N and d. A measured speed ratio far from the traffic ratio says caches, launch overhead or arithmetic set the time, not global memory. The model gives counts, not times.",
  };
}
