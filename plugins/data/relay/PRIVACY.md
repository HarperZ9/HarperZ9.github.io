# Privacy

Relay runs on the user's computer. The publisher operates no backend for this package.
The connected client and its model can see tool arguments and results under that client's terms.
No model is included. Any model endpoint configured by the user belongs to that user.
Local access is granted to the running process by the operating system; a client permission dialog is not an OS sandbox.
Do not connect private stores or directories to an untrusted client. Stop the client process to disconnect.

## What it reads, stores and sends

Relay reads files under the project folder you select at install. File writes and
command execution are off unless the person who installs the plugin turns them on.
Chat and agent runs send your prompt and the project content the run selects to the
model endpoint you configured, such as a local Ollama server; Relay ships no endpoint
of its own. Saved sessions go in `RELAY_SESSION_DIR`, or by default a `relay/sessions`
folder under `%LOCALAPPDATA%` on Windows, `~/Library/Application Support` on macOS or
`~/.local/share` on Linux. Relay collects no usage statistics.

## Retention and support

Sessions and saved runs stay until you delete them. Your model provider's privacy
policy covers what you send to it. Support and security reports:
https://github.com/HarperZ9/relay/issues
