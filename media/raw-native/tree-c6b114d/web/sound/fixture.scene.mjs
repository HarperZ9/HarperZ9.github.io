// SPDX-License-Identifier: FSL-1.1-MIT
// A minimal scene for the scene-sheet test: chapters, one asset read, and a sound() method.
export default {
  title: "Fixture", duration: 6, fps: 30, params: [], chapters: [],
  async load(ctx) {
    const sheet = await ctx.json("fixture.scene.json");
    this.chapters = [{ t: 0, title: "Start" }, { t: 2, title: "Middle" }, { t: 4, title: "End" }];
    return { marks: sheet.marks };
  },
  sound(ctx) { return ctx.assets.marks.map((t, k) => ({ t, type: "land", pitch: k, why: `mark ${k + 1} lands` })); },
};
