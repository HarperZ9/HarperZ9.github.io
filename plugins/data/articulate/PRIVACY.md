# Privacy Policy

Last updated: 2026-10-01. This policy covers the Articulate Writing plugin for
local Claude Code and Codex hosts. It is also published at
https://github.com/HarperZ9/articulate/blob/release/0.5.x/claude-plugin/PRIVACY.md.

### What this plugin runs and handles

**Hooks.** The plugin has one hook. After Claude writes or edits a file (the PostToolUse event for Write, Edit, MultiEdit and apply_patch), Claude Code runs `python3 -I -S -B -X utf8 "${CLAUDE_PLUGIN_ROOT}/server/edit_hook.py"` for up to 15 seconds. The hook reads the edit event Claude Code sends on standard input, which holds the file name and the text before and after the edit. For prose files (.md, .txt, .rst, .tex and similar) it returns advice about changed meaning and style to Claude. It opens no file, writes no file, starts no program and makes no network call. It never blocks the edit. Claude Code's event also carries the session ID, the path of the conversation transcript and the working folder. The hook ignores them and never opens the transcript.

**MCP server.** The plugin starts one local MCP server named `articulate` with `python3 -I -S -B -X utf8 ${CLAUDE_PLUGIN_ROOT}/server/serve.py`. `${CLAUDE_PLUGIN_ROOT}` is the folder where Claude Code installed the plugin. The launch sets two environment values: `ARTICULATE_MCP_TOOLS=local` and `ARTICULATE_LOCAL_ONLY=1`. The server talks to Claude Code over standard input and output only.

**Network.** With those two values, every tool runs on your computer. The server opens no network connection and sends nothing to the author or to any other service. Claude still reads the text as part of your conversation, and your Claude provider handles that conversation.

**Bundled code that stays off.** The bundled source also holds optional model backends from the Articulate command line tool. Those backends read `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ARTICULATE_OPENAI_API_KEY` and other `ARTICULATE_*` settings, and they call a model provider or a local Ollama server. The plugin's launch value `ARTICULATE_MCP_TOOLS=local` sends every tool to its local path, so the plugin never calls those backends and never reads those keys.

**Files it writes.** None. The `-B` flag keeps Python from writing bytecode into the plugin folder.

**Environment variables and credentials.** The server reads `ARTICULATE_MCP_TOOLS` and `ARTICULATE_LOCAL_ONLY`, which the plugin sets itself. The hook reads `ARTICULATE_EDIT_HOOK` from your environment; set it to `off` to turn the hook off. Neither reads a credential. The `-I` flag also makes Python ignore its own `PYTHON*` variables.

**Data collected.** The plugin reads only the text the calling host passes to
one of its tools, and the edit event the host passes to its hook after the
model writes or edits a file. It does not open your files or read conversation
history or saved memory. It collects no account details, usage statistics or telemetry.

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
