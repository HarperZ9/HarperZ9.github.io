# Privacy

Telos's plugin runs on your computer. The publisher operates no backend, account or
inference service for it, and the plugin collects no telemetry or usage statistics.

**What it reads.** Files inside its own package, fixture data shipped with it, and,
for the room and workflow tools, sibling tool checkouts next to the package when they
exist.

**What it stores.** Nothing that outlives a call. The workflow check writes scratch
files in a temporary folder and removes them before it returns.

**What it runs.** Each tool starts a local Node.js script from the package with fixed
arguments. The room and workflow tools also start a local Python interpreter against
sibling checkouts. No tool on the packaged server writes to your files, opens a
network connection or drives a browser or application.

**Retention.** None.

**Third parties.** The connected client and its model see tool arguments and results
under that client's terms. Your model provider's privacy policy applies to what the
model reads.

**Support and security reports.** https://github.com/HarperZ9/telos/issues
