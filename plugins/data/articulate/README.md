## Marketplace source distribution

This folder packages the source plugin from release 0.6.0. It requires Python 3.9 or later, available as `python3`. It includes the tool source and no model or bundled runtime. The connected client supplies any model used in the conversation.

The separate [Windows x64 native download](https://github.com/HarperZ9/articulate/releases/download/v0.6.0/articulate-writing-0.6.0-win-x64.mcpb) includes its runtime. That download is a manual MCPB package and is not part of this source plugin. Directory approval and availability remain unverified.

This branch contains the installable plugin. Build commands in the release README below apply to the [product source tag](https://github.com/HarperZ9/articulate/tree/v0.6.0). DISTRIBUTION.json records the published asset digest and every packaging change; any SOURCE.json describes the original release payload.

# Articulate Writing

Articulate Writing checks prose on your computer before you ship it. It names
writing patterns such as filler openers, stacked hedges and unsupported
superlatives, shows the line and the words where each one occurs, and gives the
label explaining each pattern. Use it on documentation, READMEs, release notes,
commit messages and drafts. The checker runs on your computer and sends the text
nowhere; the calling model reads the text as part of your conversation.

## What you get

- `check` returns each HIGH and MEDIUM finding with its rule, tier, line, span
  and label, a count of LOW advisories (`advisory_count`), `clean` and `verdict`
  (`clean` or `flagged`), a heuristic `texture_score` and cadence statistics. A
  long document returns the first 50 span records by default and never more
  than about 30,000 characters of them; the verdict and counts cover the full check;
  `hits_omitted` reports omitted span records.
- `score` returns the heuristic 0-100 `texture_score`, `hard_hits`, `advisories`,
  word count, passive-voice and adverb rates, and a uniform-cadence flag.
- `edit_plan` prepares findings, protected spans, `masked_text`, editing
  instructions and a `plan_id` for the calling model. `edit_submit` takes the
  original text, the model's masked rewrite and that token, restores masks,
  guards protected spans and returns accepted text with a host receipt.
- `fix`, `judge` and `polish` run offline in the plugin: `auto` or `host` returns
  a host plan, and `none` runs deterministic checks or edits. Explicit network,
  subprocess and sampling backends are refused before execution.
- `articulate.status` reports the server version, and `articulate.doctor`
  reports a setup summary you can paste into an issue.
- The `prose-review` skill tells the calling model when to run the checks, how to report
  them, and to propose an edit only where you want one. The `prose-edit` skill
  uses the host-edit protocol, with a check-only fallback.

## Requirements

- A local Claude Code or Codex host. The server has automated Windows and Linux test coverage. Cowork
  also loads plugins, and this plugin has not been tested there. Chat on
  claude.ai loads the skill and does not start the local checker.
- Python 3.9 or later, runnable as `python3`. Nothing else to install: the
  plugin carries its own copy of the checker, which uses only the Python
  standard library.

## Install

This plugin targets package version 0.6.0. Build from its matching package tag as
[the build guide](https://github.com/HarperZ9/articulate/blob/release/0.5.x/docs/claude-plugin.md)
describes, then use the local build folder:

```bash
claude plugin marketplace add ./build/claude-plugin
claude plugin install articulate-writing@articulate-writing
```

The same release also prepares Windows x64 native ZIP and binary MCPB packages
with a Python runtime included. See the
[native package guide](https://github.com/HarperZ9/articulate/blob/release/0.5.x/docs/native-local-package.md).
Those packages are separate from this source plugin. Both forms include no model
and use the calling model for host edits. Native client installation and
marketplace acceptance remain unverified.

Restart Claude Code, then run `/mcp`. The `articulate` server shows as
connected.

For Codex, add the built folder through a repo or personal marketplace as
[the build guide](https://github.com/HarperZ9/articulate/blob/release/0.5.x/docs/claude-plugin.md)
shows. Portable hosts read `plugin.json` and `mcp.json`; older Codex hosts use
the compatibility manifest. Client installation still needs a local Python
process. This does not provide a checker in an ordinary web chat.

## Try it

- "Check the prose in docs/guide.md and explain each finding with its
  label."
- "Score this release note and report the structural rates." (Paste the
  note after the request.)
- "Review my commit message draft for filler and hedging, and suggest edits only
  for the blocking findings." (Paste the draft after the request.)

## What it runs

| What | Detail |
|:-|:-|
| Processes | One: `python3 -I -S -B -X utf8` running the plugin's `server/serve.py`. Claude Code starts it with the session and stops it at the end. It runs the first `python3` on your PATH, which is a virtual environment's Python when you have one activated. |
| Files | It loads its own source from the plugin folder and the Python standard library, and no installed package: `-S` skips every site-packages folder. It opens none of your files and writes no file: no log, no cache, no bytecode. |
| Network | None. It opens no connection. |
| Other programs | None. |
| Settings | It sets `ARTICULATE_MCP_TOOLS=local` and `ARTICULATE_LOCAL_ONLY=1` for its own process and changes no host setting. |

The package supports optional external editing backends outside this plugin.
The plugin settings restrict editor tools to host plans and deterministic work.
A host plan asks the model already in your conversation to write the rewrite;
the plugin does not call another model.

## Privacy Policy

Last updated: 2026-09-30. This policy covers the Articulate Writing plugin for
local Claude Code and Codex hosts. It is also published at
https://github.com/HarperZ9/articulate/blob/release/0.5.x/claude-plugin/PRIVACY.md.

**Data collected.** The plugin reads only the text the calling host passes to
one of its tools. It does not read your files, conversation history or saved
memory. It collects no account details, usage statistics or telemetry.

**Use and storage.** The plugin checks text and prepares or validates host edits
in memory on your computer, then returns the result to the host. It writes no
log, cache or copy of the text to disk.

**Third-party sharing.** The plugin opens no network connection and starts no
other program. The calling host already has the text in the conversation and
may send it to its model provider. That provider's privacy policy and your
account settings govern the conversation and tool results. No second model
account is needed by the plugin.

**Retention.** The plugin writes no persistent copy of the text, log or cache.
Request and response text can remain in process memory during the server session.
The host may retain conversation text and tool results locally or remotely;
its settings and provider terms govern those copies.

**Contact.** Ask a question about this policy or the plugin at
https://github.com/HarperZ9/articulate/issues. Report a security problem
privately through the repository's security advisory reporting page.

**Changes.** A change to this policy ships in a new plugin version with a new
date above, and the changelog at
https://github.com/HarperZ9/articulate/blob/release/0.5.x/CHANGELOG.md lists it.

## Troubleshooting

**The `articulate` server shows as failed in `/mcp`.** Claude Code could not
start `python3`, or the Python it found is too old. Check with `python3
--version` in a terminal.

- Windows, "Python was not found" or a Microsoft Store window: install the
  Python install manager, which provides `python3`. The traditional python.org
  installer provides `python` and no `python3`. Restart Claude Code afterwards.
- macOS, a prompt to install the command line developer tools: accept it, or
  install Python from python.org or Homebrew. The plugin has not been tested on
  macOS yet.
- Linux: install the `python3` package with your distribution's package
  manager.
- "needs Python 3.9 or later": install a newer Python 3 and restart Claude
  Code.

**The tools are listed and a call fails.** Ask Claude to run the Articulate
doctor tool. It reports the plugin version, the Python version and which tools
are listed, with no file paths. Paste that report into an issue.

## Limits

- A protected-span guard and detector gate do not prove semantic equivalence,
  quality or factual correctness. Inspect refused edits and review meaning.
- `texture_score` is a heuristic. It does not estimate the probability that a
  model wrote the text.

- The rules are written for English prose. Text in other languages gets few or
  no findings, and a clean result there says nothing about the writing.
- These findings name prose patterns and where they occur. They do not show who
  or what wrote the text, and no finding or count is a basis for an accusation.

## Support and license

Report a problem or ask a question at
https://github.com/HarperZ9/articulate/issues.

Articulate Writing is source-available under the Functional Source License 1.1
with the MIT future license (`FSL-1.1-MIT`): each release becomes available
under the MIT license on the second anniversary of its release. See `LICENSE`.
