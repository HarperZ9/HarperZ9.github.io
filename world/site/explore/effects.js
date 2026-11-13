// effects.js: the BuildLang page's first step, played in place. A function reads a file and prints; the reader
// chooses what its signature declares and sees, at once, whether it builds. The rule is BuildLang's (docs/
// EFFECTS_GUIDE.md: read_file is FileSystem, println! is Console, effects join with +); the messages follow the
// wording buildc check printed for the captured case on this page. It is a model of the rule, worked in the page.
const host = document.querySelector('[data-toy="effects"]');
if (host) {
  const EFFECTS = [["FileSystem", "read_file"], ["Console", "println!"]];
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  host.innerHTML = `<fieldset class="toy-set"><legend>Declare what <code>load_config</code> may touch</legend>
${EFFECTS.map(([e]) => `<label class="toy-pick"><input type="checkbox" value="${e}"> <code>${e}</code></label>`).join("")}
</fieldset>
<pre class="lp-code toy-code" aria-label="The function"><code></code></pre>
<p class="toy-verdict" aria-live="polite"></p>
<pre class="lp-code toy-out" aria-label="What buildc check says"><code></code></pre>`;
  const code = host.querySelector(".toy-code code"), out = host.querySelector(".toy-out code"), verdict = host.querySelector(".toy-verdict");
  function show() {
    const declared = [...host.querySelectorAll("input:checked")].map((i) => i.value);
    const sig = declared.length ? ` ~ ${declared.join(" + ")}` : "";
    code.innerHTML = esc(`fn load_config()${sig} {\n    println!("{}", read_file("ops.toml"));\n}`);
    const missing = EFFECTS.filter(([e]) => !declared.includes(e));
    if (!missing.length) {
      verdict.textContent = "It builds: every effect the body performs is in the signature.";
      verdict.dataset.ok = "1";
      out.textContent = "$ buildc check load_config.bld\nType checking... OK";
    } else {
      verdict.textContent = `It does not build: ${missing.map(([e]) => e).join(" and ")} ${missing.length === 1 ? "is" : "are"} performed and not declared.`;
      verdict.dataset.ok = "0";
      out.textContent = "$ buildc check load_config.bld\n" + missing.map(([e, call]) =>
        `function \`load_config\` performs effect \`${e}\` but does not declare it\nhelp: add ~ ${e} to the signature\nnote: capability \`${e}\` was triggered by ambient call(s): ${call}`).join("\n\n");
    }
  }
  host.addEventListener("change", show);
  show();
}
