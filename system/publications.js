const tools = document.querySelector(".publication-tools");
const search = document.querySelector("#publication-search");
const filters = [...document.querySelectorAll("[data-publication-filter]")];
const entries = [...document.querySelectorAll("[data-publication-entry]")];
const empty = document.querySelector("[data-publication-empty]");
const resultCount = document.querySelector("[data-publication-result-count]");

if (tools && search && filters.length && entries.length && empty && resultCount) {
  tools.hidden = false;
  let topic = "all";

  const render = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;

    for (const entry of entries) {
      const topics = (entry.dataset.topics || "").toLocaleLowerCase().split(/\s+/);
      const matchesTopic = topic === "all" || topics.includes(topic);
      const matchesQuery = !query || entry.textContent.toLocaleLowerCase().includes(query);
      entry.hidden = !(matchesTopic && matchesQuery);
      if (!entry.hidden) visible += 1;
    }

    empty.hidden = visible !== 0;
    resultCount.textContent = `${visible} published ${visible === 1 ? "item" : "items"} shown.`;
  };

  search.addEventListener("input", render);
  for (const filter of filters) {
    filter.addEventListener("click", () => {
      topic = filter.dataset.publicationFilter || "all";
      for (const candidate of filters) {
        candidate.setAttribute("aria-pressed", String(candidate === filter));
      }
      render();
    });
  }
}
