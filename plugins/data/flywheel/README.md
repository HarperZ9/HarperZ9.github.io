# Flywheel Evidence Task

A skill that turns a claim into a source-linked evidence packet. Give it a claim
about Flywheel or Bulletin, the sources it may use, and the decision the answer
should inform. It returns what was checked, what was only reported, what stays
unknown, the measurements behind each verdict, and a false-success control that
would have caught a wrong answer.

Version 0.2.0. License: [FSL-1.1-MIT](LICENSE).

## Try it

- Use flywheel-evidence-task to check the claim in this release note against its linked sources.
- Assess this Bulletin feedback thread and separate reported, checked and unknown claims.
- Check whether this readiness claim holds, with a false-success control.

## Install

In Claude Code:

```text
/plugin marketplace add HarperZ9/flywheel-evidence-task
/plugin install flywheel-evidence-task@flywheel-evidence-task
```

For another Agent Skills host, copy `skills/flywheel-evidence-task` into that
host's skill folder and keep its references and examples together. In Codex the
user skill folder is `~/.agents/skills`.

## Use

Ask Claude to use flywheel-evidence-task on a specific claim or feedback thread.
Name the sources it may read and the decision the result should inform. The
skill uses MCP tools such as Gather and Crucible when your client has them, and
works without them. It installs no server, copies no credential, and publishes
nothing on its own. See [the workflow](skills/flywheel-evidence-task/SKILL.md)
and its examples.

## What this plugin runs and handles

**Hooks.** This plugin has no hooks.

**MCP server.** This plugin has no MCP server and no launch command.

**Programs and scripts.** The plugin contains no program and no script. It is a skill: a SKILL.md file with instructions, one constraints reference, three examples, and a Codex presentation file (`agents/openai.yaml`). Nothing in it runs on your computer.

**Network.** The plugin opens no network connection and sends nothing to the author or to any other service.

**Files it reads.** None on its own. When you ask for a check, Claude reads the sources you name with the tools your Claude client already allows, such as file reads, web fetches or MCP servers you connected. Those tools follow their own settings and privacy terms.

**Files it writes.** None. Claude writes an evidence packet to a file only when you ask it to.

**Environment variables and credentials.** The plugin reads no environment variables and no credentials.

**Retention.** The plugin keeps nothing. Uninstalling it removes the skill files.

## Data and privacy

| Question | Answer |
| --- | --- |
| What it reads | Nothing on its own. Claude reads the sources you name with tools your client already allows |
| What it stores | Nothing. The plugin writes no file |
| Network calls | None. The plugin contains no program, server, hook or script |
| Telemetry | None |
| Retention | None. Uninstalling removes the skill files |

See [PRIVACY.md](PRIVACY.md).

## Source

This repository is the published copy of the plugin. Its source lives in the
Flywheel repository at `plugins/flywheel-evidence-task`
(https://github.com/HarperZ9/flywheel/tree/main/plugins/flywheel-evidence-task).
[SOURCE.md](SOURCE.md) names the Flywheel commit this copy was taken from and
the files that differ here. Report problems at
https://github.com/HarperZ9/flywheel-evidence-task/issues.
