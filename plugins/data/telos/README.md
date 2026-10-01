# Telos local client package

Telos reports the readiness of your local tool workbench and builds proof packets that a verifier can recompute.

## Try it

- Check Telos readiness.
- Show the Telos tool catalog.
- Build the agent action proof packet and tell me its verdict.

## Details

The source ZIP includes the tool source and one scoped skill. It requires an
installed Node.js 20+; this advanced source package is not self-contained.
Extract it to a persistent folder. Claude Code can load that plugin folder;
Codex-compatible loaders use plugin.json and mcp.json. For a generic local MCP
client, replace the plugin-root token with the absolute extraction path and
select the absolute runtime executable in that client's settings. Keep arguments
as a JSON array. This package never changes client settings automatically.

This package provides Telos itself. Sibling tools are optional, separately installed capabilities; missing tools remain unavailable. Native control, writes and network tools retain their existing permission checks and require matching user intent.

The connected client supplies the model and pays any model-provider charges.
There is no publisher-hosted inference, relay or account requirement. Installing
a plugin does not authorize network calls, execution, publishing or production
deployment. Local MCP support differs between clients; ChatGPT cloud and Claude
web connections and marketplace acceptance are not established by this archive.

Build locally with Python 3.11+:

```sh
python scripts/build_client_plugin.py --mode dev --out ../client-artifacts
```

Development filenames include -dev. Their source receipt records the base commit
and every payload hash. They are not previously published bytes even when their
embedded version matches a release. Release mode requires a clean checkout,
an exact source tag and a version ending in .0; the ordinary tool release gates
still apply. Builders refuse to overwrite existing archives.

A Windows x64 package can also include the reviewed Node v24.21.0 runtime:

```sh
python scripts/build_client_plugin.py --mode dev --out ../native-client-artifacts --node-runtime /path/to/reviewed/node
```

The runtime folder must contain node.exe and LICENSE matching the pinned hashes.
The builder downloads nothing. This emits a ZIP and a Claude Desktop MCPB with
the same source and runtime bytes. No separate Node installation is needed for
those Windows x64 artifacts. RUNTIME.json identifies the upstream archive and
license hashes. Other platforms, installation in actual clients and marketplace
approval need separate validation. The runtime is not a model.

To prepare the synthetic Index freshness probe from the Windows package, run
runtime/node.exe with server/demo/compat-fixture.mjs and an absolute new directory
as its arguments. The parent directory must exist. The helper refuses an existing
target and prints PROJECT_TELOS_COMPAT_FIXTURE; replace that placeholder in the
probe arguments with the printed path. Source packages use the installed Node
runtime for the same helper. This fixture checks bounded protocol compatibility;
it does not establish that a full repository fits the fixture's budget.
