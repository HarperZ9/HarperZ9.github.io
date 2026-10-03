// The schema.org JSON-LD on the record pages rendered from system/systems.json.
// The hand-authored pages get theirs from tools/structured_data.py, which builds
// the same SoftwareSourceCode and BreadcrumbList shapes; tests/test_structured_data.py
// checks that the two stay alike.
//
// Every value comes from the record itself. Version numbers are left out on
// purpose, because they change faster than this markup is rendered.

export const ORIGIN = "https://harperz9.github.io";
const PERSON_ID = `${ORIGIN}/#person`;

function authorRef() {
  return { "@id": PERSON_ID, "@type": "Person", name: "Zain Dana Harper" };
}

// A public GitHub repository is the only source this markup will name.
export function isPublicSource(href) {
  return typeof href === "string" && href.startsWith("https://github.com/HarperZ9/");
}

export function softwareNode(system, url) {
  return {
    "@type": "SoftwareSourceCode",
    "@id": `${url}#software`,
    name: system.name,
    description: system.purpose,
    url,
    codeRepository: system.sourceHref,
    author: authorRef(),
  };
}

export function breadcrumbNode(trail) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  };
}

// JSON inside a script element must not contain "</". Escaping every "<" keeps
// the payload valid JSON and inert as HTML.
export function ldScript(graph) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  return `<script type="application/ld+json">${json.replace(/</g, "\\u003c")}</script>`;
}
