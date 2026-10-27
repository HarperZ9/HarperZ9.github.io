// The mission-control root, where the generators live beside this folder. Resolved from the page's own
// location when it sits under ui, or from <html data-workspace="..."> when a host serves
// the shell from somewhere else. Never guessed: if neither holds, generators are skipped and the components
// keep their procedural forms.
export function workspaceRoot() {
  const set = document.documentElement.dataset.workspace;
  if (set) return new URL(set, document.baseURI).href.replace(/\/?$/, "/");
  const here = import.meta.url, mark = "/ui/";
  if (here.includes(mark)) return here.slice(0, here.indexOf(mark) + 1);
  throw new Error("organic: workspace root unknown; set <html data-workspace>");
}
